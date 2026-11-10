"""Unit tests for Fun Industrial's offline binary identity verifier; no real binaries executed."""
import hashlib
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "src" / "security" / "verify_llama_release.py"
SPEC = importlib.util.spec_from_file_location("fun_integrity", MODULE)
integrity = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(integrity)


def sha(data):
    return hashlib.sha256(data).hexdigest()


class IntegrityTests(unittest.TestCase):
    def setUp(self):
        self.workspace = tempfile.TemporaryDirectory()
        self.addCleanup(self.workspace.cleanup)
        self.root = Path(self.workspace.name)
        self.install = self.root / "installed"
        self.install.mkdir()
        self.archive = self.root / "reference.zip"
        self.data = {
            name: (f"official-fixture::{name}".encode("ascii")) * 3
            for name in integrity.COMPONENTS
        }
        self.manifest = {
            "schema": "fun.binary-integrity-manifest.v1",
            "release": "fixture",
            "source_repository": "fixture",
            "source_commit": "fixture",
            "source_release_url": "fixture",
            "archive_name": "reference.zip",
            "archive_sha256": "",
            "files": {name: sha(data) for name, data in self.data.items()}
        }
        self.write_archive()

    def write_archive(self, duplicate=None, skip=None):
        with zipfile.ZipFile(self.archive, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in self.data.items():
                if name != skip:
                    archive.writestr("build/bin/" + name, data)
            if duplicate:
                archive.writestr("alternate/" + duplicate, self.data[duplicate])
        self.manifest["archive_sha256"] = integrity.sha256_file(self.archive, integrity.MAX_ARCHIVE_BYTES)
        for name, data in self.data.items():
            (self.install / name).write_bytes(data)

    def verify(self):
        return integrity.verify(self.archive, self.install, self.manifest, pinned=False)

    def test_all_seven_match(self):
        result = self.verify()
        self.assertEqual(result["state"], "PASS")
        self.assertEqual(result["matched"], 7)
        self.assertEqual(result["network_requests"], 0)
        self.assertEqual(result["executables_launched"], 0)
        self.assertEqual(result["rea_tools_executed"], 0)

    def test_installed_tamper_fails_closed(self):
        (self.install / integrity.COMPONENTS[0]).write_bytes(b"modified binary")
        result = self.verify()
        self.assertEqual(result["state"], "HOLD")
        self.assertEqual(result["matched"], 6)
        self.assertEqual(result["results"][0]["status"], "MISMATCH")

    def test_missing_local_component_holds(self):
        (self.install / integrity.COMPONENTS[0]).unlink()
        result = self.verify()
        self.assertEqual(result["state"], "HOLD")
        self.assertEqual(result["results"][0]["status"], "HOLD")

    def test_unexpected_archive_hash_rejected(self):
        self.manifest["archive_sha256"] = "0" * 64
        with self.assertRaisesRegex(integrity.IntegrityHold, "REFERENCE_ARCHIVE_HASH_MISMATCH"):
            self.verify()

    def test_missing_reference_member_rejected(self):
        self.write_archive(skip=integrity.COMPONENTS[0])
        with self.assertRaisesRegex(integrity.IntegrityHold, "REFERENCE_MEMBER_MISSING_OR_DUPLICATED"):
            self.verify()

    def test_duplicate_reference_member_rejected(self):
        self.write_archive(duplicate=integrity.COMPONENTS[0])
        with self.assertRaisesRegex(integrity.IntegrityHold, "REFERENCE_MEMBER_MISSING_OR_DUPLICATED"):
            self.verify()

    def test_untrusted_reference_manifest_rejected_in_production_mode(self):
        with self.assertRaisesRegex(integrity.IntegrityHold, "MANIFEST_NOT_PINNED_OFFICIAL_RELEASE"):
            integrity.verify(self.archive, self.install, self.manifest, pinned=True)

    def test_bad_reference_member_hash_rejected(self):
        self.manifest["files"][integrity.COMPONENTS[0]] = "f" * 64
        with self.assertRaisesRegex(integrity.IntegrityHold, "REFERENCE_MEMBER_HASH_MISMATCH"):
            self.verify()

    def test_symlink_component_holds_if_available(self):
        path = self.install / integrity.COMPONENTS[0]
        original = self.root / "original"
        original.write_bytes(path.read_bytes())
        path.unlink()
        try:
            path.symlink_to(original)
        except (NotImplementedError, OSError):
            self.skipTest("Symlink permission unavailable on this OS")
        result = self.verify()
        self.assertEqual(result["state"], "HOLD")
        self.assertEqual(result["results"][0]["status"], "HOLD")

    def test_invalid_manifest_components_rejected(self):
        del self.manifest["files"][integrity.COMPONENTS[0]]
        with self.assertRaisesRegex(integrity.IntegrityHold, "MANIFEST_COMPONENTS_INVALID"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
