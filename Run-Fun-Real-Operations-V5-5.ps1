# FIAL5.5 bounded local operations cycle. Task Scheduler can invoke unattended
# in user's existing logged-on session. No Qwen start, Git writes or external submissions.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Source=Join-Path $PSScriptRoot 'scripts\Run-Fun-Real-Operations-V5-5.mjs'
$Local=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
if(!(Test-Path -LiteralPath $Source -PathType Leaf)){throw 'FIAL55_SOURCE_MISSING'}
$nodeExe=(Get-Command node.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $Local -Force|Out-Null
$mutex=[Threading.Mutex]::new($false,'Local\FunIndustrial-ExecutiveOperatorV1')
$held=$false
try{
 try{$held=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$held=$true}
 if(!$held){Write-Host 'FIAL55_ALREADY_RUNNING_NO_DUPLICATE';return}
 $logs=Join-Path $Local 'logs';New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $log=Join-Path $logs ('fial55-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 Push-Location $PSScriptRoot
 try{
  & $nodeExe $Source --once *>&1|Tee-Object -FilePath $log
  $exit=$LASTEXITCODE
 }finally{Pop-Location}
 if($exit -ne 0){throw ('FIAL55_CYCLE_HOLD_LOG='+$log)}
 $receiptPath=Join-Path $Local 'RealWorkV55\last-real-cycle.json'
 if(!(Test-Path -LiteralPath $receiptPath -PathType Leaf)){throw 'FIAL55_CYCLE_RECEIPT_MISSING'}
 $receipt=Get-Content -LiteralPath $receiptPath -Raw|ConvertFrom-Json
 if($receipt.version -cne 'fial5.5-real-business-operations-v1' -or
  $receipt.emails_sent -ne 0 -or $receipt.government_filings -ne 0 -or
  $receipt.payments -ne 0 -or $receipt.rea_executions -ne 0 -or
  $receipt.applied_configs -ne 0){throw 'FIAL55_UNEXPECTED_EXTERNAL_AUTHORITY'}
 Write-Host ('FIAL55_REAL_CYCLE=PASS ARTIFACTS_NEW='+$receipt.new_local_artifacts)
 Write-Host ('FIAL55_OFFICIAL_SOURCES_FETCHED='+$receipt.official_sources.fetched+' CHANGED='+$receipt.official_sources.changed+' HELD='+$receipt.official_sources.errors)
 Write-Host ('FIAL55_REVIEW_PACKET_PATH='+$receiptPath)
 Write-Host 'FIAL55_EXTERNAL_ACTIONS=ZERO EMAIL_FILINGS_PAYMENTS_CONFIG_CHANGES_REA'
}finally{
 if($held){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
