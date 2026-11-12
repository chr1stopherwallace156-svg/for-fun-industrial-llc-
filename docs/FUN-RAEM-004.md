# RAEM-004: Bounded structured-record processing

## Objective

Qualify actual JSON parsing, schema validation, domain matching and fixed-size aggregate counting using 8, 32 and 128 MiB of **synthetic** report records on the operator's Windows 16 GiB computer. RAEM-003 qualified sequential streaming SHA-256 hashes, not JSON record processing.

## Design and safeguards

- No AIL install, network, external content collection, live data-leak archives, REA calls, Ollama calls, service restarts or persistent scheduler.
- Samples available RAM and recent CPU utilization before each stage; RAEM-001 decides whether to admit the job and protects its default free-memory reserve.
- Reads synthetic data in approximately 64 KiB buffers; each record is restricted to a 2 KiB maximum length. Input is newline-delimited JSON. Missing, unknown, malformed or oversized records cause HOLD.
- Only matches explicitly allowlisted domains and predefined report categories. Outputs aggregate counts and an input SHA-256 hash; no full records or leaked personal data are retained in results.
- Checks Node process RSS and free host RAM periodically, but these are **soft observational checks**, not OS-enforced resource ceilings.
- Each benchmark stage is a foreground, operator-triggered run. No continuously polling scheduler is installed.
- The synthetic data generator fills only complete records and may produce a few hundred bytes less than the nominal target dataset size; the exact `processedBytes` is reported.
- Benchmarks generated test text, **not AIL's collectors, search indexing or databases**. Results cannot establish that full AIL runs on 16 GiB.
- Deduplication across refreshes, checkpoint persistence and genuine incident verification are not yet implemented.

## Windows verification

From a separate clone of the RAEM-004 feature branch:

```powershell
node --test .\intelligence-checks\resource-aware-manager-case.mjs .\intelligence-checks\resource-aware-stream-case.mjs .\intelligence-checks\resource-aware-scaling-case.mjs .\intelligence-checks\resource-aware-incident-case.mjs
if($LASTEXITCODE -ne 0){throw 'RAEM_TESTS_FAILED'}
node .\scripts\Qualify-Fun-RAEM004.mjs
```

Look for `RAEM_004_RESULT` and `RAEM_004_SCALING`. A HOLD due to memory pressure is a protective outcome. Keep Qwen/REA/Ollama/dashboard untouched. No merge until Windows qualification.
