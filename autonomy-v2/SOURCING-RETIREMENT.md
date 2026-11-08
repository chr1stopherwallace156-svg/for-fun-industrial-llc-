# Fun Industrial — Retire Domestic and International Opportunity Sourcing (reversible)

**Goal:** remove the domestic/international sourcing systems and their old user interface from the ACTIVE Windows app while keeping the general Fun Industrial system running. This is *retirement*, not destruction. The repo's history, source files and locally recorded research remain available for a future deliberate restore or audit.

## Changes

1. **8789 main dashboard** — removes the U.S. Opportunities and International Sourcing Intelligence panels, their UI event listeners and automatic refresh callbacks. Blocks `/api/autonomy/scan`, `/api/autonomy/opportunities`, and `/api/autonomy/international` with HTTP 410 / `SOURCING_RETIRED`.
2. **8792 Sidequest** — stops registering/scheduling/enqueueing `DomesticScan` jobs at startup; makes the `DomesticScan` class a no-op so *already-persisted* jobs in Sidequest SQLite cannot fetch domestic feeds or enqueue opportunity notifications. Disables the /api/opportunities and /api/international read endpoints and the manual /api/opportunities/scan POST endpoint (HTTP 410).
3. **Unchanged** — the main Fun Industrial platform, its 8789 dashboard/Autonomy status, REA catalog and current allowlist, local llama.cpp/Qwen, Ollama reserved for Elektron, NetBird, compute, product snapshots, GitHub release research, Discover/Analyze/Verify jobs, registry audit, and operator task queue.
4. **Preserved** — all SQLite/job/evidence records, GSA snapshots, imported international profiles, grant scans, raw source adapters, feature branches and previous source code. We do not delete data files, source GitHub history or credentials. Old source-specific records may remain in audit history, but no new opportunity scans occur in the retired runtime.

`autonomy-v2/scripts/retire-sourcing-transform.mjs` performs exact-anchored, fail-closed transformations of five installed files only, staging them separately and checking Node module/inline script syntax before touching live files.

`autonomy-v2/Retire-Sourcing.ps1` checks the still-running 8789 + 8792 process identities, verifies the existing 229 REA tools and enabled-tool scope, backs up the original five files, runs retirement tests, stages replacements, and restarts only the verified 8792 and 8789 Node processes. It verifies HTTP 410 on all six sourcing routes, verifies REA/research and 8789 autonomy status, and attempts rollback if something fails. It does **not** stop the local AI/llama.cpp, Ollama, or NetBird. No REA tools are executed.

**Important:** There are no tested assumptions about current Windows state until the operator runs this. The committed code and test fixtures are not evidence that the Windows deployment already succeeded. The installer will stop safely on any source/identity/permission mismatch.

## One-line PowerShell command

This uses a separate retirement checkout (does not disturb the older U.S., International or Asia GitHub clones). Run on the machine hosting the local Fun Industrial platform:

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Sourcing-Retirement';if(-not(Test-Path $d)){& git clone --depth 1 --single-branch --branch feature/retire-opportunity-sourcing-20261107 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git $d;if($LASTEXITCODE -ne 0){throw 'RETIREMENT_CLONE_FAILED'}}else{& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'RETIREMENT_PULL_FAILED'}};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Retire-Sourcing.ps1');if($LASTEXITCODE -ne 0){throw 'SOURCING_RETIREMENT_FAILED'}
```

Expected result:
```
SOURCING_RETIREMENT=PASS DOMESTIC=RETIRED INTERNATIONAL=RETIRED
DATA_DELETED=0 BACKUP=<local backup folder>
AUTONOMY=RUNNING REA_TOOL_COUNT=229 REA_ENABLED=229
```

The following simple verification must show that sourcing is actually removed, *not* zero listings with feeds still running:

```powershell
$paths=@('/api/autonomy/opportunities','/api/autonomy/international','/api/autonomy/scan');foreach($path in $paths){try{$r=Invoke-WebRequest ('http://127.0.0.1:8789'+$path) -Method $(if($path.EndsWith('/scan')){'POST'}else{'GET'}) -UseBasicParsing -ErrorAction Stop;Write-Host "$path HTTP=$($r.StatusCode)"}catch{Write-Host "$path HTTP=$([int]$_.Exception.Response.StatusCode)"}}
```

All three routes should return HTTP **410 Gone**. The original panel should be absent from `http://127.0.0.1:8789/`, and `/api/autonomy/status` and REA should still work.

## Rollback

The script prints `BACKUP=...` and saves the original five files under that path. It attempts restoration and prior-service restart if qualification fails. A manual rollback is possible using those exact backed-up files and controlled restarts, but should only be performed by the operator after inspecting any changes made since deployment. **Do not delete the backup folders or the research data.**

Future architectural direction remains undecided. This change does not invent or silently activate a replacement system; it simply frees the existing Fun Industrial runtime of domestic/international opportunity sourcing.
