"""Unit checks for guarded paired evaluation, entirely offline and no model loads."""
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("qwen_v7",ROOT/"scripts"/"Evaluate-Fun-Qwen-Real-LoRA-V7.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class V7Tests(unittest.TestCase):
    def test_pinned_candidate_and_source(self):
        self.assertEqual(mod.EXPECTED_TRAINING_SHA,"da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193")
        self.assertEqual(mod.GENERATION_SEED,6427)
        self.assertEqual(mod.MAX_CASES,3)

    def test_bounded_generation(self):
        self.assertLessEqual(mod.MAX_GENERATION_TOKENS,96)
        self.assertLessEqual(mod.MAX_CHILD_SECONDS,300)
        self.assertGreaterEqual(mod.MIN_HOST_FREE_GIB,4.0)
        self.assertGreaterEqual(mod.MIN_COMMIT_HEADROOM_GIB,4.0)

    def test_real_base_adapter_pairing(self):
        import inspect
        s=inspect.getsource(mod.main)
        self.assertIn('run_case(binary,case,"baseline",RUN_DIR)',s)
        self.assertIn('run_case(binary,case,"adapter",RUN_DIR)',s)
        self.assertIn('"fibonacci_generalization_or_improvement_proven":False',s)

    def test_same_sampling_parameters(self):
        import inspect
        s=inspect.getsource(mod.run_case)
        self.assertIn('"--temp","0"',s)
        self.assertIn('str(GENERATION_SEED)',s)
        self.assertIn('if mode=="adapter":',s)
        self.assertIn('"--lora",str(ADAPTER)',s)
        self.assertIn('adapter_load_attested',s)
        self.assertIn('NO_GENERATED_TEXT',s)

    def test_not_a_live_service(self):
        import inspect
        s=inspect.getsource(mod.run_case)
        self.assertNotIn("llama-server",s)
        self.assertNotIn('"--port"',s)
        self.assertNotIn('"8088"',s)
        self.assertIn("CREATE_NEW_PROCESS_GROUP",s)
        self.assertNotIn("Start-Process",s)

    def test_approval_and_reports(self):
        self.assertEqual(mod.CONSENT,"I_APPROVE_ISOLATED_QWEN_BASE_ADAPTER_EVALUATION")
        import inspect
        s=inspect.getsource(mod.main)
        self.assertIn('EXPLICIT_ISOLATED_EVALUATION_APPROVAL_REQUIRED',s)
        self.assertIn('EVALUATION_OUTPUT_EXISTS_NO_OVERWRITE',s)
        self.assertIn('RUN_DIR/"evaluation-report.json"',s)

    def test_heldout_question_ids(self):
        import inspect
        s=inspect.getsource(mod.verify_inputs)
        for marker in ("heldout-recurrence","heldout-model-selection","general-control","HELDOUT_PROMPT_IN_TRAINING_DATA"):
            self.assertIn(marker,s)

if __name__=="__main__":
    unittest.main()
