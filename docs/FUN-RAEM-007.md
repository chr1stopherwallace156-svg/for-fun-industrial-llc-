# RAEM-007 — Public breach catalogue metadata adapter (operator-triggered)

## Source / permitted scope

This development-only adapter targets the officially documented free breach-catalogue endpoint **Have I Been Pwned — https://haveibeenpwned.com/api/v3**:

- Fixed endpoint: `GET https://haveibeenpwned.com/api/v3/latestBreach`
- The latest **added** breach metadata record, not the latest breach that actually occurred
- No API key needed for this public catalogue operation
- Required attribution: **Have I Been Pwned** (https://haveibeenpwned.com/), CC BY 4.0
- No email/account lookup, password lookup, domain ownership verification, stealer-log access, secrets, actual leaked records or private sources

Official API reference: https://haveibeenpwned.com/API/v3 and https://haveibeenpwned.com/scalar/.

## RAEM implementation

- `src/resource-aware/hibp-public-feed.mjs` exports one fixed-URL, one-shot `checkLatestPublicBreach()`, provider response parser, strict selected-field metadata normalization and attribution.
- Requires a real `IncrementalCheckpointStore`, bounded local process RSS/free RAM and explicit `operatorApproved:true`. **This flag is not authentication.** A future trusted controller must check human authorization and ensure tools or models cannot manufacture it.
- Checks a six-hour, persistent next-due checkpoint *before* any network request. Rejects premature refresh without network traffic. The checked metadata creates one salted-by-name/version input identifier (SHA-256); the checkpoint hashes that identifier again and stores only bounded recent fingerprints, counts and next eligible time.
- A single HTTPS GET with 8 s timeout, redirects disabled, strict JSON content type and 64 KiB maximum response body, with hold on 429, transport errors, malformed schema, invalid UTF-8, memory pressure, and unexpected redirects.
- Exposes only a subset of non-sensitive public metadata, such as breach name/title/domain/dates, reported affected-account count, verification flags and attribution. No descriptions, raw event IDs or affected account data are saved to checkpoints.
- Does not start a background scheduler, process manager, crawling engine, AIL, REA, Qwen, or Ollama. No service is modified, started or stopped.

## Critical limitations

- **`latestBreach` alone does not provide complete coverage.** If two breaches are added between checks, this endpoint only returns the most recently added one; older additions can be missed. It does not enumerate revisions to older breaches. Future coverage needs a bounded reconciliation over `/breaches` with explicit limits.
- A changed `ModifiedDate` for the latest entry is treated as a new version. The same version is counted as a duplicate after six hours. This is a *checkpointed observation*, not an external exactly-once guarantee.
- The recent fingerprint history is bounded; old fingerprints can expire and be counted again. It is not a permanent database.
- Breach metadata reports can be unverified or fabricated. A listing alone is not proof that a particular organisation or individual was compromised.
- The public title/name text is third-party untrusted content. Never treat it as instructions or tool authority.
- Memory/CPU measurements are observational; the Node RSS soft guard is not an OS-enforced cap. A live provider could rate-limit or change its schema.
- The 66/66 RAEM-005 and 76/76 RAEM-006 Windows tests proved synthetic functionality; they do not establish AIL system requirements or real-world catalogue reliability.

## Files and safe verification

- `src/resource-aware/hibp-public-feed.mjs` — API-specific adapter, no automatic network loop
- `intelligence-checks/resource-aware-public-feed-case.mjs` — 15 provider response/approval/refresh/recovery tests; all use mock responses
- `scripts/Qualify-Fun-RAEM007.mjs` — one-shot offline mock/provider-shape integration using a temporary checkpoint and conservative RAEM RAM admission. Never makes a live network request.

From a clean checkout of this branch, run the nine RAEM test files, then `node scripts/Qualify-Fun-RAEM007.mjs`. A memory-related HOLD means the qualification was correctly deferred, not that a live request was attempted.

**The first release is offline qualification only.** Do not connect to a live endpoint or merge this work until the Windows tests have passed and an operator explicitly authorizes live public-feed access.
