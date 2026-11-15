# FIAL5.9: preserve the existing FIAL5.8.1 executive cycle and add
# source-specific TTL fleet prospect monitoring. No task creation, no chat model.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$PriorRoot=Join-Path $HOME 'FunIndustrial-FIAL581-DataIntegrity'
$PriorRunner=Join-Path $PriorRoot 'Run-Fun-Regulatory-Economic-V5-8.ps1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Fleet-Opportunity-V5-9.mjs'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
$OldReceipt=Join-Path $Data 'RegulatoryEconomicV58\last-intelligence-v1.json'
$FleetReceipt=Join-Path $Data 'FleetOpportunityV59\last-fleet-cycle-v1.json'
function Hold([string]$reason){throw ('FIAL59_SCHEDULED_CYCLE_HOLD='+$reason)}
foreach($file in @($PriorRunner,$Worker)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('SOURCE_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold 'UNREVIEWED_SYMLINK'
 }
}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$mutex=[Threading.Mutex]::new($false,'Local\FunIndustrial-FleetOpportunityV59')
$locked=$false
try{
 try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){Write-Host 'FIAL59_CYCLE=ALREADY_RUNNING_NO_DUPLICATE';return}
 $start=[DateTimeOffset]::UtcNow
 $logs=Join-Path $Data 'FleetOpportunityV59\logs'
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $log=Join-Path $logs ('scheduled-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 & $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $PriorRunner *>&1|Tee-Object -FilePath $log
 if($LASTEXITCODE -ne 0){Hold ('PRIOR_FIAL581_CYCLE_FAILED_LOG='+$log)}
 if(!(Test-Path -LiteralPath $OldReceipt -PathType Leaf)){Hold 'PRIOR_REGULATORY_RECEIPT_MISSING'}
 $reg=Get-Content -LiteralPath $OldReceipt -Raw|ConvertFrom-Json
 if($reg.version -cne 'fial5.8-regulatory-economic-v1' -or
  $reg.source_catalog_version -cne 'fial5.8.1-regulatory-catalog-2026-amendment-v1' -or
  $reg.boundaries.emails_sent -ne 0 -or
  [DateTimeOffset]::Parse([string]$reg.as_of_utc) -lt $start.AddSeconds(-4)){
  Hold 'PRIOR_FIAL581_EVIDENCE_INVALID'
 }
 & $Node $Worker --once *>&1|Tee-Object -FilePath $log -Append
 if($LASTEXITCODE -ne 0){Hold ('FLEET_EVIDENCE_WORKER_FAILED_LOG='+$log)}
 if(!(Test-Path -LiteralPath $FleetReceipt -PathType Leaf)){Hold 'FLEET_RECEIPT_MISSING'}
 $r=Get-Content -LiteralPath $FleetReceipt -Raw|ConvertFrom-Json
 if($r.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
  $r.counts.verified_open_rfps -ne 0 -or $r.counts.awarded_contracts -ne 0 -or
  $r.boundaries.emails_sent -ne 0 -or $r.boundaries.filed_forms -ne 0 -or
  $r.boundaries.orders_placed -ne 0 -or $r.boundaries.model_calls -ne 0 -or
  $r.boundaries.rea_calls -ne 0 -or
  [DateTimeOffset]::Parse([string]$r.last_cycle_utc) -lt $start.AddSeconds(-4)){
  Hold 'FLEET_RECEIPT_AUTHORITY_OR_FRESHNESS_INVALID'
 }
 Write-Host ('FIAL59_SCHEDULED_FLEET_RESEARCH=PASS SOURCES='+$r.counts.official_sources+
  ' CHECKED='+$r.counts.checked+' HELD='+$r.counts.held+
  ' HISTORICAL_PROSPECTS='+$r.counts.named_prospects)
 Write-Host 'FIAL59_NO_EMAIL_NO_FORM_NO_SALES_CLAIM_NO_REA=TRUE'
 Write-Host ('FIAL59_FLEET_EVIDENCE='+$FleetReceipt)
}finally{
 if($locked){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
