# Fun Industrial V3.3 — REA MCP error evidence, exact path only

## Observed failure
On November 11, 2026 the operator approved one exact V3.2 `inspect_binary_layout` call of the staged 65,536-byte Windows PE `fun_v31_windows_probe.exe`. Its file and schema checks passed, but the REA sidecar returned `UNIFIED_CHAT_UPSTREAM_422_REA229_MCP_TOOL_RETURNED_ERROR`. The 8797 exact runner had received `result.isError===true` and threw a fixed error, discarding the provider's actual error body. The prior error details are **not recoverable** from the returned result. No repeat inspection is authorized.

## Proposed V3.3 behavior (source only; live services not changed)
- `src/experimental/rea-error-evidence-v33.mjs` locally classifies known provider error phrases into a closed categorical vocabulary (`access_denied`, `provider_unavailable`, `input_validation`, `file_unavailable`, `format_not_supported`, `analysis_timeout`, `unclassified_mcp_error`), without exposing raw provider text. Classification is **heuristic**, not a proven root cause.
- Return a SHA-256 digest commitment over the complete MCP error JSON up to 131072 UTF-16 code units, or a clearly labeled bounded prefix when larger. Never claim a prefix digest represents the complete provider output.
- For `callExact` only, return `{tool,state:'provider_mcp_error_reported',result:{isError:true,...},mcpErrorEvidence,...}` instead of HTTP 422 for an actual MCP `isError`. The text and sensitive paths remain withheld. REA `run` (model-selected actions) still throws on error and fails closed.
- V3.2 requires exact tool identity, an `isError` envelope, a known safe category, correct evidence format and hash, and a rechecked file identity before issuing a negative `provider_mcp_error_reported` receipt. It is **not** a verified positive analysis. Its source file may still have changed; the negative receipt records that.
- Unknown transport failures and malformed envelopes remain **HOLD / do not retry**. V3.2's token is consumed before submission. It never executes a second REA call in response to an error.
- Updated 8797/8798 UIs mark the provider failure and show only classified evidence, not raw MCP error text or hidden strings.

## Important limitations
This does not identify the original provider failure or guarantee that any REA analysis provider creates no side effects, local session files, or temporary artifacts. It does not prove `inspect_binary_layout` works on this machine. Raw provider error content is not saved to disk by this patch. Even a future categorical `format_not_supported` is a hint, not independent proof of a corrupted executable.

The currently running 8797 instance remains unchanged unless the operator separately approves a guarded 8797-only update. The repository's existing `Start-Fun-Rea229-Sidecar8797.ps1` intentionally *refuses* an occupied 8797 port: it is **not** a restart/repair script. Do not stop or kill 8797 to deploy this branch before independent process ownership verification, preserving the original 8789 REA and local Qwen/compute. Updating 8798 also needs the existing separately approved guarded 8798 repair. No code here authorizes either restart.

## Validation before any deployment
- CI on Windows and Linux runs synthetic REA tool fixtures only; no local user's PE file is opened, and no live REA call occurs.
- Assert one and only one exact MCP call, redaction of secrets and paths, deterministic bounded digest, known classification and no success promotion.
- Assert malformed error evidence is a manual HOLD, network faults remain unknown and non-replayable, and original V1/V2/V3/V3.1/V3.2 tests still pass.

## Next required operator action
Review the GitHub diff and CI. A separate, explicit approved 8797-only restart procedure would be needed before testing a new future tool error on the actual computer. Do **not** retry the failed binary inspection based on these synthetic tests alone.
