# Fun Industrial — Semantic Proof V2

**Status:** isolated, offline, proof-of-concept. Built on verified V1 branch; V2 Python code and tests have 17/17 local prototype passes. Requires separate Windows validation before any live integration. No change to the main dashboard, Qwen, REA, startup ports, tool permissions, or Elektron.

## What V2 adds

V2 performs *exact symbolic analysis of division-by-zero hazards* for a deliberately restricted subset of Python arithmetic expressions, using only the standard library. Its engine reads reviewed Python source through V1's bounded, root-scoped reader. It never imports or executes the inspected source, runs a model, or calls MCP/REA.

Every declared numeric input has a closed, rational-valued interval of the form \`name=MIN:MAX\`. For each syntactic divisor in a top-level, undecorated, single-return Python function, the analyzer attempts to normalize the divisor to an affine expression \`c + sum(ai * xi)\`. It then calculates the exact minimum and maximum over the rectangular input domain. When zero is excluded from the entire interval, it has a proof of divisor nonzero *under that mathematical model*. When zero lies inside the affine interval, it constructs a concrete rational assignment that makes the divisor zero and rechecks the witness arithmetically. When it cannot analyze the expression conservatively, it returns **UNKNOWN**, not a speculative proof.

## Explicit statuses

- \`PROVED\` — every syntactic divisor in the supported single-return expression is demonstrably nonzero throughout the supplied rational input box. If there are no divisors, the check is vacuously true. This does **not** prove the function correct or free of other errors.
- \`COUNTEREXAMPLE_FOUND\` — the symbolic expression contains a divisor that equals zero for at least one rational input assignment in the supplied box. The report includes that input as a witness. This is **not** a claim that Python will execute that exact path or fail in every runtime.
- \`UNKNOWN\` — analysis requires unsupported syntax, a nonlinear divisor, dynamic dispatch, a complex function body, or otherwise exceeds the supported proof model.
- \`HOLD\` — an invalid or unsafe analysis request is rejected, e.g. wrong variable names, oversized/invalid input, or malformed ranges.

In all statuses: \`source_executed=false\`, \`external_actions=0\`, and \`tool_authority_granted=false\`.

## Example

Inspected source from \`intelligence-checks/fixtures/fisre_example.py\`:

\`\`\`python
def calculate_price(cost, margin):
    return cost / (1 - margin)
\`\`\`

With inputs \`cost=0:1000\` and \`margin=0:0.5\` the denominator \`1-margin\` lies in \`[1/2, 1]\`: **PROVED** nonzero over that rational domain.

With inputs \`cost=0:1000\` and \`margin=0:1\` the system reports **COUNTEREXAMPLE_FOUND**: \`margin=1\` makes the denominator zero.

For a nonlinear denominator like \`1/(x*y-1)\` with both \`x\` and \`y\` variable, V2 returns **UNKNOWN**. Later work may introduce a separately qualified SMT engine such as Z3, but **Z3 is not installed, required, or used by V2**.

## PC qualification

Use a separate checkout of \`feature/fun-semantic-proof-v2-20261122\`, not the currently running Fun Industrial checkout. From the new checkout root:

\`\`\`powershell
py -3.12 -m unittest discover -s intelligence-checks -p 'test_fisre*.py' -v
py -3.12 src/semantic/fisre_proof_v2.py intelligence-checks/fixtures/fisre_example.py --root . --function calculate_price --range cost=0:1000 --range margin=0:0.5
py -3.12 src/semantic/fisre_proof_v2.py intelligence-checks/fixtures/fisre_example.py --root . --function calculate_price --range cost=0:1000 --range margin=0:1
\`\`\`

Expected: **34 tests** (17 V1 + 17 V2) pass, followed by \`PROVED\` and \`COUNTEREXAMPLE_FOUND\`. Confirm results on Windows before claiming full qualification.

## Boundaries and future development

- Intended for Python 3.12+; statically parses supported source in memory; no target code execution. V1 enforces size, root/path and symlink restrictions. Use trusted local directories.
- Input intervals describe exact rational numbers, and Python float literals are represented as decimal rationals. **No claim is made about IEEE-754 floating-point behavior, exceptions, real CPU execution, or exact Python type semantics.**
- Call aliases, imported functions, decorators, branches, loops, side-effecting calls, user-defined operators, arbitrary nested syntax, and non-affine divisors are not proven safe.
- Proofs are narrowly about syntactic divisor values. An unverified or unsupported operation elsewhere in the expression does not become safe by implication.
- No persistent cognitive memory integration, Z3, daemon, extra network listener, model download, or changed operator permissions.
- Future: optional reviewed Z3 integration with explicit \`sat/unsat/unknown\`; independent testing against held-out cases; read-only candidate evidence feed into cognitive memory; integration behind an operator-approved feature gate. Protect all running services and Elektron.

**No deployment to port 8802 is performed by this branch.**
