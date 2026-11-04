# Fun Industrial — Functional Integration and Bounded Stress Qualification Plan

**Status:** planned; not executed.  
**Baseline:** [Functional Qualification 2026-11-04](FUN_INDUSTRIAL_FUNCTIONAL_QUALIFICATION_2026-11-04.md)  
**Baseline result:** `FUN_INDUSTRIAL_FUNCTIONAL_QUALIFICATION=PASS`

## Purpose

Extend the passed smoke/functional baseline into bounded integration and adversarial checks. Keep this plan distinct from observed test evidence. Every result must be recorded as PASS, FAIL, HOLD, or NOT RUN with exact inputs, response/status, and state-before/state-after evidence.

## Safety constraints

- Use only synthetic data and the existing qualification universes unless a new universe is strictly necessary.
- Do not restart/stop services or processes.
- Do not call `/admin/shutdown`, `/runtime/llama-cpp/stop`, or any destructive endpoint.
- Do not edit source, configuration, environment files, or Git working-tree state during host execution.
- Do not touch Elektron Chat/Work, Ollama, NetBird, Tailscale, firewall, routes, scheduled tasks, or unrelated ports.
- Bound request sizes, loops, and runtime. Stop immediately on unexpected status, response shape, state mutation, or service loss.
- The universe registry has no confirmed delete route. Avoid creating many test universes and do not exceed the 64-universe registry limit.
- The existing source and target test universes are in-memory and remain present. Do not assume cleanup occurred.

## Test groups

### FI-STRESS-GRAPH — graph correctness and scale

1. Exercise a larger deterministic graph with known components and degree counts.
2. Check isolated vertices, duplicate edges, and empty/single-node behavior only where the API contract permits them.
3. Independently calculate expected node/edge counts, density, connected components, and selected centrality values.
4. Record payload size and response duration. Use a bounded graph (initial ceiling: 250 nodes / 500 edges); do not escalate automatically.

### FI-STRESS-TENSOR — dimensions and numerical correctness

1. Exercise multiple compatible shapes, including rectangular matrices and a small square matrix.
2. Compute expected values independently in the PowerShell harness (not by calling the same tensor engine).
3. Compare returned shape and every numeric element with a documented tolerance.
4. Include a small zero-valued case and a non-square case.
5. Reject mismatched dimensions without accepting a fabricated success response.

### FI-STRESS-NEURAL — held-out inference

1. Use the already-trained global model and its known input width.
2. Query held-out synthetic points not included in the nine training examples.
3. Check response count, output width, finite values, and bounded numerical behavior.
4. Do not retrain as part of the held-out inference check.
5. Record that held-out behavior on this small synthetic task is not evidence of general-purpose generalization.

### FI-STRESS-VECTOR — exact search and topology edges

1. Verify deterministic tie ordering for equal cosine scores (expected secondary ordering by vector ID).
2. Verify zero-vector query behavior (score 0.0) if the current API accepts it.
3. Verify upsert semantics by reusing a synthetic vector ID and confirming count does not increase.
4. Verify wrong-dimension vector rejection and confirm vector count/state is unchanged.
5. Exercise topology with a different neighbor count, bounded by the existing four-vector fixture.
6. Confirm exact search is reported as non-approximate.

### FI-SECURITY-BRIDGE — negative authorization

1. Record source and target memory counts before the request.
2. Attempt transfer in the reverse direction (target to source), for which no directed bridge was configured.
3. Expect HTTP 403 / PermissionError (or the exact mapped API status documented by the implementation).
4. Confirm no memory count or payload changed after rejection.
5. Re-check that the original source-to-target bridge remains usable only if an additional positive transfer is needed; avoid duplicate payloads unless the test explicitly records them.

### FI-ISOLATION — universe boundary

1. Confirm source and target have distinct vector counts and memory counts.
2. Confirm source neural model is trained and target neural model remains untrained.
3. Confirm target cannot predict until its own model is trained.
4. If testing target prediction rejection, record the expected client error and verify no model/state was created as a side effect.
5. Do not copy vectors, memory, or model state across universes except through an explicitly configured bridge and transfer endpoint.

### FI-INPUT-VALIDATION — malformed request rejection

1. Submit invalid dimensions and non-finite values only to endpoints with known validation behavior.
2. Capture exact HTTP status and response detail.
3. Verify rejected requests do not mutate vector, memory, or neural state.
4. Never use huge payloads, unbounded epochs, or extreme dimensions.

## Acceptance criteria

- Every positive case matches independently computed expected output within declared tolerance.
- Every negative case is rejected with the expected status and has no state mutation.
- No unrelated process or service is affected.
- No source/configuration/Git state is modified by the host qualification.
- The run ends with a clear machine-readable summary, for example:
  `FUN_INDUSTRIAL_INTEGRATION_STRESS=PASS`
  only if every required test group passes. Otherwise report the exact failed/held group; never convert HOLD or NOT RUN into PASS.

## Required evidence record

Record:
- date/time and timezone;
- branch and exact source HEAD;
- dashboard and compute health before and after;
- existing test universe IDs;
- request payloads (synthetic only), HTTP status, response summaries;
- independently calculated expected values and tolerances;
- state counts before/after negative tests;
- per-test PASS/FAIL/HOLD/NOT RUN;
- final summary marker;
- explicit list of untested production properties.

Do not append results to the baseline report as though they were part of the earlier run. Create a separate dated execution report after the operator supplies the actual terminal output.
