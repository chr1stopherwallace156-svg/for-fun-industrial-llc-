# FIAL5.13: execute the established FIAL5.5–5.12 scheduled local work
# first, then bounded official BCSD + ZESBI public source checks only.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Prior=Join-Path $HOME 'FunIndustrial-FIAL512-BidReadiness\Run-Fun-Bid-Readiness-V5-12.ps1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Buyer-V5-13.mjs'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$why){throw ('FIAL513_SCHEDULED_CYCLE_HOLD='+$why)}
foreach($p in @($Prior,$Worker)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_SCRIPT_MISSING='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'SYMLINK'}
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$mutex=[Threading.Mutex]::new($false,'Local\FunIndustrial-FleetBuyerV513')
$locked=$false
try{
 try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){Write-Host 'FIAL513_CYCLE=ALREADY_RUNNING_NO_DUPLICATE';return}
 $started=[DateTimeOffset]::UtcNow
 $logs=Join-Path $Data 'FleetBuyerV513\logs'
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $log=Join-Path $logs ('cycle-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 & $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Prior *>&1|Tee-Object -FilePath $log
 if($LASTEXITCODE -ne 0){Hold ('PREVIOUS_FIAL512_CYCLE_FAILED_LOG='+$log)}
 $prev=Join-Path $Data 'BidReadinessV512\last-bid-readiness-cycle-v1.json'
 if(!(Test-Path -LiteralPath $prev -PathType Leaf)){Hold 'FIAL512_RECEIPT_MISSING'}
 $bid=Get-Content -LiteralPath $prev -Raw|ConvertFrom-Json
 if($bid.version -cne 'fial5.12-bid-readiness-v1' -or
  [DateTimeOffset]::Parse([string]$bid.as_of_utc) -lt $started.AddSeconds(-4) -or
  $bid.counts.verified_bid_ready -ne 0 -or $bid.boundaries.bids_submitted -ne 0 -or
  $bid.boundaries.rea_tool_calls -ne 0){Hold 'PRIOR_BID_READINESS_RECEIPT_INVALID'}
 & $Node $Worker --once *>&1|Tee-Object -FilePath $log -Append
 if($LASTEXITCODE -ne 0){Hold ('NEW_PUBLIC_BUYER_CYCLE_FAILED_LOG='+$log)}
 $path=Join-Path $Data 'FleetBuyerV513\last-buyer-cycle-v1.json'
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold 'BUYER_RECEIPT_MISSING'}
 $r=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
 if($r.version -cne 'fial5.13-verified-fleet-buyer-v1' -or
  [DateTimeOffset]::Parse([string]$r.as_of_utc) -lt $started.AddSeconds(-4) -or
  $r.buyer.id -cne 'bakersfield-city-school-district' -or
  $r.counts.verified_open_repair_bids -ne 0 -or
  $r.counts.verified_service_orders -ne 0 -or $r.counts.verified_revenue_usd -ne 0 -or
  $r.boundaries.emails_sent -ne 0 -or $r.boundaries.phone_calls_placed -ne 0 -or
  $r.boundaries.site_visits -ne 0 -or $r.boundaries.vendor_accounts_created -ne 0 -or
  $r.boundaries.model_calls -ne 0 -or $r.boundaries.rea_calls -ne 0){
  Hold 'BUYER_RECEIPT_AUTHORITY_INVALID'
 }
 Write-Host ('FIAL513_SCHEDULED_BUYER_RESEARCH=PASS SOURCES='+$r.counts.official_sources+
  ' RETRIEVED='+$r.counts.documents_retrieved+
  ' HOLDS='+$r.counts.source_holds+' DIRECT_REPAIR_ORDERS=0')
 Write-Host 'FIAL513_NO_EMAIL_CALL_BID_VENDOR_REGISTRATION_SITE_VISIT_REA=TRUE'
 Write-Host ('FIAL513_RECEIPT='+$path)
}finally{
 if($locked){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
