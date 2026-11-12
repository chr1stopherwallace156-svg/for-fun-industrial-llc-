# Fun Industrial V4 Stage 1 — one entrypoint, existing protected workers

## Why this phase exists
Original dashboard (8789), local tools (8796), REA MCP (8797), Unified Chat (8798), Qwen (8088), and Python compute (8791) were separately started. Operators should not need to manage six addresses.

Stage 1 supplies **one user-facing HTTP entrypoint at 127.0.0.1:8798**, a live read-only service overview and a single check-only or explicitly-approved start-missing launcher. It is **not** a single OS process, retires zero legacy listeners, and makes no RAM/CPU savings claim.

## Boundaries
- No new ports, installers, model downloads, daemons, timers, automatic retries, or REA MCP tool calls.
- Existing Qwen 8088, compute 8791, original 8789 and Elektron Ollama 11434 are never started/stopped/modified by V4 stage 1.
- Gateway permits six fixed local GET endpoints only with timeout/size bounds and reports degraded rather than inventing availability.
- V4 overview cannot authorize tools. Existing V3 approvals and REA broker authority remain in force.
- All existing REA and local sidecars still run. Process and listener retirement requires separate qualification.
- Explicit status GET/refresh only, no background polling.
- Start-missing defaults to read-only; explicit -StartMissing and exact approval phrase AUTHORIZE V4 START MISSING SIDECARS are required before invoking existing start-only scripts. Never kills/restarts an occupied port. Failure stops sequence.
- Existing guarded 8798 repair verifies owner, live schema, read-only V4 preflight, tests and protected listener identity before stopping only 8798. If new startup fails, 8798 may remain unavailable. Operator must approve separately.

## Operator sequence
1. Fetch feature/fun-unified-runtime-v4-stage1-20261112 and qualify on Windows.
2. Run node scripts/Diagnose-Fun-Unified-V4.mjs --check-only and powershell -NoProfile -File Start-Fun-Unified-V4.ps1 before any restart.
3. If V3.4 occupies 8798, separately authorize the guarded 8798 refresh; the start-only launcher will not replace it.
4. Go to http://127.0.0.1:8798/ and use Check service health once, or GET /api/unified/v4/status.
5. For future operator-approved start-only recovery, use Start-Fun-Unified-V4.ps1 -StartMissing -ApprovalPhrase 'AUTHORIZE V4 START MISSING SIDECARS'.

## Next milestones (not implemented)
- V4 Stage 2: embed 19 local-tool routing and operator approval as an internal module, retain 8796 while comparing behavior.
- V4 Stage 3: embed REA MCP routing into the same Node parent while retaining isolated MCP child and explicit approval, retain 8797 during qualification.
- V4 Stage 4: replace old 8789 surface only after confirming dependent capabilities, preserve isolated Qwen and compute workers.
- V4 Stage 5: CPU/RAM resource-aware worker scheduling, measurable budgets, operator-controlled lifecycle; no arbitrary autonomy.

**Stage 1 consolidates the user interface and health observation, not all compute or security process boundaries.**