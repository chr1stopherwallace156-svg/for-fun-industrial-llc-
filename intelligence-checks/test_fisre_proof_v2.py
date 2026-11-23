"""Offline standard-library tests for bounded FISRE V2 rational proofs."""
import contextlib
import io
import json
import pathlib
import sys
import tempfile
import unittest

SRC = pathlib.Path(__file__).resolve().parents[1] / 'src' / 'semantic'
sys.path.insert(0, str(SRC))
import fisre_proof_v2 as proof

PRICE = 'def calculate_price(cost, margin):\n    return cost / (1 - margin)\n'


def ranges(*specs):
    return proof.parse_ranges(list(specs))


class ProofTests(unittest.TestCase):
    def test_safe_domain_proved(self):
        r = proof.inspect(PRICE, 'calculate_price', ranges('cost=0:1000', 'margin=0:0.5'))
        self.assertEqual(r['status'], 'PROVED')
        self.assertEqual(r['division_checks'][0]['minimum'], '1/2')
        self.assertEqual(r['division_checks'][0]['maximum'], '1')
        self.assertFalse(r['source_executed'])

    def test_single_boundary_counterexample(self):
        r = proof.inspect(PRICE, 'calculate_price', ranges('cost=0:1000', 'margin=0:1'))
        self.assertEqual(r['status'], 'COUNTEREXAMPLE_FOUND')
        self.assertEqual(r['division_checks'][0]['witness']['margin'], '1')

    def test_interior_counterexample(self):
        r = proof.inspect(PRICE, 'calculate_price', ranges('cost=5:5', 'margin=0.9:1.1'))
        self.assertEqual(r['status'], 'COUNTEREXAMPLE_FOUND')
        self.assertEqual(r['division_checks'][0]['witness']['margin'], '1')

    def test_second_safe_domain(self):
        r = proof.inspect(PRICE, 'calculate_price', ranges('cost=5:9', 'margin=1.2:2'))
        self.assertEqual(r['status'], 'PROVED')
        self.assertEqual(r['division_checks'][0]['maximum'], '-1/5')

    def test_nonlinear_divisor_unknown(self):
        src = 'def p(x, y):\n    return 3 / (x * y - 1)\n'
        r = proof.inspect(src, 'p', ranges('x=0:2', 'y=0:2'))
        self.assertEqual(r['status'], 'UNKNOWN')
        self.assertEqual(r['division_checks'][0]['status'], 'UNKNOWN_NONAFFINE')

    def test_unsupported_function_unknown(self):
        src = 'def p(x):\n    print(x)\n    return x / (x - 1)\n'
        r = proof.inspect(src, 'p', ranges('x=0:2'))
        self.assertEqual(r['status'], 'UNKNOWN')

    def test_dynamic_call_unknown(self):
        src = 'def p(x):\n    return f() / (1-x)\n'
        r = proof.inspect(src, 'p', ranges('x=0:2'))
        self.assertEqual(r['status'], 'UNKNOWN')

    def test_decorated_function_unknown(self):
        src = '@unsafe\ndef p(x):\n    return x / (1-x)\n'
        self.assertEqual(proof.inspect(src, 'p', ranges('x=0:1'))['status'], 'UNKNOWN')

    def test_multi_divisors_distinct_proofs(self):
        src = 'def p(x):\n    return 1 / (x+2) + 1 / (x-1)\n'
        r = proof.inspect(src, 'p', ranges('x=0:2'))
        self.assertEqual(r['status'], 'COUNTEREXAMPLE_FOUND')
        self.assertEqual(sum(t['status'] == 'ZERO_WITNESS_FOUND' for t in r['division_checks']), 1)

    def test_zero_width_constant_domain(self):
        src = 'def p(x):\n    return 3 / (2*x-2)\n'
        r = proof.inspect(src, 'p', ranges('x=1:1'))
        self.assertEqual(r['status'], 'COUNTEREXAMPLE_FOUND')
        self.assertEqual(r['division_checks'][0]['witness']['x'], '1')

    def test_mixed_sign_affine_witness(self):
        src = 'def p(x, y):\n    return 4 / (2*x-y+3)\n'
        r = proof.inspect(src, 'p', ranges('x=-2:1', 'y=0:4'))
        self.assertEqual(r['status'], 'COUNTEREXAMPLE_FOUND')
        w = {k: proof.rational(v) for k, v in r['division_checks'][0]['witness'].items()}
        self.assertEqual(2*w['x']-w['y']+3, 0)

    def test_reversed_and_duplicate_ranges_hold(self):
        with self.assertRaisesRegex(ValueError, 'RANGE_REVERSED'):
            ranges('margin=2:1')
        with self.assertRaisesRegex(ValueError, 'RANGE_NAME_OR_SYNTAX_INVALID'):
            ranges('x=0:1', 'x=2:3')

    def test_invalid_numeric_input_hold(self):
        with self.assertRaisesRegex(ValueError, 'NUMBER_INVALID'):
            ranges('x=0:1;Write-Host HACK')

    def test_out_of_scope_variable_hold(self):
        with self.assertRaisesRegex(ValueError, 'RANGE_PARAMETERS_MISMATCH'):
            proof.inspect(PRICE, 'calculate_price', ranges('unknown=0:1'))

    def test_no_divisors_vacuously_proven(self):
        src = 'def plus(x):\n    return x + 1\n'
        r = proof.inspect(src, 'plus', ranges('x=0:5'))
        self.assertEqual(r['status'], 'PROVED')
        self.assertEqual(r['division_checks'], [])

    def test_cli_windows_style_range_works(self):
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            (root/'sample.py').write_text(PRICE)
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                status = proof.main(['sample.py', '--root', str(root), '--function', 'calculate_price', '--range', 'cost=0:100', '--range', 'margin=0:0.5'])
            self.assertEqual(status, 0, err.getvalue())
            self.assertEqual(json.loads(out.getvalue())['status'], 'PROVED')

    def test_cli_invalid_ranges_holds(self):
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            (root/'sample.py').write_text(PRICE)
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                status = proof.main(['sample.py', '--root', str(root), '--function', 'calculate_price', '--range', 'cost=0:100', '--range', 'margin=oops:1'])
            self.assertEqual(status, 2)
            self.assertEqual(json.loads(err.getvalue())['status'], 'HOLD')


if __name__ == '__main__':
    unittest.main()
