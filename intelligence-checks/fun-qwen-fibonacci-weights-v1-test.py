"""Offline standard-library checks for real Qwen weight-training pipeline.
These tests do not import torch, load model weights, start or stop processes.
Run: py -3.12 -m unittest intelligence-checks/fun-qwen-fibonacci-weights-v1-test.py
"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


build = load("Build-Fun-Fibonacci-Weight-Curriculum-V1.py", "fib_curriculum")
train = load("Train-Fun-Qwen-Fibonacci-LoRA-V1.py", "fib_training")


class FibonacciWeightCurriculumTests(unittest.TestCase):
    def test_recurrence_and_zeckendorf(self):
        self.assertEqual(build.fib(0), 0)
        self.assertEqual(build.fib(1), 1)
        self.assertEqual(build.fib(10), 55)
        self.assertEqual(build.components(10), [8, 2])
        self.assertEqual(build.fibonacci_code(10), "010011")
        for n in range(1, 300):
            parts = build.components(n)
            self.assertEqual(sum(parts), n)
            self.assertEqual(len(parts), len(set(parts)))
            weights = build.unique_fib(n)
            index = {v: j for j, v in enumerate(weights)}
            self.assertTrue(all(abs(index[a] - index[b]) > 1 for a, b in zip(parts, parts[1:])))
            self.assertTrue(build.fibonacci_code(n).endswith("11"))

    def test_reproducible_unique_disjoint_splits(self):
        a = build.generate()
        b = build.generate()
        self.assertEqual(a, b)
        self.assertEqual(len(a["train"]), 960)
        self.assertEqual(len(a["validation"]), 320)
        p = lambda part: [x["messages"][0]["content"] for x in a[part]]
        self.assertEqual(len(set(p("train"))), 960)
        self.assertEqual(len(set(p("validation"))), 320)
        self.assertFalse(set(p("train")) & set(p("validation")))
        self.assertEqual({x["family"] for x in a["train"]}, set(build.FAMILIES))
        self.assertEqual({x["family"] for x in a["validation"]}, set(build.FAMILIES))

    def test_maximum_bounded_generated_rows_no_prompt_overlap(self):
        a = build.generate(train_per_family=160, validation_per_family=64)
        p = lambda part: [x["messages"][0]["content"] for x in a[part]]
        self.assertEqual(len(set(p("train"))), 160 * 10)
        self.assertEqual(len(set(p("validation"))), 64 * 10)
        self.assertFalse(set(p("train")) & set(p("validation")))

    def test_generate_and_verify_hashed_curriculum(self):
        with tempfile.TemporaryDirectory() as t:
            folder = Path(t) / "curriculum"
            meta = build.write_dataset(folder, build.generate(12, 8), 6427)
            self.assertFalse(meta["model_weights_modified"])
            data = train.verify_dataset(folder)
            self.assertEqual(len(data["train"]), 12 * 10)
            self.assertEqual(len(data["validation"]), 8 * 10)
            with self.assertRaises(FileExistsError):
                build.write_dataset(folder, build.generate(12, 8), 6427)
            file = folder / "train.jsonl"
            file.write_text(file.read_text("utf-8") + "{}", "utf-8")
            with self.assertRaises(ValueError):
                train.verify_dataset(folder)

    def test_no_silent_training_for_missing_resources(self):
        class Args:
            base_dir = None
            curriculum_dir = Path("nonexistent-curriculum")
        report = train.preflight(Args())
        self.assertEqual(report["state"], "HOLD_NOT_TRAINED")
        self.assertTrue(report["active_model_unchanged"])
        self.assertFalse(report["blocking_reasons"] == [])

    def test_reject_wrong_checkpoint_identity(self):
        self.assertEqual(train.base_identity(None)["state"], "NO_MATCHING_BASE_CHECKPOINT_SUPPLIED")
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "config.json").write_text(json.dumps({"model_type":"gpt2"}), "utf-8")
            self.assertNotEqual(train.base_identity(root)["state"],
                                "LOCAL_HF_QWEN3_CHECKPOINT_PRESENT_UNPROVEN_GGUF_MATCH")


if __name__ == "__main__":
    unittest.main()
