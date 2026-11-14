# FIAL5.6 one scheduled business-competence cycle, reusing the trusted
# FIAL5.5 worker. No service changes, code writes or external actions.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$OldRoot=Join-Path $HOME 'FunIndustrial-FIAL55-RealBusiness'
$Prior=Join-Path $OldRoot 'Run-Fun-Real-Operations-V5-5.ps1'
$Source=Join-Path $Root 'scripts\Run-Fun-Business-Competence-V5-6.mjs'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
$Receipt=Join-Path $Data 'BusinessCompetenceV56\last-cycle.json'
function Hold([string]$reason){throw ('FIAL56_CYCLE_HOLD='+$reason)}
foreach($p in @($Prior,$Source)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('SOURCE_MISSING='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'SOURCE_LINK_REFUSED'}
}
$NodeExe=(Get-Command node.exe -ErrorAction Stop).Source
$PSExe=(Get-Command powershell.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $Data -Force|Out-Null
$guard=[Threading.Mutex]::new($false,'Local\FunIndustrial-BusinessCompetenceV56')
$locked=$false
try{
 try{$locked=$guard.WaitOne(0)}
 catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){Write-Host 'FIAL56_ALREADY_RUNNING_NO_DUPLICATE';return}
 $logs=Join-Path $Data 'BusinessCompetenceV56\logs'
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $log=Join-Path $logs ('cycle-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 $startedAt=[DateTimeOffset]::UtcNow
 & $PSExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Prior *>&1|Tee-Object -FilePath $log
 if($LASTEXITCODE -ne 0){Hold ('PRIOR_REAL_OPERATIONS_FAILED_LOG='+$log)}
 $realFile=Join-Path $Data 'RealWorkV55\last-real-cycle.json'
 if(!(Test-Path -LiteralPath $realFile -PathType Leaf)){Hold 'UPSTREAM_REAL_WORK_RECEIPT_MISSING'}
 $real=Get-Content -LiteralPath $realFile -Raw|ConvertFrom-Json
 $realTime=[DateTimeOffset]::Parse([string]$real.when_utc)
 if($real.version -cne 'fial5.5-real-business-operations-v1' -or
  $realTime -lt $startedAt.AddSeconds(-4) -or
  $real.emails_sent -ne 0 -or $real.government_filings -ne 0 -or
  $real.rea_executions -ne 0 -or $real.payments -ne 0){Hold 'UPSTREAM_REAL_WORK_RECEIPT_STALE_OR_INVALID'}
 & $NodeExe $Source --once *>&1|Tee-Object -FilePath $log -Append
 if($LASTEXITCODE -ne 0){Hold ('BUSINESS_COMPETENCE_WORKER_FAILED_LOG='+$log)}
 if(!(Test-Path -LiteralPath $Receipt -PathType Leaf)){Hold 'BUSINESS_COMPETENCE_RECEIPT_MISSING'}
 $out=Get-Content -LiteralPath $Receipt -Raw|ConvertFrom-Json
 $stamp=[DateTimeOffset]::Parse([string]$out.cycle_utc)
 if($out.version -cne 'fial5.6-business-operator-v1' -or
  $stamp -lt $realTime.AddSeconds(-2) -or
  $out.actions.mail_sent -ne 0 -or $out.actions.government_filings -ne 0 -or
  $out.actions.purchases -ne 0 -or $out.actions.code_mutations -ne 0 -or
  $out.actions.rea_executions -ne 0 -or $out.actions.model_invocations -ne 0){
  Hold 'COMPETENCE_RECEIPT_AUTHORITY_OR_TIME_MISMATCH'
 }
 Write-Host ('FIAL56_REAL_SCHEDULED_CYCLE=PASS TRACKED='+$out.tracked_tasks+
  ' LOCAL_PACKETS_NEW='+$out.packets_created)
 Write-Host 'FIAL56_MODEL_STARTS=0 EMAIL_SENDS=0 FILINGS=0 PAYMENTS=0 REA=0 CODE_CHANGES=0'
 Write-Host ('FIAL56_CYCLE_RECEIPT='+$Receipt)
}finally{
 if($locked){$guard.ReleaseMutex()}
 $guard.Dispose()
}
