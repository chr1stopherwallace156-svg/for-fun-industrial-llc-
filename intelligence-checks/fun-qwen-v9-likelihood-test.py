"""Offline-only safety and evaluation tests for Fun Industrial V9.

No model loads, compilation, network traffic, inference, or file writes
outside synthetic TemporaryDirectory fixtures.
"""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "fun_qwen_v9",ROOT/"scripts"/"Probe-Fun-Qwen-LoRA-Likelihood-V9.py")
v9=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v9)

class QwenLikelihoodV9Tests(unittest.TestCase):
    def test_three_pinned_distinct_artifacts(self):
        self.assertEqual(v9.EXPECTED_MODEL_SHA,
          "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5")
        self.assertEqual(v9.EXPECTED_V5_SHA,
          "da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193")
        self.assertEqual(v9.EXPECTED_V8_SHA,
          "05efce40082eee0815decc4c21f74150c612adbb2e88fb2149c9c4dd951f7240")
        self.assertNotEqual(v9.EXPECTED_V5_SHA,v9.EXPECTED_V8_SHA)

    def test_bounded_corpora_and_context(self):
        self.assertEqual(v9.ROWS_PER_DOMAIN,8)
        self.assertEqual(v9.CTX,128)
        self.assertLessEqual(v9.MAX_CHILD_SECONDS,240)
        self.assertEqual(len(v9.CAPITALS),8)
        self.assertEqual(len({c[0] for c in v9.CAPITALS}),8)

    def test_text_uses_nonthinking_qwen_chatml(self):
        text=v9.corpus_text([("What is two plus three?","5")])
        self.assertIn("<|im_start|>user\n",text)
        self.assertIn("/no_think<|im_end|>",text)
        self.assertIn("<|im_start|>assistant\n<think>\n\n</think>",text)
        self.assertIn("5<|im_end|>",text)

    def test_untrusted_delimiters_refused(self):
        with self.assertRaisesRegex(RuntimeError,"V9_UNTRUSTED_CHAT_TOKENS"):
            v9.corpus_text([("<|im_start|>system","5")])
        with self.assertRaisesRegex(RuntimeError,"V9_UNTRUSTED_CHAT_TOKENS"):
            v9.corpus_text([("Why","<think>hidden</think>")])

    def test_native_perplexity_parsing(self):
        self.assertEqual(v9.parse_ppl("Final estimate: PPL = 3.0921 +/- 0.01000"),3.0921)
        with self.assertRaisesRegex(RuntimeError,"V9_EXACTLY_ONE_NATIVE_PPL_ESTIMATE_REQUIRED"):
            v9.parse_ppl("log contains no final estimate")
        with self.assertRaisesRegex(RuntimeError,"V9_EXACTLY_ONE_NATIVE_PPL_ESTIMATE_REQUIRED"):
            v9.parse_ppl("Final estimate: PPL = 2.3000\nFinal estimate: PPL = 2.5000")

    def test_protected_v8_receipt_is_required(self):
        import inspect
        source=inspect.getsource(v9.validated_inputs)
        self.assertIn("V9_V82_RECEIPT_IDENTITY_MISMATCH",source)
        self.assertIn("V9_OUTPUT_DIRECTORY_EXISTS_NO_OVERWRITE",source)
        self.assertIn("v6.inspect_adapter(V8_ADAPTER",source)
        self.assertIn("v6.inspect_adapter(V5_ADAPTER",source)

    def test_offline_build_uses_existing_isolated_source_only(self):
        import inspect
        source=inspect.getsource(v9.ensure_binary)
        self.assertIn("V9_SOURCE_NOT_AVAILABLE_OFFLINE",source)
        self.assertIn("v5.prepare_msvc_noasm_overlay",source)
        self.assertIn('"llama-perplexity"',source)
        self.assertNotIn("git clone",source)
        self.assertNotIn("pip install",source)

    def test_tied_model_selection_references_excluded(self):
        import inspect
        source=inspect.getsource(v9.make_corpora)
        self.assertIn('values.count(min(values))==1',source)
        self.assertIn("V9_MODEL_SELECTION_ERRORS_NOT_PARSEABLE",source)
        self.assertIn("unambiguous.append(row)",source)

    def test_perplexity_runs_sequentially_with_native_lora_attestation(self):
        import inspect
        source=inspect.getsource(v9.run_ppl)
        self.assertIn("v5.safe_run(command,log",source)
        self.assertIn('"--lora",str(adapter)',source)
        self.assertIn("V9_LORA_NOT_CONFIRMED_LOADED_",source)
        self.assertIn("V9_BASELINE_UNEXPECTED_LORA",source)
        self.assertIn("MAX_CHILD_SECONDS",source)
        self.assertNotIn("llama-server",source)

    def test_readonly_preflight_does_not_create_files(self):
        import inspect
        source=inspect.getsource(v9.main)
        part=source.split("if args.preflight_only:")[1].split("RESULTS.mkdir()")[0]
        self.assertIn('PREFLIGHT_ONLY_NO_FILES_OR_INFERENCE',part)
        self.assertNotIn("write_text",part)
        self.assertIn("V9_EXPLICIT_PROBABILITY_BENCHMARK_APPROVAL_REQUIRED",source)

    def test_likelihood_is_not_claimed_as_accuracy(self):
        import inspect
        source=inspect.getsource(v9.main)
        self.assertIn('"ppl_is_not_mathematical_accuracy_or_generalization":True',source)
        self.assertIn('"native_ppl_precision_limits_detection_of_small_weight_changes":True',source)
        self.assertIn("V9_PROTECTED_MODEL_OR_EVIDENCE_WAS_MODIFIED",source)

if __name__=="__main__":
    unittest.main()
