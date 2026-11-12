# RAEM-013: operator-approved local AIL metadata source registry

## What is integrated

RAEM-013 builds on the Windows-qualified RAEM-012 AIL-shaped metadata JSONL reader (170/170 tests). It adds an in-process, explicit source registry and SHA-256 pinning. It is **not** a full AIL Framework installation, a live AIL API client, or a leaked-content ingestion system.

Each source is specified as `{id, path, expectedSha256}`. Registration rejects duplicate IDs/paths, URLs, relative paths, non-JSONL extensions and unexpected fields. No source is automatically discovered. Reading is blocked without `operatorApproved:true`; the CLI requires the explicit `--approved-readonly` flag. The source is checked for regular-file type, symlink, size, and SHA-256 digest before parsing. The existing RAEM-012 bounded parser is then used, and its final digest must match the expected digest.

Limits: max 4 MiB per file, 8 KiB per JSONL record, 512 records, 16 KiB read chunks, RAEM conservative host reserve and soft process-RSS guard. Only the existing `id,date,tags` metadata schema is allowed. The report returns aggregate tag namespaces, months, record counts, duplicate counts and digest; it does not return raw item IDs, tag values or leaked content.

## Windows qualification

Run all `intelligence-checks/resource-aware-*-case.mjs` tests (**180 expected**), `node scripts/Qualify-Fun-RAEM013.mjs` (offline synthetic), and `node scripts/Inspect-Fun-AIL013.mjs --dry-run`. The source registry tests and synthetic qualification passed in an isolated Node 22 environment; the full Windows run remains pending.

To inspect a **trusted, existing, operator-approved** local metadata-only JSONL export, use:

```powershell
node scripts/Inspect-Fun-AIL013.mjs --source-id local_ail --file 'C:\absolute\metadata.jsonl' --sha256 '<64 lowercase hex digits>' --approved-readonly
```

Do not run the above on arbitrary downloaded leaks, password lists, emails or raw paste content. The operator must separately choose the specific file.

## Limitations

- Hash pinning and read-only checks do not fully eliminate time-of-check/time-of-use races on a concurrently modified file. Use trusted, non-shared, static local files only.
- Soft RSS checks are not OS-enforced process memory caps.
- No live AIL instance, HTTP requests, Redis, crawlers, background scheduler, REA actions, Qwen, Ollama, dashboard, or Elektron services are involved.
- The source registry is deliberately in-memory and does not persist authorization or allow unattended processing.
- A future live AIL API connection requires separate authorization and API compatibility validation.
