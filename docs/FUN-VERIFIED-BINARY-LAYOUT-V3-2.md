# Fun Industrial V3.2 — Verified general binary layout

## Scope
Adds one exact named REA MCP tool, `inspect_binary_layout`, independently of the V3.1 Rust inspection pilot. V1–V3.1 remain unchanged. No model-selected execution, arbitrary REA delegation, installers, downloads, background actions, or binary execution.

## Live schema limitations
The operator's live 229-tool REA catalogue advertises `inspect_binary_layout` with required `path`, but the displayed schema was truncated and the catalogue warns that it is a reduced form. V3.2 fetches the *actual installed* schema and supports only a strict object with exactly one required `path:string`. Unsupported assertions at the root or on the path field fail closed. It sends no optional fields. The canonical REA provider may still reject the request: registration and schema matching do not establish provider usability.

## Approved input
Uses the already staged Windows file `fun_v31_windows_probe.exe` from the operator's `~/FunIndustrial-Approved-Inputs` directory. Operator-reported PE file: 65,536 bytes, SHA-256 `f51fab8041e5023d7290b540a2106f051ef0bd2bc3443c9daf318628b560fa29`. V3.2 independently re-verifies this on the user's host; GitHub CI cannot inspect that machine. No existing file is moved or modified by preparation.

Same restrictions as the V3.1 file pilot: directly staged regular file, no hardlinks or symlinks, no nested paths, PE/ELF leading header, approved extension, maximum 64 MiB, canonical target parent, identity and full SHA-256. A malicious local actor may still replace a file between final preflight and the provider's open; this is not kernel-backed snapshot isolation.

## Exact endpoints and approval
- GET `/api/unified/v3.2/status`: independent pilot state
- POST `/api/unified/v3.2/prepare`: exactly `{name:'inspect_binary_layout',filePath:'fun_v31_windows_probe.exe'}` as JSON; the tool name, actual resolved file path, schema hash and file digest are bound into a 2-minute one-use approval. This performs no MCP tool call.
- POST `/api/unified/v3.2/confirm`: only token and operatorConfirmed=true; consumes approval before any action, rechecks live provider health, complete schema fingerprint and file identity/hash, then sends exactly ONE `{name:'inspect_binary_layout',arguments:{path:<reviewed_absolute_path>}}` to the existing 8797 exact tool executor.
- POST `/api/unified/v3.2/cancel`: invalidates pending approval and makes no MCP call.

POST requires same-origin `Origin` and `x-fi-unified: operator-click` headers and strict input field allowlists. Schema drift or file change fails before submission. After a response, the file is rehashed. A verified result denotes a matching REA tool identity, non-error evidence envelope and unchanged source file; it does *not* establish correctness of detailed binary findings or that the REA provider created no derived state. Transport ambiguity reports `outcome_unknown_do_not_retry`.

## Qualification
Run `node scripts/Diagnose-Fun-Verified-Binary-V32.mjs --schema-only` first. This issues only the REA status and catalogue GETs and does not open a file or make an MCP tool call. If the true schema is unsupported, the guarded repair exits without restarting 8798.

The V3.2 CI gate runs all five V1/V2/V3/V3.1/V3.2 offline test suites, plus syntax checks, on Windows and Ubuntu. The guarded repair also checks the old 8798 process owner and preserves parent 8789, REA 8797, local 8796, Qwen 8088 and compute 8791. The existing Elektron Ollama is not touched.

## First live qualification
After preflight, run guarded `Repair-Fun-Unified-Web8798.ps1 -Apply` on the V3.2 branch. Prepare the already staged `fun_v31_windows_probe.exe` via the V3.2 panel, check its file hash and path, and cancel once to qualify no-action review. A separate operator decision is required before the first real layout-analysis call.

## Important limitation
Do not represent the provider as definitively read-only. Its tool description says it does not launch the target as a host process, but the independent provider may create session data or temporary analysis artifacts.