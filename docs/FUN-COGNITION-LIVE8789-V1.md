# Fun Industrial — Cognitive Kernel Live Bridge v1

## Scope
Connects the conventional Cognitive Kernel v1 to the existing deployed local Fun Industrial chat. Informational integration only: bounded cognitive context is added after existing automatic Cognee memory recall, with no new model, dashboard, memory service or tool executor.

The staged patch requires existing deployed 8789 chat/memory/voice markers, but the separate FI_SECURITY_PRIMARY_8789_V1 phase is **optional when never installed**. If that phase is present, the security route is preserved and must pass readiness checks. The patch does not add, remove, or bypass the security-primary service. These markers may not exist in the repository's sample server.mjs, since the *deployed* server was patched incrementally.

## API

- GET /api/cognition/status — cognitive metrics and service state summary.
- GET /api/cognition/capabilities — fixed local tool registry names, NOT a health or execution-authorization guarantee.
- POST /api/cognition/propose — candidate knowledge claim, always proposed.
- POST /api/cognition/check — compare claim with supplied evidence; this is NOT independently authenticated truth.
- POST /api/cognition/query — supported submitted-check-consistent claims only by default.
- POST /api/cognition/infer — bounded is_a/part_of/before inference.
- POST /api/cognition/predict — record prediction.
- POST /api/cognition/outcome — resolve prediction exactly once.
- POST /api/cognition/correction — create a proposed, not automatically verified, correction.

All POST operations affect isolated in-memory cognition only. They do not invoke REA, compute, network tools, shell, or model execution.

## Windows deployment

Stage first from repo root:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Deploy-Fun-Cognition-Live8789.ps1

When the existing AI and compute services are verified healthy, explicitly apply:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Deploy-Fun-Cognition-Live8789.ps1 -Apply

Stage-only tests and backs up the real live server but does not change/restart it. Apply verifies existing dashboard, model/compute, voice, memory, installed security if present, tool registry, and REA allowlist before changing anything. Only 8789 dashboard Node process may restart, with rollback on failure. Model process 8088, compute 8791, gateway 8443, web 4479, voice/security preview 8794, NetBird, Ollama, and REA are never stopped or restarted by this script.

DO NOT use -Apply while /api/ai/status is 503 or 127.0.0.1:8791 is unreachable. Correct the existing dependency through the separate documented recovery path first. The script must fail closed if the installed source differs from expected anchors.

## Tests

node --test intelligence-checks\cognitive-kernel-case.mjs intelligence-checks\cognitive-live-bridge-case.mjs

The initial 8 kernel tests plus 7 bridge/patch tests passed locally. This does not qualify on-machine runtime behavior. The Windows stage-only script verifies the actual deployed source against protected route anchors.

## Limits and future

- Cognitive state is IN MEMORY and resets when dashboard restarts; existing Cognee read-only recall remains unchanged.
- Candidate statements and submitted measurement labels are not independently proven, even if status says supported.
- Cognitive context uses a bounded list of locally registered tool names; it does not activate the 229 REA tools or bypass operator approval.
- Chat enrichment preserves existing model payload fields (including tools and token settings), and skips extra context if too long.
- Future: authenticated evidence, persistent snapshots, graph/River learning under CPU budgets, independent teacher/student testing.
## Compatibility repair 2026-11-10

A real installed dashboard diagnostic returned `COGNITION_PROTECTED_BASELINE_MISSING:FI_SECURITY_PRIMARY_8789_V1` with all required chat and memory anchors present. The patcher now accepts the earlier pre-security-primary baseline without weakening an installed security phase. Use `node scripts/diagnose-cognitive-live.mjs <live-server-path>` before and after staging to inspect `patchStatus` without printing source code. The live model/compute endpoint on port 8791 must still be healthy before `-Apply`.

## Readiness probe repair 2026-11-11

The first guarded Apply passed 16/16 stage tests but reported NEW_DASHBOARD_NOT_READY. The applied and rollback stdout both showed the server listening on 127.0.0.1:8789 without logged startup errors. The source rollback succeeded; neither the newly applied dashboard nor its full API health was independently confirmed.

The earlier readiness loop called GET /api/cognition/status and GET /api/ai/status with 4-second timeouts. Both requests could wait for platform.status() and the full REA/NetBird health chain. The updated bridge now provides **GET /api/cognition/health**, a synchronous local-only in-process identity check which does not call platform.status(), Cognee, REA, or any external service.

The launch gate now requires (1) the same verified 8789 Node PID, (2) the correct bounded cognition health identity, (3) reaExecutionGrants = 0, and (4) direct compute 8791 /ai/runtime/llama-cpp state = ready. The full after-restart VerifyExistingServices gate still separately checks AI status, memory, voice, fixed local registry, and REA allowlist. Fail-closed rollback remains active.

GET /api/cognition/status also caps its separate platform-health summary at 1.5 seconds, reporting timed_out_unverified rather than hanging indefinitely. **This is a targeted possible-false-negative repair, not proof that the first failure was caused by slow REA health.**

Before another Apply, confirm the prior rollback successfully restored the ordinary chat and that port 8789 is owned by the expected Node process. Always run the stage-only script first. Do not bypass owner/authority/compute checks, and do not stop Ollama or external llama.cpp.

## November 11: REA stopped, cognition still deployable

On the user's host, `GET /api/status` reported `LOCAL_FIRST=true`, `VPN_REQUIRED=false`, compute running, AI ready, and REA stopped. `GET /api/rea/tools` returned HTTP 403 with `REA MCP is not ready.` This is not proof of a malfunction requiring REA activation. The cognitive kernel is local and does not execute REA tools.

The updated guarded deployment permits **only** this precise REA baseline: one `rea` service with state `stopped`, HTTP 403 from `/api/rea/tools`, zero exposed `rea__*` tool definitions, and `rea_tool_count=0`. If REA was running, if the catalogue becomes accessible, if service identity is ambiguous, or if any unexpected error occurs, the deployer HOLDS. It never sends REA initialize, `/api/activate`, or an REA tool call. The new dashboard launches with a forced empty runtime REA allowlist, preventing new REA execution authority. This changes no persisted `.env` permissions; runtime REA access remains disabled.

The full preflight and postflight continue to require ready llama.cpp via compute 8791, default-on Cognee, mobile voice, unchanged fixed local tool registry, unchanged protected listener identities, and cognitive status with `reaExecutionGrants=0`. A successful deployment does not initialize the 229 REA MCP tools; that is a separate, explicitly reviewed operator-approval capability project.

Use only the current `feature/fun-cognition-live8789-v1-20261110` branch, NOT the draft external-llama adoption repair: the live Windows runtime already has external-model adoption and the Qwen llama.cpp model was re-adopted successfully without any source change. If the AI model returns stopped again, invoke the existing adoption API under operator review rather than replacing code.

Before deploying, stage-only pull and run; check output; apply only against a healthy 8789+8791+8088 system. Do not claim live status until the deployment's PASS is independently verified.
