# FIAL5.13: verified official buyer evidence + existing four-trigger
# schedule + reviewed only-8802 dashboard and Qwen live check.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Install=Join-Path $Root 'Install-Fun-Buyer-V5-13.ps1'
$Deploy=Join-Path $Root 'Deploy-Fun-FIAL513-PrimaryDashboard.ps1'
function Hold([string]$why){throw ('FIAL513_ALL_IN_ONE_HOLD='+$why)}
foreach($p in @($Install,$Deploy)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('SCRIPT_MISSING='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_SCRIPT_REFUSED='+$p)
 }
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Install
if($LASTEXITCODE -ne 0){Hold 'OFFICIAL_SOURCE_CYCLE_OR_SCHEDULE_NOT_VERIFIED'}
Write-Host 'FIAL513_PHASE_1=REAL_PUBLIC_BUYER_EVIDENCE_AND_SCHEDULER_PASS'
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){Hold 'REVIEWED_DASHBOARD_OR_QWEN_LIVE_HOLD'}
Write-Host 'FIAL513_PHASE_2=PRIMARY_DASHBOARD_AND_QWEN_PASS'
$u='http://127.0.0.1:8802'
$buyer=Invoke-RestMethod ($u+'/api/operator/buyer/status') -TimeoutSec 15
$bid=Invoke-RestMethod ($u+'/api/operator/bid-readiness/status') -TimeoutSec 15
$fit=Invoke-RestMethod ($u+'/api/operator/fit/status') -TimeoutSec 15
$proc=Invoke-RestMethod ($u+'/api/operator/procurement/status') -TimeoutSec 15
$fleet=Invoke-RestMethod ($u+'/api/operator/fleet/status') -TimeoutSec 15
$reg=Invoke-RestMethod ($u+'/api/operator/regulatory/status') -TimeoutSec 15
$task=Get-ScheduledTask -TaskName 'FunIndustrial-Executive-Operator-V1' -ErrorAction Stop
if($buyer.version -cne 'fial5.13-verified-fleet-buyer-v1' -or
 $buyer.buyer.id -cne 'bakersfield-city-school-district' -or
 $buyer.counts.verified_open_repair_bids -ne 0 -or
 $buyer.counts.verified_service_orders -ne 0 -or
 $buyer.counts.verified_revenue_usd -ne 0 -or
 $buyer.boundaries.emails_sent -ne 0 -or $buyer.boundaries.rea_calls -ne 0 -or
 $bid.version -cne 'fial5.12-bid-readiness-v1' -or
 $fit.version -cne 'fial5.11-commercial-fit-v1' -or
 $proc.version -cne 'fial5.10-published-procurement-v1' -or
 $fleet.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
 $reg.source_catalog_version -cne 'fial5.8.1-regulatory-catalog-2026-amendment-v1' -or
 @($task.Triggers).Count -ne 4){Hold 'FINAL_BUYER_SYSTEM_OR_AUTHORITY_INVALID'}
Write-Host ('FIAL513_PUBLIC_BUYER_EVIDENCE='+$buyer.decision.buyer_evidence_state)
Write-Host ('FIAL513_OFFICIAL_SOURCES_CURRENT='+$buyer.counts.current_sources)
Write-Host ('FIAL513_VERIFIED_PUBLIC_BUYER_PATHWAYS='+$buyer.counts.verified_public_buyer_pathways)
Write-Host 'FIAL513_VERIFIED_EV_BUSES_OR_SERVICE_NEED=NOT_ESTABLISHED'
Write-Host 'FIAL513_VERIFIED_PURCHASE_ORDERS_AND_REVENUE=ZERO'
Write-Host 'FIAL513_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host 'FIAL513_EMAIL_CALL_VENDOR_REGISTRATION_SITE_VISIT_REA=ZERO'
Write-Host ('FIAL513_OPERATIONS='+$u+'/operations/')
Write-Host ('FIAL513_CHAT='+$u+'/unified/?view=chat')
Write-Host 'FIAL513_ALL_IN_ONE=PASS'
