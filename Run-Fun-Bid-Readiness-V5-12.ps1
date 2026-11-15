# FIAL5.12: preserve all FIAL5.5–FIAL5.11 scheduled operations, append
# only public, fixed-source EVSE and school-bus vendor-readiness research.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Prior=Join-Path $HOME 'FunIndustrial-FIAL511-CommercialFit\Run-Fun-Commercial-Fit-V5-11.ps1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Bid-Readiness-V5-12.mjs'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$why){throw ('FIAL512_SCHEDULED_CYCLE_HOLD='+$why)}
foreach($p in @($Prior,$Worker)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_SCRIPT_MISSING='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'SYMLINK'}
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$mutex=[Threading.Mutex]::new($false,'Local\FunIndustrial-BidReadinessV512')
$locked=$false
try{
 try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){Write-Host 'FIAL512_CYCLE=ALREADY_RUNNING_NO_DUPLICATE';return}
 $start=[DateTimeOffset]::UtcNow
 $logs=Join-Path $Data 'BidReadinessV512\logs'
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $log=Join-Path $logs ('cycle-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 & $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Prior *>&1|Tee-Object -FilePath $log
 if($LASTEXITCODE -ne 0){Hold ('PREVIOUS_FIAL511_CYCLE_FAILED_LOG='+$log)}
 $previous=Join-Path $Data 'CommercialFitV511\last-fit-cycle-v1.json'
 if(!(Test-Path -LiteralPath $previous -PathType Leaf)){Hold 'FIAL511_RECEIPT_MISSING'}
 $fit=Get-Content -LiteralPath $previous -Raw|ConvertFrom-Json
 if($fit.version -cne 'fial5.11-commercial-fit-v1' -or
  [DateTimeOffset]::Parse([string]$fit.as_of_utc) -lt $start.AddSeconds(-4) -or
  $fit.counts.directly_qualified_bids -ne 0 -or
  $fit.boundaries.bids_submitted -ne 0 -or $fit.boundaries.rea_calls -ne 0){
  Hold 'PRIOR_COMMERCIAL_FIT_RECEIPT_INVALID'
 }
 & $Node $Worker --once *>&1|Tee-Object -FilePath $log -Append
 if($LASTEXITCODE -ne 0){Hold ('BID_EVIDENCE_CYCLE_FAILED_LOG='+$log)}
 $file=Join-Path $Data 'BidReadinessV512\last-bid-readiness-cycle-v1.json'
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold 'BID_READINESS_RECEIPT_MISSING'}
 $r=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
 if($r.version -cne 'fial5.12-bid-readiness-v1' -or
  [DateTimeOffset]::Parse([string]$r.as_of_utc) -lt $start.AddSeconds(-4) -or
  $r.counts.verified_bid_ready -ne 0 -or $r.counts.actual_revenue_usd -ne 0 -or
  $r.boundaries.emails_sent -ne 0 -or $r.boundaries.rea_tool_calls -ne 0 -or
  $r.boundaries.bids_submitted -ne 0 -or $r.boundaries.registrations_made -ne 0 -or
  $r.boundaries.model_calls -ne 0 -or $r.boundaries.payments_made -ne 0){
  Hold 'BID_READINESS_RECEIPT_AUTHORITY_OR_FRESHNESS_INVALID'
 }
 Write-Host ('FIAL512_SCHEDULED_BID_QUALIFICATION=PASS SOURCES='+$r.counts.official_sources+
  ' CHECKED='+$r.counts.checked_this_cycle+' HOLDS='+$r.counts.source_holds+
  ' PATHWAYS='+$r.counts.lead_paths+' READY_BIDS=0')
 Write-Host 'FIAL512_NO_EMAIL_BIDS_VENDOR_REGISTRATION_MODELS_REA_PAYMENTS=TRUE'
 Write-Host ('FIAL512_RECEIPT='+$file)
}finally{
 if($locked){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
