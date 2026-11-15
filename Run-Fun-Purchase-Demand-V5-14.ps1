# FIAL5.14: prior verified FIAL5.13 executive chain + read-only
# exact official VVTA IFB and Addendum public-document observation.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Prior=Join-Path $HOME 'FunIndustrial-FIAL513-Buyer\Run-Fun-Buyer-V5-13.ps1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Purchase-Demand-V5-14.mjs'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$why){throw ('FIAL514_SCHEDULED_CYCLE_HOLD='+$why)}
foreach($p in @($Prior,$Worker)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_SOURCE_NOT_FOUND='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold 'UNTRUSTED_SYMLINK'}
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$mutex=[Threading.Mutex]::new($false,'Local\FunIndustrial-PurchaseDemandV514')
$locked=$false
try{
 try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){Write-Host 'FIAL514_CYCLE=ALREADY_RUNNING_NO_DUPLICATE';return}
 $started=[DateTimeOffset]::UtcNow
 $logs=Join-Path $Data 'PurchaseDemandV514\logs'
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $log=Join-Path $logs ('cycle-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 & $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Prior *>&1|
  Tee-Object -FilePath $log
 if($LASTEXITCODE -ne 0){Hold ('PRIOR_FIAL513_CYCLE_FAILED_LOG='+$log)}
 $priorFile=Join-Path $Data 'FleetBuyerV513\last-buyer-cycle-v1.json'
 if(!(Test-Path -LiteralPath $priorFile -PathType Leaf)){Hold 'FIAL513_EVIDENCE_MISSING'}
 $b=Get-Content -LiteralPath $priorFile -Raw|ConvertFrom-Json
 if($b.version -cne 'fial5.13-verified-fleet-buyer-v1' -or
  [DateTimeOffset]::Parse([string]$b.as_of_utc) -lt $started.AddSeconds(-4) -or
  $b.counts.verified_open_repair_bids -ne 0 -or $b.boundaries.rea_calls -ne 0 -or
  $b.boundaries.emails_sent -ne 0){Hold 'FIAL513_PREVIOUS_CYCLE_AUTHORITY_INVALID'}
 & $Node $Worker --once *>&1|Tee-Object -FilePath $log -Append
 if($LASTEXITCODE -ne 0){Hold ('VVTA_OFFICIAL_SOURCE_CHECK_FAILED_LOG='+$log)}
 $file=Join-Path $Data 'PurchaseDemandV514\last-purchase-demand-cycle-v1.json'
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold 'FIAL514_PURCHASING_RECEIPT_MISSING'}
 $r=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
 if($r.version -cne 'fial5.14-official-purchase-demand-v1' -or
  [DateTimeOffset]::Parse([string]$r.as_of_utc) -lt $started.AddSeconds(-4) -or
  $r.notice.solicitation -cne 'IFB 2027-01' -or
  $r.counts.current_maintenance_rfps_verified -ne 0 -or
  $r.counts.qualified_elektron_bids -ne 0 -or
  $r.counts.awarded_contracts -ne 0 -or
  $r.boundaries.emails_sent -ne 0 -or $r.boundaries.phone_calls -ne 0 -or
  $r.boundaries.vendor_accounts_created -ne 0 -or
  $r.boundaries.site_visits -ne 0 -or $r.boundaries.bids_submitted -ne 0 -or
  $r.boundaries.models_started -ne 0 -or $r.boundaries.model_calls -ne 0 -or
  $r.boundaries.rea_calls -ne 0){Hold 'FIAL514_PURCHASING_RECEIPT_AUTHORITY_INVALID'}
 Write-Host ('FIAL514_SCHEDULED_PUBLIC_DEMAND=PASS SOURCES='+$r.counts.official_sources+
  ' CHECKED='+$r.counts.checked_this_cycle+
  ' RETRIEVED='+$r.counts.documents_retrieved+
  ' HOLDS='+$r.counts.source_holds+' OPEN_MAINTENANCE_RFPS=0')
 Write-Host 'FIAL514_BIDS_EMAIL_CALL_VENDOR_REGISTRATION_MODELS_REA=ZERO'
 Write-Host ('FIAL514_RECEIPT='+$file)
}finally{
 if($locked){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
