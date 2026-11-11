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
