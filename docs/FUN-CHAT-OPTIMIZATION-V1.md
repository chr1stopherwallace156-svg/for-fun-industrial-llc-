# Fun Industrial: Chat-Integrated Optimization (Phase 2.2.1)

## Scope

This extends the completed Phase 2.2 offline Qwen selection + Optuna/OR-Tools workflow into **the existing Fun Industrial dashboard chat** at 127.0.0.1:8789. It does not create another listener, daemon, recurring schedule, or tool execution authority.

An explicit chat command like `Optimize inventory for these demand samples` is recognized before the existing Send handler **only when a uniquely identifiable chat control is found**. If the installed operator dashboard does not use the historical chat IDs and its actual controls cannot be identified unambiguously, the injected client adds a dedicated **Optimization in Fun Industrial** section on that same dashboard, with an explicit **Prepare optimization** button. In this compatibility fallback, optimization is *not* triggered by sending text into the unidentified regular chat. Existing chat, automatic read-only memory, web research, voice, and REA catalogue behavior remain unchanged.

The panel requires the operator to enter **1–3 concrete validated candidate JSON objects** using the existing inventory/allocation/route schemas. It never silently assumes demand, stock costs, budgets, labor, or distances. The previous Phase 2.2 prompt lets local Qwen select one index only, without executing any solver. The selected problem and goal are saved with SHA-256 integrity, proposal ID, model reason, and measured token usage.

The operator must inspect the full selected JSON, then separately confirm a single local solver run. A run claim is single-use and cannot be repeated automatically. The calculation is followed by an explicit `enter-review`, then a separate final approve/reject acknowledgment. These approvals do not alter business inventory, schedule services, or grant REA tools.

The result lives under the existing `%LOCALAPPDATA%\FunIndustrial\WorkflowRuntime` checkpoints. No model tools or external actions are permitted by this bridge.

## Deployment and rollback

The guarded `Install-Fun-Chat-Optimization.ps1` script:
- Refuses an unrecognized live server, modified Phase 2.2 adapter, missing REA catalogue, unready llama.cpp, compute, memory, voice, web, or optimization-agent services.
- Runs four focused Node test suites, performs staged server and HTML patches, validates syntax and SHA-256 file hashes, and keeps backups of both original live files.
- Copies only three new `src/workflows` files and replaces the staged dashboard server + HTML.
- Restarts **only** the verified existing 127.0.0.1:8789 dashboard process; it never stops llama.cpp 8088, compute 8791, or the gateway. It reinitializes the existing REA MCP catalogue after the dashboard restart without invoking a tool.
- Checks available services and protected port/PID snapshots, and attempts rollback if postflight fails.

From a **fresh, clean branch checkout**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Fun-Chat-Optimization.ps1
```

A deployment failure reports a `FUN_CHAT_OPTIMIZATION_DEPLOY_HOLD` and the backup directory; investigate rather than forcing. Do not remove the solver lock or run claim without manual process and checkpoint examination.

## Test in existing chat

Open `http://127.0.0.1:8789` and enter:

`Optimize inventory using my verified demand numbers`

The chat either displays an inline review panel (recognized chat controls) or a separate **Optimization in Fun Industrial** panel farther down the page (unrecognized dashboard markup). For the latter, enter your optimization goal there and choose **Prepare optimization**. For a **synthetic test only**, paste this complete candidate array:

```json
[{"action":"inventory","problem":{"demand_samples":[3,4,3,6,7,4,5,8,5,4],"min_stock":0,"max_stock":12,"holding_cost":1,"shortage_cost":3,"trials":48}}]
```

Choose `Ask Qwen to select (no solver)`, inspect the proposal, then separately approve a run; review and approve/reject the result separately. An ordinary non-optimization chat prompt should still follow the original path. Neither a page reload nor a repeat request automatically resubmits a solver run.

## Qualification and limitations

The standalone CI test uses a simulated local Qwen response and simulated solver to verify strict inputs, no-run drafts, single-use approval claims, and separate final review, on Windows and Linux. Only a real Windows installation and direct dashboard smoke test establish live chat integration.

This is **not** a general optimization language interpreter: an operator must supply numeric candidate schemas. It has no autonomous scheduler, recurring execution, resource-aware CPU manager, or unrestricted agent. Human-facing `window.confirm` and a same-origin request header are application approval controls, not a cryptographic human identity signature.

## Next: complexity-aware software development

Treat two upstream open source patterns as architecture references, **not implicitly installed dependencies**:

1. `Fission-AI/OpenSpec`: turn ambiguous goals into durable proposals, specs, designs and tasks. Use bounded operator review before coding.
2. `Aider-AI/aider`: use its repository-map ideas to select relevant files/functions instead of pushing an entire GitHub checkout through the local Qwen context window.
3. `github/codeql`: optional static evidence for data flow, dependencies and security questions; evaluate supported languages and per-repository resource costs first.
4. `OpenHands/software-agent-sdk`: optional agent orchestration architecture, but do **not** adopt its heavy execution stack as a default for local CPU-constrained Fun Industrial.

Recommended next stage: build a deterministic, read-only repository-indexing and architecture-report pipeline that records file paths, imports, dependency edges, changed source ranges, test coverage links, and uncertainty. Feed only small evidence summaries to Qwen, then gate patches behind tests and human approval. This adds complexity comprehension without requiring a larger local model or granting agent write authority.

## Dashboard compatibility repair — 2026-11-10

The first live Windows installation stopped before any service restart with `CHAT_OPT_UI_BASELINE_MISSING_id="chat-input"`, after all 27 focused tests passed. The real dashboard is a customized version; earlier voice patchers already warned not to assume that legacy input ID. The compatibility patch removes those brittle selectors from **staging-time validation**, verifies a unique body element plus protected web and voice markers, and safely attaches only if chat controls are uniquely identifiable at runtime. Otherwise it renders a separate opt-in optimizer input on the same dashboard. Focused CI confirms both original and customized markup. No existing chat controls or messages are replaced.
