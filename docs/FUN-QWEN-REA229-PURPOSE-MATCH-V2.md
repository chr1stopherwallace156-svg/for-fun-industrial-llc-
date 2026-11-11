# Qwen REA pilot V2: purpose-based tool matching

Observed live output on Windows: the model returned finish_reason=tool_calls, completion_tokens=65, structured_calls=1 and selected read_adb_setting. The REA MCP endpoint returned HTTP 422 with REA229_MCP_TOOL_RETURNED_ERROR, so the model-to-executor dispatch worked, but the selected Android operation did not complete. No successful REA inspection result was returned.

Root cause in pilot code: a loose read-only name heuristic treated unrelated read_adb_setting, inspect_analysis_settings, read_bytes and list_jeb_units as interchangeable file-inspection tools. This is incorrect. read_adb_setting is Android-specific; read_bytes inspects initialized Ghidra analysis memory; neither reads arbitrary JavaScript source from a Windows path.

V2 removes fuzzy read/list matching. For the next proof it only offers the exact catalogued inspect_analysis_settings tool when the operator requests inspection of REA MCP analysis settings. It refuses arbitrary JavaScript source file inspection with NO_VERIFIED_COMPATIBLE_READ_ONLY_REA_TOOL_FOR_TASK, before making a model inference or executing anything. A separate installed-guidance scenario supports exact search_guidance only when explicitly requested. Every selected candidate must match the live 229 entry and schema and unique stable alias.

Run in the existing FunIndustrial-QwenREA-Pilot-V1 checkout, not in the installed 8797 source. Pull --ff-only and call Diagnose-Fun-Qwen-Rea229.mjs --run --prompt "Inspect the current REA MCP analysis settings using a real read-only session tool. Report the returned settings without modifying them." The live pilot reuses 8797 and 8088 without restarting either.

The next proof requires READ_ONLY_CANDIDATES=inspect_analysis_settings, MODEL_METADATA showing one structured call, QWEN_SELECTED_REAL_REA_TOOL=inspect_analysis_settings, QWEN_REA_PILOT_STATE=real_mcp_tool_executed, and REAL_REA_RESULT with isError not true. This has not yet been observed on the Windows host.

Targeted qualification: 25 tests (15 existing REA runner + 10 purpose-matching pilot) PASS on Windows and Ubuntu in the updated GitHub Actions run. Tool names and annotation heuristics are not a sandbox; the narrow test limits potential operations by exact verified name.
## Live catalogue correction: guidance tool absent

The operator searched the complete live 229-tool catalogue after a pilot attempt to use `search_guidance` failed at `REQUIRED_READ_ONLY_TOOL_NOT_INSTALLED`. That search returned reverse-engineering operations including Hopper documents, Ghidra memory inspection and Android-specific operations, but no installed `search_guidance`. Do not substitute generic search operations or call a non-installed tool.

REA's source defines the `binary_session` MCP operation as a read-only session status and provider availability report. It accepts optional `detail` (summary or complete) and `refresh_candidates` fields. The new diagnostic route matches explicit REA MCP binary session/provider status queries, selects **only the exact `binary_session` name if it exists in the live catalogue**, and rejects prompts for unrelated tasks.

For the bounded first test, any model-proposed `detail: complete` or `refresh_candidates: true` is refused before the actual MCP execution. The default `{}` and optional `detail: summary`, `refresh_candidates: false` are admitted. This avoids pulling expensive full provider details or running fresh candidate probes in this initial check.

Invoke the pilot from the existing separate checkout, using an explicit read-only session-status prompt. `READ_ONLY_CANDIDATES=binary_session` and `QWEN_SELECTED_REAL_REA_TOOL=binary_session` should precede a successful MCP result. If the tool is not installed, the pilot stops with `REQUIRED_READ_ONLY_TOOL_NOT_INSTALLED` without model inference or a tool call.

Qualification: 28/28 PASS on Windows and Linux for the full REA plus Qwen pilot suite. The actual Windows binary session test has NOT yet run; only the prior `inspect_analysis_settings` live operation has completed successfully.

## Next live observation: binary_session model selected but the argument guard held

The Windows user tested the read-only binary_session diagnostic. The model emitted one structured tool call with `completion_tokens=100` and `finish_reason=tool_calls`, but the client returned `QWEN_REA_PILOT_SESSION_SUMMARY_ONLY` before REA execution. This proves Qwen selected the intended tool but requested parameters outside the diagnostic's admitted summary-only contract. No MCP call occurred in that run.

Latest client change: advertise the model with an **empty function parameters schema** for the `binary_session` smoke test. Client verifies the exact tool/alias, validates JSON object shape and known keys, then executes only the fixed `{"detail":"summary","refresh_candidates":false}` arguments regardless of model-proposed optional values. Explicit log messages show when proposals are normalized and the actual `MCP_EXECUTION_ARGS`. Unknown additional fields are rejected without execution. This bounds server operations, avoids provider refresh and avoids full status reports. It leaves all 8789/8796/8797 server processes, model and separate Elekton Ollama untouched.

GitHub Actions targeted tests now 29/29 PASS on Windows and Ubuntu. Tests show a no-argument model-generated function call translates to fixed summary parameters, an overly broad `complete` / `refresh_candidates:true` proposal is executed only after documented normalization to safe defaults, unknown fields reject before the MCP call, and the exact tool name remains enforced. The repaired live Windows test remains to be run; no success should be claimed until the operator supplies actual MCP results.
