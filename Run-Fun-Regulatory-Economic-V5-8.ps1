# FIAL5.8: reuse FIAL5.7 full scheduled work; append incremental
# public official monitoring. No second task, model or external business action.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$PriorRoot=Join-Path $HOME 'FunIndustrial-FIAL57-VerifiedOutcomes'
$PriorRunner=Join-Path $PriorRoot 'Run-Fun-Verified-Outcomes-V5-7.ps1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Regulatory-Economic-V5-8.mjs'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
$Receipt=Join-Path $Data 'RegulatoryEconomicV58\last-intelligence-v1.json'
$Competence=Join-Path $Data 'BusinessCompetenceV56\last-cycle.json'
function Hold([string]$why){throw ('FIAL58_CYCLE_HOLD='+$why)}
foreach($file in @($PriorRunner,$Worker)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('SOURCE_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'UNREVIEWED_SYMLINK'}
}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $Data -Force|Out-Null
$guard=[Threading.Mutex]::new($false,'Local\FunIndustrial-RegulatoryEconomicV58')
$held=$false
try{
 try{$held=$guard.WaitOne(0)}catch [Threading.AbandonedMutexException]{$held=$true}
 if(!$held){Write-Host 'FIAL58_ALREADY_RUNNING_NO_DUPLICATE';return}
 $logs=Join-Path $Data 'RegulatoryEconomicV58\logs'
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $log=Join-Path $logs ('run-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 $start=[DateTimeOffset]::UtcNow
 & $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $PriorRunner *>&1|Tee-Object -FilePath $log
 if($LASTEXITCODE -ne 0){Hold ('PRIOR_EXECUTIVE_CYCLE_FAILED='+$log)}
 if(!(Test-Path -LiteralPath $Competence -PathType Leaf)){Hold 'PRIOR_BUSINESS_RECEIPT_MISSING'}
 $prior=Get-Content -LiteralPath $Competence -Raw|ConvertFrom-Json
 if($prior.version -cne 'fial5.6-business-operator-v1' -or
  [DateTimeOffset]::Parse([string]$prior.cycle_utc) -lt $start.AddSeconds(-4) -or
  $prior.actions.mail_sent -ne 0 -or $prior.actions.government_filings -ne 0){
  Hold 'PRIOR_BUSINESS_CYCLE_RECEIPT_INVALID'
 }
 & $Node $Worker --once *>&1|Tee-Object -FilePath $log -Append
 if($LASTEXITCODE -ne 0){Hold ('REGULATORY_CYCLE_FAILED='+$log)}
 if(!(Test-Path -LiteralPath $Receipt -PathType Leaf)){Hold 'INTELLIGENCE_RECEIPT_MISSING'}
 $r=Get-Content -LiteralPath $Receipt -Raw|ConvertFrom-Json
 if($r.version -cne 'fial5.8-regulatory-economic-v1' -or
  [DateTimeOffset]::Parse([string]$r.as_of_utc) -lt $start.AddSeconds(-4) -or
  $r.boundaries.emails_sent -ne 0 -or $r.boundaries.automatic_filing -ne 0 -or
  $r.boundaries.model_calls -ne 0 -or $r.boundaries.verified_individual_due_dates -ne 0 -or
  $r.boundaries.bid_submissions -ne 0){Hold 'INTELLIGENCE_RECEIPT_AUTHORITY_OR_TIME_INVALID'}
 Write-Host ('FIAL58_REAL_INCREMENTAL_CYCLE=PASS SOURCES='+$r.counts.monitored+
  ' FETCHED='+$r.counts.refreshed+' CHANGED='+$r.counts.source_changes+
  ' HOLDS='+$r.counts.source_holds+' BLS_SERIES='+$r.counts.economic_series)
 Write-Host 'FIAL58_NO_GMAIL_AUTHORIZATION_REQUIRED=TRUE'
 Write-Host 'FIAL58_NO_EMAIL_SEND_NO_FILINGS_NO_MODEL_CALLS=TRUE'
 Write-Host ('FIAL58_INTELLIGENCE_RECEIPT='+$Receipt)
}finally{
 if($held){$guard.ReleaseMutex()}
 $guard.Dispose()
}
