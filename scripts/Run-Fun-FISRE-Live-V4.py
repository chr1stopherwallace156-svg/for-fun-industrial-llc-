"""Fun Industrial FISRE live request worker: stdin JSON, stdout JSON, no source execution.

This subprocess is launched by the existing one-port 8802 Node dashboard on one
explicit operator click. It analyzes supplied source as text; it never reads,
imports, compiles to bytecode, or executes that supplied source.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src' / 'semantic'))
from fisre_v1 import analyze_text
from fisre_proof_v2 import inspect, parse_ranges
from fisre_source_v4 import verify_against_source

VERSION = 'fun-fisre-live-v4'
MAX_STDIN = 24576
MAX_SOURCE = 16000
MAX_RANGES = 16


def hold(reason):
    raise ValueError('FISRE_LIVE_HOLD_' + reason)


def main():
    raw = sys.stdin.buffer.read(MAX_STDIN + 1)
    if not raw or len(raw) > MAX_STDIN:
        hold('INPUT_SIZE_INVALID')
    try:
        value = json.loads(raw.decode('utf-8'))
    except (UnicodeDecodeError, ValueError):
        hold('INVALID_REQUEST_JSON')
    if not isinstance(value, dict) or set(value) != {'source', 'function', 'ranges'}:
        hold('REQUEST_SCHEMA_INVALID')
    source, function, ranges = value['source'], value['function'], value['ranges']
    if not isinstance(source, str) or not source.strip() or len(source.encode('utf-8')) > MAX_SOURCE:
        hold('SOURCE_TOO_LARGE_OR_EMPTY')
    if not isinstance(function, str) or not function or len(function) > 64:
        hold('FUNCTION_INVALID')
    if not isinstance(ranges, list) or not 0 < len(ranges) <= MAX_RANGES or any(not isinstance(r, str) or len(r) > 220 for r in ranges):
        hold('RANGES_INVALID')
    label = 'operator-submitted.py'
    analysis = analyze_text(source, label)
    proof = inspect(source, function, parse_ranges(ranges))
    proof['file'] = label
    replay = verify_against_source(proof, source=source, relative_file=label, function=function)
    if replay['state'] != 'SOURCE_BOUND_REPLAY_MATCH' or replay['analyzer_replay_matched'] is not True:
        hold('SOURCE_BOUND_REPLAY_FAILED')
    # Return bounded facts from V1. JSON source and report remain ephemeral.
    functions = [{
        'name': f['name'], 'line': f['line'], 'parameters': f['parameters'],
        'internal_calls': f['internal_calls'], 'unresolved_calls': f['unresolved_calls'][:12],
        'divisor_risks': f['divisor_risks'][:12],
        'suspected_effects': f['suspected_effects'],
        'reachable_effect_candidates': f['reachable_effect_candidates'][:16],
        'cyclomatic_lower_bound': f['cyclomatic_lower_bound'],
        'runtime_behavior_verified': False,
    } for f in analysis['functions'][:50]]
    result = {
        'version': VERSION,
        'state': 'SOURCE_ANALYZED_AND_REPLAYED',
        'source': {
            'sha256': analysis['sha256'], 'bytes': analysis['source_size_bytes'],
            'functions_total': len(analysis['functions']), 'functions': functions,
            'imports': analysis['imports'][:45], 'call_edges': analysis['call_edges'][:60],
            'unknowns': analysis['unknowns'], 'summarized': len(analysis['functions']) > 50,
        },
        'proof': proof, 'replay': replay,
        'source_executed': False, 'external_actions': 0, 'authority_granted': False,
        'persistence_performed': False, 'reviewed_file_on_disk': False,
        'note': 'Source supplied as in-memory text; no disk file was read. Rational proofs are not Python runtime proofs.',
    }
    json.dump(result, sys.stdout, separators=(',', ':'), allow_nan=False)
    sys.stdout.write('\n')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, RuntimeError, RecursionError, OverflowError) as exc:
        sys.stderr.write(json.dumps({'version': VERSION, 'state': 'HOLD', 'reason': str(exc)[:220], 'source_executed': False}) + '\n')
        raise SystemExit(2)
