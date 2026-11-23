"""Pure offline V10.6 typed-host-authorized math tool proposal tests.

All proposals are SYNTHETIC fixtures. No Qwen inference, MCP registration,
network calls, training, installations, or reading/writing local model files.
"""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "fun_math_v106",ROOT/"scripts"/"Fun-Math-Tool-Contract-V106.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def host(errors=None, source_id="FixtureV106"):
    return m.host_authority(source_id,errors or {3:236,5:230,8:235})

def proposal(e3=236,e5=230,e8=235, source_id="FixtureV106"):
    return json.dumps({"schema":m.SCHEMA,"tool":m.TOOL,
                       "source_id":source_id,
                       "arguments":{"e3":e3,"e5":e5,"e8":e8}},
                      sort_keys=True,separators=(",",":"))

class V106TypedMathContractTests(unittest.TestCase):
    def test_manifest_exact_nonmutating_tool(self):
        meta=m.tool_manifest()
        self.assertEqual(meta["name"],"verify_window_math")
        fields=meta["inputSchema"]
        self.assertEqual(fields["required"],["e3","e5","e8"])
        self.assertFalse(fields["additionalProperties"])
        self.assertFalse(meta["registered_with_live_qwen_or_rea"])

    def test_host_authorized_correct_proposal_executes(self):
        h=host()
        out=m.dispatch(h,proposal())
        self.assertEqual(out["state"],"V106_HOST_AUTHORIZED_READONLY_MATH_EXECUTED")
        self.assertEqual(out["verified_fields"]["BEST_WINDOWS"],[5])
        self.assertEqual(out["verified_fields"]["MIN_ERROR"],230)
        self.assertEqual(out["verified_fields"]["PROOF_D35"],6)
        self.assertEqual(out["verified_fields"]["D38"],1)
        self.assertEqual(out["verified_fields"]["D58"],-5)
        self.assertTrue(out["arguments_matched_host_authority"])
        self.assertFalse(out["qwen_tool_request_actually_generated"])
        self.assertFalse(out["production_registration_performed"])
        self.assertFalse(out["model_training_or_inference_performed"])

    def test_all_tie_patterns_correct(self):
        examples=(({3:18,5:18,8:29},[3,5]),
                  ({3:18,5:29,8:18},[3,8]),
                  ({3:29,5:18,8:18},[5,8]),
                  ({3:18,5:18,8:18},[3,5,8]))
        for errors,expect in examples:
            with self.subTest(expect=expect):
                h=host(errors)
                result=m.dispatch(h,m.proposal_for_fixture(h))
                self.assertEqual(result["verified_fields"]["BEST_WINDOWS"],expect)

    def test_forged_numeric_arguments_rejected(self):
        h=host()
        for c in (proposal(e3=235),proposal(e5=999),proposal(e8=0)):
            with self.subTest(c=c), self.assertRaisesRegex(ValueError,"ARGUMENTS_DIFFER_FROM_HOST_SOURCE"):
                m.dispatch(h,c)

    def test_forged_source_id_rejected(self):
        with self.assertRaisesRegex(ValueError,"UNTRUSTED_SOURCE_ID_MISMATCH"):
            m.dispatch(host(),proposal(source_id="OtherSource"))

    def test_tampered_host_fingerprint_rejected(self):
        h=host()
        h["errors"][5]=1000
        with self.assertRaisesRegex(ValueError,"HOST_AUTHORITY_FINGERPRINT_MISMATCH"):
            m.dispatch(h,proposal())

    def test_forged_host_digest_rejected(self):
        h=host()
        h["fingerprint"]="0"*64
        with self.assertRaisesRegex(ValueError,"HOST_AUTHORITY_FINGERPRINT_MISMATCH"):
            m.dispatch(h,proposal())

    def test_boolean_float_string_or_negative_numbers_rejected(self):
        examples=(True,3.14,"18",-1,1000000001,None,[],{})
        for bad in examples:
            p=json.dumps({"schema":m.SCHEMA,"tool":m.TOOL,"source_id":"FixtureV106",
                          "arguments":{"e3":bad,"e5":230,"e8":235}})
            with self.subTest(bad=str(bad)),self.assertRaisesRegex(ValueError,"INTEGER"):
                m.parse_proposal(p)

    def test_duplicate_top_level_keys_rejected(self):
        p=('{"schema":"'+m.SCHEMA+'","tool":"'+m.TOOL+'",'
           '"source_id":"FixtureV106","source_id":"Different",'
           '"arguments":{"e3":236,"e5":230,"e8":235}}')
        with self.assertRaisesRegex(ValueError,"DUPLICATE_JSON_KEY_source_id"):
            m.parse_proposal(p)

    def test_duplicate_argument_keys_rejected(self):
        p=('{"schema":"'+m.SCHEMA+'","tool":"'+m.TOOL+'","source_id":"FixtureV106",'
           '"arguments":{"e3":236,"e5":230,"e5":999,"e8":235}}')
        with self.assertRaisesRegex(ValueError,"DUPLICATE_JSON_KEY_e5"):
            m.parse_proposal(p)

    def test_unknown_tool_and_schema_rejected(self):
        p=proposal()
        with self.assertRaisesRegex(ValueError,"TOOL_NOT_IN_ALLOWLIST"):
            m.parse_proposal(p.replace(m.TOOL,"delete_files"))
        with self.assertRaisesRegex(ValueError,"SCHEMA_NOT_APPROVED"):
            m.parse_proposal(p.replace(m.SCHEMA,"unknown-version"))
        with self.assertRaisesRegex(ValueError,"PROPOSAL_FIELDS_INVALID"):
            m.parse_proposal(p[:-1]+',"autorun":true}')

    def test_unexpected_nested_parameter_rejected(self):
        original=json.loads(proposal())
        original["arguments"]["path"]="C:/some/file"
        with self.assertRaisesRegex(ValueError,"ARGUMENT_SCHEMA_INVALID"):
            m.parse_proposal(json.dumps(original))

    def test_nonfinite_or_malformed_json_rejected(self):
        p=proposal()
        with self.assertRaisesRegex(ValueError,"NONFINITE_JSON_NUMBER"):
            m.parse_proposal(p.replace("236","NaN"))
        with self.assertRaisesRegex(ValueError,"PROPOSAL_NOT_STRICT_JSON"):
            m.parse_proposal(p+" garbage")
        with self.assertRaisesRegex(ValueError,"PROPOSAL_SIZE_OR_TYPE_INVALID"):
            m.parse_proposal(p+" "*(m.MAX_REQUEST_BYTES+1))

    def test_invalid_source_id_rejected(self):
        for source in ("../escape","with space","", "z"*65):
            with self.subTest(source=source),self.assertRaisesRegex(ValueError,"HOST_SOURCE_ID_INVALID"):
                m.host_authority(source,{3:1,5:2,8:3})

    def test_sha_fingerprint_is_not_authentication(self):
        h=host()
        self.assertTrue(h["fingerprint_is_not_a_signature"])
        self.assertEqual(len(h["fingerprint"]),64)
        out=m.dispatch(h,proposal())
        self.assertFalse(out["model_proposal_authenticated"])
        self.assertTrue(out["host_values_sha256_not_a_signature"])

    def test_synthetic_fixture_not_claimed_as_real_ai_tool_call(self):
        h=host()
        fixture=m.proposal_for_fixture(h)
        self.assertEqual(m.parse_proposal(fixture)["source_id"],h["source_id"])
        out=m.dispatch(h,fixture)
        self.assertFalse(out["qwen_tool_request_actually_generated"])

    def test_no_external_actions_or_model_or_file_io(self):
        import inspect
        src=inspect.getsource(m)
        for forbidden in ("subprocess.","requests.","socket.","llama-server",
                          "llama-finetune","llama-completion",".write_text(",
                          ".write_bytes(",'.open("w"', "mcp.register"):
            self.assertNotIn(forbidden,src)
        self.assertIn('"production_registration_performed":False',src)

if __name__=="__main__":
    unittest.main()
