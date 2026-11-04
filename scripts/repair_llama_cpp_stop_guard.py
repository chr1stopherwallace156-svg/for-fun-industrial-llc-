#!/usr/bin/env python
"""Repair the duplicate stop() override left by the first external-adoption patch.

Run from the FunIndustrial repository root:
  .\.venv\Scripts\python.exe .\scripts\repair_llama_cpp_stop_guard.py

Edits only ai_ml/llama_runtime.py, creates a timestamped backup, and never
starts, stops, signals, or reconfigures any running process.
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


def main() -> int:
    if not TARGET.is_file():
        hold("ai_ml/llama_runtime.py not found")
    original = TARGET.read_text(encoding="utf-8")
    try:
        tree = ast.parse(original, filename=str(TARGET))
    except SyntaxError as exc:
        hold("target does not parse: " + str(exc))
    cls = next((n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "LlamaCppRuntime"), None)
    if cls is None:
        hold("LlamaCppRuntime class not found")
    stops = [n for n in cls.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == "stop"]
    if not stops:
        hold("LlamaCppRuntime.stop method not found")
    stop = stops[-1]
    if stop is not cls.body[-1]:
        hold("stop() is not the final class member; refusing a broad source rewrite")
    replacement = '''    def stop(self):
        if self.external:
            return {
                "state": "externally-managed", "managed": False,
                "detail": "Verified external llama.cpp server left running.",
            }
        if self.process is None:
            return {"state": "not-running"}
        if self.process.poll() is not None:
            if self.log_handle:
                self.log_handle.close()
                self.log_handle = None
            return {"state": "already-exited"}
        self.process.terminate()
        try:
            self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)
        if self.log_handle:
            self.log_handle.close()
            self.log_handle = None
        return {"state": "stopped", "managed": True}
'''
    lines = original.splitlines(keepends=True)
    start = stop.lineno - 1
    if start < 0 or start >= len(lines):
        hold("invalid stop() source line")
    # Replace from the final stop() definition to EOF; it must be the final class member.
    updated = "".join(lines[:start]) + replacement
    try:
        check = ast.parse(updated, filename=str(TARGET))
    except SyntaxError as exc:
        hold("repaired source failed parse: " + str(exc))
    check_cls = next(n for n in check.body if isinstance(n, ast.ClassDef) and n.name == "LlamaCppRuntime")
    check_stops = [n for n in check_cls.body if isinstance(n, ast.FunctionDef) and n.name == "stop"]
    if len(check_stops) != 1:
        hold("expected exactly one stop() after repair")
    stop_source = ast.get_source_segment(updated, check_stops[0]) or ""
    if '"externally-managed"' not in stop_source or "self.external" not in stop_source:
        hold("external ownership guard missing after repair")

    if updated == original:
        print("STOP_GUARD_REPAIR=ALREADY_CORRECT")
        print("STOP_METHOD_COUNT=1")
        print("SOURCE_COMPILE=PASS")
        return 0

    backup_dir = ROOT / ".runtime" / "backups" / (
        "pre-stop-guard-repair-" + datetime.now().strftime("%Y%m%d-%H%M%S")
    )
    backup_dir.mkdir(parents=True, exist_ok=False)
    backup = backup_dir / TARGET.name
    backup.write_text(original, encoding="utf-8")
    TARGET.write_text(updated, encoding="utf-8", newline="\n")
    print("BACKUP=" + str(backup))
    print("STOP_GUARD_REPAIR=APPLIED")
    print("STOP_METHOD_COUNT=1")
    print("PATCH_SCOPE=ai_ml/llama_runtime.py")
    print("PROCESS_ACTIONS=NONE")
    print("SOURCE_COMPILE=PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
