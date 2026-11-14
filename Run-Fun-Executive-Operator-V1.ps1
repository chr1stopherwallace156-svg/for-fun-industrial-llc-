# FIAL5.4 one bounded local executive cycle, scheduled or operator-triggered.
# Does not start/stop models, send email, submit forms, spend or use REA.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Source=Join-Path $Root 'scripts\Run-Fun-Executive-Operator-V1.mjs'
$Storage=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$reason){throw ('FIAL54_RUN_HOLD='+$reason)}
if(!(Test-Path -LiteralPath $Source -PathType Leaf)){Hold 'RUNNER_MISSING'}
if(((Get-Item -LiteralPath $Source).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'RUNNER_REPARSE_DENIED'}
$NodeExe=(Get-Command node.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $Storage -Force|Out-Null
$mutex=[Threading.Mutex]::new($false,'Local\FunIndustrial-ExecutiveOperatorV1')
$acquired=$false
try{
 try{$acquired=$mutex.WaitOne(0)}
 catch [Threading.AbandonedMutexException]{$acquired=$true}
 if(!$acquired){Write-Host 'FIAL54_ALREADY_RUNNING=TRUE NO_DUPLICATE';return}
 $logDir=Join-Path $Storage 'logs'
 New-Item -ItemType Directory -Path $logDir -Force|Out-Null
 $log=Join-Path $logDir ('cycle-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 Push-Location $Root
 try{
  & $NodeExe $Source --once *>&1 | Tee-Object -FilePath $log
  $resultCode=$LASTEXITCODE
 }finally{Pop-Location}
 if($resultCode -ne 0){Hold ('ONE_CYCLE_FAILED_LOG='+$log)}
 $statusPath=Join-Path $Storage 'last-cycle-v1.json'
 if(!(Test-Path -LiteralPath $statusPath -PathType Leaf)){Hold 'STATE_RECEIPT_MISSING'}
 $status=Get-Content -LiteralPath $statusPath -Raw -ErrorAction Stop|ConvertFrom-Json
 if($status.version -cne 'fial5.4-executive-operator-v1' -or
  $status.outbound_permissions.email_sent -ne 0 -or
  $status.outbound_permissions.government_filings -ne 0 -or
  $status.outbound_permissions.spent_usd -ne 0 -or
  $status.outbound_permissions.rea_runs -ne 0){Hold 'EXECUTION_AUTHORITY_OR_RECEIPT_INVALID'}
 Write-Host ('FIAL54_REAL_CYCLE=PASS ITEMS='+$status.active_items+' NEW='+$status.new_or_changed)
 Write-Host ('FIAL54_LAST_RECEIPT='+$statusPath)
 Write-Host 'FIAL54_EXTERNAL_ACTIONS=ZERO'
}finally{
 if($acquired){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
