# Fun Industrial V4 Stage 2 — Embedded Local 19-Tool Runner

## Objective and non-goals
Move approved local tool orchestration from a POST to the separate 8796 Node sidecar into the existing main 8798 Node process. Reuse the existing `createAutoLocalDashboard()` and `runAutoLocalExperiment()` implementations rather than rewrite tool selection or give the model new authority.

This phase does NOT retire 8796 or 8789. It still uses the original 8789 registered 19 tools and its /api/ai/tool-call execution endpoint, plus Qwen 8088 for inference where required. It does NOT embed or execute the REA 229-tool broker, modify model execution, consolidate Python compute, or prove any RAM savings.

## Paths and authority
- User-facing chat and independent approval: 127.0.0.1:8798.
- Status and legacy activity check: GET http://127.0.0.1:8796/api/ai/auto-local/status only. The embedded path never POSTs to the 8796 sidecar.
- Existing 19 local-tool catalog and actual local tool execution: original 8789 platform. Only existing `fi_` local functions in the verified 19-tool index are eligible.
- REA 8797 remains a separate tool broker. Embedded local path has `reaExecutionGrants:0` and no REA call route.
- One existing user approval enables at most one bounded local tool session of two model rounds. As in the original local executor, a single approved session may execute multiple selected `fi_` calls; it is NOT one approval per individual function.
- No background work or automatic retries. On unknown or failed execution outcomes, operator review is necessary.

## Phase 2 safety gates
Preparation (normal chat) makes no local tool requests. The 8798 POST /api/unified/local/execute still requires same-origin operator click and `operatorConfirmed:true`, and verifies that the prompt matches a local-tool task. The embedded module checks 8796 is idle and not granted REA authority, verifies 19 local and 229 REA registrations, verifies its original bridge identity, then calls its existing bounded implementation once. If 8796 is active or catalogue changes, it HOLDs before requesting tool execution.

One active embedded session blocks a second; no automatic retries or fallback to 8796 execution if the new path fails. The old 8796 listener continues to exist for compatibility. Because the separate legacy listener could accept another explicit user task immediately after a status read, Stage 2 does not claim an exclusive cross-process lock. Full 8796 retirement requires a subsequent guarded migration with confirmed lock semantics, independent operator authorization, rollback, and dedicated CPU/RAM measurement.

## Deployment constraints
Development branch: `feature/fun-unified-runtime-v4-stage2-local-20261112`.
Tests run offline with synthetic local catalog and faked local tool results on Windows and Ubuntu; no real local action occurs during tests.
Source checkout by itself does not affect live services. Operator must separately authorize the existing guarded 8798-only refresh after the new branch and pinned commit are reviewed. The refresh validates all prior V3/V4 cases, source, live schemas, protected listener identities and the new embedded local state. The old 8798 instance may be lost if the new startup fails; do not retry blindly.

## Independent live qualification (after separately approved deployment)
1. GET /api/unified/status and verify `localExecutionPath:embedded_in_8798`, embeddedLocalV42.enabled=true, reaExecutionGrants=0.
2. GET /api/unified/v4/status and verify all required services ready.
3. Normal chat requesting a local graph analysis should return awaiting_operator_click with no tool execution.
4. Separate operator click to execute a bounded local task; confirm its exact `fi_` identity, result and source, and verify original 8796 executed no action. An ambiguous result must not be replayed.
5. Leave 8796 running until concurrency/rollback and no-feature-regression qualification of its retirement.

## Roadmap
Stage 3: consolidate REA broker routing with the same 8798 Node application, retaining separate MCP child and explicit per-operation approvals. Stage 4: carefully retire unused 8796/8797 HTTP listeners only after independent tests. Stage 5: adaptive CPU/RAM scheduling, low idle overhead, batched/incremental refresh, and elastic bursts when justified.