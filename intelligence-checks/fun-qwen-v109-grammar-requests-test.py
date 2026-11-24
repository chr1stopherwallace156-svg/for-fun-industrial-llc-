"""Fun Industrial V10.9: 17 offline tests for pinned GBNF Qwen request experiment.

No real inference, no file writes outside TemporaryDirectory, no frozen
V10 test loading, no live services and no changes to historical reports.
"""
import hashlib
import importlib.util
import inspect
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "fun_qwen_v109_grammar",ROOT/"scripts"/"Run-Fun-Qwen-GBNF-Tool-Requests-V109.py")
v=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

def case_for(winners=(5,), index=0):
    case=v.v10.make_case("validation",winners,index)
    return {
        "id":"v10-validation-synthetic",
        "prompt":case["question"],
        "errors":case["errors"],
        "reference_answer":case["answer"],
        "pattern":winners,
        "source_id":"V107Fixture1",
    }

def good_proposal(case):
    return v.v106.proposal_for_fixture(
        v.v106.host_authority(case["source_id"],case["errors"]))

class GrammarRequestV109Tests(unittest.TestCase):
    def test_version_and_new_consent(self):
        self.assertEqual(v.CASES,7)
        self.assertEqual(v.CONSENT,"I_APPROVE_ISOLATED_QWEN_V109_GBNF_TOOL_REQUEST_EVALUATION")
        self.assertEqual(v.MODEL_SHA,"7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5")

    def test_reviewed_static_grammar_has_no_source_values(self):
        digest=v.checked_grammar()
        self.assertEqual(digest,v.sha(v.GRAMMAR))
        source=v.GRAMMAR.read_text("utf-8")
        self.assertIn("root ::=",source)
        self.assertIn("source-id ::=",source)
        self.assertIn("uint ::=",source)
        self.assertIn(r'"\"arguments\""',source)
        self.assertNotIn("V107Val",source)
        self.assertNotIn("236",source)
        self.assertNotIn("230",source)

    def test_grammar_forbids_additional_brace_after_root(self):
        source=v.GRAMMAR.read_text("utf-8")
        root=next(line for line in source.splitlines()
                  if line.startswith("root ::= "))
        self.assertTrue(root.rstrip().endswith('ws "}"'))
        self.assertNotIn('"}}"',root)
        self.assertNotIn(' ws "}" ws "}"',root)
        self.assertNotIn(".*",root)

    def test_same_v107_prompt_not_changed(self):
        c=case_for()
        self.assertIn("Return only ONE valid, compact JSON object",
                      v.v107.tool_request_prompt(c))
        code=inspect.getsource(v.run_native_case)
        self.assertIn("v107.tool_request_prompt(case)",code)
        self.assertIn("v7.qwen_nonthinking_prefill(",code)
        self.assertIn('"--grammar-file",str(GRAMMAR)',code)

    def test_strict_valid_request_dispatches(self):
        c=case_for()
        result=v.evaluate_raw(c,good_proposal(c))
        self.assertTrue(result["host_math_tool_dispatched"])
        self.assertEqual(result["verified_tool_answer"],
                         v.v104.verify(c["errors"])["verified_answer"])
        self.assertFalse(result["source_values_from_qwen_used_as_authority"])

    def test_original_extra_brace_still_rejected(self):
        c=case_for()
        result=v.evaluate_raw(c,good_proposal(c)+"}")
        self.assertEqual(result["proposal_status"],"REJECTED_FAIL_CLOSED")
        self.assertFalse(result["host_math_tool_dispatched"])
        self.assertEqual(result["proposal_rejection_reason"],"V106_PROPOSAL_NOT_STRICT_JSON")

    def test_extra_fields_and_unsupported_tool_rejected(self):
        c=case_for()
        for change in ({"tool":"delete_all_files"},{"extra":"surprise"}):
            forged=json.loads(good_proposal(c))
            forged.update(change)
            result=v.evaluate_raw(c,json.dumps(forged))
            self.assertFalse(result["host_math_tool_dispatched"])

    def test_incorrect_numbers_still_rejected_even_if_json_valid(self):
        c=case_for()
        changed=json.loads(good_proposal(c))
        changed["arguments"]["e5"]+=1
        result=v.evaluate_raw(c,json.dumps(changed))
        self.assertFalse(result["host_math_tool_dispatched"])
        self.assertIn("UNTRUSTED_ARGUMENTS_DIFFER_FROM_HOST_SOURCE",
                      result["proposal_rejection_reason"])

    def test_source_forgery_rejected(self):
        c=case_for()
        changed=json.loads(good_proposal(c))
        changed["source_id"]="OtherSource"
        result=v.evaluate_raw(c,json.dumps(changed))
        self.assertFalse(result["host_math_tool_dispatched"])

    def test_all_seven_patterns_with_valid_synthetic_json(self):
        for winners in v.v10.PATTERNS:
            with self.subTest(winners=winners):
                c=case_for(winners)
                result=v.evaluate_raw(c,good_proposal(c))
                self.assertTrue(result["host_math_tool_dispatched"])
                self.assertEqual(result["host_oracle_reference_for_diagnostics"],
                                 result["verified_tool_answer"])

    def test_binary_capability_help_is_checked(self):
        class FakeResult:
            stdout=b"supported options: --grammar-file FNAME --temp N"
            returncode=0
        with tempfile.TemporaryDirectory() as tmp, \
             patch.object(v.subprocess,"run",return_value=FakeResult()) as run:
            binary=Path(tmp)/"llama-completion.exe"
            outcome=v.check_native_grammar_option(binary)
        self.assertTrue(outcome["grammar_flag_supported_in_binary_help"])
        self.assertEqual(outcome["binary_help_returncode"],0)
        self.assertIn("--help",run.call_args.args[0])

    def test_binary_without_grammar_support_holds(self):
        class FakeResult:
            stdout=b"supported options: --temp N"
            returncode=0
        with tempfile.TemporaryDirectory() as tmp, \
             patch.object(v.subprocess,"run",return_value=FakeResult()):
            with self.assertRaisesRegex(RuntimeError,"LACKS_GBNF_FLAG"):
                v.check_native_grammar_option(Path(tmp)/"llama-completion.exe")

    def test_original_seven_cases_paired_and_bad_case_rejected(self):
        cases=[]
        rows=[]
        for i,w in enumerate(v.v10.PATTERNS):
            c=case_for(w)
            c["id"]="v10-validation-"+str(i)
            c["source_id"]="V107Val"+str(i)
            cases.append(c)
            rows.append({"id":c["id"],
                         "raw_qwen_sha256":hashlib.sha256(c["id"].encode()).hexdigest(),
                         "proposal_status":"REJECTED_FAIL_CLOSED",
                         "host_math_tool_dispatched":False})
        saved={"sha256":"synthetic-v107-sha",
               "cases":{c["id"]:c for c in cases},
               "source_hashes":{},
               "v101_sha256":"synthetic-v101-sha",
               "v105_sha256":"synthetic-v105-sha",
               "original":{"records":rows}}
        with patch.object(v.v108,"verified_evidence",return_value=saved):
            pair=v.select_paired_cases()
        self.assertEqual([c["id"] for c in pair["cases"]],
                         [r["id"] for r in rows])
        self.assertEqual(pair["source_v107_sha256"],"synthetic-v107-sha")

        rows[0]["host_math_tool_dispatched"]=True
        with patch.object(v.v108,"verified_evidence",return_value=saved):
            with self.assertRaisesRegex(RuntimeError,"PAIRED_VALIDATION_OR_PRIOR_REJECTION_INVALID"):
                v.select_paired_cases()

    def test_no_existing_evidence_overwritten(self):
        src=inspect.getsource(v.preflight)
        self.assertIn("V109_DESTINATION_EXISTS_PRESERVE_EVIDENCE",src)
        self.assertIn("v7.inspect_existing_binary()",src)
        self.assertIn("v7.initial_resources()",src)
        self.assertIn("v5.checked_hash(v5.LIVE_GGUF,MODEL_SHA)",src)

    def test_cpu_watchdog_and_raw_model_output_are_preserved(self):
        src=inspect.getsource(v.run_native_case)
        self.assertIn("v5.private_commit_gib(proc.pid)",src)
        self.assertIn("v5.KILL_HOST_FREE_GIB",src)
        self.assertIn("v5.KILL_COMMIT_HEADROOM_GIB",src)
        self.assertIn("v5.MAX_CHILD_PRIVATE_COMMIT_GIB",src)
        self.assertIn("v7.MAX_CHILD_SECONDS",src)
        self.assertIn('stdout.open("xb")',src)
        self.assertIn('stderr.open("xb")',src)
        self.assertIn('"--temp","0"',src)
        self.assertIn('"--seed",str(v7.GENERATION_SEED)',src)

    def test_raw_acceptance_is_independently_measured(self):
        src=inspect.getsource(v.run)
        self.assertIn('graded=evaluate_raw(case,original["generated_text"])',src)
        self.assertIn("original_v107_valid_requests",src)
        self.assertIn("v109_raw_valid_model_generated_requests",src)
        self.assertIn("V109_PREVIOUS_REPORT_CHANGED",src)
        self.assertIn("V109_MODEL_OR_GRAMMAR_CHANGED_DURING_RUN",src)
        self.assertIn("UNMODIFIED" if False else "unmodified_v106_strict_host_authority",src)

    def test_does_not_touch_frozen_test_or_live_services(self):
        src=inspect.getsource(v)
        self.assertNotIn('"test.jsonl"',src)
        self.assertNotIn('"test-ground-truth.jsonl"',src)
        for forbidden in ("llama-finetune","cmake --build","git clone",
                          "requests.get","mcp.register","llama-server"):
            self.assertNotIn(forbidden,src)
        self.assertIn("live_services_and_elektron_unchanged_by_workflow",src)

if __name__=="__main__":
    unittest.main()
