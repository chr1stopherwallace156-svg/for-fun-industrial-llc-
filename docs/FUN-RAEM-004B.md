# RAEM-004b — benchmark-only balanced resource policy

## Why

Windows RAEM-004a completed 45/45 tests but correctly held the synthetic data benchmark at 59 MiB free above its 3197 MiB (20%) reserve. The Node process baseline was 56.38 MiB, and a safe 128 MiB target could not be granted under that conservative default. This proves admission controls, **not structured ingestion throughput**.

## Exactly what changes

The RAEM default in `src/resource-aware/raem.mjs` remains **unchanged**. This branch creates an explicit `SYNTHETIC_BALANCED_ONLY` admission policy for the manually launched synthetic structured-record benchmark:
- protected reserve: max(2048 MiB, 12.5% of host RAM);
- require an additional 512 MiB free beyond that reserve **before** starting;
- require at least 256 MiB free beyond that reserve **during** the run;
- hold when sampled CPU busy percentage is 70% or higher;
- one worker; job minimum 64 MiB, target and maximum 128 MiB;
- use the measured Node process RSS with an 8 MiB process growth margin and 8 MiB additional host margin;
- never exceed the initial RAEM admission when adapting a memory grant.

Example with the last Windows observation (15981 MiB total / 3256 MiB free / 0.76% CPU / Node RSS 56.38 MiB): the profile would reserve 2048 MiB, require 2560 MiB free at preflight and 2304 MiB free during work, and **could** grant a 128 MiB worker budget. This is only a hypothetical replay of the snapshot; the script measures again every time.

## Boundaries and risk

This opt-in policy applies **only to the synthetic local benchmark**. It must never be silently reused for AIL, public data collection, model inference, REA tools or other services. There is no OS-enforced RSS limit, no persistent scheduler, no installation, no network collection, no service lifecycle control, no AIL process and no automatic kill of Ollama or the dashboard. A background Windows process or model can increase RAM use between checks, so worker RSS and host-free-memory checks are best-effort guards.

Benchmark source is `scripts/Qualify-Fun-RAEM004.mjs`. Tests for the new policy are in `intelligence-checks/resource-aware-balanced-profile-case.mjs`.

## Windows qualification

From a clean test checkout of `feature/fun-raem-004b-balanced-admission-20261112`, run all six targeted RAEM test files followed by the manual benchmark. On pressure, a HOLD is acceptable and correct. Report `RAEM_004_PRECHECK`, `RAEM_004_RESULT`, and `RAEM_004_SCALING` fields.

Do not claim full AIL resource savings from these synthetic records. Do not merge until the new policy's Windows qualification is reviewed.
