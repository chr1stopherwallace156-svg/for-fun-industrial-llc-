# RAEM-008b — Benchmark-only balanced admission for offline catalogue checks

## Windows evidence

The RAEM-008 checkout passed 112/112 tests on the user's Windows machine. Its standalone synthetic catalogue demonstration was held before making any provider calls: 15,981 MiB total RAM, 3,237 MiB free, 4.64% CPU, original RAEM reserve 3,197 MiB, just 40 MiB headroom, and Node baseline RSS 57.09 MiB. The refusal was correct under the conservative default.

## Narrow correction

Only `scripts/Qualify-Fun-RAEM008.mjs` is changed to reuse the **existing** `evaluateSyntheticBalancedAdmission()` helper from RAEM-004b. RAEM's default admission, actual catalogue library, ordinary job scheduling and live-provider boundaries are unchanged.

The isolated demo policy is explicitly tagged `SYNTHETIC_BALANCED_ONLY`:
- protected reserve of max(2,048 MiB, 12.5% of total RAM)
- **extra 512 MiB** of free RAM above reserve required at benchmark preflight
- **extra 256 MiB** of RAM above reserve required during parser execution
- one synthetic job, worker allocation between 64 MiB minimum and 128 MiB target; baseline process RSS and extra margins must fit
- hold at 70% or higher measured CPU busy percentage
- a `HOLD` is not an error and must not trigger service shutdown, reconfiguration or forced allocation

At the last Windows snapshot (3,237 MiB free, 57.09 MiB Node RSS, 4.64% CPU), **a hypothetical evaluation** of this policy would grant a 128 MiB worker ceiling with 2,304 MiB live free-memory floor. Actual admission is sampled again on every test run.

## Scope boundaries

- Synthetic data and a **mock `fetchImpl` only**. No real HIBP request is performed by the qualification script.
- The 112 prior tests plus six new isolated-profile tests are expected to run together, for 118 in total. The user has not yet qualified the six new tests on Windows.
- It is not a RAM reduction of the full AIL stack, a production scheduler, or a hard operating-system-enforced process limit.
- Live HIBP public catalogue access must separately receive operator authorization and remain outside the mock benchmark. A model or remote input must not be able to assert `operatorApproved:true` as if it were authenticated.
- Existing Qwen, REA, Ollama, Fun Industrial dashboard, and Electron systems are not started, stopped, killed, or restarted.
- A real provider catalogue may contain multiple records and more metadata; no performance claims about live catalogue parsing follow from a three-record mock.

## Qualification

Switch the **existing test-only RAEM-008 checkout** to `feature/fun-raem-008b-balanced-offline-20261112` only when its git working tree is clean. Run the previous 10 test files, add `intelligence-checks/resource-aware-catalogue-balanced-case.mjs` for 6 new tests, then manually run `node scripts/Qualify-Fun-RAEM008.mjs`.

Expected demo:
- `RAEM_008_BASELINE`: 3 catalogued records, reported as a baseline rather than new
- `RAEM_008_EARLY`: `REFRESH_NOT_DUE`; zero mock network calls
- `RAEM_008_RECONCILED`: one new, one modified, one unchanged, one absent from the latest mock snapshot
- `RAEM_008_RESULT=PASS` and `TEMP_FILES_CLEANED`

If headroom or CPU limits fail, `RAEM_008_RESULT=HOLD` remains the correct outcome.
