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
