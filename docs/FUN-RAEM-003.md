# RAEM-003: Synthetic scaling qualification

This separate source-only milestone extends RAEM-002 without changing running Fun Industrial services. A manual Node script processes 128 MiB, 512 MiB, then 1024 MiB of deterministic synthetic bytes using the existing 64-KiB read-only hashing worker. It rechecks free memory and recent CPU load before each stage and uses the RAEM-001 admission policy. A HOLD stops further stages.

## Purpose

Determine whether observed process RSS stays approximately bounded as the number of processed bytes rises eightfold, and measure throughput. This does **not** compress data, enforce an OS memory limit, run AIL, download content, provide an autonomous scheduler, or establish production performance for document parsing, crawling, large graphs or AI inference.

## Safety and interpretation

- Checks 20% or 1536 MiB free reserve (whichever is higher), and CPU below the policy ceiling, before each stage. The streaming worker checks process RSS and host-free memory periodically while running. These are observational guards and do not guarantee an operating-system hard limit.
- Memory can change between samples; a HOLD is a correct safety outcome, not a test failure.
- Data are generated on demand from a 64-KiB buffer, not downloaded, written to disk, or retained as a gigabyte array.
- `BOUNDED_SCALING_CANDIDATE` means observed RSS increased no more than a screening threshold as input grew >=4x. It does **not** establish general bounded memory for arbitrary applications.
- Entirely operator-triggered. No service restart, automatic refresh, REA authorization, AIL installation or external network action.

## Windows test command

From the RAEM-003 cloned feature branch:

```powershell
node --test .\intelligence-checks\resource-aware-manager-case.mjs .\intelligence-checks\resource-aware-stream-case.mjs .\intelligence-checks\resource-aware-scaling-case.mjs; if($LASTEXITCODE -ne 0){throw 'RAEM_TESTS_FAILED'}; node .\scripts\Qualify-Fun-RAEM003.mjs
```

Look for `RAEM_003_STEP_RESULT` and `RAEM_003_SCALING_ASSESSMENT`. The local benchmark has not been run on the user's Windows computer until they report its output.
