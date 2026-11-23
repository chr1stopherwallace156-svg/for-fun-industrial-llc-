"""V10.2 read-only saved-answer regrade regression tests.

Tests use synthetic responses and do not load Qwen, run inference, read
the user's local V10/V10.1 data, create model files, or change services.
"""
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "fun_qwen_v102",ROOT/"scripts"/"Audit-Fun-Qwen-Math-Baseline-V102.py")
v=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

class V102ProofTests(unittest.TestCase):
    def setUp(self):
        self.case={"errors":{3:18,5:18,8:29}}

    def test_exact_canonical_answer_all_fields(self):
        answer=v.v10.encode_label(self.case["errors"])
        g=v.grade(self.case,answer)
        self.assertEqual(g["parse_state"],"COMPLETE")
        self.assertTrue(g["all_decision_fields_correct"])
        self.assertTrue(g["all_proof_fields_correct"])
        self.assertTrue(g["complete_math_content_correct"])

    def test_real_observed_alternate_proof_separators(self):
        c={"errors":{3:297,5:303,8:304}}
        observed=("MIN_ERROR=297; BEST_WINDOWS=3; TIE=NO; "
                  "FIBONACCI_GUARANTEE=NO; PROOF_D35=-6; D38=-9; D58=-1.")
        g=v.grade(c,observed)
        self.assertEqual(g["parse_state"],"COMPLETE")
        self.assertTrue(g["all_decision_fields_correct"])
        self.assertTrue(g["fields"]["PROOF_D35"]["correct"])
        self.assertFalse(g["fields"]["D38"]["correct"])
        self.assertEqual(g["fields"]["D38"]["expected"],-7)
        self.assertEqual(g["fields"]["D38"]["observed"],-9)

    def test_positive_sign_and_spaces(self):
        c={"errors":{3:310,5:279,8:309}}
        response=("MIN_ERROR=279; BEST_WINDOWS=5; TIE=NO; "
                  "FIBONACCI_GUARANTEE=NO; PROOF_D35= +31; D38=+1; D58=-30.")
        g=v.grade(c,response)
        self.assertTrue(g["complete_math_content_correct"])

    def test_negative_zero_is_zero_but_other_arithmetic_wrong(self):
        c={"errors":{3:212,5:212,8:214}}
        observed=("MIN_ERROR=212; BEST_WINDOWS=3,5; TIE=YES; "
                  "FIBONACCI_GUARANTEE=NO; PROOF_D35=-0, D38=-2, D58=0.")
        g=v.grade(c,observed)
        self.assertTrue(g["fields"]["PROOF_D35"]["correct"])
        self.assertFalse(g["fields"]["D58"]["correct"])
        self.assertEqual(g["fields"]["D58"]["expected"],-2)
        self.assertTrue(g["winner_set_correct"])
        self.assertFalse(g["complete_math_content_correct"])

    def test_case_with_correct_math_but_noncanonical_format(self):
        c={"errors":{3:254,5:267,8:254}}
        text=("MIN_ERROR=254; BEST_WINDOWS=3,8; TIE=YES; "
              "FIBONACCI_GUARANTEE=NO; PROOF_D35=-13, D38=0, D58=+13.")
        g=v.grade(c,text)
        self.assertTrue(g["complete_math_content_correct"])
        self.assertFalse(v.v10.grade_output(c["errors"],text)["exact_answer"])

    def test_wrong_winner_is_not_granted_credit(self):
        text=("MIN_ERROR=18; BEST_WINDOWS=8; TIE=NO; "
              "FIBONACCI_GUARANTEE=NO; PROOF_D35=0, D38=-11, D58=-11.")
        g=v.grade(self.case,text)
        self.assertFalse(g["winner_set_correct"])
        self.assertFalse(g["all_decision_fields_correct"])
        self.assertTrue(g["all_proof_fields_correct"])

    def test_repeated_fields_are_ambiguous(self):
        text=v.v10.encode_label(self.case["errors"])+" MIN_ERROR=99."
        g=v.grade(self.case,text)
        self.assertEqual(g["parse_state"],"AMBIGUOUS")
        self.assertIn("MIN_ERROR",g["ambiguous_fields"])
        self.assertFalse(g["complete_math_content_correct"])

    def test_missing_field_not_scored_as_correct(self):
        text="BEST_WINDOWS=3,5; MIN_ERROR=18; TIE=YES."
        g=v.grade(self.case,text)
        self.assertEqual(g["parse_state"],"INCOMPLETE")
        self.assertIsNone(g["guarantee_correct"])
        self.assertIsNone(g["fields"]["D58"]["correct"])
        self.assertFalse(g["complete_math_content_correct"])

    def test_wrong_signed_differences_are_real_math_errors(self):
        c={"errors":{3:236,5:230,8:235}}
        text=("MIN_ERROR=230; BEST_WINDOWS=5; TIE=NO; "
              "FIBONACCI_GUARANTEE=NO; PROOF_D35=-6; D38=-1; D58=5.")
        g=v.grade(c,text)
        self.assertEqual(g["proof_sign_errors"],3)
        self.assertFalse(g["all_proof_fields_correct"])
        self.assertTrue(g["all_decision_fields_correct"])

    def test_all_tie_patterns_correct_math(self):
        for winners in v.v10.PATTERNS:
            errs={3:20,5:20,8:20}
            for w in errs:
                errs[w]=20 if w in winners else 25
            with self.subTest(winners=winners):
                g=v.grade({"errors":errs},v.v10.encode_label(errs))
                self.assertTrue(g["complete_math_content_correct"])

    def test_protected_report_and_frozen_test_exclusion(self):
        import inspect
        s=inspect.getsource(v.validate_report)
        self.assertIn("V102_BASELINE_REPORT_IDENTITY_OR_SCOPE_MISMATCH",s)
        self.assertIn("v101.verified_dataset()",s)
        self.assertIn("V102_UNTRUSTED_BASELINE_RECORD_",s)
        self.assertNotIn('"test.jsonl"',s)
        self.assertNotIn('"test-ground-truth.jsonl"',s)

    def test_strictly_readonly_no_training_or_subprocess(self):
        import inspect
        source=inspect.getsource(v)
        for forbidden in ("subprocess.Popen","subprocess.run","llama-finetune",
                          ".write_bytes(",'.open("x"',".unlink(",'.rename(',
                          "requests.get","git clone"):
            self.assertNotIn(forbidden,source)
        self.assertIn("V102_ORIGINAL_REPORT_CHANGED_DURING_AUDIT",source)

    def test_requires_exact_per_pattern_counts(self):
        import inspect
        source=inspect.getsource(v.analyze)
        self.assertIn('pattern_score[(key,"total")]!=CASES_PER_PATTERN',source)
        self.assertIn("V102_PATTERN_GROUP_COUNTS_UNEXPECTED_",source)

if __name__=="__main__":
    unittest.main()
