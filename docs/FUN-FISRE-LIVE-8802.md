# Fun Industrial FISRE — Active One-Port Integration (8802)

This change is a **live dashboard integration**, not another standalone proof-only qualification branch. The operator deploys the feature by running `Activate-Fun-FISRE-Live-V4.ps1` from the new dedicated checkout. The assistant cannot directly operate the user's Windows PC: **GitHub publication is not local deployment**. Live status is established only after the PC reports `FUN_FISRE_LIVE_V4=PASS`.

## What changes in the real system

- The **existing** loopback-only dashboard port `http://127.0.0.1:8802/` gains a **Semantic Reasoning** entry under **Capabilities** in the same sidebar. The spatial homepage, existing links, Qwen chat, Tool Review, Operations, Fleet, Procurement, Commerce, ML and other modules are left as they are.
- Clicking Semantic Reasoning opens the same-origin `/fisre/` workspace, with an editable text-only Python source box, function selector, and rational input ranges such as `cost=0:1000` and `margin=0:0.5`.
- **Analyze source & verify** initiates `POST /api/fisre/analyze`. The existing Node 8802 service checks the browser origin, a deliberate operator-click header, strict JSON content type and input size, then launches a *fixed reviewed Python worker* using the installed Python 3.12 interpreter. No arbitrary shell or user-controlled command arguments are used; source is passed as stdin text, not as executable code or a filesystem pathname.
- That worker runs FISRE V1 source/dependency analysis, V2 bounded exact-rational proof, and V4 same-algorithm source-bound replay **over exactly the submitted in-memory source**.
- The same 8802 service feeds the V2 report into the existing V3 `CognitiveKernel` bridge, which generates only a `proposed` knowledge record and report digest. No shared memory is modified, no permanent database write happens, and no code or source is stored.
- Results are rendered as plain text in the embedded module. A `PROVED` verdict is narrow: rational affine divisor nonzero for the supplied domain, **not** general Python runtime safety. A `COUNTEREXAMPLE_FOUND` verdict has a rational zero-divisor witness. Unsupported constructs remain `UNKNOWN`.

## Endpoints (existing 8802 server, no new network listener)

- `GET /fisre/` — workspace; same-origin embedded route.
- `GET /api/fisre/client.js` — same-origin static frontend.
- `GET /api/fisre/status` — read-only capability status.
- `POST /api/fisre/analyze` — explicit, bounded local analysis request only; requires same-origin `Origin` and `x-fi-fisre: operator-click`. No automatic calls or scheduled background work.

## Deployment

Required existing folders:

- `$HOME\FunIndustrial-SpatialUX-V2` — your current reviewed dashboard and rollback checkout, branch `feature/fun-oneport-spatial-ux-v2-20261115`.
- `$HOME\FunIndustrial-QwenML-V2` — existing independent ML starter, if using the combined full-system starter.

New dedicated checkout: `$HOME\FunIndustrial-FISRE-Live` on `feature/fun-fisre-live-8802-20261122`. From this checkout invoke `Activate-Fun-FISRE-Live-V4.ps1`. The script verifies the exact old/new source branch, clean worktrees, local Node/Python availability, protected listener snapshot, and previously known process owner. It stops **only** the existing reviewed 8802 Node process, launches the new 8802 process, validates both old dashboard and new Semantic Reasoning endpoints, and checks that protected listeners did not change. If the new 8802 process fails, it attempts to stop only its own new process and restore the old 8802 Node dashboard. Unexpected process ownership or unknown source causes a hold; the script never substitutes arbitrary processes.

For future full starts (after initial deployment), replace the old V2 startup command with the single `Start-Fun-FISRE-System.ps1` script in this new checkout. This calls the existing reviewed core, ML, new 8802 activation/adoption, and private gateway starters in order without using the superseded Spatial UX 8802 activation.

## Limits

- **Not** global Qwen chat fine-tuning, persistent cognitive learning, Z3, full Python symbolic execution or verified IEEE floating-point behavior. The new UI is an explicit tool inside the existing app.
- **Not** another REA capability or automatic action. REA approvals, the existing Qwen and memory services, gateway, scheduled grants, Shopify, and Elektron are untouched.
- The PC must report successful deployment before claiming the running system was upgraded.
- A source-bound replay using the same V2 solver is **not** an independent mathematical proof or publisher authentication.
- Only manually pasted, reviewed source is supported. Arbitrary local-file browsing from the dashboard is intentionally unsupported.

## Existing upstream service health

The deployment verifies the **local 8802 shell and FISRE module** before declaring the new feature active. Read-only status checks for independent ML and unified-chat upstreams run afterward for diagnostics only. If either responds with HTTP 502, the deployment prints a `FUN_FISRE_DEPENDENCY=... STATE=DEGRADED_HTTP_ONLY NO_RESTART` warning, rather than failing or restarting those workers. The affected existing module may still be unavailable until its own service is recovered. A healthy FISRE deployment is **not** a claim that all unrelated modules are healthy.

## Unified Qwen chat integration — installed code (operator activation required)

This branch now integrates FISRE **into the same 8802 Qwen conversation path**, not just the separate Semantic Reasoning tab. The existing **Local AI Chat** sidebar link now opens `/chat/?embedded=1` directly on port 8802. It no longer requires the separate (currently degraded) 8798 chat proxy. The separate Tools/REA review route remains unchanged and may still show degraded until 8798 is recovered.

The chat uses **the existing Qwen3-4B server on 127.0.0.1:8088**, existing optional read-only Cognee retrieval through 8789, and the same already-qualified Python FISRE proof subprocess. No second model, new network port, training, new process daemon, GPU, or replacement of the spatial homepage is required.

The user can ask a question and optionally attach Python source, exact function name, and rational numeric ranges in the **same chat message**. One deliberate click triggers this bounded sequence:

1. 8802 validates the code fields; if no code was attached, the usual Qwen chat path is unchanged.
2. A single bounded, local, ephemeral FISRE subprocess inspects the supplied source text, runs V2 exact-rational divisor checking and V4 source-bound replay, and constructs a V3 in-memory **proposed** cognitive claim. The submitted code is not imported or executed.
3. A shortened evidence report (source hash, function relationships, hypotheses, mathematical status, domain, witness and code excerpt labeled *untrusted data*) is included in the existing grounded Qwen prompt, so **that same Qwen produces the answer**.
4. Results remain scoped to the current chat. There are no automatic code fixes, code runs, REA actions, external commands, permanent memories, or model-weight updates.

**This is runtime orchestration/integration, not changing Qwen's neural weights.** The model has access to qualified tools via fixed, reviewed application logic, not by granting itself shell authority. A `PROVED` result remains scoped to the restricted exact-rational mathematics; a validated replay is not an independent mathematical proof.

The new deployment marker is `FUN_QWEN_FISRE_CHAT=UNIFIED_8802_DIRECT_8088`. After running the activation script, visit `http://127.0.0.1:8802/#chat`. The activation script will adopt an existing matching integrated dashboard without restarting it, or replace only the existing identified 8802 Node process and attempt rollback to the reviewed old dashboard if activation fails.

## Unified AI capability fabric (12-domain inventory)

The primary **Local AI Chat** on 8802 uses the *same* Qwen model, and now receives a bounded, query-sensitive capability inventory (`fun-ai-capability-fabric-v1`) plus available **read-only cached evidence** for grants, executive/outcomes, ML health, and Shopify/Trends. The pre-existing Qwen context adapters also cover business frameworks, regulatory research, fleet buyers, procurement, commercial fit, bid readiness and funding-demand evidence. FISRE has been integrated into the chat for operator-supplied Python source and ranges.

Domains reported inside the existing chat: code/math, Cognee memory, business, grants, fleet and purchasing, operations/outcomes, ML, commerce, optimization, engineering, security/PE, and REA/local tools.

**This inventory is not automatic execution of every module.** Optimization, CAD/EV engineering, security inspection, model training, REA tools and filesystem effects are **not** silently executed from prompts. Their existing capabilities are catalogued, and tool execution continues to require the approved operator flow and healthy dependencies. No new model, process daemon, network port, code-authoring permission, or Elektron integration has been installed. A degraded unified-tools backend at 8798 remains an independent availability concern.

`GET /api/fun/capabilities/status` provides the read-only inventory. `GET /api/fial/grounded/status` includes `capability_fabric_version=fun-ai-capability-fabric-v1`. The deployment checks these on 8802 startup and prints `FUN_QWEN_CAPABILITY_FABRIC=12_DOMAINS_READONLY_ROUTING`.

To use it, open `http://127.0.0.1:8802/#chat` and ask Qwen, for example, "What can Fun Industrial do for grants, EV engineering and optimization, and which modules can currently act?" The answer must distinguish existing modules and read-only evidence from actual verified execution authority. Click **Fun Industrial intelligence domains** inside the chat for the inventory; this never launches an action.

## In-chat operator-reviewed REA dispatcher (limited initial scope)

The current one-port Qwen chat includes **Reviewed REA tools · separate approval**. This uses a fixed adapter to the existing REA MCP service **127.0.0.1:8797** and reuses the existing `createVerifiedReaV3` two-step review and single-use authorization token. It does not depend on the separate degraded 8798 UI.

Only these **two explicitly reviewed read-only operations** can be prepared here:

- `inspect_analysis_settings`, exact arguments `{}`; inspect configured REA analysis settings.
- `binary_session`, exact arguments `{}`; inspect the binary provider/session status.

In Qwen chat, asking about REA settings or binary providers yields **a deterministic suggestion only**. The operator must then open the tool review panel and **click Prepare inspection**; 8802 reads the live 8797 status and tool catalogue, verifies the exact tool's schema, and creates a 120-second pending authorization. **Confirm exact read-only call** is a distinct second click and consumes the token, even on ambiguous failure. No automatic retries. Cancel explicitly invalidates the pending token. No agent-generated arguments, no arbitrary REA tool names, no tool execution from the Qwen model, and no file operations.

A verified result can be read in the same panel with a receipt hash; **Ask Qwen to explain the approved observation** sends only a short, labeled, untrusted snapshot of the operator-approved result into the *existing local Qwen* prompt. The observation is ephemeral in 8802 memory and not written to persistent cognitive memory. Qwen cannot repeat or modify the tool call itself. Backend maintains existing one-port origin/click requirements. If the REA provider or its exact tool is unavailable, preparation refuses execution. This integration does **not** repair 8798 or assert all 229 REA tool calls are available.

Routes under the existing 8802 loopback listener:
- `GET /api/fun/rea/dispatch/status` — local dispatcher capability/approval state, with provider usability not verified until preparation.
- `POST /api/fun/rea/dispatch/prepare` — separately clicked operator review of exact allowlisted tool and `{}`.
- `POST /api/fun/rea/dispatch/confirm` — separate click with matching single-use token and `operatorConfirmed=true`.
- `POST /api/fun/rea/dispatch/cancel` — cancellation, `{}` only.

**Not connected for direct execution:** general ML training, OR-Tools/Optuna solves, FreeCAD/WireViz rendering, arbitrary file and PE analysis, financial transfers, external submissions, Shopify writes, or the remaining REA tools. They require tool-specific schema verification, target review, per-effect permissions, and operator approval. Merely listing them in the 12-domain capability inventory is not evidence that Qwen can operate them.

Deployment remains operator-initiated via `Activate-Fun-FISRE-Live-V4.ps1`, and checks the presence of this review panel and the `fun-ai-reviewed-rea-dispatch-v1` route before changing the active dashboard. The success marker includes `FUN_REA_DISPATCH=EXACT_READONLY_PREPARE_CONFIRM_SEPARATE_CLICKS`.

## Qwen chat ML and optimization — reviewed V1 compute layer

The existing **Local AI Chat** on 8802 now contains **ML & optimization · one AI, reviewed execution**, integrated with the existing Qwen 8088 model. This is **one existing AI model**, not a separate AI, machine or dashboard. The two mathematical solvers are ordinary Python libraries running on the same Windows PC; they do not change Qwen weights.

The reviewed dispatcher offers **five fixed modes**:

1. `optuna_inventory` — Optuna TPE inventory stock-level search. Dataset 1–50 periods, bounded stock 0–1000, 12–64 sequential trials. It additionally enumerates all allowed stock levels for exact discrete verification and reports whether Optuna found the optimum.
2. `ortools_routing` — Google OR-Tools bounded single-vehicle routing across 3–12 nodes. One fixed vehicle starts and ends at node 0; search has a four-second time limit, and the result's route and cost are checked against the supplied matrix. It **does not** claim global optimality.
3. `ml_deals` — already reviewed local scikit-learn bridge on 8801, exact `deals` records, no arbitrary Python code.
4. `ml_history` — reviewed local scikit-learn training on 8801 using `history` records. **Training requires separate human confirmation**; this does not train Qwen or create new permissions.
5. `ml_candidates` — existing scikit-learn bridge with bounded `candidates` records; availability and model prerequisites are checked by that backend.

Each module is selected explicitly. The input editor is JSON, and its examples are **synthetic**, not real observations or business recommendations.

**Review flow:** Enter or replace input data; click **Prepare reviewed job** to validate exact schema and freeze the reviewed payload with a SHA-256 digest and short-lived token (120 seconds); read the task, exact mode, data count, parameter bounds, and effects; separately click **Confirm exact computation**. Only then can the dispatcher call the fixed local ML backend or a fixed Optuna/OR-Tools Python worker. A new preparation invalidates the previous one; cancel removes the pending review. No Qwen text can invoke this call directly, and the backend has no raw command or arbitrary file argument. Every unverified or ambiguous outcome refuses automatic retry.

After an approved, attested computation, **Ask Qwen to explain approved result** passes a bounded snapshot of the verified result (labeled *untrusted data*, not executable instructions) into the *same* local Qwen chat. It does not retrain Qwen, persist a new cognitive fact, install a model, transfer data over the internet, or spend money.

The standard ML bridge uses existing 8801 without replacing that service. Optuna and OR-Tools are installed into **only** `%LOCALAPPDATA%\FunIndustrial\ApprovedOptimizationV1\.venv` by operator-invoked `Initialize-Fun-Optimization-V1.ps1`, which checks Python 3.12 and runs pip for bounded package-major versions, with wheels-only and no pip cache. This requires package-index internet access once. No package installation occurs just by opening chat, asking Qwen, or preparing a job. The isolated worker is launched once per approved computation, with a maximum 30-second window, one active action at a time, no user-code execution, and thread budgets (`OMP_NUM_THREADS=1`, etc.).

Existing 8802-only endpoints:
- `GET /api/fun/compute/status` — read-only approval and capability state; not a claim that 8801 or solver dependencies are live.
- `POST /api/fun/compute/prepare`, `/confirm`, `/cancel` — same-origin separately clicked operator approvals.

Deployment marker: `FUN_QWEN_ML_OPTIMIZATION=REVIEWED_5_MODES_SAME_8802`. This confirms the **dispatcher is registered in the current dashboard**, not that Optuna, OR-Tools or the upstream 8801 model has run successfully. A separate `FUN_REVIEWED_OPTIMIZATION_ENV=READY` marker confirms the two Python libraries were installed to the isolated environment. The optional older 8798 unified proxy may remain degraded independently.

No changes are made to Elektron, existing FreeCAD project, Qwen weights, REA allowlists, main homepage, other listener processes, or network configuration.

**Remaining non-autonomous domains:** FreeCAD/WireViz engineering actions, arbitrary security/PE tasks, Shopify writes, financial actions, bids, messages and the remaining REA tool catalogue. They require their own reviewed target-specific dispatch and authorization; being in the 12-domain registry alone is not executable authority.
