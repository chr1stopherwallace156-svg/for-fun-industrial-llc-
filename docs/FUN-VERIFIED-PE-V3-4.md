# Fun Industrial V3.4 — exact Windows PE inspection pilot

## Evidence and scope
The operator verified the existing staged Windows sample `fun_v31_windows_probe.exe` as a **PE x64** binary: Machine `0x8664`, seven sections, SHA-256 `f51fab8041e5023d7290b540a2106f051ef0bd2bc3443c9daf318628b560fa29`. The live REA catalogue registered five tools with a mandatory `path` argument:
- `inspect_pe_imports`
- `inspect_native_exports`
- `inspect_pe_resources`
- `inspect_byte_entropy`
- `inspect_pe_load_config`

`inspect_binary_hardening` was **not confirmed** and is **not authorized**. V3.2's `inspect_binary_layout` returned two real MCP tool rejections; the cause remains unknown and the earlier request must not be replayed.

## V3.4 new isolated capability
`src/experimental/verified-pe-inspection-v3-4.mjs` and the dedicated `/api/unified/v3.4/` endpoints add five *individually selected* exact REA tools, not multi-tool orchestration. The operator provides only a basename for a staged `.exe` or `.dll` file; nested, external or symlink/hardlink inputs fail before execution. The original V3.2 file probe checks the approved directory, canonical file path, size up to 64 MiB, regular file identity and full-file SHA-256. V3.4 additionally checks the native DOS header, PE signature, x64 machine 0x8664, a bounded nonzero section count, and PE32+ optional header 0x20b. V3.4 compares the complete SHA-256 and file identity before and after header reading, and again before and after the MCP call.

Every prepare checks live 229-tool MCP catalogue, rejects duplicate names and unknown schema assertions, and requires *exactly one mandatory `path:string`* plus `additionalProperties:false`. It passes no optional parameters. Actual provider availability is **unverified**, even when the tool is registered. Preparation does not call MCP.

A separate, one-use 48-hex token expires after 2 minutes. Confirm consumes it before network actions, rechecks the schema, file identity and path, then submits *at most one* `/api/rea229/call` with the selected name and exact path. No model-selected tool, automatic retry, loop, arbitrary shell, download, file execution, REA status mutation or background job is part of this pilot. Cancel makes no MCP call.

## Honest evidence handling
- `verified_mcp_envelope` means exact tool identity, non-error result envelope and unchanged source file. It does **not** independently establish findings' correctness or provider-side effect freedom.
- `provider_mcp_error_reported` preserves V3.3's bounded sanitized error class and hash, with `analysisAccuracyVerified:false`. Never mislabel a negative receipt as success.
- `result_hold_manual_review` means the envelope is missing, malformed, too large, or inconsistent.
- `outcome_unknown_do_not_retry` means a transport/HTTP exception after a possible submission. Never replay automatically.

## Operator workflow
Develop, review and CI test on `feature/fun-pe-inspection-v3-4-20261112`. A guarded 8798-only service update requires a **separate operator decision**; no GitHub commit or checkout performs this update. The existing 8797, 8796, 8789, 8088, 8791 services and Elektron/Ollama must be preserved. `Repair-Fun-Unified-Web8798.ps1 -Apply` runs full offline qualifications and verifies the exact owned 8798 process before a controlled replacement.

After approved deployment, GET `/api/unified/v3.4/status`, then POST `/api/unified/v3.4/prepare` with `{name:'inspect_pe_imports',filePath:'fun_v31_windows_probe.exe'}`. Review the resulting tool name, file path/digest, native header and schema. POST `/api/unified/v3.4/confirm` with exactly `{token,operatorConfirmed:true}` **only if separately approved**. Otherwise `/api/unified/v3.4/cancel` accepts `{}` and guarantees no tool submission. The UI panel supports all five tools with explicit selection and confirmation.

## Qualification
Windows and Ubuntu GitHub Actions run synthetic/offline tests for five-tool allowlisting, actual staged PE parser, blocked symlink/hardlink/path escalation via inherited V3.2 protections, schema drift, changed file identity, expiry/replay rejection, HTTP same-origin controls and V3.3 safe failure envelope. No real REA tool call runs in CI. Live provider compatibility still requires a separate operator-approved test.
