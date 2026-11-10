"""Fun Industrial offline integrity monitor V1.

On-demand, read-only verification against an operator-pinned, separately stored
baseline SHA-256. Creating a *candidate* baseline is an explicit, separate
operation, never performed by verification. No execution, REA, network, or
automatic repair. Standard library only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path

SCHEMA_SCOPE = "fun.integrity.scope.v1"
SCHEMA_BASELINE = "fun.integrity.baseline.v1"
KINDS = frozenset({"source", "config", "python-deps", "binaries"})
SOURCE_EXT = frozenset({".py", ".mjs", ".cjs", ".js", ".ts", ".tsx", ".ps1", ".json"})
BINARY_EXT = frozenset({".exe", ".dll"})
OMIT_DIRS = frozenset({
    ".git", "node_modules", ".venv", "venv", "__pycache__", ".runtime",
    ".cache", ".tox", "build", "dist", ".pytest_cache"
})
MAX_ROOTS = 4
MAX_FILES = 10000
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_DEPTH = 12
MAX_SCOPE_BYTES = 32768
MAX_BASELINE_BYTES = 3 * 1024 * 1024
HEX64 = re.compile(r"^[0-9a-fA-F]{64}$")
ROOT_ID = re.compile(r"^[a-z][a-z0-9-]{0,31}$")


class IntegrityHold(Exception):
    pass


def canonical(data: object) -> bytes:
    return (json.dumps(data, sort_keys=True, ensure_ascii=True,
                       separators=(",", ":")) + "\n").encode("utf-8")


def read_json(path: Path, limit: int) -> dict:
    safe_regular(path, limit)
    try:
        with path.open("rb") as handle:
            data = handle.read(limit + 1)
        if len(data) > limit:
            raise IntegrityHold("INPUT_TOO_LARGE")
        obj = json.loads(data.decode("utf-8"))
    except (OSError, UnicodeError, ValueError) as exc:
        raise IntegrityHold("INPUT_JSON_INVALID") from exc
    if not isinstance(obj, dict):
        raise IntegrityHold("INPUT_NOT_AN_OBJECT")
    return obj


def path_unsafe(path: Path) -> bool:
    try:
        return path.is_symlink() or bool(getattr(path, "is_junction", lambda: False)())
    except OSError:
        return True


def safe_regular(path: Path, maximum: int) -> os.stat_result:
    if path_unsafe(path):
        raise IntegrityHold("SYMLINK_OR_JUNCTION_NOT_ALLOWED")
    try:
        info = path.lstat()
    except OSError as exc:
        raise IntegrityHold("FILE_MISSING_OR_INACCESSIBLE") from exc
    if not stat.S_ISREG(info.st_mode) or info.st_size < 0 or info.st_size > maximum:
        raise IntegrityHold("FILE_NOT_REGULAR_OR_TOO_LARGE")
    return info


def safe_dir(path: Path) -> None:
    if path_unsafe(path):
        raise IntegrityHold("SYMLINK_OR_JUNCTION_NOT_ALLOWED")
    try:
        info = path.lstat()
    except OSError as exc:
        raise IntegrityHold("DIRECTORY_MISSING_OR_INACCESSIBLE") from exc
    if not stat.S_ISDIR(info.st_mode):
        raise IntegrityHold("ROOT_NOT_DIRECTORY")


def normalize_scope(obj: dict) -> dict:
    if set(obj) != {"schema", "roots"} or obj["schema"] != SCHEMA_SCOPE:
        raise IntegrityHold("SCOPE_SCHEMA_INVALID")
    roots = obj["roots"]
    if not isinstance(roots, list) or len(roots) != MAX_ROOTS:
        raise IntegrityHold("SCOPE_REQUIRES_FOUR_ROOTS")
    normalized = []
    used_ids = set()
    used_kinds = set()
    for root in roots:
        if not isinstance(root, dict) or "kind" not in root:
            raise IntegrityHold("ROOT_SCHEMA_INVALID")
        kind = root["kind"]
        if kind not in KINDS or set(root) != ({"id", "kind", "path", "files"} if kind == "config"
                                           else {"id", "kind", "path"}):
            raise IntegrityHold("ROOT_SCHEMA_INVALID")
        rid = root["id"]
        if not isinstance(rid, str) or not ROOT_ID.fullmatch(rid) or rid in used_ids or kind in used_kinds:
            raise IntegrityHold("ROOT_ID_OR_KIND_INVALID")
        path = root["path"]
        if not isinstance(path, str) or not Path(path).is_absolute():
            raise IntegrityHold("ROOT_PATH_MUST_BE_ABSOLUTE")
        base = Path(path)
        safe_dir(base)
        value = {"id": rid, "kind": kind, "path": str(base)}
        if kind == "config":
            files = root["files"]
            if not isinstance(files, list) or not 1 <= len(files) <= 32:
                raise IntegrityHold("CONFIG_FILES_INVALID")
            clean = []
            for rel in files:
                if not isinstance(rel, str) or not rel or "\\" in rel or ":" in rel:
                    raise IntegrityHold("CONFIG_PATH_INVALID")
                parts = rel.split("/")
                if any(p in ("", ".", "..") for p in parts):
                    raise IntegrityHold("CONFIG_PATH_INVALID")
                if rel.lower() == ".env" or any(p.lower() in OMIT_DIRS for p in parts):
                    raise IntegrityHold("CONFIG_PATH_EXCLUDED")
                if not (rel.endswith((".json", ".toml", ".txt", ".yaml", ".yml", ".ini", ".md"))
                        or rel == ".env.example"):
                    raise IntegrityHold("CONFIG_TYPE_NOT_ALLOWED")
                clean.append(rel)
            if len(set(x.casefold() for x in clean)) != len(clean):
                raise IntegrityHold("CONFIG_PATH_DUPLICATE")
            value["files"] = sorted(clean)
        normalized.append(value)
        used_ids.add(rid)
        used_kinds.add(kind)
    if used_kinds != KINDS:
        raise IntegrityHold("SCOPE_MISSING_REQUIRED_CATEGORY")
    return {"schema": SCHEMA_SCOPE, "roots": sorted(normalized, key=lambda x: x["id"])}


def source_paths(base: Path):
    def walk(folder: Path, level: int):
        if level > MAX_DEPTH:
            raise IntegrityHold("DIRECTORY_DEPTH_LIMIT")
        safe_dir(folder)
        try:
            children = sorted(folder.iterdir(), key=lambda p: p.name.casefold())
        except OSError as exc:
            raise IntegrityHold("DIRECTORY_READ_FAILED") from exc
        for child in children:
            # Never follow links or Windows junctions, even if directory is omitted.
            if path_unsafe(child):
                raise IntegrityHold("SYMLINK_OR_JUNCTION_NOT_ALLOWED")
            try:
                info = child.lstat()
            except OSError as exc:
                raise IntegrityHold("ENTRY_INACCESSIBLE") from exc
            if stat.S_ISDIR(info.st_mode):
                if child.name.lower() not in OMIT_DIRS:
                    yield from walk(child, level + 1)
            elif stat.S_ISREG(info.st_mode):
                if child.suffix.lower() in SOURCE_EXT:
                    yield child.relative_to(base).as_posix(), child
            else:
                raise IntegrityHold("SPECIAL_FILE_NOT_ALLOWED")
    yield from walk(base, 0)


def list_files(root: dict):
    base = Path(root["path"])
    safe_dir(base)
    kind = root["kind"]
    if kind == "source":
        yield from source_paths(base)
    elif kind == "config":
        for relative in root["files"]:
            filename = base.joinpath(*relative.split("/"))
            # Check intermediate directories, not only the file.
            parent = base
            for part in relative.split("/")[:-1]:
                parent = parent / part
                safe_dir(parent)
            yield relative, filename
    elif kind == "python-deps":
        # Metadata only: never imports third-party packages or executes setup.py.
        found = 0
        try:
            children = sorted(base.iterdir(), key=lambda p: p.name.casefold())
        except OSError as exc:
            raise IntegrityHold("DIRECTORY_READ_FAILED") from exc
        for child in children:
            if path_unsafe(child):
                raise IntegrityHold("SYMLINK_OR_JUNCTION_NOT_ALLOWED")
            if not child.name.lower().endswith(".dist-info"):
                continue
            safe_dir(child)
            metadata = child / "METADATA"
            record = child / "RECORD"
            # Both files are required; additions/removals become visible.
            found += 1
            yield f"{child.name}/METADATA", metadata
            yield f"{child.name}/RECORD", record
        if not found:
            raise IntegrityHold("NO_PYTHON_DISTRIBUTION_METADATA")
    elif kind == "binaries":
        found = 0
        try:
            children = sorted(base.iterdir(), key=lambda p: p.name.casefold())
        except OSError as exc:
            raise IntegrityHold("DIRECTORY_READ_FAILED") from exc
        for child in children:
            if path_unsafe(child):
                raise IntegrityHold("SYMLINK_OR_JUNCTION_NOT_ALLOWED")
            if child.suffix.lower() in BINARY_EXT:
                found += 1
                yield child.name, child
        if not found:
            raise IntegrityHold("NO_EXECUTABLES_OR_DLLS")


def sha256_file(path: Path) -> tuple[str, int]:
    before = safe_regular(path, MAX_FILE_BYTES)
    h = hashlib.sha256()
    total = 0
    try:
        with path.open("rb") as handle:
            while True:
                buf = handle.read(1024 * 1024)
                if not buf:
                    break
                total += len(buf)
                if total > MAX_FILE_BYTES:
                    raise IntegrityHold("FILE_TOO_LARGE")
                h.update(buf)
    except OSError as exc:
        raise IntegrityHold("FILE_READ_FAILED") from exc
    after = safe_regular(path, MAX_FILE_BYTES)
    if total != before.st_size or (before.st_size, before.st_mtime_ns, before.st_ino) != (
        after.st_size, after.st_mtime_ns, after.st_ino
    ):
        raise IntegrityHold("FILE_CHANGED_DURING_SCAN")
    return h.hexdigest(), total


def inventory(scope: dict) -> dict:
    entries = {}
    scanned = 0
    seen = set()
    for root in scope["roots"]:
        for relative, file_path in list_files(root):
            key = root["id"] + "/" + relative
            normalized = key.casefold()
            if normalized in seen:
                raise IntegrityHold("CASE_INSENSITIVE_FILE_COLLISION")
            seen.add(normalized)
            if len(entries) >= MAX_FILES:
                raise IntegrityHold("FILE_COUNT_LIMIT")
            sha, size = sha256_file(file_path)
            scanned += size
            if scanned > MAX_TOTAL_BYTES:
                raise IntegrityHold("TOTAL_BYTES_LIMIT")
            entries[key] = {"sha256": sha, "size": size}
    if not entries:
        raise IntegrityHold("NO_FILES_SELECTED")
    return dict(sorted(entries.items()))


def validate_baseline(obj: dict) -> dict:
    if set(obj) != {"schema", "scope", "files"} or obj["schema"] != SCHEMA_BASELINE:
        raise IntegrityHold("BASELINE_SCHEMA_INVALID")
    scope = normalize_scope(obj["scope"])
    items = obj["files"]
    if not isinstance(items, dict) or not 1 <= len(items) <= MAX_FILES:
        raise IntegrityHold("BASELINE_ITEMS_INVALID")
    for path, row in items.items():
        if not isinstance(path, str) or not isinstance(row, dict) or set(row) != {"sha256", "size"}:
            raise IntegrityHold("BASELINE_ITEM_INVALID")
        if not isinstance(row["sha256"], str) or not HEX64.fullmatch(row["sha256"]):
            raise IntegrityHold("BASELINE_HASH_INVALID")
        if not isinstance(row["size"], int) or isinstance(row["size"], bool) or not 0 <= row["size"] <= MAX_FILE_BYTES:
            raise IntegrityHold("BASELINE_SIZE_INVALID")
    return scope


def outside_roots(output: Path, scope: dict) -> None:
    out = output.resolve(strict=False)
    for root in scope["roots"]:
        base = Path(root["path"]).resolve(strict=False)
        if out == base or base in out.parents:
            raise IntegrityHold("BASELINE_MUST_BE_OUTSIDE_MONITORED_ROOTS")


def draft(scope_path: Path, output: Path) -> dict:
    scope = normalize_scope(read_json(scope_path, MAX_SCOPE_BYTES))
    outside_roots(output, scope)
    safe_dir(output.parent)
    if path_unsafe(output):
        raise IntegrityHold("BASELINE_PATH_UNSAFE")
    candidate = {"schema": SCHEMA_BASELINE, "scope": scope, "files": inventory(scope)}
    payload = canonical(candidate)
    if len(payload) > MAX_BASELINE_BYTES:
        raise IntegrityHold("BASELINE_TOO_LARGE")
    try:
        with output.open("xb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
    except OSError as exc:
        raise IntegrityHold("BASELINE_CREATE_ONLY_FAILED") from exc
    return {
        "event": "FUN_INTEGRITY_BASELINE_CANDIDATE",
        "state": "AWAITING_OPERATOR_PIN",
        "baseline_sha256": hashlib.sha256(payload).hexdigest(),
        "files": len(candidate["files"]),
        "categories": sorted(KINDS),
        "baseline_created": True,
        "approved_as_trusted": False,
        "note": "Review known-good state and retain digest independently. Do not auto-approve.",
    }


def verify(baseline: Path, expected_sha: str) -> dict:
    if not HEX64.fullmatch(expected_sha):
        raise IntegrityHold("EXPECTED_SHA256_REQUIRED")
    info = safe_regular(baseline, MAX_BASELINE_BYTES)
    # Hash exact stored bytes; the operator's digest must live outside this workspace.
    data = baseline.read_bytes()
    if len(data) != info.st_size:
        raise IntegrityHold("BASELINE_CHANGED_DURING_READ")
    actual_sha = hashlib.sha256(data).hexdigest()
    if actual_sha.lower() != expected_sha.lower():
        raise IntegrityHold("BASELINE_TRUST_PIN_MISMATCH")
    try:
        obj = json.loads(data.decode("utf-8"))
    except (ValueError, UnicodeError) as exc:
        raise IntegrityHold("BASELINE_JSON_INVALID") from exc
    if not isinstance(obj, dict):
        raise IntegrityHold("BASELINE_SCHEMA_INVALID")
    scope = validate_baseline(obj)
    current = inventory(scope)
    original = obj["files"]
    added = sorted(set(current) - set(original))
    removed = sorted(set(original) - set(current))
    changed = sorted(k for k in set(original) & set(current)
                     if current[k] != original[k])
    return {
        "event": "FUN_INTEGRITY_MONITOR_RESULT",
        "state": "PASS" if not (added or removed or changed) else "HOLD",
        "baseline_pin": "MATCH",
        "files_expected": len(original),
        "files_observed": len(current),
        "unchanged": len(set(original) & set(current)) - len(changed),
        "added": added,
        "removed": removed,
        "changed": changed,
        "categories": sorted(KINDS),
        "scope": "ON_DEMAND_SELECTED_FILES_NO_MALWARE_CERTIFICATION",
        "rea_tools_executed": 0,
        "external_actions_executed": 0,
        "automatic_repairs": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Fun Industrial offline, on-demand file-integrity monitor")
    sub = parser.add_subparsers(dest="command", required=True)
    p_draft = sub.add_parser("draft", help="Create a baseline candidate only, never approve automatically")
    p_draft.add_argument("--scope", type=Path, required=True)
    p_draft.add_argument("--output", type=Path, required=True)
    p_verify = sub.add_parser("verify", help="Check files against an operator-pinned baseline")
    p_verify.add_argument("--baseline", type=Path, required=True)
    p_verify.add_argument("--expected-sha", required=True)
    args = parser.parse_args()
    try:
        result = (draft(args.scope, args.output) if args.command == "draft" else
                  verify(args.baseline, args.expected_sha))
    except (IntegrityHold, OSError) as exc:
        result = {"event": "FUN_INTEGRITY_MONITOR_HOLD", "state": "HOLD",
                  "reason": str(exc) if isinstance(exc, IntegrityHold) else "OS_ERROR",
                  "rea_tools_executed": 0, "external_actions_executed": 0,
                  "automatic_repairs": 0}
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["state"] in {"PASS", "AWAITING_OPERATOR_PIN"} else 2


if __name__ == "__main__":
    sys.exit(main())
