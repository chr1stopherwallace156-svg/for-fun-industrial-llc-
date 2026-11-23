"""Offline standard-library-only tests; do not execute analyzed source."""
import importlib.util
import json
import pathlib
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
FILE = HERE.parent / 'src' / 'semantic' / 'fisre_v1.py'
spec = importlib.util.spec_from_file_location('fisre_v1', FILE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class FisreTests(unittest.TestCase):
    def test_ast_and_graph(self):
        source = 'def a(x):\n    return b(x)\n\ndef b(x):\n    return x + 2\n'
        report = mod.analyze_text(source, 'fixture.py')
        self.assertEqual(report['version'], 'fi-semantic-reasoning-v1')
        self.assertEqual(len(report['functions']), 2)
        self.assertEqual(report['call_edges'][0]['callee'], 'b')
        self.assertEqual(report['call_edges'][0]['status'], 'lexical_candidate_not_runtime_proof')
        self.assertFalse(report['inspected_code_executed'])
        self.assertEqual(report['external_tool_calls'], 0)

    def test_transitive_effect_candidate_with_provenance(self):
        src = ('def top():\n    return mid()\n'
               'def mid():\n    return risky()\n'
               'def risky():\n    print("hello")\n')
        report = mod.analyze_text(src)
        top = {f['name']: f for f in report['functions']}['top']
        self.assertEqual(top['reachable_effect_candidates'],
                         [{'effect': 'console_io_candidate', 'via': ['top', 'mid', 'risky']}])
        self.assertFalse(top['runtime_behavior_verified'])

    def test_recursive_graph_bounded(self):
        src = 'def a():\n    return b()\n\ndef b():\n    return a()\n'
        r = mod.analyze_text(src)
        self.assertEqual(len(r['call_edges']), 2)
        self.assertTrue(all(f['reachable_effect_candidates'] == [] for f in r['functions']))

    def test_annotation_contract_is_syntax_not_truth(self):
        r = mod.analyze_text('def f(x: int) -> int:\n    """Example only"""\n    return x\n')
        f = r['functions'][0]
        self.assertEqual(f['parameter_annotations'], {'x': 'int'})
        self.assertEqual(f['return_annotation'], 'int')
        self.assertFalse(f['runtime_behavior_verified'])

    def test_divisor_and_arithmetic(self):
        src = 'def calculate_price(cost, margin):\n    return cost / (1 - margin)\n'
        r = mod.analyze_text(src)
        self.assertEqual(r['functions'][0]['divisor_risks'][0]['expression'], '1 - margin')
        p = mod.probe_expression(src, 'calculate_price', {'cost': '100', 'margin': '0.25'})
        self.assertEqual(p['result_rational'], '400/3')
        with self.assertRaisesRegex(ValueError, 'DIVISION_BY_ZERO'):
            mod.probe_expression(src, 'calculate_price', {'cost': '100', 'margin': '1'})

    def test_probe_never_executes_code(self):
        src = 'def dangerous(x):\n    return __import__("os").system("echo nope")\n'
        with self.assertRaisesRegex(ValueError, 'EXPRESSION_NOT_IN_VERIFIED_ARITHMETIC_SUBSET'):
            mod.probe_expression(src, 'dangerous', {'x': '1'})

    def test_imported_or_multistep_calls_not_probed(self):
        src = 'def f(x):\n    y = x * 2\n    return y\n'
        with self.assertRaisesRegex(ValueError, 'REQUIRES_SINGLE_ARITHMETIC_RETURN'):
            mod.probe_expression(src, 'f', {'x': 1})

    def test_suspected_effects_are_not_claimed_verified(self):
        src = 'def edit(path):\n    open(path, "w")\n'
        f = mod.analyze_text(src)['functions'][0]
        self.assertIn('filesystem_io_candidate', f['suspected_effects'])
        self.assertFalse(f['runtime_behavior_verified'])

    def test_unknown_call_distinction(self):
        r = mod.analyze_text('def x():\n    something()\n')
        self.assertEqual(r['functions'][0]['unresolved_calls'], ['something'])
        self.assertEqual(r['call_edges'], [])

    def test_nested_code_does_not_overwrite_parent(self):
        src = 'def outer():\n    def inner():\n        print("hello")\n    return 1\n'
        r = mod.analyze_text(src)
        f = {f['name']: f for f in r['functions']}
        self.assertEqual(f['outer']['suspected_effects'], [])
        self.assertIn('console_io_candidate', f['outer.inner']['suspected_effects'])

    def test_reject_syntax_and_size(self):
        with self.assertRaisesRegex(ValueError, 'PARSE_FAILED'):
            mod.analyze_text('def broken(:')
        with self.assertRaisesRegex(ValueError, 'SOURCE_TOO_LARGE'):
            mod.analyze_text(' ' * (mod.MAX_BYTES + 1))

    def test_file_root_and_symlink(self):
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            file = root / 'ok.py'
            file.write_text('def f():\n    return 7\n', encoding='utf-8')
            src, rel = mod.read_source(pathlib.Path('ok.py'), root)
            self.assertEqual(rel, 'ok.py')
            self.assertIn('return 7', src)
            with self.assertRaisesRegex(ValueError, 'OUTSIDE_ROOT'):
                mod.read_source(pathlib.Path('../no.py'), root)
            try:
                link = root / 'link.py'
                link.symlink_to(file)
            except (OSError, NotImplementedError):
                pass
            else:
                with self.assertRaisesRegex(ValueError, 'SYMLINK_NOT_ALLOWED'):
                    mod.read_source(pathlib.Path('link.py'), root)

    def test_empty_inputs_and_pow_bounds(self):
        r = mod.probe_expression('def seven():\n    return 7\n', 'seven', {})
        self.assertEqual(r['result_rational'], '7')
        with self.assertRaisesRegex(ValueError, 'UNSUPPORTED_ARITHMETIC_OPERATOR'):
            mod.probe_expression('def f(x):\n    return x**100\n', 'f', {'x': 2})
        with self.assertRaisesRegex(ValueError, 'PROBE_PARAMETERS_MISMATCH'):
            mod.probe_expression('def f(x):\n    return x\n', 'f', {'z': 3})

    def test_real_fixture(self):
        src = (HERE / 'fixtures' / 'fisre_example.py').read_text(encoding='utf-8')
        report = mod.analyze_text(src)
        self.assertEqual(len(report['functions']), 3)
        self.assertEqual(len(report['call_edges']), 1)
        self.assertEqual(report['call_edges'][0]['caller'], 'wrapper')
        self.assertEqual(report['call_edges'][0]['callee'], 'calculate_price')


    def test_powershell_safe_cli_vars(self):
        import contextlib
        import io
        stdout = io.StringIO()
        stderr = io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = mod.main([
                'intelligence-checks/fixtures/fisre_example.py',
                '--root', str(HERE.parent),
                '--probe', 'calculate_price',
                '--var', 'cost=100',
                '--var', 'margin=0.25',
            ])
        self.assertEqual(code, 0, stderr.getvalue())
        report = json.loads(stdout.getvalue())
        self.assertEqual(report['arithmetic_probe']['result_rational'], '400/3')
        self.assertFalse(report['arithmetic_probe']['inspected_code_executed'])

    def test_cli_rejects_duplicate_and_conflicting_var_inputs(self):
        import contextlib
        import io
        for flags, expected in [
            (['--var', 'cost=100', '--var', 'cost=200'], 'PROBE_VAR_NAME_OR_DUPLICATE'),
            (['--inputs', '{}', '--var', 'cost=100'], 'PROBE_INPUT_MODES_MUTUALLY_EXCLUSIVE'),
            (['--var', 'bad=1;echo'], 'NUMERIC_INPUT_INVALID'),
        ]:
            stdout = io.StringIO()
            stderr = io.StringIO()
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                code = mod.main([
                    'intelligence-checks/fixtures/fisre_example.py',
                    '--root', str(HERE.parent),
                    '--probe', 'calculate_price',
                    *flags,
                ])
            self.assertEqual(code, 2)
            self.assertEqual(json.loads(stderr.getvalue())['state'], 'HOLD')
            self.assertIn(expected, stderr.getvalue())

    def test_cli_var_division_by_zero_holds(self):
        import contextlib
        import io
        stderr = io.StringIO()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(stderr):
            code = mod.main([
                'intelligence-checks/fixtures/fisre_example.py',
                '--root', str(HERE.parent),
                '--probe', 'calculate_price',
                '--var', 'cost=100',
                '--var', 'margin=1',
            ])
        self.assertEqual(code, 2)
        self.assertIn('FISRE_HOLD_DIVISION_BY_ZERO', stderr.getvalue())



if __name__ == '__main__':
    unittest.main()
