# Fun Industrial — FISRE V4 Source-Bound Replay Qualification

**Scope:** isolated, offline, additive research branch based on Windows-qualified FISRE V3. No changes to live Fun Industrial processes, 8802 dashboard, Qwen, REA, policies, startups, memory persistence, or Elektron.

## What V4 does

An uploaded/supplied JSON report can be structurally valid yet forged. V4 adds a **read-only, source-bound replay gate** for V2 mathematical reports:

1. Operator selects a reviewed, regular Python source file beneath an explicit local root (same file-reader and safety boundaries as V1).
2. V4 accepts up to 64 KiB of JSON via stdin and checks that it is a V2 proof report with the exact supported schema, no source execution, no external actions, and no authority grants.
3. Recomputes SHA-256 over the exact inspected source text and demands a match with the report's claimed source digest.
4. Reconstructs the input ranges from the report, runs **the existing V2 rational analyzer again** against the selected original source, and compares the whole canonicalized report, including proof statuses, domain, minimum/maximum bounds, witness values, source hash, and file.
5. Outputs `SOURCE_BOUND_REPLAY_MATCH` only if the source and replayed report match. Otherwise exits with `HOLD` (code 2). The selected target is never imported or executed.

**Critical limitation:** Replaying the **same V2 algorithm** is not an independent proof and does not authenticate the author/publisher. A bug in V2 could repeat during replay. V4 therefore explicitly returns `independently_proved=false`, `publisher_authenticated=false`, and `cognitive_fact_promoted=false`. A replay match must not autonomously promote V3 cognitive proposals to established facts or permit tool execution.

## Windows qualification

Clone `feature/fun-semantic-source-bound-v4-20261122` to a separate folder. From its root:

```powershell
py -3.12 -m unittest discover -s intelligence-checks -p 'test_fisre*.py' -v
node --test intelligence-checks/fisre-evidence-v3-case.mjs
```

Expected **54 Python tests** (17 V1 + 17 V2 + 20 V4) and **18 Node tests** (V3), for a combined **72 tests**. Three integration tests require the actual V2 implementation and source files: a safe-domain replay, a full CLI tampered-status rejection, and an explicit CRLF source-hash regression. The test suite uses the production byte-preserving source reader to avoid Windows newline normalization mismatches. Windows qualification remains pending until the operator runs this on the real PC.

### One-pass pipeline (source unchanged)

```powershell
$file='intelligence-checks/fixtures/fisre_example.py'
$report=& py -3.12 src/semantic/fisre_proof_v2.py $file --root . --function calculate_price --range cost=0:1000 --range margin=0:0.5
if($LASTEXITCODE -ne 0){throw 'V2_REPORT_FAILED'}
$verified=($report -join "`n") | & py -3.12 src/semantic/fisre_source_v4.py $file --root . --function calculate_price
if($LASTEXITCODE -ne 0){throw 'V4_SOURCE_REPLAY_FAILED'}
$verified | ConvertFrom-Json | Select-Object state,reported_proof_status,selected_source_matched_report,analyzer_replay_matched,independently_proved,cognitive_fact_promoted,authority_granted
```

Expected: `state=SOURCE_BOUND_REPLAY_MATCH`, `reported_proof_status=PROVED`, matched source and replay true; independent proof, knowledge promotion and authority all false.

## Next gating steps

- Validate Windows test results and real V2 report pipeline.
- Add separate proof-validation methods (optionally solver-backed) and different source-authentication mechanisms, with clearly distinguished trust levels.
- Only after rigorous qualification, consider a read-only preview surfaced in the current 8802 dashboard, keeping operator approval and the existing UI intact.

**Not implemented:** Z3, new AI model, persistent cognitive memory, runtime symbolic execution, proof of arbitrary Python semantics, or live dashboard integration.
