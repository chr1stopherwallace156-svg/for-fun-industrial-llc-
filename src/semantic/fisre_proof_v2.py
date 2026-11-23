"""FISRE V2: offline bounded division-safety reasoning using exact rational arithmetic.

Never imports or runs inspected source. All claims apply only to the deliberately
restricted rational expression language, not Python runtime execution/float semantics.
"""
from __future__ import annotations
import argparse
import ast
import hashlib
import json
import re
import sys
from fractions import Fraction
from pathlib import Path

from fisre_v1 import read_source, MAX_BYTES

VERSION = 'fi-semantic-proof-v2'
MAX_VARS = 16
MAX_DEPTH = 18
MAX_NODES = 1024
MAX_BITS = 128


class Hold(ValueError):
    pass


def hold(code):
    raise Hold('FISRE_V2_HOLD_' + code)


def rational(value):
    if not isinstance(value, str) or not value or len(value) > 90 or not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d{1,3})?|[+-]?\d+/\d+', value):
        hold('NUMBER_INVALID')
    try:
        n = Fraction(value)
    except (ValueError, ZeroDivisionError, OverflowError):
        hold('NUMBER_INVALID')
    if abs(n.numerator).bit_length() > MAX_BITS or n.denominator.bit_length() > MAX_BITS:
        hold('NUMBER_OUT_OF_BOUNDS')
    return n


def limited(x):
    if abs(x.numerator).bit_length() > MAX_BITS or x.denominator.bit_length() > MAX_BITS:
        hold('SYMBOLIC_RESULT_TOO_LARGE')
    return x


def parse_ranges(items):
    if not isinstance(items, list) or not 0 < len(items) <= MAX_VARS:
        hold('RANGES_REQUIRED_OR_EXCESSIVE')
    out = {}
    for item in items:
        if not isinstance(item, str) or len(item) > 220 or '=' not in item:
            hold('RANGE_FORMAT_INVALID')
        key, values = item.split('=', 1)
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,63}', key) or key in out or values.count(':') != 1:
            hold('RANGE_NAME_OR_SYNTAX_INVALID')
        low, high = [rational(v) for v in values.split(':', 1)]
        if low > high:
            hold('RANGE_REVERSED')
        out[key] = (low, high)
    return out


def _tree_allowed(node, params, depth=0):
    if depth > MAX_DEPTH:
        return False
    if isinstance(node, ast.Constant):
        return type(node.value) in (int, float) and abs(node.value) < 10 ** 35
    if isinstance(node, ast.Name):
        return node.id in params
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        return _tree_allowed(node.operand, params, depth + 1)
    if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
        return _tree_allowed(node.left, params, depth + 1) and _tree_allowed(node.right, params, depth + 1)
    return False


def _affine(node, params, depth=0):
    """Return c + sum(ai*xi), or None if non-affine/unsupported.

    Python float literals are treated as rational decimal literals. We do not
    claim IEEE-754/Python runtime guarantees from these results.
    """
    if depth > MAX_DEPTH:
        return None
    if isinstance(node, ast.Name) and node.id in params:
        return (Fraction(0), {node.id: Fraction(1)})
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return (rational(str(node.value)), {})
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        a = _affine(node.operand, params, depth + 1)
        if a is None:
            return None
        factor = -1 if isinstance(node.op, ast.USub) else 1
        return (limited(a[0] * factor), {k: limited(v * factor) for k, v in a[1].items()})
    if not isinstance(node, ast.BinOp):
        return None
    a = _affine(node.left, params, depth + 1)
    b = _affine(node.right, params, depth + 1)
    if a is None or b is None:
        return None
    if isinstance(node.op, (ast.Add, ast.Sub)):
        sign = -1 if isinstance(node.op, ast.Sub) else 1
        coefficients = {k: limited(a[1].get(k, 0) + sign * b[1].get(k, 0)) for k in params}
        return (limited(a[0] + sign * b[0]), {k: v for k, v in coefficients.items() if v})
    if isinstance(node.op, ast.Mult):
        if a[1] and b[1]:
            return None
        if b[1]:
            a, b = b, a
        return (limited(a[0] * b[0]), {k: limited(v * b[0]) for k, v in a[1].items() if v})
    if isinstance(node.op, ast.Div):
        if b[1] or b[0] == 0:
            return None
        return (limited(a[0] / b[0]), {k: limited(v / b[0]) for k, v in a[1].items() if v})
    return None


def affine_extrema(expr, ranges):
    constant, coefficients = expr
    smallest = constant
    largest = constant
    smallest_at, largest_at = {}, {}
    for key, (low, high) in ranges.items():
        coefficient = coefficients.get(key, Fraction(0))
        minval, maxval = (low, high) if coefficient >= 0 else (high, low)
        smallest_at[key] = minval
        largest_at[key] = maxval
        smallest = limited(smallest + limited(coefficient * minval))
        largest = limited(largest + limited(coefficient * maxval))
    return smallest, largest, smallest_at, largest_at


def counterexample(expr, ranges):
    low, high, low_corner, high_corner = affine_extrema(expr, ranges)
    if not low <= 0 <= high:
        return None
    t = Fraction(0) if low == high else limited(-low / (high - low))
    witness = {name: limited(low_corner[name] + t * (high_corner[name] - low_corner[name])) for name in ranges}
    constant, coefficients = expr
    evaluation = constant + sum((coefficients.get(k, 0) * value for k, value in witness.items()), Fraction(0))
    if evaluation != 0:
        hold('COUNTEREXAMPLE_RECHECK_FAILED')
    return witness


def inspect(source, name, ranges):
    if not isinstance(source, str) or len(source.encode('utf-8')) > MAX_BYTES or not isinstance(name, str) or not isinstance(ranges, dict):
        hold('INVALID_INSPECTION')
    try:
        module = ast.parse(source)
    except (SyntaxError, ValueError, RecursionError):
        hold('SOURCE_PARSE_FAILED')
    matches = [item for item in module.body if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)) and item.name == name]
    if len(matches) != 1 or type(matches[0]) is not ast.FunctionDef:
        hold('TOP_LEVEL_FUNCTION_REQUIRED')
    func = matches[0]
    args = func.args
    if func.decorator_list or args.posonlyargs or args.vararg or args.kwarg or args.kwonlyargs or args.defaults or args.kw_defaults:
        return outcome(source, name, ranges, 'UNKNOWN', 'COMPLEX_FUNCTION_SIGNATURE', [])
    params = [a.arg for a in args.args]
    if len(params) > MAX_VARS or not params or set(params) != set(ranges):
        hold('RANGE_PARAMETERS_MISMATCH')
    meaningful = [node for node in func.body if not (isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str))]
    if len(meaningful) != 1 or not isinstance(meaningful[0], ast.Return) or meaningful[0].value is None:
        return outcome(source, name, ranges, 'UNKNOWN', 'NOT_SINGLE_RETURN', [])
    body = meaningful[0].value
    nodes = list(ast.walk(body))
    if len(nodes) > MAX_NODES or not _tree_allowed(body, set(params)):
        return outcome(source, name, ranges, 'UNKNOWN', 'UNSUPPORTED_EXPRESSION_OR_DEPTH', [])
    denominators = [node.right for node in nodes if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div)]
    results = []
    uncertain = False
    found = False
    for divisor in denominators:
        affine = _affine(divisor, ranges)
        line = getattr(divisor, 'lineno', func.lineno)
        expr = ast.unparse(divisor)[:240]
        if affine is None:
            uncertain = True
            results.append({'line': line, 'expression': expr, 'status': 'UNKNOWN_NONAFFINE'})
            continue
        low, high, _, _ = affine_extrema(affine, ranges)
        check = {'line': line, 'expression': expr, 'minimum': str(low), 'maximum': str(high)}
        if low > 0 or high < 0:
            check['status'] = 'PROVED_NONZERO'
        else:
            found = True
            check['status'] = 'ZERO_WITNESS_FOUND'
            check['witness'] = {k: str(v) for k, v in counterexample(affine, ranges).items()}
            check['scope'] = 'affine_divisor_reaches_zero_under_rational_semantics'
        results.append(check)
    if found:
        return outcome(source, name, ranges, 'COUNTEREXAMPLE_FOUND', 'ZERO_DIVISOR_IN_DOMAIN', results)
    if uncertain:
        return outcome(source, name, ranges, 'UNKNOWN', 'NONAFFINE_DIVISOR_NOT_PROVED', results)
    return outcome(source, name, ranges, 'PROVED', 'ALL_SYNTACTIC_DIVISORS_NONZERO_IN_RATIONAL_DOMAIN', results)


def outcome(source, name, ranges, status, reason, checks):
    return {'version': VERSION, 'status': status, 'reason': reason,
            'source_sha256': hashlib.sha256(source.encode('utf-8')).hexdigest(), 'function': name,
            'domain': {k: {'min': str(v[0]), 'max': str(v[1])} for k, v in sorted(ranges.items())},
            'division_checks': checks, 'proof_scope': 'restricted_exact_rational_arithmetic_not_Python_runtime_or_floating_point',
            'source_executed': False, 'external_actions': 0, 'tool_authority_granted': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description='FISRE V2 bounded rational division-safety analyzer')
    parser.add_argument('file', help='reviewed .py file under --root')
    parser.add_argument('--root', default='.')
    parser.add_argument('--function', required=True)
    parser.add_argument('--range', dest='ranges', action='append', default=[], help='repeatable NAME=MIN:MAX (PowerShell-safe)')
    args = parser.parse_args(argv)
    try:
        root = Path(args.root).resolve(strict=True)
        content, relative = read_source(Path(args.file), root)
        report = inspect(content, args.function, parse_ranges(args.ranges))
        report['file'] = relative
        print(json.dumps(report, sort_keys=True, indent=2))
        return 0
    except (ValueError, OSError, RecursionError) as exc:
        print(json.dumps({'version': VERSION, 'status': 'HOLD', 'reason': str(exc)[:180], 'source_executed': False}), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
