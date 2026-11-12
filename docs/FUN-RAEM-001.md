# Fun Industrial RAEM-001 — observational resource admission

## Scope

Source-only prototype for a Resource-Aware Execution Manager (RAEM). It can measure available RAM and recent CPU utilization, calculate bounded memory budgets, queue named jobs, gate claims on an operator-supplied approval flag, and compute the next due time for periodic jobs after a successful completion.

It does **not** run jobs, start or stop services, install AIL, fetch breach data, enforce hard Windows process memory limits, provide a persistent scheduler, or prove that AIL can run with 16 GiB RAM. There is no background timer, network call, subprocess, REA execution, filesystem write, or AI model lifecycle operation in these modules. The claim/complete API is only a planning state machine. The host controller must independently authenticate the human operator before ever passing `operatorApproved:true` and must enforce access controls on actual actions.

## Files

- `src/resource-aware/raem.mjs` — validation, pressure-aware admission decisions, manual queue and refresh lifecycle.
- `src/resource-aware/host-snapshot.mjs` — OS RAM and sampled CPU utilization.
- `scripts/Diagnose-Fun-RAEM001.mjs` — read-only diagnostic showing a *hypothetical* six-hour public-feed monitor; no monitor is executed.
- `intelligence-checks/resource-aware-manager-case.mjs` — deterministic synthetic test cases.

## Proposed defaults (tunable, not hard RAM limits)

- Free-memory reserve is the larger of 1536 MiB or 20% of total system memory, plus any already-reserved job budgets.
- Hold new work when measured host CPU utilization is at least 85% or free headroom cannot meet the task minimum.
- Grant at most the **requested target** memory and reduce toward the minimum as needed. The task may request a higher target (for example 5 GiB) when headroom allows, with no arbitrary 1–3 GiB ceiling.
- Default to one active admission. Periodic work is scheduled **after successful completion**, not polled continually by this module.
- Failed work requires separate operator-authorized retry; no automatic rerun.

The grant is advisory, not an OS-enforced RAM reservation. Admission must be followed by runtime observation and cancellation/kill limits in the worker integration, and resources may disappear between sampling and execution. `os.freemem()` is not a guaranteed availability forecast, particularly on Windows. No operation here has any authority to kill Ollama, llama.cpp, the Fun Industrial dashboard, or REA.

## Qualification on a safe copy

From a checkout of the new branch, with Node.js 22+:

```powershell
node --test .\intelligence-checks\resource-aware-manager-case.mjs
node .\scripts\Diagnose-Fun-RAEM001.mjs
```

These commands only read resource status and execute synthetic decision tests. The diagnostic prints `JOB_EXECUTION=NONE` and does not change current services.

## Next qualification gate (not completed)

On the operator's Windows 16 GiB machine, collect observed RAM/CPU readings while *separate*, approved synthetic stream-processing tasks run under a capped worker. Measure peak working set, CPU utilization, throughput, queue latency, failure recovery, and operational impact on Qwen/REA. Only then connect an authorized, incremental AIL public-intelligence feed with an operator-configured interval.

Do not introduce a clock timer, persistent auto-execution, REA tool grants, dark-web collection, or AIL server lifecycle control in RAEM-001.
