"""V8.1 stranded GGUF checkpoint recovery audit tests, entirely offline."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "fun_v81",ROOT/"scripts"/"Audit-Fun-Qwen-V8-Recovery-V81.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def fake_audit(path, expected_hash=None):
    data=Path(path).read_bytes()
    # Simulates V6's already independently tested GGUF reader for testing
    # candidate classification only, not genuine adapter validation.
    if not data.startswith(b"TEST-GGUF"):
        raise ValueError("NOT_GGUF")
    val=data[9]
    return {
        "adapter_sha256":hashlib.sha256(data).hexdigest(),
        "adapter_bytes":len(data),
        "trained_targets":["blk.35.attn_q.weight","blk.35.attn_v.weight"],
        "learned_b_tensors":{
          "blk.35.attn_q.weight.lora_b":{"max_abs":val*0.000001,"l2_norm":val*0.00001},
          "blk.35.attn_v.weight.lora_b":{"max_abs":val*0.000002,"l2_norm":val*0.00002},
        }
    }

class TestV81Recovery(unittest.TestCase):
    def test_canonical_candidate_paths_are_readonly(self):
        self.assertEqual([name for name,_ in m.FILES],[
            "best_validation","last_attempted_main_save"])
        self.assertTrue(str(m.FILES[0][1]).endswith(".lora.gguf.best"))
        self.assertTrue(str(m.FILES[1][1]).endswith(".lora.gguf.tmp"))
        self.assertEqual(m.MAX_BYTES,2_000_000)

    def test_missing_candidates_reported_not_generated(self):
        with tempfile.TemporaryDirectory() as d:
            results=m.analyze_candidates(
                {"learned_b_tensors":{}},
                [("best_validation",Path(d)/"absent.best"),
                 ("last_attempted_main_save",Path(d)/"absent.tmp")])
            self.assertEqual([x["state"] for x in results],["NOT_FOUND","NOT_FOUND"])

    def test_changed_qv_tensors_classified_without_changes(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"candidate.tmp"
            original=b"TEST-GGUF"+bytes([3])+bytes(1024)
            p.write_bytes(original)
            prior={
                "learned_b_tensors":{
                  "blk.35.attn_q.weight.lora_b":{"max_abs":1e-6,"l2_norm":1e-5},
                  "blk.35.attn_v.weight.lora_b":{"max_abs":2e-6,"l2_norm":2e-5},
                }
            }
            with patch.object(m.v6,"inspect_adapter",side_effect=fake_audit):
                result=m.analyze_candidates(prior,[("last_attempted_main_save",p)])
            self.assertEqual(result[0]["state"],"VALID_DIFFERENT_LEARNED_LORA_CANDIDATE_NOT_DEPLOYED")
            self.assertEqual(p.read_bytes(),original)

    def test_unchanged_b_metrics_not_qualified(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"candidate.best"
            p.write_bytes(b"TEST-GGUF"+bytes([3])+bytes(1024))
            prior={"learned_b_tensors":{
                "blk.35.attn_q.weight.lora_b":{"max_abs":3e-6,"l2_norm":3e-5},
                "blk.35.attn_v.weight.lora_b":{"max_abs":6e-6,"l2_norm":6e-5}
            }}
            with patch.object(m.v6,"inspect_adapter",side_effect=fake_audit):
                result=m.analyze_candidates(prior,[("best_validation",p)])
            self.assertEqual(result[0]["state"],"HOLD_ADAPTER_IDENTICAL_OR_NO_MEASURABLE_B_UPDATES")

    def test_invalid_gguf_file_is_held_without_modifications(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"candidate.tmp"
            data=b"this is not valid GGUF"+bytes(1000)
            p.write_bytes(data)
            with patch.object(m.v6,"inspect_adapter",side_effect=fake_audit):
                result=m.analyze_candidates({"learned_b_tensors":{}},[("file",p)])
            self.assertEqual(result[0]["state"],"HOLD_GGUF_AUDIT_FAILED")
            self.assertEqual(p.read_bytes(),data)

    def test_never_runs_training_or_renames_checkpoint(self):
        import inspect
        src=inspect.getsource(m.run)+inspect.getsource(m.analyze_candidates)
        for forbidden in ("subprocess.run(", "subprocess.Popen(", ".rename(", ".replace(", ".write_bytes(", ".unlink("):
            self.assertNotIn(forbidden,src)
        self.assertIn("native_adapter_save_failed",src)
        self.assertIn("native_resume_attested",src)
        self.assertIn("original_v5_adapter_sha256",src)

if __name__=="__main__":
    unittest.main()
