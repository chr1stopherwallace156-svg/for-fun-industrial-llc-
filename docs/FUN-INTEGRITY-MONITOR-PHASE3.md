# Fun Industrial Phase 3 — Offline Integrity Monitoring

## What Phase 3 does

Operator-controlled, on-demand file integrity checking for four explicitly scoped categories:

1. Source: selected source extensions (.py, .js, .mjs, .cjs, .ts, .tsx, .ps1, .json); recursive with exclusions.
2. Configuration: an explicit list of selected config files, including package manifests and dependency requirement lists; never secrets such as `.env`.
3. Python dependencies: `METADATA` and `RECORD` of direct `.dist-info` entries in a chosen `site-packages` directory. This checks package metadata, **not the entire contents** of installed packages or runtime imports.
4. Executables: top-level `.exe` and `.dll` files in a chosen installation directory (for the initial setup: Fun Industrial's llama.cpp directory).

Produces deterministic SHA-256-based JSON records and detects additions, removals, or content changes. Never executes monitored files, installs a service, calls a model, or makes network requests.

## Important trust model

**Do not trust a baseline because this tool created it.** The operator must first establish that the selected files represent a known-good state. Draft creation is not approval. Review the scope, capture the printed candidate SHA-256 independently (for example, offline paper, or a separately controlled secure location), then use that digest as `--expected-sha` for each verification. An untrusted machine can forge files, tool output, baselines, and checksums; this is local drift detection, not tamper-proof attestation.

Baseline candidate creation creates exactly one JSON file with exclusive create (`xb`) outside monitored roots and refuses replacing existing files. Verification is strictly read-only. Never embed the trust pin in the same baseline file.

## Windows commands from a fresh Phase 3 branch checkout

The following commands do not touch your live Fun Industrial services. Use PowerShell in the Phase 3 checkout directory.

### 1. Unit tests

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" -m unittest discover -s .\intelligence-checks -p test_integrity_monitor_v1.py -v
```

### 2. Prepare an explicit scope

These specific paths reflect the user's known local installation. Review them before use. This writes only a *scope configuration* file, not a security baseline, inside `%LOCALAPPDATA%`. It will refuse to overwrite an existing scope file.

```powershell
$Repo=(Get-Location).Path; $Local=Join-Path $env:LOCALAPPDATA 'FunIndustrial\SecurityIntegrityV1'; New-Item -ItemType Directory -Path $Local -Force | Out-Null; $Scope=Join-Path $Local 'scope.json'; if(Test-Path -LiteralPath $Scope){throw 'SCOPE_ALREADY_EXISTS'}; $Payload=@{schema='fun.integrity.scope.v1';roots=@(@{id='app';kind='source';path=$Repo},@{id='settings';kind='config';path=$Repo;files=@('package.json','SECURITY.md','.env.example','requirements-compute.txt','requirements-optimization.txt')},@{id='deps';kind='python-deps';path=(Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\Lib\site-packages')},@{id='runtime';kind='binaries';path=(Join-Path $HOME 'FunIndustrial\.runtime\llama.cpp')})}; [IO.File]::WriteAllText($Scope,($Payload | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false)); Write-Host ('FUN_INTEGRITY_SCOPE=' + $Scope)
```

### 3. Create a candidate baseline — no approval implied

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" .\src\security\integrity_monitor.py draft --scope "$env:LOCALAPPDATA\FunIndustrial\SecurityIntegrityV1\scope.json" --output "$env:LOCALAPPDATA\FunIndustrial\SecurityIntegrityV1\candidate-baseline.json"
```

Expected state: `AWAITING_OPERATOR_PIN`, `approved_as_trusted=false`. Preserve the reported digest outside the monitored machine after checking the baseline and scope. Never overwrite the candidate to hide a difference.

### 4. Verify only after independent operator approval

```powershell
$Pin=Read-Host 'Enter reviewed SHA-256 digest stored separately'; & "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" .\src\security\integrity_monitor.py verify --baseline "$env:LOCALAPPDATA\FunIndustrial\SecurityIntegrityV1\candidate-baseline.json" --expected-sha $Pin
```

`PASS` means only that the **covered files** match that pinned snapshot. `HOLD` means either drift or incomplete/unsafe evidence. No automatic changes are made; repair or trusted baseline updates are manual and separate.

## Limitations and safety restrictions

- No watcher, service, timer, background process, autonomous repair, quarantine, REA permissions, credential access, or dashboard integration.
- A snapshot cannot reveal what happened between scans. On-demand means the operator chooses when to check.
- The source scan ignores `.git`, caches, build artifacts, virtual environments, `node_modules`, and `.runtime`. A symlink or junction found during traversals is a HOLD, not followed.
- Config is an explicit inclusion list, not a whole-secret-directory scan; `.env` is excluded.
- Python metadata checks `.dist-info/METADATA` and `RECORD`, not package content; metadata may be incomplete for some environments. Source and binary checks do not cover all possible file types or nested binary directories.
- The chosen source checkout is not automatically the active deployed source directory; validate all paths and adjust scope through a newly reviewed candidate if necessary.
- Maximum four roots, 10,000 selected files, 64 MiB/file, 512 MiB total hashed, 12 nested directories. These bounds can HOLD on legitimate large systems and should not be bypassed without qualification.
- The baseline and scope contain absolute filesystem paths and file names; keep them outside your public GitHub repository. Never store credentials or model files in evidence.
- A compromised operating system, interpreter, auditor, or local manifest can falsify measurements. Prefer a separately controlled host and trusted pin for stronger assurance.
- SHA-256 matching detects file drift, not whether baseline contents were malicious or vulnerable. Reference checks from Phase 2 remain separate.

## Acceptance criteria

CI passes all synthetic tests on both Windows and Linux, then the operator's host tests pass. Candidate generation must be reviewed independently; the verification command must return PASS on unchanged selected files and HOLD on deliberate benign modifications in a disposable fixture. Do not modify live services to create a failure test. Do not merge or deploy prior to review.
