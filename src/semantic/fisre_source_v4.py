"""FISRE V4: bind a submitted V2 proof report to user-selected local source.

This is deterministic *replay* of V2, not a second independent proof system.
The program never imports or runs the source being inspected.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

VERSION = 'fi-semantic-source-bound-v4'
V2_VERSION = 'fi-semantic-proof-v2'
MAX_REPORT_BYTES = 65536
MAX_PARAMETERS = 16
REQUIRED = frozenset({
    'version', 'status', 'reason', 'source_sha256', 'function', 'proof_scope',
    'source_executed', 'external_actions', 'tool_authority_granted',
    'domain', 'division_checks', 'file',
})
FUNCTION = re.compile(r'[A-Za-z_][A-Za-z0-9_]{0,63}\Z')
SHA = re.compile(r'[0-9a-f]{64}\Z')


class VerificationHold(ValueError):
    pass


def hold(reason):
    raise VerificationHold('FISRE_V4_HOLD_' + reason)


def object_json(value):
    try:
        return json.dumps(value, sort_keys=True, separators=(',', ':'),
                          allow_nan=False, ensure_ascii=True)
    except (ValueError, TypeError, OverflowError, RecursionError):
        hold('REPORT_INVALID_JSON_VALUES')


def validate_shape(report, *, file, function):
    if type(report) is not dict:
        hold('REPORT_NOT_OBJECT')
    if len(object_json(report).encode('utf-8')) > MAX_REPORT_BYTES:
        hold('REPORT_TOO_LARGE')
    if set(report) != REQUIRED or report['version'] != V2_VERSION:
        hold('REPORT_SCHEMA_INVALID')
    if type(report['source_sha256']) is not str or not SHA.fullmatch(report['source_sha256']):
        hold('SOURCE_SHA_INVALID')
    if type(report['function']) is not str or not FUNCTION.fullmatch(report['function']):
        hold('FUNCTION_INVALID')
    if report['file'] != file or report['function'] != function:
        hold('SELECTED_TARGET_MISMATCH')
    if report['source_executed'] is not False or type(report['external_actions']) is not int or report['external_actions'] != 0 or report['tool_authority_granted'] is not False:
        hold('ACTION_BOUNDARY_INVALID')
    if type(report['domain']) is not dict or not 0 < len(report['domain']) <= MAX_PARAMETERS:
        hold('DOMAIN_INVALID')
    for name, bounds in report['domain'].items():
        if type(name) is not str or not FUNCTION.fullmatch(name):
            hold('DOMAIN_NAME_INVALID')
        if type(bounds) is not dict or set(bounds) != {'min', 'max'}:
            hold('DOMAIN_BOUNDS_INVALID')
        if any(type(bounds[k]) is not str or len(bounds[k]) > 90 for k in ('min', 'max')):
            hold('DOMAIN_NUMBER_INVALID')
    if type(report['division_checks']) is not list or len(report['division_checks']) > 150:
        hold('DIVISION_CHECKS_INVALID')


def verify_against_source(report, *, source, relative_file, function, analyzer=None, range_parser=None):
    """Replay V2 on the selected source and compare every reported field.

    'analyzer' and 'range_parser' are injected only for deterministic unit tests;
    production CLI always uses real V2 implementations.
    """
    if type(source) is not str or len(source.encode('utf-8')) > 262144:
        hold('SOURCE_INVALID_OR_OVERSIZED')
    if type(relative_file) is not str or not relative_file or len(relative_file) > 300:
        hold('TARGET_FILE_INVALID')
    if type(function) is not str or not FUNCTION.fullmatch(function):
        hold('SELECTED_FUNCTION_INVALID')
    validate_shape(report, file=relative_file, function=function)
    source_sha = hashlib.sha256(source.encode('utf-8')).hexdigest()
    if report['source_sha256'] != source_sha:
        hold('SOURCE_HASH_MISMATCH')

    if analyzer is None or range_parser is None:
        from fisre_proof_v2 import inspect, parse_ranges
        analyzer = inspect
        range_parser = parse_ranges
    inputs = [f'{name}={bounds["min"]}:{bounds["max"]}'
              for name, bounds in sorted(report['domain'].items())]
    try:
        domain = range_parser(inputs)
        replay = analyzer(source, function, domain)
    except (ValueError, OverflowError, RecursionError) as error:
        hold('REPLAY_FAILED_' + type(error).__name__)
    if type(replay) is not dict:
        hold('REPLAY_NOT_OBJECT')
    replay = dict(replay)
    replay['file'] = relative_file
    if object_json(report) != object_json(replay):
        hold('REPLAY_MISMATCH')

    return {
        'version': VERSION,
        'state': 'SOURCE_BOUND_REPLAY_MATCH',
        'reported_proof_status': report['status'],
        'function': function,
        'file': relative_file,
        'source_sha256': source_sha,
        'replayed_report_sha256': hashlib.sha256(object_json(replay).encode('utf-8')).hexdigest(),
        'selected_source_matched_report': True,
        'analyzer_replay_matched': True,
        'independently_proved': False,
        'publisher_authenticated': False,
        'cognitive_fact_promoted': False,
        'source_executed': False,
        'external_actions': 0,
        'authority_granted': False,
        'next': 'Operator review and independent mathematical checking before knowledge promotion',
    }


def read_report(stream):
    raw = stream.read(MAX_REPORT_BYTES + 1)
    if not raw or len(raw) > MAX_REPORT_BYTES:
        hold('REPORT_EMPTY_OR_TOO_LARGE')
    try:
        return json.loads(raw.decode('utf-8'))
    except (UnicodeDecodeError, ValueError):
        hold('REPORT_JSON_INVALID')


def main(argv=None):
    parser = argparse.ArgumentParser(description='FISRE V4 source-bound report replay (no target execution)')
    parser.add_argument('file', help='reviewed relative Python file under --root')
    parser.add_argument('--root', default='.')
    parser.add_argument('--function', required=True, help='exact name of the selected top-level function')
    args = parser.parse_args(argv)
    try:
        from fisre_v1 import read_source
        root = Path(args.root).resolve(strict=True)
        source, file = read_source(Path(args.file), root)
        report = read_report(sys.stdin.buffer)
        result = verify_against_source(report, source=source, relative_file=file, function=args.function)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (VerificationHold, ValueError, OSError, RecursionError) as e:
        print(json.dumps({'version': VERSION, 'state': 'HOLD', 'reason': str(e)[:180],
                          'source_executed': False, 'authority_granted': False}), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
