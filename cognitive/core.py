"""Evidence-first cognitive memory with human review and bounded retrieval.

The library never invokes a model, REA, the network, or operating-system commands.
An observation is untrusted until an operator explicitly approves it. Feedback
updates a retrieval preference only; it never promotes observations or edits code.
"""
from __future__ import annotations

from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json
import math
import re
import sqlite3
from uuid import uuid4

_ORIGINS = frozenset({"operator", "web", "rea", "model", "test"})
_SCOPE = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
_WORD = re.compile(r"[a-z0-9]{2,}")


def _tokens(value: str) -> set[str]:
    return set(_WORD.findall(value.lower()))


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _bounded(value: str, name: str, limit: int) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f"{name} must contain 1 to {limit} characters")
    return value.strip()


def _scope(value: str) -> str:
    if not isinstance(value, str) or not _SCOPE.fullmatch(value):
        raise ValueError("scope must match [a-z][a-z0-9_-]{0,63}")
    return value


class CognitiveStore:
    """SQLite-backed, scoped observations and explicit feedback-adjusted recall."""

    def __init__(self, db_path: str | Path):
        self.path = Path(db_path).expanduser().resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS observations (
                    id TEXT PRIMARY KEY,
                    scope TEXT NOT NULL,
                    origin TEXT NOT NULL,
                    content TEXT NOT NULL,
                    evidence TEXT NOT NULL,
                    fingerprint TEXT NOT NULL,
                    state TEXT NOT NULL CHECK (state IN ('pending','approved','rejected')),
                    created_at TEXT NOT NULL,
                    reviewed_at TEXT,
                    reviewer TEXT,
                    reward_sum INTEGER NOT NULL DEFAULT 0,
                    feedback_count INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_observations_scope_state
                    ON observations(scope, state, created_at);
                CREATE TABLE IF NOT EXISTS feedback (
                    id TEXT PRIMARY KEY,
                    observation_id TEXT NOT NULL REFERENCES observations(id),
                    rating INTEGER NOT NULL CHECK (rating BETWEEN -1 AND 1),
                    reason TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
            """)

    @contextmanager
    def _db(self):
        db = sqlite3.connect(str(self.path), timeout=8)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=8000")
        try:
            with db:
                yield db
        finally:
            db.close()

    def propose(self, content: str, *, scope: str = "general", origin: str,
                evidence: str) -> dict:
        scope = _scope(scope)
        content = _bounded(content, "content", 4000)
        evidence = _bounded(evidence, "evidence", 1024)
        if origin not in _ORIGINS:
            raise ValueError("origin must be operator, web, rea, model, or test")
        identifier = uuid4().hex
        fingerprint = sha256(json.dumps([scope, origin, content, evidence],
                                        ensure_ascii=False).encode("utf-8")).hexdigest()
        with self._db() as db:
            db.execute("INSERT INTO observations"
                       "(id,scope,origin,content,evidence,fingerprint,state,created_at)"
                       " VALUES(?,?,?,?,?,?,?,?)",
                       (identifier, scope, origin, content, evidence, fingerprint,
                        "pending", _utc()))
        return {"id": identifier, "state": "pending", "scope": scope,
                "fingerprint": fingerprint, "trusted": False}

    def review(self, identifier: str, *, decision: str, reviewer: str) -> dict:
        if decision not in ("approved", "rejected"):
            raise ValueError("decision must be approved or rejected")
        reviewer = _bounded(reviewer, "reviewer", 100)
        with self._db() as db:
            change = db.execute("UPDATE observations SET state=?, reviewer=?, reviewed_at=?"
                                " WHERE id=? AND state='pending'",
                                (decision, reviewer, _utc(), identifier))
            if change.rowcount != 1:
                raise ValueError("observation not found or already reviewed")
        return {"id": identifier, "state": decision, "reviewer": reviewer}

    def inspect(self, identifier: str) -> dict:
        with self._db() as db:
            row = db.execute("SELECT * FROM observations WHERE id=?", (identifier,)).fetchone()
        if row is None:
            raise ValueError("observation not found")
        result = dict(row)
        result["trusted"] = result["state"] == "approved"
        return result

    def feedback(self, identifier: str, *, rating: int, reason: str) -> dict:
        if type(rating) is not int or rating not in (-1, 0, 1):
            raise ValueError("rating must be -1, 0, or 1")
        reason = _bounded(reason, "reason", 500)
        event = uuid4().hex
        with self._db() as db:
            change = db.execute("UPDATE observations SET reward_sum=reward_sum+?,"
                                " feedback_count=feedback_count+1"
                                " WHERE id=? AND state='approved'", (rating, identifier))
            if change.rowcount != 1:
                raise ValueError("feedback only applies to approved observations")
            db.execute("INSERT INTO feedback(id,observation_id,rating,reason,created_at)"
                       " VALUES(?,?,?,?,?)", (event, identifier, rating, reason, _utc()))
        return {"feedback_id": event, "observation_id": identifier,
                "recorded": True, "model_weights_updated": False}

    def recall(self, query: str, *, scope: str = "general", limit: int = 5) -> dict:
        scope = _scope(scope)
        query = _bounded(query, "query", 500)
        if type(limit) is not int or not 1 <= limit <= 10:
            raise ValueError("limit must be between 1 and 10")
        q = _tokens(query)
        if not q:
            return {"results": [], "scope": scope, "read_only": True}
        with self._db() as db:
            rows = db.execute("SELECT * FROM observations WHERE scope=?"
                              " AND state='approved' ORDER BY created_at DESC LIMIT 500",
                              (scope,)).fetchall()
        texts = [_tokens(row["content"]) for row in rows]
        df = Counter(term for tokens in texts for term in tokens)
        result = []
        for row, tokens in zip(rows, texts):
            hits = tokens.intersection(q)
            if not hits:
                continue
            # Local, deterministic lexical retrieval; bounded preference learned from feedback.
            lexical = sum(math.log(1 + (len(rows) + 1) / (1 + df[word]))
                          for word in hits) / math.sqrt(max(1, len(tokens)))
            count = row["feedback_count"]
            preference = (row["reward_sum"] / count) if count else 0.0
            score = round(lexical * (1 + 0.25 * preference), 6)
            result.append({"id": row["id"], "content": row["content"],
                           "origin": row["origin"], "evidence": row["evidence"],
                           "fingerprint": row["fingerprint"], "score": score,
                           "feedback_count": count, "trust": "operator-approved",
                           "untrusted_source": row["origin"] != "operator"})
        result.sort(key=lambda item: (-item["score"], item["id"]))
        return {"results": result[:limit], "scope": scope, "read_only": True,
                "retrieval": "lexical-feedback-v1", "considered": len(rows)}

    def stats(self, *, scope: str = "general") -> dict:
        scope = _scope(scope)
        with self._db() as db:
            values = db.execute("SELECT state, COUNT(*) AS n FROM observations"
                                " WHERE scope=? GROUP BY state", (scope,)).fetchall()
        return {"scope": scope, "states": {row["state"]: row["n"] for row in values}}
