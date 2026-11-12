# Fun Industrial — V3 Verified Exact-Tool Execution Pilot

## What V3 really does

This bounded V3 pilot adds exact, operator-approved REA MCP inspection to the unified chat at `127.0.0.1:8798`. V1 conversation/web/REA inspection and V2 live 229+19 capability discovery remain unchanged. The new API only permits `inspect_analysis_settings` and `binary_session` using exactly empty JSON object arguments `{}`. Both were existing V1 read-only inspection routes. They are not evidence that all 229 REA tools are safe or functional.

### Request path

1. **Prepare**: An explicit click POSTs to `/api/unified/v3/prepare` with `{"name":"inspect_analysis_settings","arguments":{}}`. The server reads the live 8797 MCP health and all 229 tool definitions, checks uniqueness, confirms the exact allowlisted tool with no required input fields and no unsupported root schema constraints. It returns the **exact tool identity**, hashed schema, argument hash, a random one-use token and a two-minute expiry. No MCP tool calls yet.
2. **Confirm**: A separate click submits the returned token with `operatorConfirmed:true` to `/api/unified/v3/confirm`. The token must match and be unexpired. The preparation is consumed before requesting anything. Live REA health/catalogue/schema is checked again. If changed, HOLD with zero calls. If stable, the system sends exactly one `8797/api/rea229/call` with the operator-reviewed `{name,arguments:{}}` and no Qwen tool selection.
3. **Verify**: The result must have the expected MCP tool identity, an object result envelope, and not signal `isError:true`. V3 records SHA-256 hashes of schema, arguments, result and a bounded receipt. It does not assert that the underlying provider's substantive findings are factually correct; only the envelope and response identity are verified. The preview is untrusted tool output.
4. **Failure**: Expired approvals, invalid arguments, missing catalogue, schema drift, wrong response identity or explicit MCP error stop or HOLD. A timeout/drop after sending the request is reported as `outcome_unverified_do_not_retry`. The token is consumed, and there is **no automatic retry**. After such an outcome, manually review the REA status and only create another preparation if necessary.
5. **Cancel**: A separate click can cancel a pending approval without execution.

### Security boundaries

- All V3 requests are localhost-only and enforce the existing same-origin request/header policy.
- The V3 direct approval token is in-memory, nonreplayable, valid for 120 seconds, and tied to the specific live tool schema and exact `{}` arguments. There is no background scheduling, arbitrary shell, local-file path, file mutation workflow, upload or model-generated arguments in V3.
- Other 227 REA tools, including `inspect_rust_binary` and `address_to_file_offset`, remain in V2 **discovery-only** status for this V3 pilot; they are not automatically executable from a discovered plan.
- V3 does **not** create a durable evidence database. Receipts are returned to the operator and shown in the browser session's execution log; the last receipt hash is in process memory only. Save the operator output separately if durable proof is needed.
- V3 cannot prevent a compromised local process or an extension that can access the loopback service from impersonating HTTP origin/headers. This is a local operator workflow, not cryptographic human identity verification.
- The existing, separately approved broad REA/local executor buttons from V1 still exist. This pilot does not strengthen or replace their independent authorization boundaries.

### Live preflight and operator deployment

Run `node scripts/Diagnose-Fun-Verified-V3.mjs --prepare-only` from the V3 checkout. It reads the live 8797 status and catalogue and prepares/cancels a token in that short-lived Node process. It **does not** execute any MCP tools. Expected: `V3_PREFLIGHT=PASS`, `V3_PREPARED_ACTIONS=0`, `V3_NO_TOOL_CALLS=TRUE`.

The guarded `Repair-Fun-Unified-Web8798.ps1 -Apply` does its existing V1 website preflight and V2 229+19 live discovery, then the **V3 prepare-only live check** and the complete three-suite JavaScript tests **before stopping the existing 8798**. It verifies the exact old 8798 Node ownership, checks unchanged listener mappings on 8789/8796/8797/8088/8791, restarts only port 8798, and validates the new UI and V3 status. On a failed preflight, the running V2 remains untouched.

Upon activation, open `http://127.0.0.1:8798/`, locate **V3 · Verified exact REA inspection**, choose a pilot tool, click **1. Prepare exact inspection**, review exact name/empty args/schema SHA/expiration, then optionally click **2. Confirm once and execute**. A receipt appears in Execution evidence. A separate single approved REA call is made only at confirmation.

### Qualification / what remains

Windows and Ubuntu CI runs syntax, all V1+V2+V3 tests, and Windows PowerShell parsing. These are offline synthetic cases, not proof of successful real 8797 tool execution. The Windows operator has not yet deployed or confirmed V3 live execution at authoring time. Expanding beyond the two inspected tools requires validating full JSON Schema arguments, target availability/ownership, effect classification, and an explicit operator-review binding for each new tool.
