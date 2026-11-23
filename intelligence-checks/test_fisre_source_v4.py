import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import subprocess
import unittest

FILE = Path(__file__).resolve().parents[1] / 'src' / 'semantic' / 'fisre_source_v4.py'
sp = importlib.util.spec_from_file_location('fisre_source_v4', FILE)
v4 = importlib.util.module_from_spec(sp)
sp.loader.exec_module(v4)
SOURCE='def calculate_price(cost, margin):\n    return cost/(1-margin)\n'
REL='fixtures/source.py'
PROOF_SCOPE='restricted_exact_rational_arithmetic_not_Python_runtime_or_floating_point'


def fixture():
    return {
      'version': 'fi-semantic-proof-v2',
      'status': 'PROVED',
      'reason': 'ALL_SYNTACTIC_DIVISORS_NONZERO_IN_RATIONAL_DOMAIN',
      'source_sha256': hashlib.sha256(SOURCE.encode()).hexdigest(),
      'function': 'calculate_price', 'proof_scope': PROOF_SCOPE,
      'source_executed': False, 'external_actions': 0,
      'tool_authority_granted': False,
      'domain': {'cost': {'min': '0', 'max': '100'}, 'margin': {'min': '0', 'max': '1/2'}},
      'division_checks': [{'line':2,'expression':'1 - margin','minimum':'1/2','maximum':'1','status':'PROVED_NONZERO'}],
      'file': REL,
    }


def fake_parser(items):
    assert items == ['cost=0:100', 'margin=0:1/2'], items
    return {'cost': ('0','100'), 'margin':('0','1/2')}


def fake_analyzer(src,name,domain):
    assert src==SOURCE
    assert name=='calculate_price'
    assert set(domain)=={'cost','margin'}
    report=fixture()
    report.pop('file')
    return report


def verify(report=None, source=SOURCE, function='calculate_price', relative_file=REL):
    return v4.verify_against_source(report if report is not None else fixture(),
         source=source, relative_file=relative_file,function=function,
         analyzer=fake_analyzer,range_parser=fake_parser)


class V4Tests(unittest.TestCase):
    def test_valid_replay_matches_source(self):
        r=verify()
        self.assertEqual(r['state'],'SOURCE_BOUND_REPLAY_MATCH')
        self.assertEqual(r['reported_proof_status'],'PROVED')
        self.assertTrue(r['selected_source_matched_report'])
        self.assertTrue(r['analyzer_replay_matched'])
        self.assertFalse(r['independently_proved'])
        self.assertFalse(r['publisher_authenticated'])
        self.assertFalse(r['authority_granted'])

    def test_repeated_check_stable_digest(self):
        self.assertEqual(verify()['replayed_report_sha256'],verify()['replayed_report_sha256'])

    def test_source_hash_modified(self):
        with self.assertRaisesRegex(ValueError,'SOURCE_HASH_MISMATCH'):
            verify(source=SOURCE+'\n# extra')

    def test_claim_forgery_detected(self):
        x=fixture();x['status']='COUNTEREXAMPLE_FOUND'
        with self.assertRaisesRegex(ValueError,'REPLAY_MISMATCH'):
            verify(x)

    def test_forged_witness_detected(self):
        x=fixture();x['division_checks'][0]['status']='ZERO_WITNESS_FOUND'
        x['division_checks'][0]['witness']={'cost':'0','margin':'1'}
        with self.assertRaisesRegex(ValueError,'REPLAY_MISMATCH'):
            verify(x)

    def test_external_actions_rejected(self):
        x=fixture();x['external_actions']=1
        with self.assertRaisesRegex(ValueError,'ACTION_BOUNDARY_INVALID'):
            verify(x)

    def test_authority_grant_rejected(self):
        x=fixture();x['tool_authority_granted']=True
        with self.assertRaisesRegex(ValueError,'ACTION_BOUNDARY_INVALID'):
            verify(x)

    def test_unknown_parameter_rejected(self):
        x=fixture();x['domain']['other']={'min':'0','max':'1'}
        with self.assertRaisesRegex(ValueError,'REPLAY_MISMATCH'):
            v4.verify_against_source(x,source=SOURCE,relative_file=REL,function='calculate_price',
              range_parser=lambda x:x,analyzer=lambda s,n,d:fixture_without_file())

    def test_extra_fields_refused(self):
        x=fixture();x['authority']='authorized'
        with self.assertRaisesRegex(ValueError,'REPORT_SCHEMA_INVALID'):
            verify(x)

    def test_target_file_mismatch(self):
        with self.assertRaisesRegex(ValueError,'SELECTED_TARGET_MISMATCH'):
            verify(relative_file='fixtures/other.py')

    def test_target_function_mismatch(self):
        with self.assertRaisesRegex(ValueError,'SELECTED_TARGET_MISMATCH'):
            verify(function='other')

    def test_non_boolean_false_rejected(self):
        x=fixture();x['source_executed']=0
        with self.assertRaisesRegex(ValueError,'ACTION_BOUNDARY_INVALID'):
            verify(x)

    def test_duplicate_report_keys_not_part_of_public_api(self):
        with self.assertRaisesRegex(ValueError,'REPORT_SCHEMA_INVALID'):
            verify({'version':'fi-semantic-proof-v2'})

    def test_reject_huge_report(self):
        x=fixture();x['reason']='a'*66000
        with self.assertRaisesRegex(ValueError,'REPORT_TOO_LARGE'):
            verify(x)

    def test_reject_malformed_json(self):
        with self.assertRaisesRegex(ValueError,'REPORT_JSON_INVALID'):
            v4.read_report(io.BytesIO(b'{invalid'))

    def test_read_report_limit(self):
        with self.assertRaisesRegex(ValueError,'REPORT_EMPTY_OR_TOO_LARGE'):
            v4.read_report(io.BytesIO(b'x'*(v4.MAX_REPORT_BYTES+1)))

    def test_no_implicit_source_execution(self):
        x=fixture();result=verify(x)
        self.assertFalse(result['source_executed'])
        self.assertFalse(result['cognitive_fact_promoted'])

    def test_real_v2_safe_domain_source_bound(self):
        source_path = Path(__file__).resolve().parents[1] / 'intelligence-checks' / 'fixtures' / 'fisre_example.py'
        v2_path = Path(__file__).resolve().parents[1] / 'src' / 'semantic' / 'fisre_proof_v2.py'
        self.assertTrue(source_path.is_file(), 'V2 fixture must be present')
        self.assertTrue(v2_path.is_file(), 'V2 analyzer must be present')
        sys.path.insert(0, str(v2_path.parent))
        from fisre_proof_v2 import inspect, parse_ranges
        from fisre_v1 import read_source
        src, _ = read_source(source_path, Path(__file__).resolve().parents[1])
        vals = parse_ranges(['cost=0:1000', 'margin=0:0.5'])
        report = inspect(src, 'calculate_price', vals)
        report['file'] = 'intelligence-checks/fixtures/fisre_example.py'
        checked = v4.verify_against_source(report, source=src, relative_file=report['file'],
                                          function='calculate_price')
        self.assertEqual(checked['state'], 'SOURCE_BOUND_REPLAY_MATCH')
        self.assertEqual(checked['reported_proof_status'], 'PROVED')
        self.assertFalse(checked['independently_proved'])

    def test_real_v2_cli_and_forged_status_rejected(self):
        repo = Path(__file__).resolve().parents[1]
        path = repo / 'intelligence-checks' / 'fixtures' / 'fisre_example.py'
        v2_path = repo / 'src' / 'semantic' / 'fisre_proof_v2.py'
        self.assertTrue(path.is_file(), 'V2 fixture must be present')
        self.assertTrue(v2_path.is_file(), 'V2 analyzer must be present')
        sys.path.insert(0, str(v2_path.parent))
        from fisre_proof_v2 import inspect, parse_ranges
        from fisre_v1 import read_source
        src, _ = read_source(path, repo)
        report = inspect(src, 'calculate_price', parse_ranges(['cost=0:1000', 'margin=0:1']))
        report['file'] = 'intelligence-checks/fixtures/fisre_example.py'
        good = subprocess.run([sys.executable, str(FILE), report['file'], '--root', str(repo),
                               '--function', 'calculate_price'], input=json.dumps(report),
                              text=True, capture_output=True, timeout=10)
        self.assertEqual(good.returncode, 0, good.stderr)
        self.assertEqual(json.loads(good.stdout)['state'], 'SOURCE_BOUND_REPLAY_MATCH')
        tampered = dict(report)
        tampered['status'] = 'PROVED'
        bad = subprocess.run([sys.executable, str(FILE), report['file'], '--root', str(repo),
                              '--function', 'calculate_price'], input=json.dumps(tampered),
                             text=True, capture_output=True, timeout=10)
        self.assertEqual(bad.returncode, 2)
        self.assertEqual(json.loads(bad.stderr)['state'], 'HOLD')


    def test_real_v2_cli_explicit_crlf_source_hash_preserved(self):
        """Byte-level CRLF fixtures must hash identically across CLI and test paths."""
        import tempfile
        repo = Path(__file__).resolve().parents[1]
        sys.path.insert(0, str(repo / 'src' / 'semantic'))
        from fisre_v1 import read_source
        from fisre_proof_v2 import inspect, parse_ranges
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            path = root / 'crlf.py'
            path.write_bytes(b'def calculate_price(cost, margin):\r\n    return cost / (1 - margin)\r\n')
            src, rel = read_source(path, root)
            self.assertIn('\r\n', src)
            domain = parse_ranges(['cost=0:1000', 'margin=0:0.5'])
            report = inspect(src, 'calculate_price', domain)
            report['file'] = rel
            cmd = [sys.executable, str(FILE), rel, '--root', str(root),
                   '--function', 'calculate_price']
            good = subprocess.run(cmd, input=json.dumps(report), text=True,
                                  capture_output=True, timeout=10)
            self.assertEqual(good.returncode, 0, good.stderr)
            self.assertEqual(json.loads(good.stdout)['state'], 'SOURCE_BOUND_REPLAY_MATCH')
            normalized = path.read_text(encoding='utf-8')
            self.assertNotEqual(src, normalized)
            invalid = inspect(normalized, 'calculate_price', domain)
            invalid['file'] = rel
            bad = subprocess.run(cmd, input=json.dumps(invalid), text=True,
                                 capture_output=True, timeout=10)
            self.assertEqual(bad.returncode, 2)
            self.assertIn('SOURCE_HASH_MISMATCH', bad.stderr)


def fixture_without_file():
    x=fixture();x.pop('file');return x


if __name__=='__main__':unittest.main()
