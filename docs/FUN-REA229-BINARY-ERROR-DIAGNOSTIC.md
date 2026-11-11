# REA binary_session: uncovering the real MCP error without restarting live services

The user's latest real Qwen pilot output selects `binary_session` correctly (`finish_reason=tool_calls`, 20 completion tokens, 1 structured call) and normalizes args to `{"detail":"summary","refresh_candidates":false}`. The live 8797 bridge returns `REA229_MCP_TOOL_RETURNED_ERROR` HTTP 422, but hides the provider's underlying MCP error data. This confirms a real tools/call was made and failed; the error type, provider prerequisites and remediation remain unknown.

## Independent single-shot diagnostic

Use the already-created standalone checkout `FunIndustrial-QwenREA-Pilot-V1`, pull the current branch, then run `node scripts/Diagnose-Fun-Rea-Binary-Error.mjs --inspect-error`.

The new script checks the parent 8789 and live executor 8797 health, counts all 229 real tool names, requires `binary_session` in the catalogue, and uses the installed original REA .env only to configure a new temporary MCP stdio child. It initializes that child, verifies all 229 names match the live executor's list, and calls `binary_session` exactly once with fixed `detail:summary, refresh_candidates:false` arguments. It prints the tool's original MCP error code, message, details, remediation, and a bounded raw excerpt (or successful result if this fresh session behaves differently). It **always stops its own temporary child**, then verifies the parent and live executor catalogues remain unchanged. It does **not** restart or patch 8789, 8796, 8797, Qwen/llama.cpp, compute, VPN or Elektron/Ollama.

The temporary REA MCP session is independent; an error observed in it is a diagnostic of that fresh session, not a guarantee that the original running 8797 session has identical provider state.

Expected lines: `DIAGNOSTIC_TEMPORARY_MCP=READY TOOL_COUNT=229`, `DIAGNOSTIC_CALL=binary_session ARGS=...`, `REA_BINARY_SESSION_MCP_RESULT=IS_ERROR`, `REA_MCP_ERROR_CODE=...`, `REA_MCP_ERROR_MESSAGE=...`, `REA_MCP_ERROR_DETAILS=...`, `REA_MCP_ERROR_REMEDIATION=...`, `REA_MCP_ERROR_RAW_EXCERPT=...`, `DIAGNOSTIC_TEMPORARY_MCP_STOPPED=TRUE`, `PARENT_8789=REA_READY ORIGINAL_8797=REA_READY CATALOGUE_229_UNCHANGED=TRUE`. A healthy temporary call reports SUCCESS instead and must not be treated as proving the existing 8797 call succeeded.

Qualification: 35/35 targeted tests pass on Windows and Ubuntu. New tests check real `isError` data preservation, exact one-call semantics, transport failure, live/temporary catalogue-name match, missing-tool refusal, success distinction, inert invocation without explicit `--inspect-error`, and temporary child cleanup. No actual operator Windows diagnostic result has been received yet.