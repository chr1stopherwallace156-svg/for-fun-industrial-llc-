# FIAL5.14 keeps the reviewed executive chain first, then bounded public
# BCSD active index / CEC / ZESBI checks. No agency contact, grants or bids.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Prior=Join-Path $HOME 'FunIndustrial-FIAL513-Buyer\Run-Fun-Buyer-V5-13.ps1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Purchase-Demand-V5-14.mjs'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$why){throw ('FIAL514_SCHEDULED_CYCLE_HOLD='+$why)}
foreach($file in @($Prior,$Worker)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('SOURCE_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'SYMLINK'}
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$mutex=[Threading.Mutex]::new($false,'Local\FunIndustrial-PurchaseDemandV514')
$lock=$false
try{
 try{$lock=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$lock=$true}
 if(!$lock){Write-Host 'FIAL514_CYCLE=ALREADY_RUNNING_NO_DUPLICATE';return}
 $started=[DateTimeOffset]::UtcNow
 $logs=Join-Path $Data 'PurchaseDemandV514\logs'
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $log=Join-Path $logs ('scheduled-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 & $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Prior *>&1|Tee-Object -FilePath $log
 if($LASTEXITCODE -ne 0){Hold ('PREVIOUS_FIAL513_CYCLE_FAILED_LOG='+$log)}
 $priorReceipt=Join-Path $Data 'FleetBuyerV513\last-buyer-cycle-v1.json'
 if(!(Test-Path -LiteralPath $priorReceipt -PathType Leaf)){Hold 'PREVIOUS_BUYER_RECEIPT_MISSING'}
 $buyer=Get-Content -LiteralPath $priorReceipt -Raw|ConvertFrom-Json
 if($buyer.version -cne 'fial5.13-verified-fleet-buyer-v1' -or
  [DateTimeOffset]::Parse([string]$buyer.as_of_utc) -lt $started.AddSeconds(-4) -or
  $buyer.counts.verified_revenue_usd -ne 0 -or
  $buyer.boundaries.emails_sent -ne 0 -or $buyer.boundaries.rea_calls -ne 0){
  Hold 'PREVIOUS_BUYER_EVIDENCE_INVALID'
 }
 & $Node $Worker --once *>&1|Tee-Object -FilePath $log -Append
 if($LASTEXITCODE -ne 0){Hold ('PUBLIC_DEMAND_CYCLE_FAILED_LOG='+$log)}
 $receipt=Join-Path $Data 'PurchaseDemandV514\last-demand-cycle-v1.json'
 if(!(Test-Path -LiteralPath $receipt -PathType Leaf)){Hold 'DEMAND_RECEIPT_MISSING'}
 $r=Get-Content -LiteralPath $receipt -Raw|ConvertFrom-Json
 if($r.version -cne 'fial5.14-real-purchase-demand-v1' -or
  [DateTimeOffset]::Parse([string]$r.as_of_utc) -lt $started.AddSeconds(-4) -or
  $r.counts.verified_live_ev_repair_rfps -ne 0 -or
  $r.counts.buyer_orders -ne 0 -or $r.counts.actual_revenue_usd -ne 0 -or
  $r.counts.verified_funded_district_awards -ne 0 -or
  $r.boundaries.emails_sent -ne 0 -or
  $r.boundaries.bids_submitted -ne 0 -or
  $r.boundaries.vendor_accounts_created -ne 0 -or
  $r.boundaries.applications_filed -ne 0 -or
  $r.boundaries.rea_calls -ne 0 -or $r.boundaries.model_calls -ne 0){
  Hold 'DEMAND_RECEIPT_AUTHORITY_INVALID'
 }
 Write-Host ('FIAL514_SCHEDULED_PUBLIC_DEMAND=PASS SOURCES='+$r.counts.official_sources+
  ' RETRIEVED='+$r.counts.documents_retrieved+
  ' HOLDS='+$r.counts.source_holds+
  ' TRUE_BUYER_ORDERS=0 GRANT_AWARDS=0')
 Write-Host 'FIAL514_NO_EMAIL_BID_VENDOR_GRANT_PAYMENT_MODEL_REA=TRUE'
 Write-Host ('FIAL514_RECEIPT='+$receipt)
}finally{
 if($lock){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
