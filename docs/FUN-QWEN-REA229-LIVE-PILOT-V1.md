# Qwen3 ↔ REA 229 MCP: independent one-shot live pilot

## Observed failure

Windows operator ran POST http://127.0.0.1:8797/api/rea229/run to inspect a local `.mjs` source file. The real response was `state=model_no_tool_call`, `rounds=1`, `realReaToolCount=229`, `actions=[]`, `reply=""`. Thus **no real MCP tool executed**. A ready 229-tool catalogue does not by itself establish that the model can select and invoke a tool.

The current 8797 runner uses Qwen3 thinking defaults, tool_choice:auto, and max_tokens:448 without exposing finish_reason or token usage; these prevent identifying why a response was empty.

## Non-restarting diagnostic

Files: `src/experimental/rea-qwen-direct-pilot.mjs`, `scripts/Diagnose-Fun-Qwen-Rea229.mjs` and `intelligence-checks/qwen-rea-direct-pilot-case.mjs`.

The operator creates a **separate checkout** for this pilot, leaving 8789, 8796, 8797 and the live REA MCP child untouched. Explicit `--run --prompt` is required. The pilot GETs status and all 229 live tools from 8797, picks up to four inspection-like candidate names and their actual input schemas, then makes a Qwen3 request to the existing llama.cpp service with chat_template_kwargs.enable_thinking=false and /no_think and max_tokens=1024.

The response captures finish_reason, completion token usage, content chars, reasoning chars, and number of structured calls. If a single valid advertised read-only-looking tool is selected, the pilot calls the already-running real 8797 POST /api/rea229/call endpoint with exactly that verified tool name and model-proposed JSON arguments. If the real MCP result isError or the name is unknown, it HOLDs; no retries or fabricated success. On success it asks Qwen to summarize returned untrusted data.

The read-only candidate filter is **heuristic**; names and descriptions alone cannot guarantee lack of side effects. Run under an appropriate Windows account, use disposable input where possible, and inspect `READ_ONLY_CANDIDATES` in the output. This is a diagnostic of model-to-real-tool selection, not a claim that all 229 tools work successfully.

Expected logs: `READ_ONLY_CANDIDATES=...`, `MODEL_METADATA=...`, then either `QWEN_REA_PILOT_STATE=model_no_structured_call` (zero execution) or `QWEN_SELECTED_REAL_REA_TOOL=...`, `QWEN_REA_PILOT_STATE=real_mcp_tool_executed`, `REAL_REA_RESULT=...` (actual MCP execution).

Offline targeted tests: 22/22 PASS on Windows and Linux as of the pilot CI commit. The user's real Qwen pilot remains unverified until they run it.