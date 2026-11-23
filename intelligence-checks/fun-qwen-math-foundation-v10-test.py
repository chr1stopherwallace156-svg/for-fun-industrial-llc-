"""Offline V10 proof tests: no model loads, training, downloads or services."""
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sp=importlib.util.spec_from_file_location(
    "fun_qwen_math_v10",ROOT/"scripts"/"Build-Fun-Qwen-Math-Foundation-V10.py")
v=importlib.util.module_from_spec(sp)
sp.loader.exec_module(v)

class MathFoundationV10Tests(unittest.TestCase):
    def test_argmin_and_single_best(self):
        self.assertEqual(v.argmin_set({3:20,5:23,8:4}),(8,))
        self.assertEqual(v.argmin_set({3:29,5:3,8:18}),(5,))
        self.assertEqual(v.argmin_set({3:1,5:8,8:12}),(3,))

    def test_tie_aware_exact_set(self):
        self.assertEqual(v.argmin_set({3:18,5:18,8:29}),(3,5))
        self.assertEqual(v.argmin_set({3:5,5:19,8:5}),(3,8))
        self.assertEqual(v.argmin_set({3:19,5:5,8:5}),(5,8))
        self.assertEqual(v.argmin_set({3:5,5:5,8:5}),(3,5,8))
        self.assertEqual(v.margin({3:18,5:18,8:29}),0)

    def test_tie_in_output_and_wrong_answer_rejected(self):
        errors={3:18,5:18,8:29}
        label=v.encode_label(errors)
        self.assertIn("BEST_WINDOWS=3,5",label)
        self.assertIn("TIE=YES",label)
        self.assertIn("FIBONACCI_GUARANTEE=NO",label)
        self.assertTrue(v.grade_output(errors,label)["exact_answer"])
        self.assertFalse(v.grade_output(errors,
            "MIN_ERROR=18; BEST_WINDOWS=8; TIE=NO; FIBONACCI_GUARANTEE=NO")["exact_answer"])
        self.assertFalse(v.grade_output(errors,
            "MIN_ERROR=18; BEST_WINDOWS=3; TIE=NO; FIBONACCI_GUARANTEE=NO")["exact_answer"])

    def test_unique_split_minimum_and_no_overlap(self):
        rows=v.build()
        self.assertEqual({s:len(rows[s]) for s in rows},
                         {"train":224,"validation":84,"test":84})
        for split in rows:
            signatures={tuple(c["errors"][w] for w in v.WINDOWS) for c in rows[split]}
            self.assertEqual(len(signatures),len(rows[split]))
            low,high=v.RANGES[split]
            self.assertTrue(all(low<=min(c["errors"].values())<=high
                                for c in rows[split]))
        self.assertLess(max(min(c["errors"].values()) for c in rows["train"]),
                        min(min(c["errors"].values()) for c in rows["validation"]))

    def test_seven_pattern_balanced_and_invariants(self):
        rows=v.build()
        from collections import Counter
        for split in rows:
            self.assertEqual(set(Counter(c["pattern"] for c in rows[split])),set(v.PATTERNS))
            self.assertEqual(set(Counter(c["pattern"] for c in rows[split]).values()),
                             {v.COUNTS[split]})
        self.assertEqual(v.invariants(rows),4*(224+84+84))

    def test_affine_shift_and_relabel_invariance(self):
        origin={3:18,5:18,8:29}
        target=v.argmin_set(origin)
        self.assertEqual(v.argmin_set({w:7*e+100 for w,e in origin.items()}),target)
        shifted={5:18,8:18,3:29}
        self.assertEqual(v.argmin_set(shifted),(5,8))

    def test_multilabel_objective_supports_ties(self):
        tied={3:18,5:18,8:29}
        good={3:5.0,5:5.0,8:-5.0}
        bad={3:-5.0,5:-5.0,8:5.0}
        self.assertLess(v.multilabel_set_loss(tied,good),
                        v.multilabel_set_loss(tied,bad))
        self.assertGreater(v.multilabel_set_loss(tied,good),0)

    def test_contrastive_penalizes_wrong_high_scores(self):
        self.assertLess(v.contrastive_pair_loss(2.0,-1.0),
                        v.contrastive_pair_loss(-1.0,2.0))
        self.assertAlmostEqual(v.contrastive_pair_loss(0.0,0.0),
                               math.log(2))

    def test_set_calibration_brier(self):
        errors={3:18,5:18,8:29}
        self.assertEqual(v.brier_set_score(errors,{3:1.0,5:1.0,8:0.0}),0)
        self.assertGreater(v.brier_set_score(errors,{3:0.0,5:0.0,8:1.0}),0.9)
        with self.assertRaisesRegex(ValueError,"OUTSIDE_ZERO_ONE"):
            v.brier_set_score(errors,{3:1.4,5:1.0,8:0.0})

    def test_answer_only_nll_and_hard_negative_margin(self):
        self.assertAlmostEqual(v.normalized_answer_nll(
            [math.log(0.5),math.log(0.5)]),math.log(2))
        self.assertAlmostEqual(v.hard_negative_margin(-0.2,[-0.6,-0.9]),0.4)
        with self.assertRaisesRegex(ValueError,"TOKEN_LOG_PROBABILITIES"):
            v.normalized_answer_nll([0.1])
        with self.assertRaisesRegex(ValueError,"LOG_SCORE_MARGIN"):
            v.hard_negative_margin(0.1,[])

    def test_softmin_is_analytical_not_tie_set_label(self):
        probs=v.softmin_distribution({3:18,5:18,8:29},2.0)
        self.assertAlmostEqual(sum(probs.values()),1.0)
        self.assertAlmostEqual(probs[3],probs[5])
        self.assertLess(probs[8],probs[3])

    def test_hard_negatives_never_become_training_answers(self):
        rows=v.build()
        render=v.render_files(rows)
        self.assertIn("hard-negatives.jsonl",render)
        negatives=[json.loads(s) for s in render["hard-negatives.jsonl"].decode().splitlines()]
        self.assertEqual(len(negatives),224)
        self.assertTrue(all(x["source"]=="synthetic_ground_truth_not_model_logits" for x in negatives))
        self.assertTrue(all(x["preferred"]!=x["rejected"] for x in negatives))
        train_text=render["train.jsonl"].decode()
        self.assertNotIn('"rejected"',train_text)

    def test_test_split_kept_separate_from_training(self):
        files=v.render_files(v.build())
        self.assertIn("test.jsonl",files)
        self.assertNotEqual(hashlib.sha256(files["train.jsonl"]).digest(),
                            hashlib.sha256(files["test.jsonl"]).digest())
        self.assertNotIn(b'"rejected":',files["train.jsonl"])

    def test_readonly_default_and_no_model_code(self):
        import inspect
        main=inspect.getsource(v.main)
        self.assertIn("DRY_RUN_NO_FILES_CREATED",main)
        self.assertIn("EXPLICIT_DATASET_WRITE_APPROVAL_REQUIRED",main)
        self.assertIn("V10_DESTINATION_EXISTS_NO_OVERWRITE",main)
        src=inspect.getsource(v)
        self.assertNotIn("llama-server",src)
        self.assertNotIn("llama-finetune",src)
        self.assertNotIn("subprocess.Popen",src)
        self.assertNotIn("requests.get",src)

    def test_manifest_sha_and_no_training(self):
        cases=v.build()
        f=v.render_files(cases)
        info=v.manifest_for(f,cases,v.invariants(cases))
        self.assertFalse(info["training_performed"])
        self.assertFalse(info["evaluation_accuracy_proven"])
        self.assertEqual(info["rows_per_split"]["train"],224)
        self.assertEqual(info["files"]["test.jsonl"]["sha256"],
                         hashlib.sha256(f["test.jsonl"]).hexdigest())

if __name__=="__main__":
    unittest.main()
