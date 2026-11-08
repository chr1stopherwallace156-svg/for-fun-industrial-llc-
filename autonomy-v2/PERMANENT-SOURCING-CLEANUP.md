# Fun Industrial — Permanently Delete Domestic/International Sourcing From Windows

The operator explicitly requested recovering real disk space, NOT merely disabling domestic and international source scans. This is destructive, irreversible local cleanup of the exact allowlisted sourcing-only artifacts; do not imply that deleting GitHub branch history or local AI models is part of the request.

## Staged operation

1. Pull the GitHub retirement branch. The 9 retirement tests run before any live-file changes; the CRLF/CRCRLF guard is included.
2. Apply the 5-file guarded retirement to the existing platform and worker (8789 and 8792); verify all 6 sourcing APIs return HTTP 410, REA still has 229 tools, and unrelated research is available. This step has an attempted rollback before purge.
3. Run Purge-Sourcing-From-Computer.ps1. It checks retired live routes and REA health again BEFORE deleting; it enumerates and measures candidates, removes allowlisted sourcing-only files/old clones/data/backup directories, and verifies health again.
4. Delete the original retirement checkout from the parent shell, only after successful purge and only if git status is clean. The GitHub source remains archived online.

## One PowerShell command after previous failed attempts

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Sourcing-Retirement';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_FAILED'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Retire-Sourcing.ps1');if($LASTEXITCODE -ne 0){throw 'SOURCING_RETIREMENT_FAILED'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Purge-Sourcing-From-Computer.ps1');if($LASTEXITCODE -ne 0){throw 'SOURCING_PURGE_FAILED'};$dirty=(& git -C $d status --porcelain=v1 --untracked-files=all | Out-String).Trim();if($LASTEXITCODE -eq 0 -and -not $dirty){Remove-Item -LiteralPath $d -Recurse -Force -ErrorAction Stop;Write-Host 'RETIREMENT_CHECKOUT_DELETED=PASS'}else{Write-Warning 'RETIREMENT_CHECKOUT_PRESERVED_LOCAL_CHANGES'};Write-Host 'FINISHED_SOURCING_RETIREMENT_AND_DISK_PURGE'
```

## Delete scope

Known clean GitHub checkouts only: FunIndustrial-US-Opportunities, FunIndustrial-International-Sourcing, FunIndustrial-Asia-Sourcing and the clean retirement checkout after execution. Clones with the wrong git remote, dirty state, reparse points or AI model files are NOT deleted.

Under %LOCALAPPDATA%\FunIndustrial\AutonomyLab\autonomy-v2-github only: sourcing adapters, importers, sourcing tests, and source-named domestic/GSA/grants/SAM/international/Asia snapshots. Sourcing-only old deployment backups: DomesticBackups, GsaBridgeBackups, InternationalBackups, AsiaSupplierBackups, and SourcingRetirementBackups. Historic sourcing-only logs are removed.

Excluded: the entire active FunIndustrial-REA-MCP-Activation folder, all REA tools and executions, SQLite jobs DB, general software-release research, operator task list, generic product records, llama.cpp, Qwen model weights, Elektron Ollama, NetBird, other user files, and GitHub remote repository history. A tiny no-op legacy DomesticScan class remains in the active job file so persisted SQLite jobs cannot accidentally scan or crash.

## Preview without deleting

```powershell
$d=Join-Path $env:USERPROFILE 'FunIndustrial-Sourcing-Retirement';& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Purge-Sourcing-From-Computer.ps1') -PreviewOnly
```

The preview requires the retirement to be fully deployed and healthy. You cannot use it before retirement succeeds.

## Storage receipts

The deletion script prints SOURCING_PURGE=PASS, REMOVED, SKIPPED, LOGICAL_RECLAIMED_MIB, and DISK_FREE_CHANGE_MIB; it writes a JSON receipt to %LOCALAPPDATA%\FunIndustrial\Logs\sourcing-purge-receipt-*.json. Logical deleted bytes are NOT identical to disk-free delta. Size savings are not known before local execution and may be much smaller than 1 GB.

WARNING: once cleanup removes local snapshots and historical backups, they cannot be restored from the remaining local installation. Repository source is preserved on GitHub, but previously imported local data may not exist there.
