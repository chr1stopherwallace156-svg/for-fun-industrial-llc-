"""Offline operator CLI for opt-in cognitive memory. No web server is started."""
from __future__ import annotations
import argparse
import json
from .core import CognitiveStore


def main() -> int:
    parser = argparse.ArgumentParser(description="Fun Industrial bounded cognitive memory")
    parser.add_argument("--db", required=True, help="Explicit SQLite database file path")
    commands = parser.add_subparsers(dest="command", required=True)
    propose = commands.add_parser("propose", help="Quarantine an unreviewed observation")
    propose.add_argument("--text", required=True)
    propose.add_argument("--origin", required=True, choices=["operator", "web", "rea", "model", "test"])
    propose.add_argument("--evidence", required=True)
    propose.add_argument("--scope", default="general")
    review = commands.add_parser("review", help="Human-operated approval or rejection")
    review.add_argument("id"); review.add_argument("--decision", required=True, choices=["approved", "rejected"])
    review.add_argument("--reviewer", required=True)
    recall = commands.add_parser("recall", help="Read approved memories only")
    recall.add_argument("--query", required=True); recall.add_argument("--scope", default="general")
    recall.add_argument("--limit", type=int, default=5)
    feedback = commands.add_parser("feedback", help="Record outcome-based retrieval preference")
    feedback.add_argument("id"); feedback.add_argument("--rating", required=True, type=int, choices=[-1,0,1])
    feedback.add_argument("--reason", required=True)
    inspect = commands.add_parser("inspect", help="Inspect one observation and provenance")
    inspect.add_argument("id")
    stats = commands.add_parser("stats", help="Count observation review states")
    stats.add_argument("--scope", default="general")
    args = parser.parse_args(); store = CognitiveStore(args.db)
    if args.command == "propose":
        result = store.propose(args.text, scope=args.scope, origin=args.origin, evidence=args.evidence)
    elif args.command == "review":
        result = store.review(args.id, decision=args.decision, reviewer=args.reviewer)
    elif args.command == "recall":
        result = store.recall(args.query, scope=args.scope, limit=args.limit)
    elif args.command == "feedback":
        result = store.feedback(args.id, rating=args.rating, reason=args.reason)
    elif args.command == "inspect":
        result = store.inspect(args.id)
    else:
        result = store.stats(scope=args.scope)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
