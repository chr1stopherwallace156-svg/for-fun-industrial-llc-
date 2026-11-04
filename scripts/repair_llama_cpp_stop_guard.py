#!/usr/bin/env python
"""Remove only the duplicate, unguarded LlamaCppRuntime.stop() definition.

Run from the FunIndustrial repository root. Edits only ai_ml/llama_runtime.py,
creates a timestamped backup, and never interacts with running processes.
"""
from __future__ import annotations

import ast
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "ai_ml" / "llama_runtime.py"


def hold(message: str) -> None:
    raise SystemExit("STOP_GUARD_REPAIR=HOLD " + message)


def methods(tree):
    cls = next((n for n in tree.body if isinstance(n, ast.ClassDef)
                and n.name == "LlamaCppRuntime"), None)
    if cls is None:
        hold("LlamaCppRuntime class not found")
    return [n for n in cls.body
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
            and n.name == "stop"]


def main() -> int:
    if not TARGET.is_file():
        hold("ai_ml/llama_runtime.py not found")
    original = TARGET.read_text(encoding="utf-8")
    try:
        tree = ast.parse(original, filename=str(TARGET))
    except SyntaxError as exc:
        hold("target does not parse: " + str(exc))

    stops = methods(tree)
    if len(stops) == 1:
        segment = ast.get_source_segment(original, stops[0]) or ""
        if "self.external" in segment and '"externally-managed"' in segment:
            print("STOP_GUARD_REPAIR=ALREADY_CORRECT")
            print("STOP_METHOD_COUNT=1")
            print("SOURCE_COMPILE=PASS")
            return 0
        hold("single stop() exists but external ownership guard is absent")
    if len(stops) != 2:
        hold("expected exactly two stop() definitions; found " + str(len(stops)))

    first_source = ast.get_source_segment(original, stops[0]) or ""
    second_source = ast.get_source_segment(original, stops[1]) or ""
    if "self.external" not in first_source or '"externally-managed"' not in first_source:
        hold("first stop() is not the verified guarded implementation")
    if "self.external" in second_source or '"externally-managed"' in second_source:
        hold("second stop() is not the expected unguarded duplicate")

    lines = original.splitlines(keepends=True)
    start = stops[1].lineno - 1
    end = stops[1].end_lineno
    if start < 0 or end > len(lines) or end <= start:
        hold("invalid duplicate method source range")
    updated = "".join(lines[:start] + lines[end:])
    try:
        check = ast.parse(updated, filename=str(TARGET))
    except SyntaxError as exc:
        hold("duplicate removal failed parse: " + str(exc))
    remaining = methods(check)
    if len(remaining) != 1:
        hold("post-repair stop() count is " + str(len(remaining)))
    retained = ast.get_source_segment(updated, remaining[0]) or ""
    if "self.external" not in retained or '"externally-managed"' not in retained:
        hold("retained stop() lacks external ownership guard")

    backup_dir = ROOT / ".runtime" / "backups" / (
        "pre-stop-guard-repair-" + datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    )
    backup_dir.mkdir(parents=True, exist_ok=False)
    backup = backup_dir / TARGET.name
    backup.write_text(original, encoding="utf-8")
    TARGET.write_text(updated, encoding="utf-8", newline="\n")
    compile(TARGET.read_text(encoding="utf-8"), str(TARGET), "exec")
    print("BACKUP=" + str(backup))
    print("STOP_GUARD_REPAIR=APPLIED")
    print("REMOVED_METHOD_LINE=" + str(stops[1].lineno))
    print("STOP_METHOD_COUNT=1")
    print("PATCH_SCOPE=ai_ml/llama_runtime.py")
    print("PROCESS_ACTIONS=NONE")
    print("SOURCE_COMPILE=PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
