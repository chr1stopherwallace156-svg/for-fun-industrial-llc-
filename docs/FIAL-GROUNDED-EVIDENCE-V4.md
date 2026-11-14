# Fun Industrial — FIAL 4 Grounded Evidence Pilot

Status: New isolated FIAL 4 branch. Existing FIAL 1/2/3 and running services are not modified by the offline pilot.

## Verified evidence chain

FIAL 4 examines the already-saved California government grant CSV; it does **not** fetch a live government page. It rechecks the SHA-256 snapshot, grant ID/title/agency, saved source fields, and the exact v0.2/v0.3 interpretations against source evidence. It reruns the deterministic FIAL 3 claim checks to reject drift or tampering. Numbers, polarity, unsupported certainty, and assertions about any company's eligibility remain on HOLD. Even a coherent paraphrase is marked `REVIEW_REQUIRED_VERIFIED_SNAPSHOT_NOT_ENTAILMENT`.

The fixed FIAL 4 language is `src/fial/programs/grant-grounded.fial`. Outputs live exclusively in `%LOCALAPPDATA%\FunIndustrial\RealApplicationWorkerV1\fial\grounded-v4\` with create-only, content-addressed JSON/Markdown case audits, a SQLite ledger and an atomic latest receipt. Existing saved FIAL 2 and FIAL 3 case files are never overwritten.

## Windows one-command isolated pilot

Paste this **entire single line** into Windows PowerShell:

```powershell
$r=Join-Path $HOME 'FunIndustrial-FIAL4';$b='feature/fial4-grounded-evidence-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r)){git clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL4_CLONE_HOLD'}};if((git -C $r remote get-url origin) -cne $u -or (git -C $r branch --show-current) -cne $b){throw 'FIAL4_REPO_HOLD'};if(@(git -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL4_LOCAL_CHANGES_HOLD'};git -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL4_UPDATE_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Run-Fun-FIAL-Grounded-V4.ps1');if($LASTEXITCODE -ne 0){throw 'FIAL4_AUDIT_HOLD'}
```

The pilot verifies origin, branch and clean source tree, runs independent local tests and deterministic FIAL 4 compiler, checks saved report presence, and then audits the saved cases. It **does not** activate or restart existing services. The Windows live pilot needs to be run by the operator; GitHub CI cannot verify the local archived grant data.

Expected final labels are `FIAL4_INDEPENDENT_TESTS=PASS`, `FIAL4_COMPILER=PASS`, `FIAL4_RUNTIME=PASS`, `FIAL4_SOURCE_GROUNDED_PILOT=PASS`. If any source or service integrity condition is not met, the runner issues a named HOLD. No retry/repair bypass is installed.

## Dashboard integration (prepared in source, NOT activated)

The new branch adds read-only `GET /api/fial/v4/status` and `GET /api/fial/v4/widget.js` routes to `scripts/Run-Fun-ML-Dashboard8802.mjs`. The existing integrated dashboard at `http://127.0.0.1:8802/` will show a summary panel only **after** an independently validated, operator-approved deployment/restart of the 8802 source on this branch. This pilot does not restart the running 8802 hub, original 8789 dashboard, unified 8798 chat, Qwen, REA, 8443 gateway, or Elektron.

The status panel performs a read-only file lookup; no model, network, REA or grant operation is triggered by viewing it.

## What FIAL 4 does not establish

- No fresh official agency-page retrieval, source freshness guarantee, complete program guidelines or company-specific eligibility decision.
- No proof of general semantic entailment or AI understanding; lexical overlap and deterministic red flags cannot solve these problems.
- No autonomous outreach, spending, application submission or REA tool execution.

Future FIAL 4B would require a separately approved official-source fetch and immutable provenance workflow, followed by independently labeled entailment/contradiction benchmarks and verified applicant-specific documentary evidence.
