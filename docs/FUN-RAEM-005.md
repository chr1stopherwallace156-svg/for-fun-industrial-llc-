# RAEM-005: Synthetic incremental checkpoint + bounded deduplication

## Why
RAEM-004b's Windows run passed 53/53 tests and completed 8, 32, and 128 MiB synthetic incident-record processing. The largest 128 MiB test processed 936,944 records with 65.01 MiB sampled peak Node process RSS in 996 ms; output showed 16x input increase from 8 MiB and 5.88 MiB RSS growth. These results do not establish full AIL compatibility or hard memory caps.

RAEM-005 tests **avoiding repeated records** and calculating a next-eligible refresh timestamp rather than polling constantly. This is an independent checkpoint state machine for synthetic identifiers, not yet connected to the RAEM-004 parser or a real feed.

## Architecture

- `src/resource-aware/incremental-checkpoint.mjs` stores only a **bounded list of recent SHA-256 event-ID fingerprints** (default 256) with a monotonic batch cursor, processed/duplicate totals, last success timestamp and next due time; it does not store raw event text.
- Each batch has at most 64 synthetic event IDs and explicitly defined categories. The persisted state is capped at 512 KiB, with write lock and atomic same-directory replacement. Malformed checkpoints fail closed; symlink-backed checkpoint files are refused.
- Default refresh interval: **six hours after successful completion**. The system never starts a timer, crawler, REA tool, or automated execution.
- `processBatch` requires `operatorApproved:true`. This is a function-level guard **only**, not authentication: a future trusted controller must independently verify operator authorization and prevent AI agents from asserting approval themselves.
- Only test-written local files are affected. The standalone qualification script uses an isolated temporary directory, simulates two batch runs separated by a six-hour virtual-clock advancement, and cleans up.
- **Bounded recent deduplication is not permanent/global**: once a fingerprint is evicted from the 256-item history it may be counted again. Stable feed cursors, authoritative upstream event IDs and larger disk-backed indexes must be verified before production use.
- SHA-256 hashes of predictable identifiers are not irreversible anonymization. Do not use real personal data or secrets in this prototype.
- A checkpoint is not a source-of-truth feed archive, and a due timestamp does not deliver automatic refresh.
- A stale lock from a crash intentionally holds further writes until independently investigated; never automatically override a lock in the initial release.

## Read-only service boundary

No AIL installation, no live breach-data ingestion, no network access, no Qwen/REA calls, no service starts/stops, no modification to the Fun Industrial dashboard or existing orchestration. The Node test suite may write ephemeral files in the OS temp directory; it cleans these files up.

## Qualification

On a separate clone of the RAEM-005 feature branch, run:

~~~powershell
node --test .\intelligence-checks\resource-aware-checkpoint-case.mjs
node .\scripts\Qualify-Fun-RAEM005.mjs
~~~

Inspect `RAEM_005_RESULT=PASS`, `RAEM_005_EARLY` (`REFRESH_NOT_DUE`), and the saved counter values. This is source qualification only; the Windows host has **not** yet qualified RAEM-005. Do not merge or connect live collectors before verification.
