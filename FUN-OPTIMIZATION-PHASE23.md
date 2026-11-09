# Fun Industrial Optimization — Phase 2 + Phase 3

This capability extends the working Optuna 4.6.0 + OR-Tools 9.14.6206
isolated Python 3.12 runtime that passed local Windows tests on Nov 9, 2026.

## Phase 2 — Optimization workspace

The existing customized Fun Industrial dashboard on 127.0.0.1:8789
receives one additional section below existing content, without replacing
the older panels, model chat, iPhone voice recorder, or Cognee memory.

- Select Optuna inventory, OR-Tools integer allocation, or OR-Tools routing.
- Review/edit bounded JSON in the browser.
- Tap Review and approve solver run, then confirm the one-shot operation.
- The server checks an operator-reviewed request header, runs one dedicated
  Python subprocess with stdin JSON, and returns a typed JSON result.
- Inputs are bounded and parser-validated; no scripts or arbitrary functions.
- A maximum execution period, output limit, concurrency lock, and cooldown
  bound the local one-shot computations.
- Solver returns suggestions; never purchases, orders, deploys, writes
  memory, calls REA, or dispatches jobs.

The server creates no new listening socket and reuses the existing
authenticated HTTPS / NetBird gateway for remote access. The optimizer
Python environment is not installed in the active compute service.

## Phase 3 — Local llama.cpp planning and explanation

The new panel also offers:
- Ask local AI to draft JSON from an operator description.
- Review AI draft in editor (separate, explicit review).
- Explain last solver result.

AI calls the *existing* local /api/ai/chat endpoint using tools:[]; no
optimizer, REA, shell, or other function-call authority is granted.
Its draft is untrusted and is never silently applied to the editor or
submitted to the solver. Operator must approve separately.

For missing numbers, the AI is instructed to request measurements instead
of inventing costs, labor hours, budgets or route distances. The strict
JSON parser and solver validators provide the enforceable safeguards.

This module does not change the normal Fun Industrial chat, automatic
read-only contextual memory, or the 229-tool REA catalogue.

## Activation

Preconditions:
- Offline solver runtime setup previously ended with FUN_OPTIMIZATION_SETUP=PASS.
- The current operator's runtime checkout is at
  %USERPROFILE%\FunIndustrial-Optimization-20261109.
- The live dashboard remains in
  %USERPROFILE%\FunIndustrial-REA-MCP-Activation.
- Dashboard /api/ai/automatic-memory/status reports
  automatic_contextual_read_only, AI is ready, the 229-tool REA catalogue
  is working, voice panel is installed, and compute 8791 + llama.cpp 8088
  remain running.

From the updated operator optimization source checkout, run:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Activate-Fun-Optimization-Phase23.ps1

The script runs local Node and Python tests, verifies listener process
identity, performs additive stage-only transformation, takes a backup and
restarts ONLY the dashboard Node process on 8789. After restart, it
initializes the read-only REA catalog without REA tools/call, checks 229
tool names, Cognee read-only status, voice upload, llama.cpp and the
existing protected port listeners on 8088, 8791, 8443.

Then it checks Phase 2 HTTP:
- GET /api/optimization/status returns ready.
- GET /api/optimization/client.js serves the additive client script.
- POST /api/optimization/run without approval is rejected with HTTP 403.
- POST with approval to a small synthetic allocation problem returns
  a mathematically feasible recommendation, with zero tool executions.

It intentionally does **not** make an automatic local AI chat request:
Phase 3 advisory UI is wired and the underlying AI is checked ready, but
actual language generation is operator-tested manually.

Expected success markers:

    FUN_OPTIMIZATION_PHASE2=PASS DASHBOARD=8789 SOLVER_HTTP=PASS
    FUN_OPTIMIZATION_PHASE3=ADVISORY_UI_READY LOCAL_LLAMA_CPP=READY AI_GENERATION_TEST=NOT_PERFORMED
    FUN_OPTIMIZATION_REA_PRESERVED=229
    FUN_OPTIMIZATION_UNAPPROVED_RUN_DENIAL=PASS OPERATOR_APPROVED_TEST=PASS

If startup or a mandatory check fails after live files change, rollback
attempts to restore the dashboard source/HTML and its prior process. The
backup path is printed, and restoration should be independently confirmed.
If preflight fails, no live file changes should occur.

Do not run any generic platform /api/shutdown or /api/activate action to
deploy optimization; that would involve unrelated services.
