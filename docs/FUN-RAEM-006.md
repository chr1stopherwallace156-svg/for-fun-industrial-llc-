# RAEM-006 — Synthetic parser-to-checkpoint integration

RAEM-006 connects the *existing* bounded structured-record parser from RAEM-004 with the bounded recent-fingerprint checkpoint store from RAEM-005. It remains a **source-only synthetic qualification**, with no AIL installation, crawling, real data leaks, external network access, Qwen or REA activity, service restarts, or background scheduler.

## Verified baseline from the Windows operator

- RAEM-004b passed 53/53 tests. A 128 MiB synthetic incident workload parsed 936,944 records with 65.01 MiB observed peak RSS in 996 ms.
- RAEM-005 passed 66/66 accumulated tests and reported `RAEM_005_RESULT=PASS`, including six-hour virtual-clock gating, resumed checkpoint state, and bounded recent deduplication.

Neither proves full AIL operation on 16 GiB RAM or a hard OS-enforced memory limit.

## RAEM-006 pipeline

1. Require an explicit caller-supplied `operatorApproved:true` flag. This is **not operator authentication**; a future trusted UI/controller must independently check approval.
2. Validate a maximum batch of 64 synthetic `.example` incident records and a monotonic source cursor.
3. Read the persisted checkpoint **before parsing**. Hold immediately if the refresh is not due or the cursor has already been committed.
4. Stream only accepted synthetic record fields through the validated NDJSON parser, with per-line, input, record-count, and sampled RSS/free-memory limits. Unknown fields, malformed records and pressure lead to HOLD without checkpoint advance.
5. Commit recent event-ID SHA-256 fingerprints, counters, cursor and six-hour next-due time only after successful parse, using the existing exclusive lock and atomic checkpoint replacement.
6. No raw event IDs, titles, or full record bodies are saved in the checkpoint. Aggregate counts are returned to the caller.

## Limitations

- This adapter takes an in-memory array of at most 64 synthetic events. It does **not** stream a real feed into the checkpoint; the prior large input scaling benchmark is a separate demonstration.
- Recent-history deduplication is bounded and fingerprints are evicted; it is not exactly-once delivery, permanent deduplication, or a transactional coupling of an external source with persisted output.
- A crash after parsing but before checkpoint commit can lead to safe reprocessing; no external side effects are performed.
- The checkpoint's due timestamp does not start an automated timer or perform an actual refresh. All test clock values are synthetic.
- Samples are best-effort observations, not hard OS memory constraints.
- A malicious caller could set the approval flag itself; do not expose this function directly as an agent-granted tool.

## Files

- `src/resource-aware/incremental-pipeline.mjs` — source-only adapter.
- `intelligence-checks/resource-aware-pipeline-case.mjs` — 10 focused tests.
- `scripts/Qualify-Fun-RAEM006.mjs` — one-shot Windows benchmark using disposable temporary files and guarded RAEM-004b memory admission.

## Windows verification

Use a separate checkout or an intentionally isolated test folder. Run the 8 RAEM test files and the one-shot qualification script from Node 22 or later. Look for:

- `RAEM_006_PRECHECK` — host memory and CPU admission (benchmark-only balanced policy).
- `RAEM_006_FIRST` — synthetic parse and checkpoint commit.
- `RAEM_006_EARLY` — `REFRESH_NOT_DUE` with zero records reparsed.
- `RAEM_006_AFTER_REOPEN` — recent deduplication after reopening checkpoint.
- `RAEM_006_RESULT=PASS` — successful end-to-end qualification.

A pressure-induced `RAEM_006_RESULT=HOLD` is a safe result. **Windows testing of RAEM-006 remains pending.** Do not merge or attach live sources before qualification.
