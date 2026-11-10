"""Synthetic, offline integrity-monitor qualification. No production files read."""
from __future__ import annotations
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MOD = Path(__file__).resolve().parents[1] / "src" / "security" / "integrity_monitor.py"
spec = importlib.util.spec_from_file_location("fi_integrity_monitor", MOD)
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class IntegrityMonitorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.workspace = Path(self.tmp.name)
        self.paths = {}
        for kind in ("source", "config", "python-deps", "binaries"):
            root = self.workspace / kind
            root.mkdir()
            self.paths[kind] = root
        (self.paths["source"] / "main.py").write_text("print('hello')\n", encoding="utf-8")
        (self.paths["source"] / "main.mjs").write_text("export const x=1;\n", encoding="utf-8")
        (self.paths["source"] / "node_modules").mkdir()
        (self.paths["source"] / "node_modules" / "ignored.js").write_text("ignored", encoding="utf-8")
        (self.paths["config"] / "settings.json").write_text('{"safe":true}\n', encoding="utf-8")
        (self.paths["config"] / ".env.example").write_text("PLACEHOLDER=none\n", encoding="utf-8")
        pkg = self.paths["python-deps"] / "sample-1.0.dist-info"
        pkg.mkdir()
        (pkg / "METADATA").write_text("Name: sample\nVersion: 1.0\n", encoding="utf-8")
        (pkg / "RECORD").write_text("sample/__init__.py,,\n", encoding="utf-8")
        (self.paths["binaries"] / "runtime.exe").write_bytes(b"fixture-binary")
        (self.paths["binaries"] / "core.dll").write_bytes(b"fixture-library")
        self.scope = {
            "schema": monitor.SCHEMA_SCOPE,
            "roots": [
                {"id": "app", "kind": "source", "path": str(self.paths["source"])},
                {"id": "settings", "kind": "config", "path": str(self.paths["config"]),
                 "files": ["settings.json", ".env.example"]},
                {"id": "deps", "kind": "python-deps", "path": str(self.paths["python-deps"])},
                {"id": "runtime", "kind": "binaries", "path": str(self.paths["binaries"])},
            ],
        }
        self.scope_path = self.workspace / "scope.json"
        self.scope_path.write_text(json.dumps(self.scope), encoding="utf-8")
        self.baseline_path = self.workspace / "baseline.json"

    def make_baseline(self):
        info = monitor.draft(self.scope_path, self.baseline_path)
        return info["baseline_sha256"]

    def test_candidate_not_approved_and_no_automatic_actions(self):
        info = monitor.draft(self.scope_path, self.baseline_path)
        self.assertEqual(info["state"], "AWAITING_OPERATOR_PIN")
        self.assertFalse(info["approved_as_trusted"])
        self.assertEqual(info["files"], 8)
        result = monitor.verify(self.baseline_path, info["baseline_sha256"])
        self.assertEqual(result["state"], "PASS")
        self.assertEqual(result["rea_tools_executed"], 0)
        self.assertEqual(result["automatic_repairs"], 0)

    def test_candidate_write_once_never_overwrites(self):
        self.make_baseline()
        original = self.baseline_path.read_bytes()
        with self.assertRaisesRegex(monitor.IntegrityHold, "BASELINE_CREATE_ONLY_FAILED"):
            monitor.draft(self.scope_path, self.baseline_path)
        self.assertEqual(self.baseline_path.read_bytes(), original)

    def test_changed_source_detected_without_repair(self):
        pin = self.make_baseline()
        source = self.paths["source"] / "main.py"
        source.write_text("print('changed')\n", encoding="utf-8")
        result = monitor.verify(self.baseline_path, pin)
        self.assertEqual(result["state"], "HOLD")
        self.assertEqual(result["changed"], ["app/main.py"])
        self.assertEqual(source.read_text(), "print('changed')\n")

    def test_new_and_removed_files_detected(self):
        pin = self.make_baseline()
        (self.paths["source"] / "main.py").unlink()
        (self.paths["source"] / "new.js").write_text("new", encoding="utf-8")
        result = monitor.verify(self.baseline_path, pin)
        self.assertEqual(result["state"], "HOLD")
        self.assertEqual(result["added"], ["app/new.js"])
        self.assertEqual(result["removed"], ["app/main.py"])

    def test_package_metadata_change_detected(self):
        pin = self.make_baseline()
        target = self.paths["python-deps"] / "sample-1.0.dist-info" / "METADATA"
        target.write_text("Name: sample\nVersion: 9.9\n", encoding="utf-8")
        result = monitor.verify(self.baseline_path, pin)
        self.assertEqual(result["state"], "HOLD")
        self.assertEqual(result["changed"], ["deps/sample-1.0.dist-info/METADATA"])

    def test_config_and_binary_change_detected(self):
        pin = self.make_baseline()
        (self.paths["config"] / "settings.json").write_text('{"safe":false}\n', encoding="utf-8")
        (self.paths["binaries"] / "runtime.exe").write_bytes(b"modified-fixture")
        result = monitor.verify(self.baseline_path, pin)
        self.assertEqual(result["state"], "HOLD")
        self.assertEqual(result["changed"], ["runtime/runtime.exe", "settings/settings.json"])

    def test_unpinned_or_tampered_baseline_refused(self):
        pin = self.make_baseline()
        with self.assertRaisesRegex(monitor.IntegrityHold, "BASELINE_TRUST_PIN_MISMATCH"):
            monitor.verify(self.baseline_path, "0" * 64)
        obj = json.loads(self.baseline_path.read_text())
        obj["files"]["app/main.py"]["sha256"] = "0" * 64
        self.baseline_path.write_text(json.dumps(obj), encoding="utf-8")
        with self.assertRaisesRegex(monitor.IntegrityHold, "BASELINE_TRUST_PIN_MISMATCH"):
            monitor.verify(self.baseline_path, pin)

    def test_baseline_inside_monitored_root_denied(self):
        with self.assertRaisesRegex(monitor.IntegrityHold, "BASELINE_MUST_BE_OUTSIDE_MONITORED_ROOTS"):
            monitor.draft(self.scope_path, self.paths["source"] / "baseline.json")

    def test_bad_config_path_denied(self):
        self.scope["roots"][1]["files"] = ["../private.json"]
        with self.assertRaisesRegex(monitor.IntegrityHold, "CONFIG_PATH_INVALID"):
            monitor.normalize_scope(self.scope)

    def test_symlink_source_denied_when_supported(self):
        outside = self.workspace / "private.py"
        outside.write_text("secret", encoding="utf-8")
        target = self.paths["source"] / "linked.py"
        try:
            target.symlink_to(outside)
        except (NotImplementedError, OSError):
            self.skipTest("Symlinks unavailable without Windows developer/admin privileges")
        with self.assertRaisesRegex(monitor.IntegrityHold, "SYMLINK_OR_JUNCTION_NOT_ALLOWED"):
            monitor.draft(self.scope_path, self.baseline_path)

    def test_dependency_metadata_is_required(self):
        (self.paths["python-deps"] / "sample-1.0.dist-info" / "RECORD").unlink()
        with self.assertRaisesRegex(monitor.IntegrityHold, "FILE_MISSING_OR_INACCESSIBLE"):
            monitor.draft(self.scope_path, self.baseline_path)

    def test_missing_kind_denied(self):
        self.scope["roots"].pop()
        with self.assertRaisesRegex(monitor.IntegrityHold, "SCOPE_REQUIRES_FOUR_ROOTS"):
            monitor.normalize_scope(self.scope)

    def test_source_ignored_directory_not_scanned(self):
        pin = self.make_baseline()
        (self.paths["source"] / "node_modules" / "ignored.js").write_text("other", encoding="utf-8")
        self.assertEqual(monitor.verify(self.baseline_path, pin)["state"], "PASS")


if __name__ == "__main__":
    unittest.main()
