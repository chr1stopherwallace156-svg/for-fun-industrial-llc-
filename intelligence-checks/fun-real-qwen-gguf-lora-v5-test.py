"""Standard-library-only V5 training harness tests.
Never downloads, compiles, starts a server, or trains a model.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("real_qwen_lora_v5", ROOT/"scripts"/"Run-Fun-Qwen-GGUF-Native-LoRA-V5.py")
train = importlib.util.module_from_spec(spec)
spec.loader.exec_module(train)

class TestV5(unittest.TestCase):
    def test_external_training_source_pinned(self):
        self.assertEqual(train.ORIGIN, "https://github.com/LL4nc33/llama-tq.git")
        self.assertEqual(train.PIN_TAG, "v2026.10.31")
        self.assertEqual(train.PIN_SHA, "fed4890a4ccd775d5c04b921720eda947d990f7d")
        self.assertEqual(len(train.PIN_SHA), 40)

    def test_official_gguf_sha_not_changed(self):
        self.assertEqual(train.EXPECTED_GGUF_SHA,
                         "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5")

    def test_smoke_train_data_all_ten_families(self):
        families = ("recurrence", "zeckendorf", "fibonacci_code", "multiscale",
                    "ratio", "state_space", "information_theory", "entropy",
                    "meta_selection", "limits")
        self.assertEqual(set(families),train.EXPECTED_FAMILIES)
        rows = {"train":[]}
        for family in families:
            for i in range(4):
                rows["train"].append({"family":family, "messages":[
                    {"role":"user","content":f"Training example {family} {i}"},
                    {"role":"assistant","content":f"Checked result {family} {i}"}
                ]})
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"train-30.jsonl"
            item=train.write_small_training_slice(rows,path)
            self.assertEqual(item["records"],30)
            data=path.read_bytes()
            self.assertEqual(item["sha256"],hashlib.sha256(data).hexdigest())
            parsed=[json.loads(line) for line in data.splitlines()]
            self.assertEqual(len(parsed),30)
            self.assertEqual(sum(1 for r in parsed if "messages" in r),30)
            self.assertNotIn("family",parsed[0])
            self.assertEqual(train.write_small_training_slice(rows,path),item)
            path.write_text("changed data",encoding="utf-8")
            with self.assertRaises(RuntimeError):
                train.write_small_training_slice(rows,path)

    def test_missing_or_changed_model_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing=Path(tmp)/"not.gguf"
            with self.assertRaises(RuntimeError):
                train.checked_hash(missing,train.EXPECTED_GGUF_SHA)
            present=Path(tmp)/"fake.gguf"
            present.write_bytes(b"GGUF"+b"bad fake data")
            with self.assertRaises(RuntimeError):
                train.checked_hash(present,train.EXPECTED_GGUF_SHA)

    def test_resource_limits_are_bounded(self):
        self.assertGreater(train.MIN_HOST_FREE_GIB, 2.0)
        self.assertGreater(train.MIN_COMMIT_HEADROOM_GIB,2.5)
        self.assertGreater(train.KILL_HOST_FREE_GIB,1.0)
        self.assertGreater(train.KILL_COMMIT_HEADROOM_GIB,0.5)
        self.assertLess(train.MAX_TRAIN_SECONDS, 3601)
        self.assertLess(train.MAX_CHILD_PRIVATE_COMMIT_GIB,6.0)
        self.assertLessEqual(train.MAX_BUILD_SECONDS,1800)

    def test_actual_training_requires_explicit_consent(self):
        self.assertEqual(train.CONSENT,"I_APPROVE_ISOLATED_REAL_QWEN_LORA_TRAINING")
        self.assertIn("GGUF",train.VERSION.upper())

if __name__=="__main__":
    unittest.main()
