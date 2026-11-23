"""Offline standard-library-only V10.4 mathematical verifier tests."""
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("fun_math_v104",ROOT/"scripts"/"Verified-Fun-Math-Decision-V104.py")
mathv=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mathv)

class StandaloneWindowMathTests(unittest.TestCase):
    def test_unique_minima(self):
        self.assertEqual(mathv.calculate({3:10,5:11,8:20})["BEST_WINDOWS"],(3,))
        self.assertEqual(mathv.calculate({3:11,5:10,8:20})["BEST_WINDOWS"],(5,))
        self.assertEqual(mathv.calculate({3:11,5:20,8:10})["BEST_WINDOWS"],(8,))

    def test_all_tie_types(self):
        cases=(
            ({3:18,5:18,8:29},(3,5)),
            ({3:18,5:29,8:18},(3,8)),
            ({3:29,5:18,8:18},(5,8)),
            ({3:18,5:18,8:18},(3,5,8)),
        )
        for errors,winners in cases:
            with self.subTest(winners=winners):
                result=mathv.calculate(errors)
                self.assertEqual(result["BEST_WINDOWS"],winners)
                self.assertTrue(result["TIE"])

    def test_signed_differences_cannot_be_faked_by_wrong_model(self):
        errors={3:236,5:230,8:235}
        expected=mathv.calculate(errors)
        self.assertEqual((expected["PROOF_D35"],expected["D38"],expected["D58"]),(6,1,-5))
        wrong=("MIN_ERROR=230; BEST_WINDOWS=5; TIE=NO; "
               "FIBONACCI_GUARANTEE=NO; PROOF_D35=-6; D38=-1; D58=5.")
        result=mathv.verify(errors,wrong)
        self.assertEqual(result["state"],"MODEL_CLAIM_INCORRECT_VERIFIED_ALTERNATIVE_AVAILABLE")
        self.assertEqual(set(result["model_claim_mismatch_fields"]),
                         {"PROOF_D35","D38","D58"})
        self.assertFalse(result["corrected_output_generated_by_qwen"])

    def test_correct_claim_with_semicolon_variation(self):
        errors={3:254,5:267,8:254}
        text=("MIN_ERROR=254; BEST_WINDOWS=3,8; TIE=YES; "
              "FIBONACCI_GUARANTEE=NO; PROOF_D35=-13; D38=0; D58=+13.")
        result=mathv.verify(errors,text)
        self.assertEqual(result["state"],"MODEL_CLAIM_VERIFIED_AGAINST_INPUTS")
        self.assertEqual(result["model_claim_mismatch_fields"],{})

    def test_only_exact_typed_schema(self):
        with self.assertRaisesRegex(ValueError,"EXACTLY_WINDOWS"):
            mathv.verify({3:3,5:5})
        with self.assertRaisesRegex(ValueError,"EXACTLY_WINDOWS"):
            mathv.verify({3:3,5:5,8:8,13:13})
        with self.assertRaisesRegex(ValueError,"INTEGER"):
            mathv.verify({3:3,5:True,8:8})
        with self.assertRaisesRegex(ValueError,"INTEGER"):
            mathv.verify({3:-1,5:5,8:8})
        with self.assertRaisesRegex(ValueError,"INTEGER"):
            mathv.verify({3:3,5:5,8:10**10})

    def test_parse_rejects_duplicate_or_missing_model_fields(self):
        valid=mathv.format_oracle(mathv.calculate({3:18,5:18,8:29}))
        with self.assertRaisesRegex(ValueError,"AMBIGUOUS_CLAIM"):
            mathv.verify({3:18,5:18,8:29},valid+" D58=-99.")
        with self.assertRaisesRegex(ValueError,"AMBIGUOUS_CLAIM"):
            mathv.verify({3:18,5:18,8:29},"MIN_ERROR=18; BEST_WINDOWS=3,5")

    def test_unsorted_and_repeated_winners_rejected(self):
        good=mathv.format_oracle(mathv.calculate({3:18,5:18,8:29}))
        for bad in ("BEST_WINDOWS=5,3","BEST_WINDOWS=3,3"):
            with self.subTest(bad=bad):
                with self.assertRaisesRegex(ValueError,"WINNER_LIST_DUPLICATE_OR_UNSORTED"):
                    mathv.parse_model_claim(good.replace("BEST_WINDOWS=3,5",bad))

    def test_invalid_override_of_correct_minimum_detected(self):
        e={3:18,5:18,8:29}
        claim=mathv.format_oracle(mathv.calculate(e)).replace("MIN_ERROR=18","MIN_ERROR=29")
        result=mathv.verify(e,claim)
        self.assertEqual(result["model_claim_mismatch_fields"]["MIN_ERROR"]["verified"],18)

    def test_invariant_insufficient_without_trusted_inputs(self):
        e={3:236,5:230,8:235}
        claims=mathv.parse_model_claim("MIN_ERROR=230; BEST_WINDOWS=5; TIE=NO; "
               "FIBONACCI_GUARANTEE=NO; PROOF_D35=-6; D38=-1; D58=5.")
        self.assertEqual(claims["PROOF_D35"]+claims["D58"],claims["D38"])
        self.assertNotEqual(claims["PROOF_D35"],mathv.calculate(e)["PROOF_D35"])

    def test_full_small_space_exhaustive_check(self):
        report=mathv.offline_proofs()
        self.assertEqual(report["error_triplets_verified"],1728)
        self.assertEqual(report["winner_patterns_covered"],7)

    def test_large_integer_boundaries(self):
        maxval=mathv.MAX_ERROR
        out=mathv.verify({3:maxval,5:0,8:maxval})
        self.assertEqual(out["verified_fields"]["BEST_WINDOWS"],[5])
        self.assertEqual(out["verified_fields"]["PROOF_D35"],maxval)
        self.assertEqual(out["verified_fields"]["D58"],-maxval)

    def test_no_inference_deployment_or_filesystem_writes(self):
        import inspect
        text=inspect.getsource(mathv)
        for forbidden in ("subprocess", "requests.", "llama-finetune",
                          "llama-completion", "llama-server", ".write_text(",
                          ".write_bytes(", ".unlink(", ".rename(", "socket."):
            self.assertNotIn(forbidden,text)
        self.assertIn('"production_connected":False',text)
        self.assertIn('"qwen_or_adapters_loaded":False',text)

if __name__=="__main__":
    unittest.main()
