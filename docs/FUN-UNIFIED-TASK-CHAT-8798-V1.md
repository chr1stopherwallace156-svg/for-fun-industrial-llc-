# Fun Industrial — Unified Task Chat V1, isolated port 8798

## Status

Source changes are committed in an independent feature branch. Windows and Ubuntu qualification run in GitHub Actions. **Operator Windows activation has not occurred.** This is not a claim of production universal autonomy.

## Purpose

Provide one **operator-started, local-only** natural-language interface while **preserving** the currently-running Fun Industrial services: primary dashboard/REA 8789, 19-tool auto-local executor 8796, independently verified 229-tool REA MCP executor 8797, Qwen3 running under external llama.cpp 8088, and Python compute 8791. Never start/stop these services or Elektron's separately owned Ollama.

## Entry point and capabilities

`http://127.0.0.1:8798/` is a new responsive same-origin chat page. Its read-only input can:

- Send ordinary questions, software/game/app feasibility questions and follow-ups to Qwen3 via the existing 8088 llama.cpp OpenAI-compatible endpoint. It keeps only the last eight short user/assistant turns in browser page state; no persistent or Cognee memory writes.
- Given a **concrete public HTTPS URL**, retrieve the first 128 KiB of static HTML/plain text (no JavaScript, cookies, auth, redirects, binary downloads, or private IP/hostname), then pass at most 7,000 text characters as untrusted reference evidence to Qwen. This is not a browser-automation or general web search engine.
- For exact explicit REA status requests, check the live 229-tool catalogue on 8797 and call only `inspect_analysis_settings` or `binary_session` with `{}` (no parameters), reporting actual results. The installed `binary_session` rejected upstream `detail`/`refresh_candidates` arguments, so they must NEVER be guessed. A read-only tool may still report an error, which is surfaced as HOLD.
- For an explicit task involving the 19 existing local compute tools, show a separate operator approval panel, then delegate a one-click session to the already-running 8796 local executor. No local tools execute on an ordinary chat message.
- For an explicit task invoking REA inspection/analysis, show a separate REA approval panel, then delegate **one bounded round** to the existing real 8797 REA 229-tool runner. This existing runner may choose up to two real MCP calls per round; it can fail, reject arguments, or pick an unsuitable tool. No REA task execution occurs from an unapproved ordinary chat message.

## Boundaries and limitations

Completing chat routing is NOT equivalent to installing or using any arbitrary website/app/game. Native iOS porting, downloading apps, browser navigation/scripts, Windows shell, account login, changing protected game code, evading anti-cheat/DRM, and universal self-repair are **not** features of V1. REA tool catalogue registration is not proof of a provider being configured or the tool succeeding. General game/app answers without supplied evidence are hypotheses and must not claim active binary inspection.

The chat is loopback-only: **not accessible from the iPhone** without a separately designed authenticated remote gateway. Consent headers and same-origin validation reduce casual web-triggering, but are not a substitute for OS user permissions, authenticated account identity or sandboxing. Do not expose port 8798 (or the internal ports) publicly.

Qwen3 uses external llama.cpp `127.0.0.1:8088/v1/chat/completions`, nonthinking mode and output budget 512. The experiment does NOT start Ollama or another local model. Public website content and MCP observations are labelled untrusted data and never treated as tool-execution instructions.

## HTTP contract

- GET `/` — UI only, no execution
- GET `/api/unified/client.js` — static browser client, no execution
- GET `/api/unified/status` — status for model 8789, local 8796, REA 8797; no inference or execution
- POST `/api/unified/chat` with `{ "prompt": "...", "context": [{"role":"user|assistant","content":"..."}, ...] }` — task classification, Qwen, or bounded read-only observation only
- POST `/api/unified/local/execute` with `{ "prompt": "...", "operatorConfirmed": true }` — separate one-click local-19 authorization
- POST `/api/unified/rea/execute` with `{ "prompt": "...", "operatorConfirmed": true }` — separate one-click 229-REA runner authorization; exactly one runner round

POST endpoints require same-Origin `http://127.0.0.1:8798` plus the `x-fi-unified: operator-click` header. The server checks exact Host and loopback binding and rejects cross-origin requests, unexpected fields and oversized request bodies. This is browser-origin defense, not strong native client authentication.

## Operator installation (no existing service restart)

Use a new isolated checkout of `feature/fun-unified-task-chat-8798-v1-20261111` and invoke `Start-Fun-Unified-Chat8798.ps1`. It verifies Node syntax, runs independent tests, verifies 8789/8796/8797/8088/8791 listeners, Qwen readiness and 229/19 catalogue baselines, rejects an existing port 8798 owner, starts only new Node 8798, then verifies new UI/client/status and unchanged protected listener identities. On a failure after spawning, it terminates only its own 8798 PID when that owner is verified. It stores logs in `AppData/Local/FunIndustrial/UnifiedChat8798/`.

Do not use `Deploy-Fun-Auto-Local-Dashboard8789.ps1 -Apply` or any process-wide stop/restart command. The 8789 process holds the original REA MCP session and volatile cognitive state.

## Smoke tests after operator host reports PASS

1. Visit `http://127.0.0.1:8798/` in the **Windows computer's browser**.
2. Ask `Can Call of Duty: Warzone run natively on my iPhone?` — expect a grounded feasibility explanation and **zero tool executions**, not a claim of a native port.
3. Ask `Analyze https://example.org/ and tell me what the static page says.` — expect route `public_website` and a public URL source, without browser automation or downloading a game.
4. Ask `Inspect REA MCP analysis settings` — expect an exact read-only tool call with a real result (already validated in the earlier independent Qwen pilot, not yet in this unified UI).
5. Ask `Run a graph analysis using local compute` — expect pending approval and zero actions. Only if desired, tick the review checkbox and click the execute button. It delegates to 8796; successful graph tool usage is not guaranteed.
6. Ask `Use REA to inspect a Rust executable` — expect pending approval, no REA action before separate click. Do not approve if you haven't supplied a suitable lawful target or don't accept possible filesystem/process effects.

## Test scope

GitHub Actions uses Windows and Ubuntu, and exercises task routing, URL SSRF checks/DNS pinning, private/reserved networks, maximum response size and no redirect, real REA tool boundary mocking, local/REA click separation, browser same-origin controls, model requests, bounded context, CLI inertness, PowerShell syntax and separate server endpoint behavior. These **offline synthetic tests do not prove actual Windows startup, live public website retrieval, game/app portability or every REA tool**. The operator must run the bootstrap to confirm live end-to-end startup.