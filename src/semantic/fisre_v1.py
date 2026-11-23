"""FISRE v1: offline, read-only Python semantic inspection and bounded arithmetic.

This module parses source but never imports or executes inspected Python code.
Its reports distinguish observed syntax from hypotheses and unsupported claims.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import stat
import sys
from fractions import Fraction
from pathlib import Path

VERSION = "fi-semantic-reasoning-v1"
MAX_BYTES = 262_144
MAX_AST_NODES = 12_000
MAX_FUNCTIONS = 300
MAX_DEPTH = 20
MAX_OPERAND_BITS = 128
MAX_EXPONENT = 12
MAX_INPUTS = 16


def hold(reason: str):
    raise ValueError("FISRE_HOLD_" + reason)


def dotted(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        left = dotted(node.value)
        return left + "." + node.attr if left else None
    return None


def source_expr(node):
    try:
        return ast.unparse(node)[:350]
    except (ValueError, TypeError, RecursionError):
        return "<unrepresentable>"


class BodyInspection(ast.NodeVisitor):
    """Visit the function's own code; don't attribute nested bodies to parents."""
    def __init__(self):
        self.calls = []
        self.imports = set()
        self.denominators = []
        self.branches = 0
        self.returns = []
        self.assigns = []
        self.nested_functions = []
        self.dynamic = set()

    def visit_FunctionDef(self, node):
        self.nested_functions.append(node.name)

    def visit_AsyncFunctionDef(self, node):
        self.nested_functions.append(node.name)

    def visit_Lambda(self, node):
        # Lambdas may be invoked dynamically; we do not infer their behavior.
        self.dynamic.add("lambda_body_not_resolved")

    def visit_Call(self, node):
        name = dotted(node.func)
        if name is None:
            self.dynamic.add("dynamic_call_target")
        else:
            self.calls.append({"target": name, "line": node.lineno})
        self.generic_visit(node)

    def visit_BinOp(self, node):
        if isinstance(node.op, (ast.Div, ast.FloorDiv, ast.Mod)):
            self.denominators.append({"line": node.lineno, "expression": source_expr(node.right), "potentially_zero": True})
        self.generic_visit(node)

    def visit_If(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_IfExp(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_For(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_AsyncFor(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_While(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_ExceptHandler(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_Assert(self, node):
        self.branches += 1
        self.generic_visit(node)

    def visit_BoolOp(self, node):
        self.branches += max(0, len(node.values) - 1)
        self.generic_visit(node)

    def visit_comprehension(self, node):
        self.branches += 1 + len(node.ifs)
        self.generic_visit(node)

    def visit_Return(self, node):
        self.returns.append({"line": node.lineno, "expression": source_expr(node.value) if node.value is not None else None})
        self.generic_visit(node)

    def visit_Assign(self, node):
        self.assigns.append(node.lineno)
        self.generic_visit(node)

    def visit_Import(self, node):
        self.imports.update(a.name for a in node.names)

    def visit_ImportFrom(self, node):
        self.imports.add(("." * node.level) + (node.module or ""))


def suspected_effects(calls):
    """Conservative signals, NOT proof of an actual runtime side effect."""
    effects = set()
    for call in calls:
        name = call["target"]
        if name in {"print", "input"} or name.startswith("sys.stdout"):
            effects.add("console_io_candidate")
        if name in {"open", "io.open", "Path.open", "Path.write_text", "Path.write_bytes", "os.remove", "os.unlink", "os.rename", "shutil.rmtree"} or name.endswith((".write_text", ".write_bytes", ".unlink", ".mkdir")):
            effects.add("filesystem_io_candidate")
        if name in {"eval", "exec", "compile", "__import__"}:
            effects.add("dynamic_execution_candidate")
        if name.startswith(("subprocess.", "os.system", "os.popen")):
            effects.add("process_execution_candidate")
        if name.startswith(("requests.", "httpx.", "urllib.request.", "socket.")):
            effects.add("network_io_candidate")
    return sorted(effects)


def arguments(node):
    a = node.args
    args = ([x.arg for x in a.posonlyargs] + [x.arg for x in a.args])
    if a.vararg:
        args.append("*" + a.vararg.arg)
    args.extend(x.arg for x in a.kwonlyargs)
    if a.kwarg:
        args.append("**" + a.kwarg.arg)
    return args


def analyze_text(source: str, source_id="<input>"):
    if not isinstance(source, str) or not isinstance(source_id, str) or not source_id or len(source_id) > 250:
        hold("INVALID_SOURCE")
    raw = source.encode("utf-8")
    if len(raw) > MAX_BYTES:
        hold("SOURCE_TOO_LARGE")
    try:
        root = ast.parse(source, filename=source_id, mode="exec")
    except (SyntaxError, ValueError) as error:
        hold("PARSE_FAILED_" + type(error).__name__)
    all_nodes = list(ast.walk(root))
    if len(all_nodes) > MAX_AST_NODES:
        hold("AST_TOO_LARGE")

    modules = set()
    functions = {}

    def walk_scope(body, prefix=""):
        for node in body:
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                if isinstance(node, ast.Import):
                    modules.update(x.name for x in node.names)
                else:
                    modules.add("." * node.level + (node.module or ""))
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                qualified = prefix + node.name
                if isinstance(node, ast.ClassDef):
                    walk_scope(node.body, qualified + ".")
                else:
                    if len(functions) >= MAX_FUNCTIONS:
                        hold("FUNCTION_LIMIT")
                    visitor = BodyInspection()
                    for stmt in node.body:
                        visitor.visit(stmt)
                    calls = sorted(visitor.calls, key=lambda c: (c["line"], c["target"]))
                    item = {
                        "name": qualified,
                        "line": node.lineno,
                        "end_line": node.end_lineno,
                        "async": isinstance(node, ast.AsyncFunctionDef),
                        "parameters": arguments(node),
                        "docstring": (ast.get_docstring(node) or "")[:300],
                        "parameter_annotations": {a.arg: source_expr(a.annotation) if a.annotation else None for a in (node.args.posonlyargs + node.args.args + node.args.kwonlyargs)},
                        "return_annotation": source_expr(node.returns) if node.returns else None,
                        "decorators": [source_expr(d) for d in node.decorator_list],
                        "calls": calls,
                        "returns": visitor.returns,
                        "local_branches": visitor.branches,
                        "cyclomatic_lower_bound": 1 + visitor.branches,
                        "divisor_risks": visitor.denominators,
                        "suspected_effects": suspected_effects(calls),
                        "dynamic_uncertainty": sorted(visitor.dynamic),
                        "nested_functions_skipped": visitor.nested_functions,
                        "evidence": "AST_SYNTAX_ONLY",
                        "runtime_behavior_verified": False,
                    }
                    functions[qualified] = item
                    # Nested defs are separate and should not inherit parent effects.
                    def nested_search(statements, parent):
                        for s in statements:
                            if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                                walk_scope([s], parent)
                            else:
                                # Nested definitions may occur under if/try/loops.
                                for field, val in ast.iter_fields(s):
                                    if field in {"body", "orelse", "finalbody"} and isinstance(val, list):
                                        nested_search(val, parent)
                                    elif field == "handlers" and isinstance(val, list):
                                        for h in val:
                                            nested_search(h.body, parent)
                    nested_search(node.body, qualified + ".")
    walk_scope(root.body)
    known = set(functions)
    links = []
    for owner, f in functions.items():
        for call in f["calls"]:
            target = call["target"]
            # Resolve module-level calls, and explicitly self.method() calls.
            inferred = target if target in known else None
            if inferred is None and target.startswith("self.") and "." in owner:
                candidate = owner.rpartition(".")[0] + "." + target[5:]
                inferred = candidate if candidate in known else None
            if inferred:
                links.append({"caller": owner, "callee": inferred, "line": call["line"], "status": "lexical_candidate_not_runtime_proof"})
        f["internal_calls"] = sorted({x["callee"] for x in links if x["caller"] == owner})
        resolved_sites = {(x["line"], x["callee"]) for x in links if x["caller"] == owner}
        f["unresolved_calls"] = sorted({c["target"] for c in f["calls"]
            if (c["line"], c["target"]) not in resolved_sites and not (
                c["target"].startswith("self.") and "." in owner and
                (c["line"], owner.rpartition(".")[0] + "." + c["target"][5:]) in resolved_sites)})
    # Static candidate effects may flow through apparent local calls. A fixed
    # point avoids recursion and never claims an observed runtime side effect.
    for name, f in functions.items():
        f["reachable_effect_candidates"] = [{"effect": e, "via": [name]} for e in f["suspected_effects"]]
    for _ in range(min(len(functions), MAX_FUNCTIONS)):
        changed = False
        for name, f in functions.items():
            prior = {(x["effect"], tuple(x["via"])) for x in f["reachable_effect_candidates"]}
            for callee in f["internal_calls"]:
                if callee == name:
                    continue
                for effect in functions[callee]["reachable_effect_candidates"]:
                    if name in effect["via"] or len(effect["via"]) > 8:
                        continue
                    candidate = {"effect": effect["effect"], "via": [name] + effect["via"]}
                    key = (candidate["effect"], tuple(candidate["via"]))
                    if key not in prior:
                        f["reachable_effect_candidates"].append(candidate)
                        prior.add(key)
                        changed = True
            f["reachable_effect_candidates"].sort(key=lambda x: (x["effect"], x["via"]))
        if not changed:
            break
    return {
        "version": VERSION,
        "source": source_id,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "analysis": "static_python_ast_only",
        "inspected_code_executed": False,
        "external_tool_calls": 0,
        "authority_granted": False,
        "source_size_bytes": len(raw),
        "imports": sorted(modules),
        "functions": [functions[k] for k in sorted(functions)],
        "call_edges": sorted(links, key=lambda x: (x["caller"], x["line"], x["callee"])),
        "unknowns": ["dynamic_dispatch", "runtime_values", "exceptional_paths", "module_import_side_effects", "reflection_and_monkey_patching", "complete_program_equivalence"],
    }


def read_source(path: Path, root: Path):
    """Bounded, regular-file-only read under one explicitly selected root."""
    if not path.is_absolute():
        path = root / path
    root = root.resolve(strict=True)
    try:
        rel = Path(os.path.abspath(path)).relative_to(root)
    except ValueError:
        hold("OUTSIDE_ROOT")
    if not rel.parts or path.suffix != ".py":
        hold("PYTHON_FILE_REQUIRED")
    cur = root
    for part in rel.parts:
        cur = cur / part
        if cur.is_symlink():
            hold("SYMLINK_NOT_ALLOWED")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(path, flags)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_BYTES:
                hold("FILE_NOT_REGULAR_OR_TOO_LARGE")
            data = os.read(fd, MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                hold("FILE_TOO_LARGE")
        finally:
            os.close(fd)
    except OSError as error:
        hold("READ_FAILED_" + type(error).__name__)
    try:
        return data.decode("utf-8-sig"), rel.as_posix()
    except UnicodeDecodeError:
        hold("UTF8_REQUIRED")


def _frac(v):
    if isinstance(v, bool) or not isinstance(v, (int, float, str)):
        hold("NUMERIC_INPUT_REQUIRED")
    try:
        fraction = Fraction(str(v))
    except (ValueError, ZeroDivisionError, OverflowError):
        hold("NUMERIC_INPUT_INVALID")
    if abs(fraction.numerator).bit_length() > MAX_OPERAND_BITS or fraction.denominator.bit_length() > MAX_OPERAND_BITS:
        hold("NUMERIC_INPUT_TOO_LARGE")
    return fraction


def _arithmetic(node, env, depth=0):
    if depth > MAX_DEPTH:
        hold("PROBE_TOO_DEEP")
    if isinstance(node, ast.Name) and node.id in env:
        return env[node.id]
    if isinstance(node, ast.Constant) and type(node.value) in {float, int}:
        return _frac(node.value)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        v = _arithmetic(node.operand, env, depth + 1)
        return v if isinstance(node.op, ast.UAdd) else -v
    if isinstance(node, ast.BinOp):
        left = _arithmetic(node.left, env, depth + 1)
        right = _arithmetic(node.right, env, depth + 1)
        if isinstance(node.op, ast.Add):
            out = left + right
        elif isinstance(node.op, ast.Sub):
            out = left - right
        elif isinstance(node.op, ast.Mult):
            out = left * right
        elif isinstance(node.op, ast.Div):
            if right == 0:
                hold("DIVISION_BY_ZERO")
            out = left / right
        elif isinstance(node.op, ast.Pow) and right.denominator == 1 and abs(right.numerator) <= MAX_EXPONENT:
            if right < 0 and left == 0:
                hold("DIVISION_BY_ZERO")
            out = left ** right.numerator
        else:
            hold("UNSUPPORTED_ARITHMETIC_OPERATOR")
        if abs(out.numerator).bit_length() > MAX_OPERAND_BITS or out.denominator.bit_length() > MAX_OPERAND_BITS:
            hold("ARITHMETIC_RESULT_TOO_LARGE")
        return out
    hold("EXPRESSION_NOT_IN_VERIFIED_ARITHMETIC_SUBSET")


def probe_expression(source: str, function: str, inputs: dict):
    """Evaluate only a pure single-return arithmetic AST; never Python bytecode."""
    if not isinstance(inputs, dict) or len(inputs) > MAX_INPUTS or not isinstance(function, str):
        hold("PROBE_INPUTS_INVALID")
    root = ast.parse(source, mode="exec")
    matches = [x for x in root.body if isinstance(x, ast.FunctionDef) and x.name == function]
    if len(matches) != 1:
        hold("PROBE_FUNCTION_NOT_FOUND")
    fn = matches[0]
    if fn.decorator_list or fn.args.defaults or any(x is not None for x in fn.args.kw_defaults) or fn.args.posonlyargs or fn.args.vararg or fn.args.kwarg or fn.args.kwonlyargs:
        hold("PROBE_COMPLEX_SIGNATURE_UNSUPPORTED")
    params = [x.arg for x in fn.args.args]
    if set(inputs) != set(params) or len(params) > MAX_INPUTS:
        hold("PROBE_PARAMETERS_MISMATCH")
    statements = [s for s in fn.body if not (isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant) and isinstance(s.value.value, str))]
    if len(statements) != 1 or not isinstance(statements[0], ast.Return) or statements[0].value is None:
        hold("PROBE_REQUIRES_SINGLE_ARITHMETIC_RETURN")
    env = {k: _frac(v) for k, v in inputs.items()}
    result = _arithmetic(statements[0].value, env)
    return {"version": VERSION, "function": function, "method": "restricted_arithmetic_AST_interpreter", "inspected_code_executed": False,
            "inputs": {k: str(v) for k, v in sorted(env.items())}, "result_rational": str(result),
            "result_decimal_approx": float(result) if abs(result.numerator).bit_length() < 100 else None,
            "scope": "expression_value_only_not_runtime_function_proof"}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Read-only Python code semantics and bounded arithmetic V1")
    parser.add_argument("file", help=".py file relative to --root")
    parser.add_argument("--root", default=".", help="root directory containing target file")
    parser.add_argument("--probe", help="top-level pure arithmetic function to evaluate")
    parser.add_argument("--inputs", help="JSON object (shell quoting may vary)")
    parser.add_argument("--var", action="append", default=[], metavar="NAME=NUMBER", help="repeatable shell-safe numeric input (recommended on PowerShell)")
    args = parser.parse_args(argv)
    try:
        root = Path(args.root).resolve(strict=True)
        src, rel = read_source(Path(args.file), root)
        report = analyze_text(src, rel)
        if args.probe is not None:
            if args.inputs is not None and args.var:
                hold("PROBE_INPUT_MODES_MUTUALLY_EXCLUSIVE")
            if args.inputs is not None:
                if len(args.inputs) > 1200:
                    hold("PROBE_JSON_TOO_LARGE")
                try:
                    inputs = json.loads(args.inputs)
                except json.JSONDecodeError:
                    hold("PROBE_JSON_INVALID")
            elif args.var:
                if len(args.var) > MAX_INPUTS:
                    hold("PROBE_TOO_MANY_VARS")
                inputs = {}
                for item in args.var:
                    if len(item) > 200 or "=" not in item:
                        hold("PROBE_VAR_SYNTAX_INVALID")
                    name, number = item.split("=", 1)
                    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,63}", name) or not number or name in inputs:
                        hold("PROBE_VAR_NAME_OR_DUPLICATE")
                    inputs[name] = number
            else:
                hold("PROBE_INPUTS_REQUIRED")
            report["arithmetic_probe"] = probe_expression(src, args.probe, inputs)
        elif args.var or args.inputs is not None:
            hold("PROBE_REQUIRED_FOR_INPUTS")
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except (ValueError, OSError, RecursionError) as error:
        print(json.dumps({"version": VERSION, "state": "HOLD", "reason": str(error)[:180], "inspected_code_executed": False}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
