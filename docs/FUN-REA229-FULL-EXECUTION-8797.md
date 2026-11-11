# Fun Industrial — real 229 REA MCP tool execution (port 8797)

## What is genuinely enabled

The parent Windows host confirmed `REA_STATE=ready`, `REA_TOOLS_HTTP=200`, 229 REA tool definitions, 19 fixed Fun Industrial local tools, and Qwen llama.cpp ready. The independent automatic LOCAL tool dashboard is also running on port 8796. These facts **do not** by themselves enable REA execution: the older 8789 `/api/rea/call` and `/api/ai/tool-call` deliberately deny REA calls.

This branch adds a separate Node service at `http://127.0.0.1:8797/`, backed by a **second actual MCP stdio client connection** using the installed `rea-agents` entrypoint specified by the existing `.env` file. It uses `src/adapters/rea.mjs` to perform real initialize, tools/list, and tools/call operations. It never patches or restarts 8789 or 8796.

The startup reads the current parent `/api/rea/catalog`, requires exactly 229 tools and 19 local tools, and compares the **exact set of 229 tool names** against the newly initialized independent MCP session. A mismatch holds with no execution grant.

Once verified, **all 229 real MCP tools are addressable**, not just the first 14 or first 32. There are two modes:

- Natural language: one explicitly operator-started Qwen task. The deterministic index ranks all 229 and offers up to four relevant tool schemas per model round, conserving context/CPU for Qwen3-4B. If Qwen selects one of the offered functions, the runner maps its stable alias back to the actual verified MCP name and calls the independent adapter's real `tools/call`. Up to two tool calls per round and up to three rounds, with no per-tool confirmation prompt in this operator-started session.
- Exact tool: browse/search the verified 229 live names, select an exact tool name, enter JSON arguments and execute that real MCP tool through `POST /api/rea229/call`. This permits every tool in the catalogue to be reached even if a model relevance ranking doesn't select it.

**Important:** successful catalogue discovery and routing are not promises that every REA function will complete successfully. Individual functions may depend on files, credentials, installation state or other services and may reject invalid arguments.

## Isolation and authorization

- Existing 8789 dashboard and its running original REA child: not restarted or modified
- Existing 8796 local-tools dashboard: untouched
- Existing llama.cpp 8088, compute 8791, NetBird, Elektron Ollama: untouched
- New service: independent 8797 Node process, its own REA MCP child; read-only access to the existing `.env` for the installed REA command and arguments
- Web requests: exact loopback host and same-origin browser Origin checks, plus an explicit `x-fi-rea229: operator-click` header for execution
- No additional permission prompt between tool calls inside a user-started task; no scheduled daemon loop, no unknown model-generated tool names, no automatic retry on error

**Real effects warning:** these are real tools and may write files, inspect software, access external systems or make other changes according to their own capabilities. There is no OS sandbox between the 8797 REA MCP child and the Windows account running it. The chosen tools may have significant consequences. Run only under an account with permissions appropriate to the intended tasks, with backups. The web origin checks are not an OS security boundary.

## Windows setup

Use a NEW checkout of `feature/fun-rea-229-execution-8797-v1-20261111`; do not switch branches in the source folders used by the running 8789/8796 processes. Run `Start-Fun-Rea229-Sidecar8797.ps1` from that checkout. It syntax-checks the new code and runs the isolated tests, verifies 8789/8796/8088/8791 listener owners, verifies the parent REA is ready with 229 tools, and starts ONLY one new Node on 127.0.0.1:8797. The new process executes the independent MCP initialization and compares all 229 names. The launcher then validates the UI and MCP status and checks parent listeners and REA tool count/names have not changed.

Expected successful output starts with `FUN_REA229_EXECUTION=PASS URL=http://127.0.0.1:8797` and includes `REAL_REA_MCP_TOOLS=229 ADDRESSABLE=229 EXECUTION_ENABLED=TRUE INDEPENDENT_MCP=TRUE`. If it HOLDS, do not restart 8789 or 8796 or alter `REA_ALLOWED_TOOLS`; inspect the `FUN_REA229_HOLD` and new sidecar logs instead.

Open `http://127.0.0.1:8797/` on the Windows host; the browser provides natural-language Qwen tool selection, catalogue search and exact-name execution.

## Qualification

Offline Windows and Linux CI tests verify complete 229-name identity, 229 exact tool-addressable calls via mocked adapter, deterministic schema ranking, unknown name refusal, no retries, browser same-origin and explicit click, and a real synthetic 229-tool MCP stdio fixture that performs actual initialize/tools/list/tools/call exchanges. The synthetic MCP fixture is not the user's installed REA package. **Only the Windows startup result can confirm that the real 229-tool MCP session is live.**
