# Fun Industrial — Verified Staged File V3.1

## Purpose

V3.1 adds an **operator-reviewed exact-path pilot** for the real REA MCP tool `inspect_rust_binary`, extending existing verified V3 `inspect_analysis_settings` and `binary_session` without weakening them. V1 conversation and websites, V2 discovery, 229 REA registrations and 19 local tools remain separate.

V3.1 can *inspect* one pre-staged Windows PE or ELF file only after verifying the live REA tool contract, hashing the exact file, and receiving separate operator approval. It does **not** execute the supplied binary, download programs, install analysis providers, grant autonomous permissions, or modify the input file intentionally. However, the REA provider is a separate subsystem and may launch analysis workers or create derived data; REA's tool description and a non-error response do not independently prove absence of all side effects.

## Approved input directory

The fixed V3.1 root is `C:\Users\<WindowsUser>\FunIndustrial-Approved-Inputs` (derived from the host's home directory; refer to `/api/unified/v3.1/status` for the exact path). **V3.1 does not create this directory or copy any file.** The operator must intentionally stage an authorized binary directly inside it. No nested folder, parent traversal, UNC, symlink, or hard-linked target is permitted. Allowed filename extensions: `.exe`, `.dll`, `.elf`, `.so`, `.bin`. Maximum size **64 MiB**.

File probing checks root directory, canonical resolved target parent, one regular link, PE/ELF leading signature, file identity and size, and SHA-256 content. A matching PE/ELF header alone does **not** establish that a file was compiled from Rust or that it is a safe or valid executable. Symlinks, hardlinks, missing files, large files and changed files HOLD.

## Schema validation / preparation

V3.1 requires the installed 229-tool REA MCP catalogue to be live. Only `inspect_rust_binary` is eligible. Its input schema must be a supported object schema with exactly one required property `path` of type string. Unknown root and path constraints HOLD instead of being ignored. The input argument is exactly `{ "path": <canonical approved file path> }`. Other non-required schema fields are deliberately omitted. The separate read-only diagnostic calls **only REA status and catalogue**, checks the tool schema, and does **not** need any local file:

    node scripts/Diagnose-Fun-Verified-File-V31.mjs --schema-only

If the real schema contains unsupported constraints, the diagnostic prints `V31_SCHEMA_HOLD` and returns nonzero; the running V3 service is untouched. No attempt to bypass the installed schema should be made.

## Approval and execution

Open `http://127.0.0.1:8798/` after guarded V3.1 activation. In **V3.1 — Staged executable inspection**, enter only the filename of an already-staged file and select **Verify file and prepare**. The server returns the exact tool name, resolved path, schema SHA-256, arguments SHA-256, file SHA-256, size, simple format signature, and a two-minute in-memory token. It makes **zero MCP tool calls** at preparation.

Separately choose **Approve one inspection** to consume that token. Before submission, V3.1 rechecks live REA readiness, full tool schema and exact staged file content/identity. If drifted, it refuses the call. Only with those checks intact does it send exactly **one** call through existing `/api/rea229/call`. Afterward it hashes the file again. A verified receipt requires matching tool identity, non-error evidence envelope, and unchanged file; receipts include schema, arguments, file before/after SHA-256, tool-result SHA-256 and outcome.

On transport uncertainty, post-call file changes, provider error, mismatched result identity or insufficient evidence, V3.1 reports a HOLD or UNKNOWN and never retries automatically. No durable database is created; the receipt is returned to the operator and logged in the browser session. A correct MCP envelope is **not** proof that the binary is Rust, that all REA findings are accurate, or that all provider side effects are impossible.

## Controlled deployment

The existing V3 service runs from the user's `FunIndustrial-UnifiedChat-V1` checkout. The new branch is `feature/fun-schema-bound-file-v3-1-20261111`. The guarded `Repair-Fun-Unified-Web8798.ps1 -Apply` first checks a public HTTPS fetch, V2 229+19 live catalogue, V3 exact read-only schema, **V3.1 real path schema only**, and the complete four-suite offline test set BEFORE stopping the existing 8798 process. If any preflight or test fails, V3 remains running. Only after verifying the old 8798 Node owner and protected listener PID mappings does it restart 8798. It preserves 8088, 8797, 8796, 8789, 8791 and does not touch Elektron Ollama.

Tests cover Windows/Linux file path spelling, headers, hardlinks/symlinks, size, exact single-call approval, schema/file drift, outcome uncertainty, and refusal to replay. These are qualification fixtures and do not prove any particular real binary provider works. First live stage: **schema-only diagnostic**, then guarded activation. Stage and approve a real file only in a separate, operator-chosen step.

## Remaining limitations

- Full JSON Schema interpreter, arbitrary nested input fields and all other 228 REA tools are outside the V3.1 exact-path pilot.
- Path and file hash checks reduce accidental substitution, but cannot provide a perfect kernel-level snapshot against a malicious local actor replacing the path during a provider's later read. An isolated provider with verified immutable input handoff is needed for stronger adversarial guarantees.
- No automated discovery-to-execution escalation, native game porting, binary uploads, self-healing, or data persistence.
