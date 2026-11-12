# RAEM-012 — Small AIL Framework metadata bridge

## Scope

Fun Industrial now has an **offline, metadata-only compatibility layer** for AIL Framework item references and local JSONL exports. This is **not** an AIL Framework installation, a live API client, an AIL crawler, an intelligence subscription, or proof that AIL is operating on the Windows host.

The AIL API request builder creates a **shape only**, referencing the AIL item lookup endpoint `/api/v1/get/item`. It is not executed by this milestone. Actual API response format and authentication still require verification against a specifically deployed and authorized AIL instance before any live connection.

## Files

- `src/integrations/ail-metadata.mjs`: strict `{id,date,tags}` record validation, a non-executable item-metadata request shape with `content:false`, SHA-256 item fingerprint, YYYYMM aggregation, and limited tag namespace counts. No raw item ID or raw tag values are returned in summaries.
- `src/integrations/ail-ndjson.mjs`: read-only, bounded local JSONL file processor; **4 MiB file**, **8 KiB line**, **512 records** maximum; 16 KiB stream chunks; duplicate detection per batch; process RSS and host free-memory soft guards; aggregate counts and a SHA-256 digest on complete success. Rejects symlinks, relative paths, unexpected fields and malformed UTF-8/JSON.
- `scripts/Inspect-Fun-AIL012.mjs`: dry-run by default. Only `--file ABSOLUTE_PATH --approved-readonly` processes an existing local metadata export. Calls RAEM admission and adaptive soft-budget checks. No network calls, timers, or background workers.
- `scripts/Qualify-Fun-RAEM012.mjs`: synthetic disposable JSONL qualification in an OS temp directory; removes the synthetic file afterward. No live AIL.
- `intelligence-checks/resource-aware-ail-case.mjs`: 13 tests for safety, bounds, metadata normalization, and memory guards.

## Windows qualification

Run all `resource-aware-*-case.mjs` tests, expecting **170** if the previous RAEM-011 checkout had 157, and then run `node scripts/Qualify-Fun-RAEM012.mjs`. The AIL-specific **13 tests and synthetic qualification passed in the isolated Node 22 local environment**. The combined Windows suite and actual Windows dry-run remain pending.

For actual use of a *pre-existing, authorized, metadata-only* JSONL export, use `node scripts/Inspect-Fun-AIL012.mjs --file 'C:\\absolute\\path\\to\\metadata.jsonl' --approved-readonly`. Never feed raw leak dumps, credentials, email lists, or private account information into this bridge.

## Known limitations and protections

- The AIL item metadata shape is an **adapter contract**, not verified interoperability with a running AIL deployment. No live AIL server has been queried.
- SHA-256 fingerprints of item IDs are **pseudonymous**, not guaranteed anonymous or secret.
- The JSONL reader checks an initial file size and symlink status, but does **not** fully protect against concurrent file replacement or races; use only trusted local, non-shared input files. The memory limit is a **soft** RSS guard, not a Windows Job Object hard cap.
- An input error causes a HOLD; partial in-memory counts must not be treated as an accepted successful dataset. No persistent checkpoint is written.
- No AIL installation, crawling, leaked-content ingestion, external API request, REA action, Qwen/Ollama interaction, service restart, or scheduler is authorized or performed.
- Any later live AIL connection needs a separate operator approval, instance URL and authentication policy, and an independent integration test against its documented API version.
