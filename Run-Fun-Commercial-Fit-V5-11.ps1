# FIAL5.11: preserve all previous executive, regulatory, fleet & procurement
# cycles, then add independent read-only commercial source qualification.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Prior=Join-Path $HOME 'FunIndustrial-FIAL510-Procurement\Run-Fun-Procurement-V5-10.ps1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Commercial-Fit-V5-11.mjs'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$why){throw ('FIAL511_SCHEDULED_CYCLE_HOLD='+$why)}
foreach($p in @($Prior,$Worker)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('SOURCE_NOT_FOUND='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'SYMLINK'}
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$mutex=[Threading.Mutex]::new($false,'Local\FunIndustrial-CommercialFitV511')
$locked=$false
try{
 try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){Write-Host 'FIAL511_CYCLE=ALREADY_RUNNING_NO_DUPLICATE';return}
 $start=[DateTimeOffset]::UtcNow
 $logs=Join-Path $Data 'CommercialFitV511\logs'
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $log=Join-Path $logs ('scheduled-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
 & $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Prior *>&1 | Tee-Object -FilePath $log
 if($LASTEXITCODE -ne 0){Hold ('PRIOR_FIAL510_CYCLE_HOLD_LOG='+$log)}
 $priorReceipt=Join-Path $Data 'ProcurementV510\last-procurement-cycle-v1.json'
 if(!(Test-Path -LiteralPath $priorReceipt)){Hold 'PRIOR_PROCUREMENT_RECEIPT_MISSING'}
 $p=Get-Content -LiteralPath $priorReceipt -Raw|ConvertFrom-Json
 if($p.version -cne 'fial5.10-published-procurement-v1' -or
  [DateTimeOffset]::Parse([string]$p.as_of_utc) -lt $start.AddSeconds(-4) -or
  $p.boundaries.actual_rfps_submitted -ne 0 -or $p.boundaries.rea_calls -ne 0){
  Hold 'PRIOR_PROCUREMENT_RECEIPT_INVALID'
 }
 & $Node $Worker --once *>&1 | Tee-Object -FilePath $log -Append
 if($LASTEXITCODE -ne 0){Hold ('COMMERCIAL_FIT_CYCLE_FAILED_LOG='+$log)}
 $receipt=Join-Path $Data 'CommercialFitV511\last-fit-cycle-v1.json'
 if(!(Test-Path -LiteralPath $receipt -PathType Leaf)){Hold 'COMMERCIAL_FIT_RECEIPT_MISSING'}
 $r=Get-Content -LiteralPath $receipt -Raw|ConvertFrom-Json
 if($r.version -cne 'fial5.11-commercial-fit-v1' -or
  [DateTimeOffset]::Parse([string]$r.as_of_utc) -lt $start.AddSeconds(-4) -or
  $r.counts.directly_qualified_bids -ne 0 -or
  $r.counts.contracts_awarded -ne 0 -or
  $r.boundaries.rea_calls -ne 0 -or $r.boundaries.model_calls -ne 0 -or
  $r.boundaries.emails_sent -ne 0 -or $r.boundaries.bids_submitted -ne 0 -or
  $r.boundaries.applications_submitted -ne 0 -or $r.boundaries.payments -ne 0){
  Hold 'COMMERCIAL_FIT_AUTHORITY_MISMATCH'
 }
 Write-Host ('FIAL511_SCHEDULED_QUALIFICATION=PASS SOURCES='+
  $r.counts.offical_source_count+' DOCUMENTS='+$r.counts.source_docs_retrieved+
  ' HOLDS='+$r.counts.official_source_holds+' READY_BIDS=0')
 Write-Host ('FIAL511_REVIEW_EVIDENCE='+$receipt)
 Write-Host 'FIAL511_NO_EMAIL_BIDS_REA_MODELS_OR_PAYMENTS=TRUE'
}finally{
 if($locked){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
