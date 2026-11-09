"""Synthetic off-line audio correction checks: no network, actual voices or processes."""
import os
from pathlib import Path
import tempfile
import unittest
import wave

import numpy as np
import soundfile as sf

from voice_lab.autotune import auto_tune, note_name, target_note


class PitchCorrectionCase(unittest.TestCase):
    def setUp(self):
        self.private = tempfile.TemporaryDirectory()
        self.prior = os.environ.get("FUN_VOICE_HOME")
        os.environ["FUN_VOICE_HOME"] = str(Path(self.private.name) / "lab")
        self.wav = Path(self.private.name) / "source.wav"
        sr = 16000
        t = np.arange(int(sr * 2.4)) / sr
        # D#4 is ~311 Hz; test C major should select D4 or E4 depending input.
        sf.write(self.wav, .27 * np.sin(2 * np.pi * 311.13 * t), sr, subtype="PCM_16")

    def tearDown(self):
        if self.prior is None:
            os.environ.pop("FUN_VOICE_HOME", None)
        else:
            os.environ["FUN_VOICE_HOME"] = self.prior
        self.private.cleanup()

    def test_note_target_nearest_key(self):
        self.assertEqual(target_note(60.20, key="C", scale="chromatic"), 60)
        self.assertEqual(target_note(61.1, key="C", scale="major"), 60)
        self.assertEqual(target_note(62.9, key="C", scale="major"), 62)
        self.assertEqual(note_name(60), "C4")
        with self.assertRaises(ValueError):
            target_note(float("nan"))
        with self.assertRaises(ValueError):
            target_note(60, key="Q")

    def test_tune_generates_private_wav_and_sidecar_without_cloning(self):
        result = auto_tune(self.wav, key="C", scale="major", strength=1)
        self.assertEqual(result["schema"], "fun.voice.pitch-tune.v1")
        self.assertEqual(result["state"], "rendered")
        self.assertFalse(result["voice_clone"])
        self.assertFalse(result["real_time"])
        self.assertEqual(result["model_downloads"], 0)
        self.assertGreater(result["windows_pitch_corrected"], 0)
        self.assertGreater(len(result["note_windows"]), 0)
        exported = Path(result["output"])
        self.assertTrue(exported.is_file())
        self.assertTrue(Path(result["provenance"]).is_file())
        with wave.open(str(exported), "rb") as w:
            self.assertEqual((w.getnchannels(), w.getsampwidth(), w.getframerate()),
                             (1, 2, 16000))
            self.assertEqual(w.getnframes(), 16000 * 2.4)
        self.assertTrue(str(exported).startswith(os.environ["FUN_VOICE_HOME"]))

    def test_cannot_overwrite_or_write_outside_private_exports(self):
        with self.assertRaises(ValueError):
            auto_tune(self.wav, output=self.wav)
        with self.assertRaises(ValueError):
            auto_tune(self.wav, key="invalid")
        with self.assertRaises(ValueError):
            auto_tune(self.wav, strength=float("nan"))
        with self.assertRaises(ValueError):
            auto_tune(self.wav, strength=1.01)


if __name__ == "__main__":
    unittest.main()
