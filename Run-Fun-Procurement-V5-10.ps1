# FIAL5.10: existing FIAL5.9 full executive/regulatory/fleet run
# followed by independent official procurement GET verification.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Prior=Join-Path $HOME 'FunIndustrial-FIAL59-FleetIntel\Run-Fun-Fleet-Opportunity-V5-9.ps1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Procurement-V5-10.mjs'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$why){throw ('FIAL510_CYCLE_HOLD='+$why)}
foreach($p in @($Prior,$Worker)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('SOURCE_MISSING='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'SYMLINK'}
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$mutex=[Threading.Mutex]::new($false,'Local\FunIndustrial-ProcurementV510')
$locked=$false
try{
 try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){Write-Host 'FIAL510_CYCLE=ALREADY_RUNNING_NO_DUPLICATE';return}
 $start=[DateTimeOffset]::UtcNow
 $logs=Join-Path $Data 'ProcurementV510\logs'
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $log=Join-Path $logs ('cycle-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 & $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Prior *>&1|Tee-Object -FilePath $log
 if($LASTEXITCODE -ne 0){Hold 'PREVIOUS_FIAL59_EXECUTION_NOT_VERIFIED'}
 $fleetFile=Join-Path $Data 'FleetOpportunityV59\last-fleet-cycle-v1.json'
 if(!(Test-Path -LiteralPath $fleetFile)){Hold 'PREVIOUS_FLEET_EVIDENCE_MISSING'}
 $fleet=Get-Content -LiteralPath $fleetFile -Raw|ConvertFrom-Json
 if($fleet.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
  [DateTimeOffset]::Parse([string]$fleet.last_cycle_utc) -lt $start.AddSeconds(-4) -or
  $fleet.boundaries.rea_calls -ne 0 -or $fleet.counts.awarded_contracts -ne 0){
  Hold 'PREVIOUS_FLEET_RECEIPT_INVALID'
 }
 & $Node $Worker --once *>&1|Tee-Object -FilePath $log -Append
 if($LASTEXITCODE -ne 0){Hold ('PROCUREMENT_GET_CYCLE_FAILED_LOG='+$log)}
 $file=Join-Path $Data 'ProcurementV510\last-procurement-cycle-v1.json'
 if(!(Test-Path -LiteralPath $file)){Hold 'PROCUREMENT_RECEIPT_MISSING'}
 $r=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
 if($r.version -cne 'fial5.10-published-procurement-v1' -or
   $r.notice.solicitation_id -cne '26-27-02TR' -or
   [DateTimeOffset]::Parse([string]$r.as_of_utc) -lt $start.AddSeconds(-4) -or
   $r.counts.verified_fit_for_elektron -ne 0 -or
   $r.boundaries.actual_rfps_submitted -ne 0 -or
   $r.boundaries.emails_sent -ne 0 -or
   $r.boundaries.rea_calls -ne 0 -or $r.boundaries.model_calls -ne 0 -or
   $r.boundaries.revenue_usd -ne 0){
  Hold 'PROCUREMENT_RECEIPT_AUTHORITY_INVALID'
 }
 Write-Host ('FIAL510_SCHEDULED_PROCUREMENT=PASS SOURCES_CHECKED='+
  $r.counts.official_source_checks+' HOLDS='+$r.counts.official_source_holds+
  ' CURRENT_NOTICE='+$r.counts.verified_current_published_notices)
 Write-Host 'FIAL510_EMAILS_BIDS_PAYMENTS_REA_MODELS=ZERO'
 Write-Host ('FIAL510_RECEIPT='+$file)
}finally{
 if($locked){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
