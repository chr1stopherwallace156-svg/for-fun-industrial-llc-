# Fun Industrial — Software-First Persistent Workflows v1

## Status

Phase 2 foundation is implemented on GitHub. Passing dedicated Windows and Linux unit tests does **not** prove the user's installed Windows runtime is operational. Installation and live local llama.cpp verification are separate.

## Architecture

`src/workflows/coordinator.mjs` is a single-process, low-overhead Node ESM workflow engine. `src/workflows/cli.mjs` exposes operator commands. No new service, port, dashboard endpoint, VPN path, REA authority, Cognee write, Ollama dependency, or autonomous shell executor is created.

Each workflow stores a UUID-keyed JSON checkpoint under `%LOCALAPPDATA%\FunIndustrial\WorkflowRuntime\checkpoints` (platform-specific homedir fallback for tests). Existing checkpoints are replaced using staged write + rename. A per-workflow exclusive file lock prevents concurrent writers; a stale lock is not removed automatically.

### Supported steps (deliberately narrow)

- `stats`: pure JavaScript count, sum, mean, median, min, max from 1–64 bounded real values; **zero model tokens**.
- `model_summary`: a single, operator-invoked read-only call to **existing** compute `127.0.0.1:8791/ai/chat`, forwarding only a compact prior result; `tools:[]`, maximum 512 output tokens per call, with total workflow budget 32–2048. Unknown or excessive completion token usage causes a HOLD rather than silently exceeding budget.
- `review`: explicit `approve` or `reject` from operator. Review records a decision only; it does not trigger any external action.

At most 16 steps per workflow. No unbounded loops, automatic step chaining, REA execution, arbitrary Python, shell, web searches, or side effects beyond local workflow checkpoints.

### Lifecycle

`ready` → operator requests `step`. Deterministic or model step completes and advances cursor. Review step moves to `awaiting_review`; operator chooses `approve` or `reject`. Model failure moves to `hold` with no automatic retry. Operator may request `retry` once for a held model step. A crash while a model request is in flight can leave `executing` plus an exclusive lock: operator must verify that the owner is gone, run `recover-lock`, and then `retry`. The engine refuses to remove a lock whose owner PID is still alive.

### Installing

From the clean, current GitHub staging clone:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Fun-Workflow-Coordinator.ps1
```

The guarded installer copies only two files into `FunIndustrial-REA-MCP-Activation\src\workflows`; it does not restart or reconfigure existing services. It refuses to overwrite an existing workflow directory.

### Demonstration (synthetic measurements only)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Fun-Workflow-Pilot.ps1
```

This creates a persistent demo with numeric values `[4,10,6]`, runs `stats` in JavaScript and prints a unique ID. It **does not invoke the model**, so initial completion token use remains zero. To continue, run:

```powershell
node "$env:USERPROFILE\FunIndustrial-REA-MCP-Activation\src\workflows\cli.mjs" step <workflow-id>
node "$env:USERPROFILE\FunIndustrial-REA-MCP-Activation\src\workflows\cli.mjs" step <workflow-id>
node "$env:USERPROFILE\FunIndustrial-REA-MCP-Activation\src\workflows\cli.mjs" review <workflow-id> approve
```

The first command calls Qwen once to summarize synthetic statistics; the second creates the review hold; the third records approval to conclude. Review the displayed model output before approval. For status: `node ...\cli.mjs status <workflow-id>`. If an interrupted process left a lock and its PID is no longer running: `node ...\cli.mjs recover-lock <workflow-id>`, then review status and use `retry` if held. Never remove an active lock to bypass operator checks.

## What this does *not* prove

It does not yet optimize arbitrary 50–100-step tasks; it establishes checkpointing, tight step contracts, model token budgeting, and execution boundaries with a small deterministic workload. It does not establish CPU/RAM or token efficiency improvements without a paired benchmark. Future work can add validated pure Python/OR-Tools/Optuna planning steps and relevant Cognee recall without widening REA permissions.
