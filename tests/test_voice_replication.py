"""Voice cloning asset and consent checks without loading model weights."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from voice_lab.openvoice_backend import _check_local_assets, synthesis_status, synthesize


class OfflineReplicatorGuardsCase(unittest.TestCase):
    def test_unauthorized_generation_fails_before_loading_model(self):
        with self.assertRaises(PermissionError):
            synthesize("my-own-voice", "Hello from Fun Industrial.", attestation="")
        with self.assertRaises(PermissionError):
            synthesize("my-own-voice", "Hello from Fun Industrial.",
                       attestation="SYNTHESIZE VOICE someone-else")

    def test_rejects_present_but_wrong_checkpoint_without_deserializing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ov = root / "OpenVoiceV2"
            me = root / "MeloTTS-English-v3"
            for filename in (
                ov / "converter" / "config.json",
                ov / "converter" / "checkpoint.pth",
                ov / "base_speakers" / "ses" / "en-newest.pth",
                me / "config.json",
                me / "checkpoint.pth",
            ):
                filename.parent.mkdir(parents=True, exist_ok=True)
                filename.write_bytes(b"synthetic-invalid-model-checkpoint-do-not-load" * 5)
            with patch.dict(os.environ, {
                "FUN_VOICE_OPENVOICE_CHECKPOINTS": str(ov),
                "FUN_VOICE_MELO_EN_NEWEST_HOME": str(me),
            }):
                with self.assertRaisesRegex(RuntimeError, "SHA256_MISMATCH"):
                    _check_local_assets()
                status = synthesis_status()
                self.assertFalse(status["configured"])
                self.assertFalse(status["model_loaded"])
                self.assertEqual(status["downloads_attempted"], 0)


if __name__ == "__main__":
    unittest.main()
