# FI_WORKFLOW_OPTIMIZATION_UPGRADE_V1 — guarded offline solver integration only.
# Back up and replace the workflow coordinator, add adapter. Leave CLI, data, processes untouched.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Root=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Workflow=Join-Path $Live 'src\workflows'
$Installed=Join-Path $Workflow 'coordinator.mjs'
$Added=Join-Path $Workflow 'optimization-step.mjs'
$ExistingCli=Join-Path $Workflow 'cli.mjs'
$OriginalVersion='ff962d97bbd152f728fe8bdd493957a31503bc97'
$CliVersion='4e82c185bc896da83cdb45634d8fd55f0786ee6f'
$SourceCoordinator=Join-Path $Root 'src\workflows\coordinator.mjs'
$SourceAdapter=Join-Path $Root 'src\workflows\optimization-step.mjs'
$Test=Join-Path $Root 'intelligence-checks\workflow-optimization-case.mjs'
$PreviousTest=Join-Path $Root 'intelligence-checks\workflow-coordinator-case.mjs'
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Git=(Get-Command git.exe -ErrorAction Stop).Source
$Base=Join-Path $env:LOCALAPPDATA 'FunIndustrial\WorkflowRuntime\upgrade-backups'
$Backup=Join-Path $Base ((Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$Ports=@(8789,8791,8088,4479,8443)
$created=$false;$backedUp=$false
function Hold([string]$reason){throw ('FUN_WORKFLOW_OPTIMIZATION_HOLD='+$reason)}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
 ForEach-Object { "$($_.LocalAddress):$($_.OwningProcess)" } | Sort-Object) -join ',')
}
foreach($dir in @($Root,$Workflow,(Join-Path $Live 'src\optimization'),(Join-Path $Root 'src\workflows'))){
 if(-not(Test-Path -LiteralPath $dir -PathType Container)){Hold ('DIRECTORY_MISSING_'+$dir)}
 if((Get-Item -LiteralPath $dir).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_DIRECTORY_DENIED'}
}
foreach($f in @($SourceCoordinator,$SourceAdapter,$Installed,$ExistingCli,$Test,$PreviousTest,(Join-Path $Live 'src\optimization\runner.mjs'))){
 if(-not(Test-Path -LiteralPath $f -PathType Leaf)){Hold ('MISSING_'+$f)}
 if((Get-Item -LiteralPath $f).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_FILE_DENIED'}
}
if(Test-Path -LiteralPath $Added){Hold 'ADAPTER_ALREADY_INSTALLED_REQUIRES_REVIEW'}
$seen=(& $Git -C $Root hash-object --path=src/workflows/coordinator.mjs -- $Installed)
if($LASTEXITCODE -ne 0 -or $seen.Trim() -ne $OriginalVersion){Hold 'LIVE_COORDINATOR_V1_BASELINE_MISMATCH'}
$seenCli=(& $Git -C $Root hash-object --path=src/workflows/cli.mjs -- $ExistingCli)
if($LASTEXITCODE -ne 0 -or $seenCli.Trim() -ne $CliVersion){Hold 'LIVE_CLI_BASELINE_MISMATCH'}
$sourceContent=[IO.File]::ReadAllText($SourceCoordinator)
$adapterContent=[IO.File]::ReadAllText($SourceAdapter)
if(-not $sourceContent.Contains('FI_WORKFLOW_OPTIMIZATION_INTEGRATION_V1') -or
 -not $adapterContent.Contains('FI_WORKFLOW_OPTIMIZATION_V1')){Hold 'SOURCE_VERSION_UNRECOGNIZED'}
if(-not ([IO.File]::ReadAllText($Installed)).Contains('FI_SOFTWARE_FIRST_COORDINATOR_V1')){Hold 'LIVE_COORDINATOR_MARKER_INVALID'}
$before=@{}
foreach($port in $Ports){$before[$port]=Snapshot $port}
foreach($f in @($SourceCoordinator,$SourceAdapter)){
 & $Node --check $f
 if($LASTEXITCODE -ne 0){Hold 'SOURCE_SYNTAX'}
}
& $Node --test $PreviousTest $Test
if($LASTEXITCODE -ne 0){Hold 'WORKFLOW_TESTS_FAILED'}
New-Item -ItemType Directory -Path $Backup -Force -ErrorAction Stop|Out-Null
$Previous=Join-Path $Backup 'coordinator.before.mjs'
Copy-Item -LiteralPath $Installed -Destination $Previous -ErrorAction Stop
$backedUp=$true
try{
 Copy-Item -LiteralPath $SourceAdapter -Destination $Added -ErrorAction Stop
 $created=$true
 Copy-Item -LiteralPath $SourceCoordinator -Destination $Installed -Force -ErrorAction Stop
 if((Get-FileHash $SourceCoordinator).Hash -ne (Get-FileHash $Installed).Hash -or
    (Get-FileHash $SourceAdapter).Hash -ne (Get-FileHash $Added).Hash){Hold 'LIVE_SOURCE_HASH_MISMATCH'}
 foreach($f in @($Installed,$Added)){
  & $Node --check $f
  if($LASTEXITCODE -ne 0){Hold 'INSTALLED_SYNTAX'}
 }
 foreach($port in $Ports){if((Snapshot $port) -cne $before[$port]){Hold ('PROTECTED_SERVICE_CHANGED_'+$port)}}
 Write-Host 'FUN_WORKFLOW_OPTIMIZATION_UPGRADE=PASS OPTUNA_OR_TOOLS=ADAPTER_INSTALLED CHECKPOINTS=PRESERVED MODEL=EXTERNAL REA=UNTOUCHED SERVICES=UNCHANGED'
 Write-Host ('FUN_WORKFLOW_OPTIMIZATION_BACKUP='+$Backup)
}catch{
 $why=$_.Exception.Message
 if($backedUp){Copy-Item -LiteralPath $Previous -Destination $Installed -Force -ErrorAction SilentlyContinue}
 if($created){Remove-Item -LiteralPath $Added -Force -ErrorAction SilentlyContinue}
 Write-Warning ('FUN_WORKFLOW_OPTIMIZATION_ROLLBACK=ATTEMPTED REASON='+$why)
 throw ('FUN_WORKFLOW_OPTIMIZATION_DEPLOY_HOLD='+$why+' BACKUP='+$Backup)
}
