# Fun Industrial V4.3 — One-Command Startup

## What this changes
Single operator-invoked `Start-Fun-Industrial.ps1` checks/adopts already-running components, starts only missing fixed Fun Industrial services in dependency order, verifies real health, and prints one 8798 URL. It does **not** overwrite the deployed original dashboard source, reset NetBird, start or stop Elektron Ollama 11434, restore November backups, or ask for six separate approval phrases.

Execution order: existing or fixed local Qwen 8088 → existing/compute-only recovery 8791 → existing or trusted original dashboard 8789 → compatibility sidecar 8796 → independent 229-tool REA MCP broker 8797 → unified chat 8798.

## Fixes that make this possible
- The compute process is validated as a Python owner with exact `networkx`/`quimb`/`pytorch-cpu` health identity; PID is not pinned across a worker reparent/restart.
- The Python-managed model may report `stopped` even while independent llama.cpp on 8088 has `status:ok`; local-model chat adopts that healthy server for inference rather than starting another model.
- A genuine Qwen no-tool response is a normal answer; it is never upgraded to a fabricated tool call.
- The dashboard parent can be HTTP-ready with its original 19 local tools while its separate original REA session remains uninitialized. The new `--standalone` mode of the independent 8797 MCP broker initializes the actual 229 tools directly from installed `.env` and verifies live schemas; it does not execute a tool at startup.
- The 8798 gateway reports verified REA from the independent 8797 broker and distinguishes the parent 8789 catalogue count. The UI continues to require separate explicit approval for any REA/local action.
- The 8796 legacy compatibility listener remains running (no retirement or claimed CPU/RAM saving); the 8798 application uses the embedded local-tool orchestrator from Stage 2. No forced restarts of occupied ports.

## Execution, authorization and recovery
- Running the **one startup command** is explicit authorization to bring fixed known Fun Industrial processes online. It does not authorize agent actions or grant additional tools; 8797's execution POST remains gated by operator click.
- No calls to `/api/activate`, `/api/start`, `/api/ai/start`, any REA `tools/call`, or model task prompt. In particular, the existing parent `/api/activate` has an autonomy-service side effect and is not used.
- The existing 8789 deployment is allowed only if the `server.mjs` SHA256 still equals the exact operator-observed `9C8667C1299102156968A79FD8CF524AC23EFAC25B7E924D369954EC638C6844`. Any new source version must be reviewed and intentionally requalified. Source is never restored automatically.
- Already occupied ports must be loopback-only and their owner identities must match expected process types. Never kill or replace an unknown occupant.
- For fixed Qwen 8088, use `FunIndustrial/.runtime/llama.cpp/llama-server.exe` with the known Qwen3-4B Q4 GGUF, 4 CPU threads, 4096 context; do not start another model if the verified one is healthy.
- If an intermediate stage fails after previous stages start, there is **no automated rollback or retry**. The command reports `FUN_ONE_COMMAND_HOLD` and logs so an operator can inspect the partial state; subsequent qualified runs adopt existing healthy instances.
- `-CheckOnly` is available for read-only source and port-owner checks, but operators are not required to run it before normal startup.
- The code starts only when explicitly invoked; Windows-login autostart is not installed or silently changed.

## Remaining limitations
Source/baseline is pinned to the November 12 observed original dashboard. The modified original 8789 source is not under the V4 repository's automatic update control. The original 8789 REA session may remain uninitialized; *legacy V3/V3.1/V3.2/V3.4 parent-specific workflows* may still require qualification before being called ready. V4.3 provides a verified separate 8797 broker, but it does not assert every legacy parent-dependent workflow is restored.

Cross-platform CI is synthetic and does not prove the user's specific Windows PC has successfully started or executed a real tool. A live startup status and selected operator-approved workflows are needed to qualify full functionality. No claimed CPU/RAM savings from this change.

## Usage
After switching to the reviewed V4.3 GitHub branch, run `& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $HOME 'FunIndustrial-UnifiedChat-V1\Start-Fun-Industrial.ps1')` once. Repeat exactly the same command after subsequent PC restarts; it adopts existing healthy services. The separately shared one-line bootstrap can also perform a one-time `git fetch` + branch switch + startup in a single pasted PowerShell line.

See `intelligence-checks/one-command-startup-v43-case.mjs` and `.github/workflows/fun-one-command-v43-ci.yml` for negative tests, static safety checks, and Windows PowerShell parsing.