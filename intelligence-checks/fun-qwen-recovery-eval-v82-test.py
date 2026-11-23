"""V8.2 source/candidate preservation and three-way evaluation: offline tests.

Test imports only; it never runs inference, downloads anything, copies
actual model files, trains, or contacts live Qwen or Elektron.
"""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "fun_qwen_v82",ROOT/"scripts"/"Recover-Evaluate-Fun-Qwen-V82.py")
v=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

class V82Tests(unittest.TestCase):
    def test_exact_recovered_adapter_hashes(self):
        self.assertEqual(v.V8_SHA,"05efce40082eee0815decc4c21f74150c612adbb2e88fb2149c9c4dd951f7240")
        self.assertEqual(v.V5_SHA,"da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193")
        self.assertEqual(v.MODEL_SHA,"7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5")
        self.assertEqual(v.NUM_CASES,6)
        self.assertEqual(v.APPROVAL,"I_APPROVE_ISOLATED_QWEN_V82_RECOVERY_EVALUATION")

    def test_original_v8_training_evidence_and_source_preserved(self):
        import inspect
        s=inspect.getsource(v.verify_checkpoint_inputs)
        for marker in (
            "V82_EXISTING_EVIDENCE_FOLDER_NO_OVERWRITE",
            "V82_RECOVERED_SOURCE_MISSING_OR_CHANGED_",
            "V82_ADAPTER_HAS_NO_QV_LEARNED_DELTA_",
            "V8_NATIVE_TRAINING_EVIDENCE_MISSING",
            "source_files",
        ):
            self.assertIn(marker,s)
        self.assertNotIn(".rename(",s)
        self.assertNotIn(".replace(",s)

    def test_recovery_copy_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            original=Path(d)/"original.best"
            recovered=Path(d)/"recovered.lora.gguf"
            blob=b"simulated-checkpoint"
            original.write_bytes(blob)
            recovered.write_bytes(b"previous-user-file")
            with self.assertRaisesRegex(RuntimeError,"V82_UNSAFE_RECOVERY_SOURCE_OR_TARGET"):
                v.copy_verified_candidate(original,recovered)
            self.assertEqual(original.read_bytes(),blob)
            self.assertEqual(recovered.read_bytes(),b"previous-user-file")

    def test_three_way_inference_is_sequential_and_bounded(self):
        import inspect
        s=inspect.getsource(v.execute)
        self.assertIn('("baseline","v5","v8")',s)
        self.assertIn("v7.run_case(",s)
        self.assertIn("v7.initial_resources()",s)
        self.assertIn("copy_verified_candidate(V8_BEST,RECOVERED)",s)
        self.assertIn('"deployment_performed":False',s)
        self.assertIn('"retraining_performed":False',s)
        self.assertIn("V82_PROTECTED_ORIGINAL_FILE_CHANGED_",s)
        self.assertNotIn("llama-finetune",s)

    def test_heldout_case_set_has_two_math_families(self):
        import inspect
        s=inspect.getsource(v.select_cases)
        self.assertIn('("recurrence","recurrence")',s)
        self.assertIn('("meta_selection","model-selection")',s)
        self.assertIn('("Tokyo","Japan")',s)
        self.assertIn('("Paris","France")',s)
        self.assertIn("training_prompts",s)

    def test_recurrence_reference_and_control_grading(self):
        r={"kind":"recurrence","reference_answer":"The next value is 3087+41838=44925."}
        self.assertTrue(v.grade(r,"The sum is 44,925.")["reference_match"])
        self.assertFalse(v.grade(r,"The sum is 45000.")["reference_match"])
        c={"kind":"general_control","reference_answer":"Tokyo"}
        self.assertTrue(v.grade(c,"Tokyo")["reference_match"])
        self.assertFalse(v.grade(c,"Kyoto")["reference_match"])
        self.assertIsNone(v.grade(c,"<think>Tokyo</think>")["reference_match"])

    def test_model_selection_tie_not_scored_as_wrong(self):
        p={"kind":"meta_selection","prompt":
           "In validation case 527, the observed holdout errors for windows 3, 5, 8 are respectively 18, 18, 29. Which window is best?"}
        a=v.grade(p,"Windows 3 and 5 are tied; no guarantee of generalization.")
        self.assertEqual(a["expected_best_windows"],[3,5])
        self.assertIsNone(a["reference_match"])
        b=v.grade(p,"Window 8 is best despite error 29.")
        self.assertTrue(b["explicit_wrong_winner"])

    def test_preflight_only_cannot_copy(self):
        import inspect
        s=inspect.getsource(v.main)
        self.assertIn("a.preflight_only",s)
        self.assertIn("no_inference_or_copies_performed",s)
        self.assertIn("EXPLICIT_V82_RECOVERY_EVALUATION_APPROVAL_REQUIRED",s)

if __name__=="__main__":
    unittest.main()
