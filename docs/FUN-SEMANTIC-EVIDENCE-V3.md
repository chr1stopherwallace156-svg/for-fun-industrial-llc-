# Fun Industrial — FISRE Cognitive Evidence Bridge V3

**Status:** separate offline research branch, based on Windows-qualified FISRE V2. No live 8802 dashboard modification, Qwen calls, REA access, service restarts, scheduled runs, or Elektron modifications. Windows qualification is pending.

## What is implemented

FISRE V3 accepts an **untrusted V2 rational-proof JSON report** and creates a *proposed* fact in the existing `CognitiveKernel` class. The original V2 report's identity, version, source digest, domain, division-check shape and no-action flags are validated before the cognitive kernel receives any proposal. It creates a new in-memory kernel by default; it does not change any deployed global memory or write to disk.

- Accepts only `fi-semantic-proof-v2` reports with expected `PROVED`, `COUNTEREXAMPLE_FOUND`, or `UNKNOWN` state values.
- Computes a SHA-256 digest of a bounded canonical report subset; this is **not** a digital signature, source authentication, or independent proof verification.
- Rejects malformed status, missing witnesses, false source-execution claims, extra authority, and oversized input.
- Converts every finding to `status=proposed` (not `supported`), preserving the report's original uncertainty. The kernel does not independently authenticate the observation.
- Maintains `actionsExecuted=0`, `authorityGranted=false`, `reportExecuted=false`, `persistencePerformed=false`.
- Uses Node.js standard libraries and the existing cognitive kernel. No new packages, network listeners or ML models.

**V3 is deliberately not a mathematically verified report-signature system**. Attackers could forge structurally valid reports. Before any `supported` status, independent source provenance and mathematical checking are required.

## Local PC qualification

Use a **separate clean checkout** of `feature/fun-semantic-evidence-v3-20261122`. From its root run:

```powershell
py -3.12 -m unittest discover -s intelligence-checks -p 'test_fisre*.py' -v
node --test intelligence-checks/fisre-evidence-v3-case.mjs
```

Expected: **34 Python tests** inherited from V1/V2 plus **18 V3 Node tests**, all passing locally. The JavaScript tests must also pass against the repository's real `CognitiveKernel` on Windows; passing a mock-only test would not qualify that integration.

To generate a real V2 safe-domain report in memory, pipe it to the V3 evidence bridge:

```powershell
$r=& py -3.12 src/semantic/fisre_proof_v2.py intelligence-checks/fixtures/fisre_example.py --root . --function calculate_price --range cost=0:1000 --range margin=0:0.5
if($LASTEXITCODE -ne 0){throw 'V2_PROOF_FAILED'}
$packet=($r -join "`n") | & node scripts/Run-Fun-FISRE-Evidence-V3.mjs
if($LASTEXITCODE -ne 0){throw 'V3_BRIDGE_FAILED'}
$packet | ConvertFrom-Json | Select-Object state,proofIndependentlyChecked,authorityGranted,actionsExecuted
```

Expected: `state=EVIDENCE_PROPOSED_NOT_VERIFIED`, `proofIndependentlyChecked=false`, `authorityGranted=false`, `actionsExecuted=0`.

## Security boundaries and non-goals

The CLI accepts up to 64 KiB of stdin JSON, and produces a bounded report packet. It has no URL input, arbitrary local file access, REA tool connection, dynamic JavaScript evaluation, or operating-system command execution.

This is **evidence-handling infrastructure**, not broad program understanding. It does not persist memory, prove Python runtime semantics, introduce Z3, verify report signatures or change the live dashboard. A future verified evidence adapter may run the original analyzer on operator-approved source, bind the source hash to a signed or directly trusted observation, and require an independent proof check before any fact can be promoted. Preserve operator approval for tool execution and do not automatically accept claims from model text.
