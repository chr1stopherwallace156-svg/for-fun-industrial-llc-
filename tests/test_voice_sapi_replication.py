"""Safety and path tests for Windows SAPI -> OpenVoice V2 (no model execution)."""
import os
from pathlib import Path
import tempfile
import unittest
import wave

from voice_lab.openvoice_windows_backend import _is_private_base, convert_sapi_base


class SapiVoiceReplicatorCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "base").mkdir()
        self.wav = self.root / "base" / "windows-source-test.wav"
        with wave.open(str(self.wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(16000)
            w.writeframes(b"\x00\x00" * (16000 * 3))

    def tearDown(self):
        self.temp.cleanup()

    def test_accepts_private_pcm_source_only(self):
        self.assertEqual(_is_private_base(str(self.wav), self.root), self.wav)
        other = self.root / "outside.wav"
        other.write_bytes(self.wav.read_bytes())
        with self.assertRaisesRegex(ValueError, "NOT_IN_PRIVATE_RUNTIME"):
            _is_private_base(str(other), self.root)

    def test_requires_explicit_operator_approval_before_profile_or_models(self):
        with self.assertRaisesRegex(PermissionError, "OPERATOR_APPROVAL_REQUIRED"):
            convert_sapi_base("selfvoice", str(self.wav), attestation="",
                              runtime_root=str(self.root))
        with self.assertRaisesRegex(PermissionError, "OPERATOR_APPROVAL_REQUIRED"):
            convert_sapi_base("selfvoice", str(self.wav),
                              attestation="SYNTHESIZE VOICE someoneelse",
                              runtime_root=str(self.root))

    def test_rejects_bad_source_format_and_duration(self):
        too_short = self.root / "base" / "short.wav"
        with wave.open(str(too_short), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(16000)
            w.writeframes(b"\x00\x00" * 16000)
        with self.assertRaisesRegex(ValueError, "FORMAT_OR_DURATION"):
            _is_private_base(str(too_short), self.root)


if __name__ == "__main__":
    unittest.main()
