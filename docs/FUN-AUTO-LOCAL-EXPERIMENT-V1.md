# Fun Industrial — One-Run Automatic Local Tool Experiment

Purpose: let the existing local Qwen llama.cpp model execute registered local Fun Industrial API tools in an operator-started run **without a confirmation prompt for each tool call**. This is not consciousness or independent judgment; the model predicts tool calls and code executes them.

## Not installed in the dashboard

The pilot is an independent Node CLI, not an always-on service. It uses loopback 127.0.0.1:8789 routes that already exist in the verified live platform and makes **no source modifications, restarts, or config updates**.

Existing endpoints it reads: GET /api/ai/status, GET /api/cognition/health, GET /api/cognition/catalogue/status, and GET /api/ai/tools. It then POSTs /api/ai/chat and if the model returns structured function calls it POSTs /api/ai/tool-call without asking the operator to approve each call.

## Authorization

`--run` explicitly starts a finite experiment. No `--run` means the script is inert. The prompt passed on the command line defines the intended task. The model may execute any of the existing fixed local tools that are selected for the round. Some of these 19 tools can mutate in-memory knowledge, train models, or change graph/universe state. They are not all read-only. One run defaults to up to 3 rounds, 8 model-proposed tool calls per round, and no automatic retries. The process exits after the run; it is NOT an always-on daemon or scheduled task.

Tool schemas are deterministically chosen from the actual local catalogue, up to 6 per model round to limit token/context usage for Qwen3-4B. All 19 registered local capabilities remain discoverable, but the model may only call a tool actually advertised to it on that round. The CLI never grants admin privileges.

## Excluded from this pilot

REA MCP remains stopped and the existing /api/rea/call endpoint refuses executions, so the 229 historically discovered REA capabilities are NOT activated by this pilot. No generic OS shell, arbitrary file-system access, external network connectors, Elektron Ollama, or unrestricted remote execution is granted. No attempt to bypass model or server security controls.

## Example

After cloning the feature branch in a separate folder, run:

    node scripts/Run-Fun-Auto-Local-Experiment.mjs --run --rounds 2 --prompt "Analyze a graph with nodes depot, truck1, truck2 and edges depot-truck1, depot-truck2"

The CLI prints each selected tool name and its result, then session summary and AI response. A no-tool response prints `model_declined_or_no_calls`; it is not automatically retried.

## Validation

CI runs offline mocked model and local HTTP tests on Windows and Linux. This does not prove the user's live 4B model will choose a tool correctly. Start with a non-destructive graph-analysis task before any tasks with state-changing tools.

## Why not full unrestricted mode?

Giving a model tool access lets it act whether or not it is conscious. No per-action confirmation is possible in this pilot, but it still uses the current registered local tools and a finite explicitly triggered run. The 229 REA tools would require separate initialization, availability checks, and server adapter integration.