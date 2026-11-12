# RAEM-010 — Read-only live-baseline checkpoint reporting

## Scope and why

RAEM-009 was locally qualified on the user's Windows computer with 128/128 tests and `RAEM_009_RESULT=DRY_RUN_ONLY`. The operator later separately authorized one manual live public-catalogue GET and reported `RAEM_009_RESULT=PASS PUBLIC_METADATA_ONLY`, approximately 1.13 MB received and a six-hour `nextDueMs`. The pasted output did not clearly show the entire live preflight or count of baseline records. Treat those details as unknown until the saved checkpoint is inspected.

RAEM-010 is deliberately **read-only** and does **not** enable another live request. It observes the existing baseline, verifies structural invariants and outputs its next eligible refresh time and current conservative RAM admission status.

## Source and safeguards

- `src/resource-aware/catalogue-checkpoint-report.mjs` reads the existing JSON snapshot from the RAEM-009 application-local checkpoint folder, using a read-only file handle. It does not instantiate the state writer, fetch a URL, create directories, acquire locks, or change files.
- The status report validates the exact `fun.raem.hibp.catalogue.v1` schema; a valid last-checked timestamp; the six-hour timestamp relationship; bounded count (0–4096); distinct SHA-256 name hashes and valid SHA-256 version hashes; a file at most 1 MiB; and no symbolic-link checkpoint file.
- It produces a SHA-256 checksum of the checkpoint **for reproducibility and comparison**, not proof of provider authenticity or tamper-proof provenance.
- It reports `PRESENT`, `MISSING` or a protective `HOLD`, the number of fingerprint pairs stored, `lastSuccessfulCheckIso`, `nextEligibleCheckIso`, and `eligibleNow`. It **does not output** fingerprint pairs, individual organization names, emails, or breach contents.
- If the file is missing or malformed, it is left untouched; the operator can investigate without automatic resets or silent baseline replacement.
- `scripts/Inspect-Fun-RAEM010.mjs` samples the local computer's memory and CPU, then checks the checkpoint in `%LOCALAPPDATA%\FunIndustrial\RAEM009PublicCatalogue\hibp_catalogue_snapshot.json` (with a home-directory fallback). It reuses RAEM-009's **conservative** live-readiness calculation. No `--live` option is accepted.
- `scripts/Qualify-Fun-RAEM010.mjs` is a separate **offline test**. It writes two synthetic records through the existing catalogue snapshot store into a disposable operating-system temp folder, reads the result using the new inspector at virtual times before and at the six-hour due boundary, and removes the temp folder.
- `intelligence-checks/resource-aware-checkpoint-report-case.mjs` adds 12 source tests for checkpoint validation, file safety, missing-state behavior, time boundaries, hash output and no modifications.
- No network, AIL deployment, background polling, REA, Qwen, llama.cpp, Ollama, dashboard manipulation, or Windows service/process lifecycle changes are performed by this milestone.

## Operational limits

A `PRESENT` status with `eligibleNow:true` means the **time condition** for a future request has been satisfied, not that a network request is currently authorized. The operator must approve each new live request separately. Actual execution also requires a new CPU/memory resource check.

A valid digest and structure are not a cryptographic signature, forensic integrity proof, or validation of the provider's original data. The saved catalogue contains SHA-256 hashes of public names, which should not be treated as irreversible anonymization.

RAEM-009 may have been run from a different folder, copy or runtime configuration. If this status command returns `MISSING`, verify the actual saved location before assuming the live pilot did not succeed. **Never create or overwrite a baseline automatically in response to MISSING.**

## Windows qualification

Use a separate test-only checkout of `feature/fun-raem-010-checkpoint-report-20261112`. Run all twelve prior RAEM test files plus the new checkpoint-report case (**140 expected tests**) and then the offline `Qualify-Fun-RAEM010.mjs`. The 12 new inspector tests passed in an isolated local Node 22 environment, and the standalone CLI scripts pass syntax checks; the full Windows test remains pending.

After the offline test passes, run `node scripts/Inspect-Fun-RAEM010.mjs --status`. This **does not** touch the live provider. Look for `RAEM_010_CHECKPOINT` and `RAEM_010_RESULT`.

No new live HIBP request is authorized as part of this milestone. Do not merge the draft PR before reviewing Windows results.
