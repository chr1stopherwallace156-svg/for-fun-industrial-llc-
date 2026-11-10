# Fun Industrial Phase 2.2 — Local AI-Assisted Optimization, Operator-Gated

## Scope and architecture

This phase is **additive** to the qualified Phase 2.1 persistent optimization coordinator. It adds no listener, web route, background process, REA tool grants, scheduler, autonomous execution loop, model installation, or service restart.

The new CLI uses the **existing local llama.cpp Qwen** endpoint through `defaultLocalModel` at `http://127.0.0.1:8791/ai/chat` (no Ollama). The operator provides 1–3 fully specified **numeric candidate problems**; the model may only return `{"candidate_index": N, "reason": "..."}`. A selected candidate is an exact deep copy of supplied validated data. The model cannot write new numeric problem fields or run a solver.

Candidate schemas reuse `validateOptimizationStep` for `inventory` (Optuna), `allocation` (OR-Tools CP-SAT), and `route` (OR-Tools routing). The proposed candidate and all alternatives are saved to local immutable-intent, SHA-256-checked proposal records. The proposal includes an untrusted model reason and measured token usage. Its digest authenticates **integrity relative to the first stored record**, not the identity of a human operator; this is not a signed approval.

Phase 2.2 command lifecycle:
1. `draft REQUEST.json` validates each candidate, invokes the existing local Qwen with `tools:[]`, parses a strict candidate index and reason, and saves the proposal. **No solver runs.**
2. `inspect PROPOSAL_ID` displays all selected inputs, digest, and whether a previous run claim exists. Still no solver runs.
3. After reviewing selected action and exact numbers, an operator separately enters `run PROPOSAL_ID SHA256`. This checks the stored proposal digest and creates a single-use claim **before** creating a new Phase 2.1 workflow. It then executes only its first offline solver step using the existing bounded runner. The claim prevents automatic duplicate runs after interruption. Failures require manual inspection rather than bypass/retry.
4. The newly generated workflow stops at `ready` with a separate `review` step. `node <existing-cli> step WORKFLOW_ID` moves it to `awaiting_review`; explicit `review WORKFLOW_ID approve|reject` acknowledges the result without acting on business systems.

The local proposal store is `%LOCALAPPDATA%\FunIndustrial\WorkflowRuntime\phase22-proposals`. Do **not** delete a .claim file or .lock as a shortcut to retry a failed or interrupted run; review the checkpoint and process ownership first.

## Installing on the Windows host

From a **clean checkout of branch** `feature/fun-workflow-phase22-20261110` run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Fun-Workflow-Phase22.ps1
```

The installer verifies the installed coordinator, CLI and Phase 2.1 optimization adapter have their expected unmodified versions, runs both sets of offline Node tests, adds only `phase22.mjs` and `phase22-cli.mjs` to the existing live `src\workflows` directory, verifies copy hashes and syntax, and compares listener PID snapshots. Refuses a duplicate or unexpected baseline. Any failed copy attempts rollback of the two added files only.

Then request a **draft only** for synthetic inventory-vs-allocation-vs-route input:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Fun-Workflow-Phase22-Pilot.ps1
```

Expected output `FUN_PHASE22_DRAFT`, `state=awaiting_operator_authorization`, `solver_runs=0`; read the printed ID, SHA and selected problem. If the model returns wrong/malformed JSON, missing usage, tool calls or unsupported candidate, the draft fails closed. No automatic repair, no fallback invented values.

Optional operator commands **after inspecting the draft**:

```powershell
node "$HOME\FunIndustrial-REA-MCP-Activation\src\workflows\phase22-cli.mjs" inspect PROPOSAL_ID
node "$HOME\FunIndustrial-REA-MCP-Activation\src\workflows\phase22-cli.mjs" run PROPOSAL_ID EXACT_SHA256
```

The second command is a **separate explicit operator run authorization**, not a suggestion for batch automation. It solves a bounded synthetic problem only and leaves the workflow review unapproved.

## Qualification and limitations

`node --test intelligence-checks/workflow-phase22-case.mjs intelligence-checks/workflow-optimization-case.mjs intelligence-checks/workflow-coordinator-case.mjs` covers strict request and model-output validation, hash tampering, no generated problem values, simulated solver handoff, explicit review and Phase 2.1 regression. CI runs on Linux and Windows but injects test doubles for optimization. **Only local Windows pilot + optional separately authorized solver run qualifies the real Qwen endpoint and installed Python solvers.**

The model does not synthesize arbitrary schemas or plan free-form workflows, cannot decide when to execute, cannot change REA approval policy, and cannot trigger tool calls. Unsupported user data and ambiguity must be resolved by the operator. Digest verification is local integrity checking rather than cryptographic authentication of a human. One active solver command is allowed per Phase 2.2 runtime, with fail-closed stale-lock handling.
