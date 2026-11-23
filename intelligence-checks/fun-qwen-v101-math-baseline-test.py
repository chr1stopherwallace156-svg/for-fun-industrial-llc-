"""V10.1 offline unit tests: no Qwen inference, model imports only."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sp=importlib.util.spec_from_file_location(
    "fun_qwen_v101",ROOT/"scripts"/"Evaluate-Fun-Qwen-Math-Baseline-V101.py")
m=importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)

class MathBaselineV101Tests(unittest.TestCase):
    def test_pinned_model_and_scope(self):
        self.assertEqual(m.MODEL_SHA,"7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5")
        self.assertEqual(m.CONSENT,"I_APPROVE_ISOLATED_QWEN_V101_BASELINE_EVALUATION")
        self.assertEqual(m.EXPECTED_CASES,14)
        self.assertEqual(m.CASES_PER_PATTERN,2)
        self.assertEqual(len(m.v10.PATTERNS),7)

    def test_strict_exact_correct_tie(self):
        e={3:18,5:18,8:29}
        case={"errors":e}
        a=m.grade_response(case,m.v10.encode_label(e))
        self.assertEqual(a["oracle_best_windows"],[3,5])
        self.assertTrue(a["strict_exact_answer"])
        self.assertTrue(a["winner_set_correct"])
        self.assertTrue(a["proof_correct"])
        self.assertTrue(a["tie_correct"])

    def test_wrong_winner_is_rejected(self):
        e={3:18,5:18,8:29}
        case={"errors":e}
        a=m.grade_response(case,m.v10.encode_label(e).replace("BEST_WINDOWS=3,5","BEST_WINDOWS=8"))
        self.assertFalse(a["strict_exact_answer"])
        self.assertFalse(a["winner_set_correct"])

    def test_wrong_proof_is_rejected_independently(self):
        e={3:18,5:18,8:29}
        case={"errors":e}
        a=m.grade_response(case,m.v10.encode_label(e).replace("PROOF_D35=0","PROOF_D35=13"))
        self.assertFalse(a["strict_exact_answer"])
        self.assertTrue(a["winner_set_correct"])
        self.assertFalse(a["proof_correct"])

    def test_unstructured_response_not_scored_as_correct(self):
        e={3:18,5:18,8:29}
        a=m.grade_response({"errors":e},"Window 3 and window 5 have the lowest error.")
        self.assertFalse(a["strict_exact_answer"])
        self.assertEqual(a["strict_parse_state"],"UNPARSEABLE")
        self.assertIsNone(a["partial_winner_set_correct"])

    def test_structured_winner_field_partially_scored(self):
        e={3:18,5:18,8:29}
        a=m.grade_response({"errors":e},"BEST_WINDOWS=3,5")
        self.assertFalse(a["strict_exact_answer"])
        self.assertTrue(a["partial_winner_set_correct"])
        self.assertEqual(a["independently_parsed_best_windows"],[3,5])

    def test_duplicated_or_unsorted_winner_list_not_accepted(self):
        case={"errors":{3:18,5:18,8:29}}
        self.assertIsNone(m.grade_response(case,"BEST_WINDOWS=5,3")["partial_winner_set_correct"])
        self.assertIsNone(m.grade_response(case,"BEST_WINDOWS=3,3")["partial_winner_set_correct"])

    def test_validation_only_and_leakage_guards(self):
        import inspect
        s=inspect.getsource(m.verified_dataset)
        self.assertIn('"validation-ground-truth.jsonl"',s)
        self.assertIn("V101_DATASET_PROMPT_LEAKAGE_OR_MISMATCH",s)
        self.assertIn("V101_MATH_ORACLE_OR_LABEL_FAILED",s)
        self.assertIn("V101_WINNER_PATTERN_NOT_BALANCED_",s)
        self.assertIn("CASES_PER_PATTERN",s)
        self.assertNotIn('"test.jsonl"',s)
        self.assertNotIn('"test-ground-truth.jsonl"',s)

    def test_only_original_model_is_run_no_lora(self):
        import inspect
        s=inspect.getsource(m.run)
        self.assertIn('v7.run_case(binary,case,"baseline",RUN)',s)
        self.assertIn("v5.checked_hash(v5.LIVE_GGUF,MODEL_SHA)",s)
        self.assertIn("V101_PRETRAINED_MODEL_CHANGED",s)
        self.assertIn("V101_PROTECTED_CORRECTED_DATASET_CHANGED_",s)
        self.assertNotIn("v7.ADAPTER =",s)
        self.assertNotIn("llama-finetune",s)

    def test_fresh_evaluation_folder_no_overwrite(self):
        import inspect
        s=inspect.getsource(m.run)
        self.assertIn("V101_EVALUATION_OUTPUT_EXISTS_NO_OVERWRITE",s)
        self.assertIn("RUN.mkdir()",s)
        self.assertIn('report.open("x"',s)

    def test_resource_guard_and_logs(self):
        import inspect
        s=inspect.getsource(m.run)
        self.assertIn("v7.initial_resources()",s)
        self.assertIn("v7.inspect_existing_binary()",s)
        self.assertIn("FUN_QWEN_V101_CASE_RESULT=",s)
        self.assertIn("strict_exact_correct",s)

    def test_no_automatic_inference_without_new_consent(self):
        import inspect
        s=inspect.getsource(m.main)
        self.assertIn("V101_EXPLICIT_EVALUATION_CONSENT_REQUIRED",s)
        self.assertIn("opts.preflight",s)
        self.assertIn("V101_BASELINE_READY_NO_INFERENCE_STARTED",s)

if __name__=="__main__":
    unittest.main()
