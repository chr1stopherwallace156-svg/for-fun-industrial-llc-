# FIAL5.14 one command: existing executive work, official current demand,
# four old scheduled triggers, protected 8802/Qwen live rollout verification.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Install=Join-Path $Root 'Install-Fun-Purchase-Demand-V5-14.ps1'
$Deploy=Join-Path $Root 'Deploy-Fun-FIAL514-PrimaryDashboard.ps1'
function Hold([string]$why){throw ('FIAL514_ALL_IN_ONE_HOLD='+$why)}
foreach($p in @($Install,$Deploy)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('SCRIPT_MISSING='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_REFUSED='+$p)
 }
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Install
if($LASTEXITCODE -ne 0){Hold 'FIRST_OFFICIAL_DEMAND_AND_SCHEDULE_NOT_VERIFIED'}
Write-Host 'FIAL514_PHASE_1=SOURCE_RESEARCH_AND_SCHEDULE_PASS'
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){Hold 'REVIEWED_PRIMARY_DASHBOARD_AND_QWEN_HOLD'}
Write-Host 'FIAL514_PHASE_2=PRIMARY_DASHBOARD_AND_QWEN_PASS'
$u='http://127.0.0.1:8802'
$demand=Invoke-RestMethod ($u+'/api/operator/demand/status') -TimeoutSec 15
$buyer=Invoke-RestMethod ($u+'/api/operator/buyer/status') -TimeoutSec 15
$bid=Invoke-RestMethod ($u+'/api/operator/bid-readiness/status') -TimeoutSec 15
$fit=Invoke-RestMethod ($u+'/api/operator/fit/status') -TimeoutSec 15
$proc=Invoke-RestMethod ($u+'/api/operator/procurement/status') -TimeoutSec 15
$fleet=Invoke-RestMethod ($u+'/api/operator/fleet/status') -TimeoutSec 15
$reg=Invoke-RestMethod ($u+'/api/operator/regulatory/status') -TimeoutSec 15
$task=Get-ScheduledTask -TaskName 'FunIndustrial-Executive-Operator-V1' -ErrorAction Stop
if($demand.version -cne 'fial5.14-real-purchase-demand-v1' -or
 $demand.counts.official_sources -ne 3 -or
 $demand.counts.verified_live_ev_repair_rfps -ne 0 -or
 $demand.counts.buyer_orders -ne 0 -or
 $demand.counts.actual_revenue_usd -ne 0 -or
 $demand.boundaries.emails_sent -ne 0 -or
 $demand.boundaries.rea_calls -ne 0 -or
 $buyer.version -cne 'fial5.13-verified-fleet-buyer-v1' -or
 $bid.version -cne 'fial5.12-bid-readiness-v1' -or
 $fit.version -cne 'fial5.11-commercial-fit-v1' -or
 $proc.version -cne 'fial5.10-published-procurement-v1' -or
 $fleet.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
 $reg.source_catalog_version -cne 'fial5.8.1-regulatory-catalog-2026-amendment-v1' -or
 @($task.Triggers).Count -ne 4){Hold 'FINAL_SYSTEM_OR_SOURCE_AUTHORITY_INVALID'}
Write-Host ('FIAL514_PUBLIC_DEMAND_SOURCES_CURRENT='+$demand.counts.current_sources)
Write-Host ('FIAL514_TITLE_ONLY_REVIEW_HINTS='+$demand.counts.titles_for_manual_review)
Write-Host ('FIAL514_CEC_APPLICATION_EVENT='+$demand.program_event_state)
Write-Host 'FIAL514_VERIFIED_CURRENT_EV_SERVICE_RFPS=0'
Write-Host 'FIAL514_CUSTOMER_PURCHASE_ORDERS=0'
Write-Host 'FIAL514_CUSTOMER_REVENUE_USD=0'
Write-Host 'FIAL514_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host 'FIAL514_NO_OUTBOUND_EMAIL_BIDS_FORMS_APPLICATIONS_REA=TRUE'
Write-Host ('FIAL514_OPERATIONS='+$u+'/operations/')
Write-Host ('FIAL514_CHAT='+$u+'/unified/?view=chat')
Write-Host 'FIAL514_ALL_IN_ONE=PASS'
