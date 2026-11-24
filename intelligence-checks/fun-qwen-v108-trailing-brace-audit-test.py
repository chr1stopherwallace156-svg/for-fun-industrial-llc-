"""Fun Industrial V10.8: unit tests for forensic-only trailing brace diagnosis.

Tests are synthetic; no Qwen execution, live MCP, native model, service
access, dataset edits, production deployment or frozen V10 test access.
"""
import hashlib
import importlib.util
import inspect
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "fun_v108_forensic", ROOT/"scripts"/"Audit-Fun-Qwen-Tool-JSON-V108.py")
v=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

def case(errors=None, ident="FixtureV108"):
    errors=errors if errors is not None else {3:236,5:240,8:238}
    return {
        "id":"test-case-v108","source_id":ident,
        "errors":errors,
        "pattern":v.v107.v10.argmin_set(errors),
        "prompt":("Observed validation errors: window 3 = {}, "
                  "window 5 = {}, window 8 = {}. "
                  "Select EVERY window tied for the LOWEST error."
                 ).format(errors[3],errors[5],errors[8]),
    }

def valid_proposal(c):
    authority=v.v106.host_authority(c["source_id"],c["errors"])
    return v.v106.proposal_for_fixture(authority)

class V108TrailingBraceTests(unittest.TestCase):
    def test_exact_one_extra_brace_has_valid_hypothetical(self):
        c=case()
        malformed=valid_proposal(c)+"}"
        d=v.inspect_request(c,malformed)
        self.assertFalse(d["raw_json_accepted"])
        self.assertTrue(d["one_brace_candidate"])
        self.assertTrue(d["would_pass_full_host_contract_after_one_brace"])
        self.assertIn("HYPOTHETICAL",d["diagnostic"])
        self.assertEqual(d["simulated_tool_answer"],
                         v.v104.verify(c["errors"])["verified_answer"])

    def test_one_extra_brace_with_scalar_last_field(self):
        # V10.6 fixture uses sort_keys=True; source_id or tool can be last.
        # Valid body ends in one brace, malformed body in two.
        c=case()
        valid=valid_proposal(c)
        self.assertTrue(valid.endswith("}"))
        malformed=valid+"}"
        self.assertTrue(malformed.endswith("}}"))
        self.assertFalse(malformed.endswith("}}}"))
        d=v.inspect_request(c,malformed)
        self.assertTrue(d["one_brace_candidate"])
        self.assertTrue(d["would_pass_full_host_contract_after_one_brace"])
        self.assertFalse(d["raw_json_accepted"])

    def test_one_extra_brace_with_object_last_field_real_qwen_order(self):
        # This field order matches the actual V10.7 Qwen report sample,
        # not the sort_keys=True synthetic fixture.
        c=case()
        raw=(
            '{"schema":"fun-math-tool-proposal-v1",'
            '"tool":"verify_window_math",'
            '"source_id":"FixtureV108",'
            '"arguments":{"e3":236,"e5":240,"e8":238}}}'
        )
        self.assertTrue(raw.endswith("}}}"))
        d=v.inspect_request(c,raw)
        self.assertFalse(d["raw_json_accepted"])
        self.assertTrue(d["one_brace_candidate"])
        self.assertTrue(d["would_pass_full_host_contract_after_one_brace"])
        self.assertEqual(d["diagnostic"],
            "HYPOTHETICAL_HOST_VALID_NOT_ACTUALLY_DISPATCHED_IN_V107")

    def test_raw_valid_request_needs_no_normalization(self):
        c=case()
        d=v.inspect_request(c,valid_proposal(c))
        self.assertTrue(d["raw_json_accepted"])
        self.assertFalse(d["one_brace_candidate"])
        self.assertFalse(d["would_pass_full_host_contract_after_one_brace"])
        self.assertIsNone(d["simulated_tool_answer"])

    def test_extra_two_braces_not_accepted(self):
        c=case()
        malformed=valid_proposal(c)+"}}"
        d=v.inspect_request(c,malformed)
        self.assertFalse(d["raw_json_accepted"])
        self.assertFalse(d["would_pass_full_host_contract_after_one_brace"])
        self.assertIsNone(d["simulated_tool_answer"])

    def test_trailing_prose_is_not_repaired(self):
        c=case()
        for malformed in (valid_proposal(c)+" extra",
                          valid_proposal(c)+"} trailing",
                          "Here is your JSON: "+valid_proposal(c)+"}"):
            with self.subTest(malformed=malformed[:30]):
                d=v.inspect_request(c,malformed)
                self.assertFalse(d["would_pass_full_host_contract_after_one_brace"])

    def test_forged_numbers_rejected_even_after_one_brace(self):
        c=case()
        raw=json.loads(valid_proposal(c))
        raw["arguments"]["e5"]=241
        d=v.inspect_request(c,json.dumps(raw)+"}")
        self.assertTrue(d["one_brace_candidate"])
        self.assertFalse(d["would_pass_full_host_contract_after_one_brace"])
        self.assertEqual(d["diagnostic"],"CANDIDATE_REJECTED_V108_HOST_AUTHORITY_MISMATCH")
        self.assertIsNone(d["simulated_tool_answer"])

    def test_wrong_source_id_not_accepted(self):
        c=case()
        raw=json.loads(valid_proposal(c))
        raw["source_id"]="ForgedOtherSource"
        d=v.inspect_request(c,json.dumps(raw)+"}")
        self.assertFalse(d["would_pass_full_host_contract_after_one_brace"])
        self.assertIsNone(d["simulated_tool_answer"])

    def test_duplicate_fields_never_accepted(self):
        c=case()
        p=valid_proposal(c)
        dup=p.replace('"tool":','"tool":"delete_all_files","tool":')
        d=v.inspect_request(c,dup+"}")
        self.assertFalse(d["would_pass_full_host_contract_after_one_brace"])
        self.assertIn("DUPLICATE",d["diagnostic"])

    def test_unknown_tool_never_accepted(self):
        c=case()
        raw=json.loads(valid_proposal(c))
        raw["tool"]="delete_all_files"
        d=v.inspect_request(c,json.dumps(raw)+"}")
        self.assertFalse(d["would_pass_full_host_contract_after_one_brace"])

    def test_false_model_success_cannot_be_attributed(self):
        c=case()
        d=v.inspect_request(c,valid_proposal(c)+"}")
        self.assertFalse(d["raw_json_accepted"])
        self.assertEqual(d["diagnostic"],
            "HYPOTHETICAL_HOST_VALID_NOT_ACTUALLY_DISPATCHED_IN_V107")

    def test_source_evidence_enforces_historical_scores(self):
        source=inspect.getsource(v.verified_evidence)
        self.assertIn('"valid_model_generated_requests")!=0',source)
        self.assertIn('"invalid_model_generated_requests_rejected")!=7',source)
        self.assertIn('v107.select_fresh_cases()',source)
        self.assertIn("V108_V107_ORIGINAL_REJECTION_NOT_REPRODUCIBLE",source)
        self.assertIn("V108_SAVED_QWEN_RECORD_UNVERIFIED_",source)

    def test_hashes_are_checked_again(self):
        src=inspect.getsource(v.audit)
        self.assertIn("V108_PROTECTED_REPORT_CHANGED",src)
        self.assertIn("V108_PROTECTED_CURRICULUM_CHANGED",src)

    def test_no_saved_source_mutation_or_inference(self):
        src=inspect.getsource(v)
        for banned in ("subprocess.Popen(", "subprocess.run(", ".write_text(",
                       ".write_bytes(", '.open("w"', "llama-finetune",
                       "llama-completion", "mcp.register", "requests.get"):
            self.assertNotIn(banned,src)
        self.assertIn("new_live_tool_registration",src)

    def test_frozen_v10_test_not_opened(self):
        src=inspect.getsource(v)
        self.assertNotIn('"test.jsonl"',src)
        self.assertNotIn('"test-ground-truth.jsonl"',src)
        self.assertIn("source_reports_or_data_changed",src)

if __name__=="__main__":
    unittest.main()
