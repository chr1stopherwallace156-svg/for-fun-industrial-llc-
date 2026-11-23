# Fun Industrial Semantic Reasoning Engine V1 (FISRE)

**Status:** isolated offline prototype. Python source analysis only. This branch has not changed or deployed the running dashboard, Qwen, compute, REA, Ollama, or any Elektron file.

## Purpose

Establish a trustworthy, deterministic source-code understanding layer before asking a local language model to explain the results. The engine inspects code structures and a restricted arithmetic expression subset without importing, invoking, or executing the inspected source.

Model: `U(x) = F(S, G, D, M, R, V)` is a design decomposition, **not** a proven formula for general understanding. V1 implements limited syntax (`S`), lexical dependency graphs (`G`), and a small verification subset (`V`). Runtime dynamics (`D`), persistent verified memory (`M`), and broader reasoning (`R`) remain future stages.

For each function, a proposed capability contract has inputs, output-expression evidence, preconditions to be tested, possible effects, dependencies, and tests. V1 extracts input names, annotations, returns, candidate side effects, graph links, and candidate arithmetic hazards; it does **not** prove runtime preconditions, safety, or completeness.

## Proven behavior in V1

- Parse **Python 3.12+ source** through the Python standard library `ast` parser, returning a machine-readable JSON report.
- Locate functions, nested functions and methods; record source lines, arguments and annotations, call sites, candidate internal call relationships, unresolved calls, and a basic control-flow complexity lower-bound heuristic.
- Identify candidate console, filesystem, network, process, and dynamic execution calls; follow these candidate effects through a bounded lexical call graph with explicit evidence paths.
- Identify potential divisor-zero hazards without asserting that they are reachable under actual runtime input constraints.
- Evaluate **only** supported single-return arithmetic AST expressions (`+`, `-`, `*`, `/`, bounded integer powers) for supplied numeric inputs using exact rational arithmetic. This is an expression-level result, not a proof of complete Python function behavior.
- Hash analyzed source (SHA-256); retain explicit unknowns and evidence labels (`AST_SYNTAX_ONLY`).
- No third-party libraries, running services, network access, REA/MCP actions, model invocations, package install, or modifications to inspected source. Does not require Qwen or the dashboard to run.

## Qualification on PC

Run in a *separate checkout* of this feature branch; do not use the live Fun Industrial checkout.

```powershell
python -m unittest discover -s intelligence-checks -p test_fisre_v1.py -v
python src/semantic/fisre_v1.py intelligence-checks/fixtures/fisre_example.py --root . --probe calculate_price --inputs '{"cost":"100","margin":"0.25"}'
```

Expected tests: 14 PASS. Expected probe: `result_rational = 400/3`, `inspected_code_executed = false`, with a candidate divide-by-zero hazard on `1 - margin`. Setting `margin` to `1` returns `FISRE_HOLD_DIVISION_BY_ZERO` instead of running the function.

For a **reviewed** Python source file under an explicitly selected `--root`:

```powershell
python src/semantic/fisre_v1.py path/to/reviewed_module.py --root .
```

The output is printed as JSON. There is no automatic logging or outbound telemetry. Treat data captured in a terminal as sensitive when inspecting private source.

## Security and limits

- The target must be a regular `.py` file under the selected root, not a symbolic link. V1 rejects non-UTF-8 input, oversized sources (>256 KiB), excessively large ASTs, and excessive function counts. File-system symlink race resistance is best-effort; use only trusted, locally controlled directories for the inspection pilot. Running this analyzer does **not** sandbox the Python interpreter itself.
- Inspected code is parsed as **data only**. It is **never** imported or executed, and AST arithmetic evaluation is allowlisted rather than Python `eval`.
- Call graphs are **lexical candidates**: aliases, virtual dispatch, imported symbols, decorators, dynamic execution, monkey patching, and reflection are unresolved. An inferred call edge is not a runtime trace.
- Suspected effects are heuristic signals, not proof of actual effects or proof of absence. Complexity estimates are lower-bound approximations, not verified cyclomatic complexity.
- No general function-equivalence oracle exists; termination and many nontrivial semantic properties are undecidable in the general case.
- The engine does not use Tree-sitter, Z3, the existing cognitive kernel, Cognee, or Qwen yet. It does not support JavaScript/TypeScript in V1.
- Run tests with Python 3.12+, then collect live Windows outputs before considering any integration.

## Next gates (not implemented)

1. Parser adapters for JavaScript/TypeScript with a reviewed parser dependency and bounds. Do not use regex as a semantic parser.
2. Optional Z3 proof obligations for numeric input bounds and division safety; report `unknown` when a proof is unavailable.
3. Connect structured reports to the existing `CognitiveKernel` as *proposed knowledge*, with source provenance and no authority grants; add separately verified observations and a persistence audit.
4. Compare against established static-analyzer fixtures, injected faults and held-out programs. Do not measure quality from synthetic pass counts alone.
5. Operator-approved, read-only dashboard integration after independent Windows qualification; preserve the original oneport v2 UI as-is until explicitly approved.

**Isolation:** No edits to the running FunIndustrial processes, startup commands, homepages, REA allowlists, local service ports, Elektron files, or GitHub base branch. New module and tests are additive on a separate feature branch.
