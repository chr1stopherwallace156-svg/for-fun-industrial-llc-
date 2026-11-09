"""Local synthetic-fixture tests. No microphone, downloads, servers, or model weights."""
import math
import os
import tempfile
import unittest
from pathlib import Path

import numpy as np
import soundfile as sf

from voice_lab.analyzer import analyze_audio, compare_analyses
from voice_lab.profiles import enroll, load_authorized, revoke, list_profiles
from voice_lab.openvoice_backend import synthesize, synthesis_status


class SpokenVoiceLabCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old = os.environ.get("FUN_VOICE_HOME")
        os.environ["FUN_VOICE_HOME"] = str(Path(self.tmp.name) / "private")
        self.wav = Path(self.tmp.name) / "reference.wav"
        sr = 16000
        n = int(sr * 3)
        t = np.arange(n) / sr
        # Speech-like pitch/loudness variation, purely a synthetic diagnostic.
        freq = 150 + 12 * np.sin(2 * np.pi * 0.8 * t)
        phase = np.cumsum(2 * np.pi * freq / sr)
        envelope = np.where((t % 0.8) < 0.5, 0.35, 0.03)
        sf.write(self.wav, envelope * np.sin(phase), sr, subtype="PCM_16")

    def tearDown(self):
        if self.old is None:
            os.environ.pop("FUN_VOICE_HOME", None)
        else:
            os.environ["FUN_VOICE_HOME"] = self.old
        self.tmp.cleanup()

    def test_pitch_loudness_and_boundaries(self):
        a = analyze_audio(self.wav)
        self.assertEqual(a["schema"], "fun.voice.analysis.v1")
        self.assertAlmostEqual(a["duration_seconds"], 3.0, delta=0.01)
        self.assertGreater(a["pitch"]["median_hz"], 95)
        self.assertLess(a["pitch"]["median_hz"], 210)
        self.assertLess(a["loudness"]["mean_dbfs_rms"], 0)
        self.assertEqual(len(a["contours"]["pitch_hz_64"]),64)
        self.assertTrue(a["privacy"]["recording_uploaded"] is False)

    def test_matching_provides_descriptive_metrics_not_identity(self):
        a = analyze_audio(self.wav)
        result = compare_analyses(a,a)
        self.assertEqual(result["identity_verification"], "NOT_PERFORMED")
        self.assertAlmostEqual(result["median_pitch_gap_semitones"], 0, delta=.01)
        self.assertAlmostEqual(result["pitch_contour_difference_semitones"], 0, delta=.01)

    def test_enrollment_requires_explicit_attestation_and_hash(self):
        with self.assertRaises(PermissionError):
            enroll("mine", str(self.wav), authorization=True, attestation="NO")
        enrolled = enroll("mine", str(self.wav),
                          authorization=True, attestation="AUTHORIZE VOICE mine")
        self.assertEqual(enrolled["state"], "enrolled")
        record, reference = load_authorized("mine")
        self.assertTrue(reference.exists())
        self.assertTrue(record["operator_asserted_rights"])
        self.assertFalse(record["may_generate_without_separate_operator_approval"])
        self.assertEqual(len(list_profiles()),1)
        with self.assertRaises(PermissionError):
            revoke("mine", attestation="REVOKE")
        gone = revoke("mine", attestation="REVOKE VOICE mine")
        self.assertEqual(gone["state"],"revoked")
        with self.assertRaises(PermissionError):
            load_authorized("mine")

    def test_synthesis_off_without_manual_consent(self):
        with self.assertRaises(PermissionError):
            synthesize("mine", "This is a test.", attestation="")
        st = synthesis_status()
        self.assertFalse(st["model_loaded"])
        self.assertEqual(st["downloads_attempted"],0)

    def test_invalid_audio_fails_closed(self):
        empty = Path(self.tmp.name) / "empty.wav"
        sf.write(empty,np.zeros(16000*2,dtype=np.float32),16000)
        with self.assertRaises(ValueError):
            analyze_audio(empty)
        with self.assertRaises(ValueError):
            analyze_audio(Path(self.tmp.name) / "not-there.wav")


if __name__ == "__main__":
    unittest.main()
