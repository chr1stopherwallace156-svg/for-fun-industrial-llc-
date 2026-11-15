# FIAL5.10: real issuer evidence, existing four-trigger upgrade, reviewed
# only-8802 dashboard process handoff, and read-only final status.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Install=Join-Path $Root 'Install-Fun-Procurement-V5-10.ps1'
$Deploy=Join-Path $Root 'Deploy-Fun-FIAL510-PrimaryDashboard.ps1'
function Hold([string]$why){throw ('FIAL510_ALL_IN_ONE_HOLD='+$why)}
foreach($file in @($Install,$Deploy)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_SCRIPT_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold 'UNTRUSTED_LINK'
 }
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Install
if($LASTEXITCODE -ne 0){Hold 'FIRST_OFFICIAL_SOURCE_CHECK_OR_SCHEDULE_NOT_VERIFIED'}
Write-Host 'FIAL510_PHASE_1=OFFICIAL_ISSUER_AND_FOUR_CYCLE_SCHEDULER_PASS'
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){Hold 'PRIMARY_DASHBOARD_OR_QWEN_NOT_VERIFIED'}
Write-Host 'FIAL510_PHASE_2=EXISTING_DASHBOARD_AND_QWEN_PASS'
$u='http://127.0.0.1:8802'
$p=Invoke-RestMethod ($u+'/api/operator/procurement/status') -TimeoutSec 15
$f=Invoke-RestMethod ($u+'/api/operator/fleet/status') -TimeoutSec 15
$reg=Invoke-RestMethod ($u+'/api/operator/regulatory/status') -TimeoutSec 15
$task=Get-ScheduledTask -TaskName 'FunIndustrial-Executive-Operator-V1' -ErrorAction Stop
if($p.version -cne 'fial5.10-published-procurement-v1' -or
 $p.notice.solicitation_id -cne '26-27-02TR' -or
 $p.boundaries.actual_rfps_submitted -ne 0 -or $p.counts.verified_fit_for_elektron -ne 0 -or
 $f.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
 $reg.source_catalog_version -cne 'fial5.8.1-regulatory-catalog-2026-amendment-v1' -or
 @($task.Triggers).Count -ne 4){Hold 'FINAL_INTEGRATION_OR_APPROVAL_BOUNDARY_INVALID'}
Write-Host ('FIAL510_OFFICIAL_NOTICE_STATE='+$p.state)
Write-Host ('FIAL510_CURRENT_PUBLISHED_NOTICES='+$p.counts.verified_current_published_notices)
Write-Host ('FIAL510_ELEKTRON_BID_ELIGIBILITY=NOT_VERIFIED')
Write-Host ('FIAL510_FLEET_RESEARCH_PROSPECTS='+$f.counts.named_prospects)
Write-Host 'FIAL510_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host 'FIAL510_EMAILS_BIDS_ORDERS_PAYMENTS_REA=ZERO'
Write-Host ('FIAL510_OPERATIONS='+$u+'/operations/')
Write-Host ('FIAL510_QWEN='+$u+'/unified/?view=chat')
Write-Host 'FIAL510_ALL_IN_ONE=PASS'
