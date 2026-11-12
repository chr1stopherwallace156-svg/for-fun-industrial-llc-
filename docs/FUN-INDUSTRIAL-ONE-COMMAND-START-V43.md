# Fun Industrial V4.3 — One-command and one-click local startup

## Goal
The operator runs **one** command for installation/first startup, and can subsequently launch **Start-Fun-Industrial.cmd** directly from the repository with a double-click. This is an explicit startup authorization for known Fun Industrial service processes, NOT approval of model-generated REA or local tool execution.

Existing healthy components are **adopted**, not restarted. Only missing services are launched, in sequence: Qwen llama.cpp 8088 → Python compute 8791 → primary dashboard 8789 → local tool sidecar 8796 → REA MCP independent sidecar 8797 → Unified Chat 8798. It never touches the Elektron-owned Ollama 11434.

## Important compatibility fixes
- The parent 8789 dashboard may report its **managed** AI state as `stopped` even if independent Qwen 8088 health is `ok`. V4.3 reads the **direct Qwen health** and does not start a second llama.cpp instance just to satisfy the parent's old state field.
- The parent 8789 dashboard may have **0 REA registrations** because its old MCP session has not initialized. V4.3 can initialize the separate 8797 REA child, **verify its 229 real tool definitions**, and preserve the parent's zero REA permission grants. This avoids invoking `POST /api/activate`, which also starts an unrelated autonomy process. A parent reporting an *inconsistent* partial 229 registration is a HOLD, not automatically treated as absent.
- 8796 local tool interface still exposes the fixed 19 original functions, but local chat now talks directly to the already-healthy 8088 model. This prevents the old parent compute-AI manager from launching another model.
- 8798 status verifies independently healthy Qwen and REA from their separate actual ports; it no longer requires misleading parent process ownership.
- 8798 Stage 2 embeds existing approved local execution orchestration; underlying local tool calls still go through original 8789 `/api/ai/tool-call`. REA tools remain behind separate explicit operator approval.

## Use
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Fun-Industrial-OneCommand.ps1 -Start
```
Or double-click `Start-Fun-Industrial.cmd` after first checkout. No per-service approval prompts. The script also has a read-only default when `-Start` is absent.

The command is **idempotent for healthy services** and refuses to kill or restart occupied ports, overwrite any source/configuration files, install packages, register Windows background tasks, or modify NetBird settings. It verifies the original saved dashboard policy and legacy source markers before adopting/starting 8789. A genuine provider failure produces `FUN_ONE_COMMAND_HOLD` and logs; no automatic process restarts or side-effect retries.

## Limits
- This is one-button startup, not yet a verified boot-time Windows scheduled task. A shortcut in the repo is provided; no login hooks are installed.
- The legacy ports 8789, 8796, and 8797 still exist. V4.3 does not claim any measured RAM/CPU reduction or process retirement.
- The startup controller is independently tested on Windows and Ubuntu with mock service data and PowerShell syntax checks; actual PC live activation is separately operator-controlled and not yet observed.
- Existing calls to `/api/ai/tool-call` may change compute state after explicit local-tool approval. Launching services never grants those approvals.
- When a running process owns a port but fails health, the controller HOLDs and leaves it running rather than blindly killing it.
- Qwen startup uses the existing model and CPU-first settings; the platform's own Python-managed llama.cpp status may still be `stopped` because it did not launch that process.
- Launcher logs under `%LOCALAPPDATA%\FunIndustrial\OneCommandStartup\`.

## Later
After confirming live deployment and version-specific service status, implement a persistent signed startup shortcut or opt-in Task Scheduler sign-in task, resilient independently from NetBird's VPN login. Then measure idle/peak memory and CPU for elastic scheduling with low idle usage. Do not run or restart Elektron's separate Ollama process.
