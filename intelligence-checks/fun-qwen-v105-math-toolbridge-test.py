"""V10.5 isolated Qwen-to-exact-math toolbridge offline tests.

All tests use synthetic cases, mocks, and TemporaryDirectory. They do not
load a real GGUF, start Qwen, train, deploy, or use frozen V10 test data.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "fun_qwen_v105",ROOT/"scripts"/"Run-Fun-Qwen-Math-Toolbridge-V105.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class V105BridgeTests(unittest.TestCase):
    def case(self, errors):
        return {
            "id":"synthetic",
            "pattern":m.v10.argmin_set(errors),
            "errors":errors,
            "prompt":("Observed validation errors: window 3 = {}, "
                      "window 5 = {}, window 8 = {}. "
                      "Select EVERY window tied for the LOWEST error."
                     ).format(errors[3],errors[5],errors[8]),
            "reference_answer":m.v10.encode_label(errors),
        }

    def test_exact_scope_and_pinned_model(self):
        self.assertEqual(m.N_CASES,7)
        self.assertEqual(m.PER_PATTERN,1)
        self.assertEqual(m.MODEL_SHA,"7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5")
        self.assertEqual(m.CONSENT,"I_APPROVE_ISOLATED_QWEN_V105_MATH_TOOLBRIDGE_EVALUATION")

    def test_correct_model_answer_is_preserved_as_evidence(self):
        c=self.case({3:18,5:18,8:29})
        response=m.v104.format_oracle(m.v104.calculate(c["errors"]))
        result=m.verify_bridge(c,response)
        self.assertEqual(result["model_answer_state"],"MODEL_ANSWER_VERIFIED")
        self.assertEqual(result["model_answer_mismatches"],{})
        self.assertTrue(result["model_complete_math_correct"])
        self.assertFalse(result["verified_output_generated_by_qwen"])

    def test_wrong_model_proof_is_replaced_by_independent_oracle(self):
        c=self.case({3:236,5:230,8:235})
        response=("MIN_ERROR=230; BEST_WINDOWS=5; TIE=NO; "
                  "FIBONACCI_GUARANTEE=NO; PROOF_D35=-6; D38=-1; D58=5.")
        result=m.verify_bridge(c,response)
        self.assertEqual(result["model_answer_state"],
                         "MODEL_ANSWER_MATH_INCORRECT_VERIFIED_ALTERNATIVE")
        self.assertEqual(set(result["model_answer_mismatches"]),
                         {"PROOF_D35","D38","D58"})
        self.assertTrue(result["model_decision_correct"])
        self.assertFalse(result["model_proof_correct"])
        self.assertIn("PROOF_D35=6,D38=1,D58=-5",result["verified_output"])
        self.assertEqual(result["original_model_response"],response)

    def test_unparseable_model_output_not_treated_as_verified(self):
        c=self.case({3:18,5:18,8:29})
        result=m.verify_bridge(c,"Window 8 is definitely best.")
        self.assertEqual(result["model_answer_state"],
                         "MODEL_ANSWER_UNPARSEABLE_VERIFIED_ALTERNATIVE")
        self.assertFalse(result["model_decision_correct"])
        self.assertEqual(result["model_answer_mismatches"].keys(),{"format"})
        self.assertTrue(result["verified_answer_mathematically_correct"])
        self.assertFalse(result["verified_output_generated_by_qwen"])

    def test_model_cannot_change_ground_truth_inputs(self):
        c=self.case({3:18,5:18,8:29})
        response=("MIN_ERROR=1; BEST_WINDOWS=8; TIE=NO; "
                  "FIBONACCI_GUARANTEE=YES; PROOF_D35=3; D38=4; D58=1.")
        result=m.verify_bridge(c,response)
        self.assertEqual(result["expected_winners"],[3,5])
        self.assertIn("MIN_ERROR=18",result["verified_output"])
        self.assertIn("BEST_WINDOWS=3,5",result["verified_output"])
        self.assertFalse(result["model_complete_math_correct"])

    def test_inconsistent_trusted_question_is_held(self):
        c=self.case({3:18,5:18,8:29})
        c["prompt"]=c["prompt"].replace("window 8 = 29","window 8 = 20")
        with self.assertRaisesRegex(RuntimeError,"TYPED_INPUT_VERSUS_QUESTION_MISMATCH"):
            m.verify_bridge(c,m.v10.encode_label(c["errors"]))

    def test_inconsistent_reference_is_held(self):
        c=self.case({3:18,5:18,8:29})
        c["reference_answer"]=m.v10.encode_label({3:18,5:19,8:29})
        with self.assertRaisesRegex(RuntimeError,"VERIFIED_REFERENCE_MISMATCH"):
            m.verify_bridge(c,m.v10.encode_label(c["errors"]))

    def test_real_prior_v101_case_selection_excluded(self):
        original=m.v10.build()["validation"]
        lines=m.v10.render_files(m.v10.build())
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp)
            hashes={}
            for name in ("validation.jsonl","validation-ground-truth.jsonl"):
                path=directory/name
                path.write_bytes(lines[name])
                hashes[str(path)]=hashlib.sha256(lines[name]).hexdigest()
            by_id={}
            by_pattern={p:[] for p in m.v10.PATTERNS}
            for i,c in enumerate(original):
                by_pattern[c["pattern"]].append({
                    "id":"v10-validation-"+str(i),
                    "pattern":c["pattern"],"errors":c["errors"],"prompt":c["question"],
                    "reference_answer":c["answer"],
                })
            for group in by_pattern.values():
                for row in group[:2]:
                    by_id[row["id"]]=row
            fake={"source":{"source_hashes":hashes},"by_id":by_id,
                  "sha256":"synthetic-report-sha"}
            with patch.object(m.v101,"DATA_DIR",directory), \
                 patch.object(m.v102,"validate_report",return_value=fake):
                result=m.select_unseen_validation()
            self.assertEqual(len(result["cases"]),7)
            self.assertEqual(set(tuple(r["pattern"]) for r in result["cases"]),
                             set(m.v10.PATTERNS))
            self.assertTrue(all(r["id"] not in by_id for r in result["cases"]))
            self.assertTrue(result["frozen_test_not_opened"])

    def test_validation_hash_mismatch_holds(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp)
            (directory/"validation.jsonl").write_text("untrusted",encoding="utf-8")
            (directory/"validation-ground-truth.jsonl").write_text("untrusted",encoding="utf-8")
            fake={"source":{"source_hashes":{}},"by_id":{},"sha256":"old"}
            with patch.object(m.v101,"DATA_DIR",directory), \
                 patch.object(m.v102,"validate_report",return_value=fake):
                with self.assertRaisesRegex(RuntimeError,"VALIDATION_INPUT_SHA_UNVERIFIED"):
                    m.select_unseen_validation()

    def test_existing_report_folder_is_not_overwritten(self):
        import inspect
        source=inspect.getsource(m.preflight)
        self.assertIn("V105_OUTPUT_DIR_EXISTS_PRESERVE_PRIOR_RUN",source)
        self.assertIn("v7.inspect_existing_binary()",source)
        self.assertIn("v5.checked_hash(v5.LIVE_GGUF,MODEL_SHA)",source)
        self.assertIn("v7.initial_resources()",source)

    def test_genuine_cpu_inference_but_not_live_qwen(self):
        import inspect
        source=inspect.getsource(m.run)
        self.assertIn('v7.run_case(binary,case,"baseline",RUN)',source)
        self.assertIn("verify_bridge(case,native",source)
        self.assertIn("V105_ORIGINAL_QWEN_MODEL_CHANGED",source)
        self.assertIn('"original_qwen_weights_modified":False',source)
        self.assertIn('"training_or_deployment_performed":False',source)

    def test_preflight_and_execution_require_separate_approval(self):
        import inspect
        source=inspect.getsource(m.main)
        self.assertIn("V105_EXPLICIT_OPERATOR_APPROVAL_FOR_ISOLATED_INFERENCE_REQUIRED",source)
        self.assertIn("a.preflight",source)
        self.assertIn("V105_ISOLATED_BRIDGE_READY_WITHOUT_MODEL_RUN",source)

    def test_frozen_test_split_not_read_anywhere(self):
        import inspect
        source=inspect.getsource(m)
        self.assertNotIn('"test.jsonl"',source)
        self.assertNotIn('"test-ground-truth.jsonl"',source)
        self.assertIn("V105_VALIDATION_ORACLE_DISAGREES_",source)

    def test_no_training_download_build_or_deployment(self):
        import inspect
        source=inspect.getsource(m)
        for forbidden in ("llama-finetune","cmake --build","git clone",
                          "pip install", "requests.get", "llama-server"):
            self.assertNotIn(forbidden,source)
        self.assertIn('"production_integrated":False',source)
        self.assertIn("external_python_orchestrated_qwen_inference",source)

if __name__=="__main__":
    unittest.main()
