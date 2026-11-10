# Fun Industrial Phase 2.1 — Checkpointed Offline Optimization

## Scope and evidence

Phase 2.1 extends the already-installed v1 local CLI coordinator with an **operator-invoked** `optimization` step. Its supported actions are `inventory` (Optuna), `allocation` (OR-Tools CP-SAT), and `route` (OR-Tools routing). There is no new daemon, dashboard listener, model replacement, REA permission, or autonomous execution pathway.

- `src/workflows/optimization-step.mjs` validates a typed, size-limited problem before persistence, runs the **existing** `src/optimization/runner.mjs` bounded local offline subprocess, checks schema and action/authority markers, and compacts evidence for Qwen.
- `src/workflows/coordinator.mjs` persists the full bounded solver output in a UUID checkpoint, with in-flight `executing` state before the solver call. A failure results in a durable `hold`, not an automatic retry.
- `model_summary` on a solver result receives a small structured summary, not the full optimization source inputs, log history or arbitrary tool definitions. The full result remains available to operator review in the checkpoint.
- Completion-token budget is enforced for model steps; the optimization step does **zero model calls and uses zero model tokens**. Solver CPU and wall time are real resources: a zero-token step is not a zero-cost step.
- Review is explicit; `approve` acknowledges the local result, **never** purchases, dispatches, schedules, changes inventory, runs REA, or triggers a solver automatically. Rejected review terminates the workflow.

The existing Python solver has its own safeguards: bounded problem sizes; 20-second subprocess timeout; fixed `python -m fun_optimization.bridge` execution without shell; one active solve per runner instance; capped input/output; single-threaded Optuna/OR-Tools where supported. All incoming numbers and schema fields are validated. Optuna's best trial is *not* guaranteed globally optimal; routing reports a feasible route, not a proven globally optimal tour.

## Qualifying and upgrading on Windows

Dedicated GitHub Actions workflow runs the original 9 coordinator tests and Phase 2.1 solver/adversarial tests on Windows and Linux. CI validates source behavior using injected fake solver outcomes; **only the local synthetic pilot uses the installed real OR-Tools/Python runtime**. A passing CI test alone does not prove that the local Python environment is configured or that the dashboard/compute processes are online.

From the matching, clean staging checkout:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Upgrade-Fun-Workflow-Optimization.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Fun-Workflow-Optimization-Pilot.ps1
```

The installer requires an exact v1 source baseline in `FunIndustrial-REA-MCP-Activation\src\workflows` and refuses unexpected modifications or an existing adapter. It adds `optimization-step.mjs`, replaces only `coordinator.mjs`, leaves the CLI unchanged, checks protected listener/PID snapshots, and keeps a separate copy of the original coordinator for rollback. No checkpoint file is read, modified or deleted by the installer. Existing workflow IDs, including currently `awaiting_review` work, are preserved.

The synthetic OR-Tools pilot creates its **own new UUID** with project budget 20 and labor 12; the first `optimization` step invokes the offline solver with no Qwen call, and shows a read-only allocation and result. Subsequent operator command `node <live-cli-path> step <new UUID>` requests a bounded model summary. Another explicit `step` enters `awaiting_review`. A separate `review <UUID> approve` or `reject` requires a deliberate operator choice; this never applies the proposed allocation.

For runtime errors, check the pilot's recorded workflow ID and `hold_reason` with `node cli.mjs status <UUID>`. Never bypass an existing lock or auto-run retries without reviewing the failure. If the installer refuses because the installed v1 file differs, inspect the local changes rather than using `-Force`.

## Limits and next qualification

This is a narrow, concrete Phase 2.1 foundation, not a general autonomous multi-agent optimizer. It does not yet support semantic task planning, free-form generated code, multi-solver branching or unrestricted 100-step loops. The existing coordinator limits a workflow to 16 operator-invoked steps, output-token budget 32–2048, and strict defined step types.

For a meaningful efficiency claim, compare like-for-like solver tasks while recording solver elapsed time, memory/CPU load, model prompt/completion tokens, correctness, and recovery after a process interruption. No token reduction by itself establishes CPU/RAM savings or model intelligence gains.
