"""V8 real-LoRA resume tests. Tests create tiny synthetic files ONLY.

No Qwen weights, Git operations, downloads, training processes, or runtime
services are used during these standard-library offline tests.
"""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "resume_v8", ROOT / "scripts" / "Continue-Fun-Qwen-Real-LoRA-V8.py")
v8 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v8)


class ResumeV8Tests(unittest.TestCase):
    def test_distinct_output_from_protected_original(self):
        self.assertEqual(v8.V5_LORA.name, "qwen-fibonacci-smoke.lora.gguf")
        self.assertEqual(v8.V8_LORA.name, "qwen-fibonacci-resumed.lora.gguf")
        self.assertNotEqual(v8.V5_LORA.parent, v8.V8_LORA.parent)
        self.assertTrue(v8.V8_DIR.name == "continuation-v8")

    def test_input_checkpoint_filename_triplet(self):
        triplet=v8.checkpoint_paths(v8.V5_LORA)
        self.assertEqual(len(triplet),3)
        self.assertEqual([p.name for p in triplet],[
            "qwen-fibonacci-smoke.lora.gguf",
            "qwen-fibonacci-smoke.lora.gguf.opt",
            "qwen-fibonacci-smoke.lora.gguf.state"])

    def test_resume_is_bounded_and_requires_new_consent(self):
        self.assertTrue(3 <= v8.TOTAL_NEW_WINDOWS <= 20)
        self.assertEqual(v8.TOTAL_NEW_WINDOWS,16)
        self.assertEqual(v8.APPROVAL,
                         "I_APPROVE_ISOLATED_QWEN_LORA_V8_CONTINUATION")
        self.assertGreaterEqual(v8.REQUIRED_HOST_GIB,5.0)
        self.assertGreaterEqual(v8.REQUIRED_COMMIT_GIB,5.0)

    def test_copy_requires_verified_digest_and_preserves_source(self):
        with tempfile.TemporaryDirectory() as d:
            a=Path(d)/"original.state"
            b=Path(d)/"copy.state"
            a.write_bytes(b'{"epoch":0,"datapoints_done":2,"lr_step":2}')
            before=a.read_bytes()
            sha=hashlib.sha256(before).hexdigest()
            self.assertEqual(v8.copy_exclusive(a,b,sha),sha)
            self.assertEqual(a.read_bytes(),before)
            self.assertEqual(b.read_bytes(),before)

    def test_copy_never_overwrites_existing_destination(self):
        with tempfile.TemporaryDirectory() as d:
            a,b=Path(d)/"old",Path(d)/"new"
            a.write_bytes(b"original")
            b.write_bytes(b"important previous result")
            with self.assertRaisesRegex(RuntimeError,"CHECKPOINT_SOURCE_OR_TARGET_UNSAFE"):
                v8.copy_exclusive(a,b,hashlib.sha256(a.read_bytes()).hexdigest())
            self.assertEqual(b.read_bytes(),b"important previous result")

    def test_copy_rejects_wrong_source_digest(self):
        with tempfile.TemporaryDirectory() as d:
            a,b=Path(d)/"old",Path(d)/"new"
            a.write_bytes(b"source-checkpoint")
            with self.assertRaisesRegex(RuntimeError,"COPIED_CHECKPOINT_HASH_MISMATCH"):
                v8.copy_exclusive(a,b,"0"*64)

    def test_resume_preserves_source_and_uses_own_output_only(self):
        import inspect
        s=inspect.getsource(v8.resume)
        self.assertIn("V8_DIR.exists()",s)
        self.assertIn("V8_DIR.mkdir()",s)
        self.assertIn("copy_exclusive(p,target",s)
        self.assertIn('"-o",str(V8_PREFIX)+".gguf"',s)
        self.assertIn('"--resume"',s)
        self.assertIn('"--stop-after",str(TOTAL_NEW_WINDOWS)',s)
        self.assertIn("v5.safe_run(command,TRAIN_LOG",s)
        self.assertIn("V8_TRAINED_ADAPTER_IDENTICAL_TO_START",s)

    def test_verifies_base_adapter_and_original_dataset(self):
        import inspect
        s=inspect.getsource(v8.verify_v5)
        self.assertIn("v5.checked_hash",s)
        self.assertIn("v6.inspect_adapter(V5_LORA",s)
        self.assertIn("ORIGINAL_TRAINING_SLICE_NOT_SAME_AS_V5",s)
        self.assertIn("V5_REQUIRED_RESUME_FILE_MISSING_",s)

    def test_output_must_contain_actual_learned_deltas(self):
        import inspect
        s=inspect.getsource(v8.resume)
        self.assertIn('V8_TRAINER_DID_NOT_CONFIRM_CHECKPOINT_RESUME',s)
        self.assertIn('V8_NO_ATTESTED_STOP_OR_NATURAL_EPOCH_END',s)
        self.assertIn('V8_NO_MEASURABLE_B_TENSOR_CHANGE_',s)
        self.assertIn('heldout_accuracy_improved_proven":False',s)


if __name__=="__main__":
    unittest.main()
