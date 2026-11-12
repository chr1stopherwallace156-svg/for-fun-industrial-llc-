# RAEM-008 — Bounded HIBP public catalogue reconciliation

## Problem addressed

RAEM-007's public `/latestBreach` metadata adapter can miss breaches added between checks. The official Have I Been Pwned API documents `GET /api/v3/breaches` as the *all breaches* public catalogue (about 1,051 catalogue entries when this design was reviewed). RAEM-008 adds a **manually invoked, bounded, source-attributed catalogue snapshot/diff** so a later check can identify multiple additions and modified records, without opening account, email, domain-ownership, password or stealer-log APIs.

Source and required attribution: **Have I Been Pwned** — https://haveibeenpwned.com/; public breach data is licensed under CC BY 4.0. Official API: https://haveibeenpwned.com/API/v3

## Implementation

- `src/resource-aware/hibp-catalogue.mjs`: fixed `https://haveibeenpwned.com/api/v3/breaches` endpoint, one GET per explicitly approved invocation, with 8-second timeout and redirects disabled. No network activity happens at import time.
- Accepts HTTP 200 JSON only. Maximum response body 8 MiB; maximum 4,096 records. The parser applies fatal UTF-8 decoding, JSON/schema validation, duplicate-name rejection, RSS and host-memory guards before checkpoint commit.
- `CatalogueSnapshotStore`: stores only the SHA-256 name/version fingerprints of catalogue records, last successful check time and next eligible check time. State JSON capped at 1 MiB. Uses exclusive lock and atomic same-directory replacement; corrupt checkpoint and unsafe files are rejected.
- The **first** successful request establishes a baseline (it does not misleadingly report the entire existing catalogue as "new"). A later request counts entries added, modified, unchanged, and *absent from this latest provider snapshot*. Absence is **not proof of permanent deletion**.
- Unexpected drops greater than half the prior catalogue cause a hold instead of replacing the checkpoint. At most five brief title/date samples are returned for human review; none are persisted to the checkpoint.
- Refresh eligibility is set six hours after successful processing; calling too early returns `REFRESH_NOT_DUE` **without any network request**.
- A live call requires an explicit caller-supplied `operatorApproved:true` flag, which is **not authenticated approval**. The operator's trusted UI/controller must independently check authorization before a live integration can be enabled.

## Strict boundaries

The manual Windows qualification script, `scripts/Qualify-Fun-RAEM008.mjs`, uses **only fake HIBP-shaped responses** and a disposable OS temporary directory. It does **not** fetch the actual HIBP API, install AIL, open a browser, run a scheduler, call REA or Qwen, or modify/restart/stop any existing Fun Industrial or Elektron service. It cleans up its temporary checkpoint files after use.

The memory budget is advisory; no OS-enforced hard RAM limit has been built. The runner uses RAEM's original conservative host reserve, and may correctly return `HOLD` when insufficient free headroom is available. The catalogue method holds when RSS/free RAM guards, provider schema or response bounds are violated.

Hashing catalogue names is not guaranteed anonymization because names are drawn from a public, guessable set. No raw full records or credentials are retained in the checkpoint. Any displayed provider title is untrusted text, not an instruction or claim of confirmed compromise.

**Current limitation:** this does not automatically refresh every six hours; it only calculates when a manual or separately authorized future schedule would be eligible. Retired/missing items can result from provider changes, errors or access policies. No alerting or full AIL crawler/indexer is enabled.

## Windows qualification

From the separate `feature/fun-raem-008-hibp-catalogue-reconciliation-20261112` branch checkout:

1. Run the ten targeted RAEM test files with Node 22+; 21 new catalogue tests cover baseline, multi-item changes, no-fetch-when-not-due, source URL, schema/rate-limit/error holds, memory budgets, state safety and abnormal catalogue shrink.
2. Run `node scripts/Qualify-Fun-RAEM008.mjs` with the fully mocked provider response.

Expected first response: `CATALOGUE_BASELINED`; next early attempt: `REFRESH_NOT_DUE` with zero new simulated fetches; second successful request: one added, one modified, one unchanged, one absent entry; at end `RAEM_008_RESULT=PASS` and temporary cleanup. A memory-related `HOLD` is also a valid protective result.

**Windows qualification of RAEM-008 is pending.** Do not merge or enable live provider contact before the operator reviews the results.
