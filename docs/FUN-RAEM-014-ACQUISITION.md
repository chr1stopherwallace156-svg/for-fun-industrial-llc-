# RAEM-014: first-source acquisition contract (stage 1)

RAEM-013 was qualified on Windows with 180/180 tests and an offline synthetic approved source import. RAEM-014 starts a real-source acquisition workflow, but **does not download or contact AIL**.

## First supported acquisition pathway

1. Obtain a **metadata-only** JSONL export through an authorized operator-controlled process. The source must already be in the RAEM-012 format: one JSON object per line with exactly \`id\`, \`date\` (YYYYMMDD) and \`tags\` (string array). This is an adapter format, not a verified native AIL export schema.
2. Keep the export in a trusted, static local file. Do not supply leak text, emails, passwords, tokens or private content.
3. Compute the file's SHA-256 independently, verify its origin and review the intended file.
4. Call the existing RAEM-013 CLI with explicit source ID, absolute path, SHA-256 and \`--approved-readonly\`. It verifies file size/type/digest and processes aggregate metadata only.

The new \`planAilAcquisition\` function accepts only \`operator_supplied_metadata_export\`, a valid local \`.jsonl\` destination, source ID and expected SHA-256. It produces a frozen **PLAN_ONLY** object with the existing 4 MiB and 512-record limits. It neither reads nor writes files. All live network candidates return \`HOLD LIVE_AIL_ENDPOINT_NOT_VERIFIED\`. No URL, authentication, crawler or HTTP request is implemented.

## Before a real AIL HTTPS connector

Identify a legitimate AIL instance the operator may access, verify its precise API version, endpoint, authentication method and response schema against actual instance documentation, and define network policy (allowlisted host, TLS, redirects forbidden, response size, timeouts, resource admission and explicit confirmation). The current AIL-shaped adapter does not prove that a native AIL endpoint returns \`id,date,tags\` JSONL. Do not assume public availability or invent a provider URL.

## Qualification

- Seven new fail-closed acquisition contract tests.
- Windows expected total: **187** RAEM tests (180 prior + 7).
- No real AIL source has been acquired yet; no HTTPS or local export ingestion is performed by this stage.
- Existing REA/Qwen/Ollama/dashboard services and all checkpoints are unchanged.
