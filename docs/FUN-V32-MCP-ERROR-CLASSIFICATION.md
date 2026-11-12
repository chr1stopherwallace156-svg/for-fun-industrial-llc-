# Fun Industrial V3.2 — observed MCP rejection classification (2026-11-11)

## Operator observation
First live call to `inspect_binary_layout` of an operator-staged Windows PE file was approved once. The exact path/schema/size/SHA-256 preflight passed. The REA 8797 HTTP service responded 422, which the 8798 fixed outbound client surfaced as:

```
UNIFIED_CHAT_UPSTREAM_422_REA229_MCP_TOOL_RETURNED_ERROR
```

After the attempt, REA MCP was `ready`, `busy=false`, V3.2 had no pending approval, and the returned result lacked a receipt. An REA cumulative call counter was 6; it does not isolate this particular call. These observations do **not** prove that the binary analysis succeeded, that the input was unmodified, that all provider operations were effect-free, or what the underlying error was.

## Root cause of lost error details in this stack
`src/experimental/rea-full-229.mjs` increments `callsExecuted` and throws the fixed `MCP_TOOL_RETURNED_ERROR` if an exact MCP call returns `result.isError===true`. `scripts/Run-Fun-Rea229-Sidecar8797.mjs` turns that exception into HTTP 422 without including the original MCP result body. Then `fixedJson` in `src/experimental/unified-task-chat.mjs` throws `UNIFIED_CHAT_UPSTREAM_422_REA229_MCP_TOOL_RETURNED_ERROR`; V3.2 previously classified every thrown error as `outcome_unknown_do_not_retry`. The provider's detailed error text cannot be recovered from that 8798 response.

## Bounded 8798-only repair
Only for the **exact fixed upstream code** above, V3.2 returns `provider_mcp_error_reported` with a negative receipt. It rehashes the staged file on this error path and records file drift, original arguments/schema commitments and a receipt SHA-256. It leaves `resultHash=null` and `providerDetailedCause='not_returned_by_8797'`. Do not label the analysis successful.

All other thrown errors (including different upstream 422s, 503s, connection drops and timeouts) remain `outcome_unknown_do_not_retry`. Tokens are still consumed before submission and not replayable, no additional REA tool calls occur, and no provider services are restarted. The same-source request in future is not authorized merely because this diagnostic was run.

## Needed later
A separate, operator-reviewed REA 8797 update could preserve bounded, sanitized MCP `isError` evidence in the exact-call HTTP response without transforming it into an exception. Such a change would require its own security review, test coverage and guarded, explicitly approved 8797-only restart; **it is not part of this repair**. Until then, the canonical provider's detailed failure reason is unobserved.

## Qualification
All V1/V2/V3/V3.1/V3.2 offline tests plus the three new negative-result tests and Windows PowerShell parsing must pass. Before any live 8798 refresh, run the existing guarded `Repair-Fun-Unified-Web8798.ps1 -Apply` on this repair branch; it checks real schema/website/REA state and tests before stopping the old 8798. Do not re-submit the rejected inspection.
