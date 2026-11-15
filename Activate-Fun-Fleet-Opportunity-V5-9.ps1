# FIAL5.9 single operator-invoked deployment:
# verified source cycle + in-place executive task upgrade + reviewed 8802 handoff.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Install=Join-Path $Root 'Install-Fun-Fleet-Opportunity-V5-9.ps1'
$Deploy=Join-Path $Root 'Deploy-Fun-FIAL59-PrimaryDashboard.ps1'
function Hold([string]$why){throw ('FIAL59_ALL_IN_ONE_HOLD='+$why)}
foreach($path in @($Install,$Deploy)){
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('REQUIRED_SCRIPT_MISSING='+$path)}
 if(((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'SYMLINK_INSTALLER_REFUSED'}
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Install
if($LASTEXITCODE -ne 0){Hold 'FLEET_SOURCE_CYCLE_OR_SCHEDULE_NOT_VERIFIED'}
Write-Host 'FIAL59_PHASE_1=REAL_FLEET_EVIDENCE_AND_SCHEDULER_PASS'
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){Hold 'PRIMARY_DASHBOARD_OR_QWEN_LIVE_HOLD'}
Write-Host 'FIAL59_PHASE_2=PRIMARY_DASHBOARD_AND_QWEN_VERIFIED'
$u='http://127.0.0.1:8802'
$r=Invoke-RestMethod ($u+'/api/operator/fleet/status') -TimeoutSec 15 -ErrorAction Stop
$reg=Invoke-RestMethod ($u+'/api/operator/regulatory/status') -TimeoutSec 15 -ErrorAction Stop
if($r.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
 $r.state -cne 'PUBLISHED_HISTORICAL_FLEET_PROSPECTS_AND_OFFICIAL_SOURCE_MONITOR' -or
 $r.counts.named_prospects -lt 30 -or $r.counts.verified_open_rfps -ne 0 -or
 $r.counts.awarded_contracts -ne 0 -or $r.boundaries.emails_sent -ne 0 -or
 $r.boundaries.rea_calls -ne 0 -or
 $reg.source_catalog_version -cne 'fial5.8.1-regulatory-catalog-2026-amendment-v1'){
 Hold 'FINAL_FLEET_OR_AMENDED_REGULATORY_PROVENANCE_INVALID'
}
Write-Host ('FIAL59_NAMED_FLEET_RESEARCH_PROSPECTS='+$r.counts.named_prospects)
Write-Host ('FIAL59_OFFICIAL_SOURCE_CHECKS='+$r.counts.checked+' HELD='+$r.counts.held)
Write-Host 'FIAL59_VERIFIED_OPEN_RFPS=0'
Write-Host 'FIAL59_APPROVED_VENDOR_ELIGIBILITY=NOT_VERIFIED'
Write-Host 'FIAL59_EMAIL_FILINGS_ORDERS_REA=ZERO'
Write-Host 'FIAL59_REGULATORY_2030_AMENDMENT=PRESERVED'
Write-Host ('FIAL59_OPERATIONS='+$u+'/operations/')
Write-Host ('FIAL59_CHAT='+$u+'/unified/?view=chat')
Write-Host 'FIAL59_ALL_IN_ONE=PASS'
