"""V10.7: offline isolated Qwen tool-request test suite.

All generated proposals in unit tests are synthetic fixtures, not real Qwen
inferences. Actual evaluation must use separate explicit operator approval.
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
    "fun_v107_tool_requests", ROOT/"scripts"/"Evaluate-Fun-Qwen-Tool-Requests-V107.py")
v=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

def case(errors=None):
    errors=errors if errors is not None else {3:236,5:230,8:235}
    return {
        "id":"SyntheticOnly","source_id":"V107Fixture",
        "errors":errors,
        "pattern":v.v10.argmin_set(errors),
        "prompt":("Observed validation errors: window 3 = {}, window 5 = {}, "
                  "window 8 = {}. Select EVERY window tied for the LOWEST error."
                  ).format(errors[3],errors[5],errors[8]),
        "reference_answer":v.v10.encode_label(errors),
    }

def proposal(c):
    h=v.v106.host_authority(c["source_id"],c["errors"])
    return v.v106.proposal_for_fixture(h)

class V107RealToolProposalTests(unittest.TestCase):
    def test_version_scope_and_approval(self):
        self.assertEqual(v.N_CASES,7)
        self.assertEqual(v.CONSENT,"I_APPROVE_ISOLATED_QWEN_V107_TOOL_REQUEST_EXPERIMENT")
        self.assertEqual(v.MODEL_SHA,"7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5")

    def test_prompt_is_not_host_created_json(self):
        p=v.tool_request_prompt(case())
        self.assertIn("Return only ONE valid, compact JSON object",p)
        self.assertIn("Question: Observed validation errors",p)
        self.assertIn("verify_window_math",p)
        self.assertNotIn('"arguments":',p)
        self.assertNotIn("PROOF_D35=6",p)

    def test_valid_synthetic_json_dispatches_through_host_contract(self):
        c=case()
        r=v.evaluate_proposal(c,proposal(c))
        self.assertEqual(r["proposal_status"],"VALID_HOST_AUTHORIZED_AND_DISPATCHED")
        self.assertTrue(r["host_math_tool_dispatched"])
        self.assertEqual(r["verified_tool_answer"],v.v104.verify(c["errors"])["verified_answer"])
        self.assertFalse(r["real_qwen_inference_provenance"])
        self.assertFalse(r["source_values_from_qwen_used_as_authority"])

    def test_all_seven_window_patterns(self):
        samples=(
            ({3:10,5:12,8:14},(3,)),
            ({3:12,5:10,8:14},(5,)),
            ({3:12,5:14,8:10},(8,)),
            ({3:10,5:10,8:14},(3,5)),
            ({3:10,5:14,8:10},(3,8)),
            ({3:14,5:10,8:10},(5,8)),
            ({3:10,5:10,8:10},(3,5,8)),
        )
        for errors,winners in samples:
            with self.subTest(winners=winners):
                c=case(errors)
                self.assertEqual(c["pattern"],winners)
                r=v.evaluate_proposal(c,proposal(c))
                self.assertTrue(r["host_math_tool_dispatched"])
                self.assertIn("BEST_WINDOWS="+",".join(map(str,winners)),r["verified_tool_answer"])

    def test_forged_number_never_dispatches(self):
        c=case()
        for key,new in (("e3",237),("e5",999),("e8",0)):
            candidate=json.loads(proposal(c))
            candidate["arguments"][key]=new
            with self.subTest(key=key):
                r=v.evaluate_proposal(c,json.dumps(candidate))
                self.assertFalse(r["host_math_tool_dispatched"])
                self.assertEqual(r["proposal_status"],"REJECTED_FAIL_CLOSED")
                self.assertIn("UNTRUSTED_ARGUMENTS_DIFFER_FROM_HOST_SOURCE",
                              r["proposal_rejection_reason"])
                self.assertIsNone(r["verified_tool_answer"])

    def test_forged_source_never_dispatches(self):
        c=case()
        p=json.loads(proposal(c))
        p["source_id"]="Other"
        r=v.evaluate_proposal(c,json.dumps(p))
        self.assertFalse(r["host_math_tool_dispatched"])
        self.assertIn("SOURCE_ID_MISMATCH",r["proposal_rejection_reason"])

    def test_unknown_tool_and_extra_keys_never_dispatch(self):
        c=case()
        for modification in ({"tool":"delete_all_files"},
                             {"unapproved_extra":True}):
            raw=json.loads(proposal(c))
            raw.update(modification)
            r=v.evaluate_proposal(c,json.dumps(raw))
            self.assertFalse(r["host_math_tool_dispatched"])

    def test_invalid_prose_and_fenced_json_never_dispatch(self):
        c=case()
        responses=("The best window is 5.",
                   "Here is the request:\n"+proposal(c),
                   "FENCED_JSON\n"+proposal(c)+"\nEND_FENCE",
                   proposal(c)+"\n"+proposal(c))
        for candidate in responses:
            with self.subTest(text=candidate[:20]):
                result=v.evaluate_proposal(c,candidate)
                self.assertFalse(result["host_math_tool_dispatched"])
                self.assertIsNone(result["verified_tool_answer"])
                self.assertIsNotNone(result["host_oracle_reference_for_diagnostics"])

    def test_duplicate_json_key_never_dispatches(self):
        c=case()
        duplicate=('{"schema":"'+v.v106.SCHEMA+'","tool":"'+v.v106.TOOL+'",'
                   '"source_id":"V107Fixture","source_id":"Hacked",'
                   '"arguments":{"e3":236,"e5":230,"e8":235}}')
        r=v.evaluate_proposal(c,duplicate)
        self.assertFalse(r["host_math_tool_dispatched"])
        self.assertIn("DUPLICATE_JSON_KEY_source_id",r["proposal_rejection_reason"])

    def test_host_values_and_prompt_must_agree(self):
        c=case()
        c["prompt"]=c["prompt"].replace("window 5 = 230","window 5 = 999")
        with self.assertRaisesRegex(RuntimeError,"V107_HOST_NUMBERS_NOT_MATCHING_VERIFIED_QUESTION"):
            v.evaluate_proposal(c,proposal(c))

    def test_missing_old_report_fail_closed(self):
        with tempfile.TemporaryDirectory() as root:
            with patch.object(v,"PREVIOUS",Path(root)/"not-there.json"):
                with self.assertRaisesRegex(RuntimeError,"V107_V105_EVIDENCE_MISSING_OR_UNTRUSTED"):
                    v.read_prior_v105({"cases":[case()]})

    def test_tampered_old_report_fail_closed(self):
        with tempfile.TemporaryDirectory() as root:
            p=Path(root)/"toolbridge-report.json"
            p.write_text('{"version":"forged"}',encoding="utf-8")
            with patch.object(v,"PREVIOUS",p):
                with self.assertRaisesRegex(RuntimeError,"V107_V105_REPORT_IDENTITY_OR_SCOPE_MISMATCH"):
                    v.read_prior_v105({"cases":[case()]})

    def test_selection_excludes_all_21_prior_qwen_cases(self):
        dataset=v.v10.build()
        render=v.v10.render_files(dataset)
        with tempfile.TemporaryDirectory() as root:
            target=Path(root)
            for name in ("validation.jsonl","validation-ground-truth.jsonl"):
                (target/name).write_bytes(render[name])
            ordered={p:[] for p in v.v10.PATTERNS}
            for i,record in enumerate(dataset["validation"]):
                ordered[record["pattern"]].append({
                    "id":"v10-validation-"+str(i),
                    "pattern":record["pattern"],
                    "errors":record["errors"],
                    "prompt":record["question"],
                    "reference_answer":record["answer"],
                })
            ids_old={r["id"] for rows in ordered.values() for r in rows[:2]}
            ids_v105={rows[2]["id"] for rows in ordered.values()}
            hashes={str(target/name):hashlib.sha256(render[name]).hexdigest()
                    for name in ("validation.jsonl","validation-ground-truth.jsonl")}
            prior={"cases":[rows[2] for rows in ordered.values()],
                   "source_hashes":hashes,
                   "original_v101_case_ids":list(ids_old),
                   "prior_v101_report_sha256":"mock-report"}
            with patch.object(v.v105,"select_unseen_validation",return_value=prior), \
                 patch.object(v,"read_prior_v105",return_value={
                     "sha256":"mock-prior-sha","ids":ids_v105
                 }),patch.object(v.v101,"DATA_DIR",target):
                result=v.select_fresh_cases()
            self.assertEqual(result["excluded_previous_case_count"],21)
            self.assertEqual(len(result["cases"]),7)
            self.assertEqual({r["id"] for r in result["cases"]},
                             {rows[3]["id"] for rows in ordered.values()})
            self.assertEqual({r["pattern"] for r in result["cases"]},set(v.v10.PATTERNS))

    def test_new_run_folder_no_overwrite(self):
        s=inspect.getsource(v.preflight)
        self.assertIn("V107_OUTPUT_DIR_EXISTS_NO_OVERWRITE",s)
        self.assertIn("v7.inspect_existing_binary()",s)
        self.assertIn("v7.initial_resources()",s)

    def test_actual_real_qwen_source_and_provenance(self):
        s=inspect.getsource(v.run)
        self.assertIn('v7.run_case(prep["binary"],native_case,"baseline",RUN)',s)
        self.assertIn('result["real_qwen_inference_provenance"]=True',s)
        self.assertIn("V107_PROTECTED_QWEN_MODEL_CHANGED",s)
        self.assertIn("V107_V10_VALIDATION_SOURCE_CHANGED",s)

    def test_accepted_and_rejected_separate(self):
        s=inspect.getsource(v.run)
        self.assertIn('accepted=sum(x["host_math_tool_dispatched"] for x in results)',s)
        self.assertIn('"invalid_model_generated_requests_rejected":N_CASES-accepted',s)
        self.assertIn('"native_model_tool_call_protocol_proven":False',s)
        self.assertIn('"model_output_never_grants_authority":True',s)

    def test_separate_new_operator_consent_and_preflight(self):
        s=inspect.getsource(v.main)
        self.assertIn("V107_EXPLICIT_OPERATOR_APPROVAL_REQUIRED",s)
        self.assertIn("READY_FOR_ISOLATED_TOOL_REQUEST_TEST_NO_INFERENCE",s)
        self.assertIn("args.preflight",s)

    def test_frozen_test_not_opened_and_no_training(self):
        s=inspect.getsource(v)
        self.assertNotIn('"test.jsonl"',s)
        self.assertNotIn('"test-ground-truth.jsonl"',s)
        for forbidden in ("llama-finetune","cmake --build","git clone",
                          "requests.get","mcp.register","llama-server"):
            self.assertNotIn(forbidden,s)

if __name__=="__main__":
    unittest.main()
