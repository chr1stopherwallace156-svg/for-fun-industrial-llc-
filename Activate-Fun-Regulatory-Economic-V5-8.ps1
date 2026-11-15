# FIAL5.8 one-command activation of existing executive worker + 8802.
# Does not authorize Gmail, file paperwork, spend or start another model.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Install=Join-Path $Root 'Install-Fun-Regulatory-Economic-V5-8.ps1'
$Deploy=Join-Path $Root 'Deploy-Fun-FIAL58-PrimaryDashboard.ps1'
function Hold([string]$why){throw ('FIAL58_ALL_IN_ONE_HOLD='+$why)}
foreach($p in @($Install,$Deploy)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('INSTALLER_MISSING='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'SYMLINK_SCRIPT_REFUSED'}
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Install
if($LASTEXITCODE -ne 0){Hold 'REAL_INTELLIGENCE_OR_SCHEDULE_NOT_VERIFIED'}
Write-Host 'FIAL58_PHASE_1=OFFICIAL_SOURCES_BLS_AND_SCHEDULER_PASS'
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){Hold 'DASHBOARD_OR_LIVE_QWEN_NOT_VERIFIED'}
Write-Host 'FIAL58_PHASE_2=PRIMARY_8802_DASHBOARD_PASS'
$data=Invoke-RestMethod 'http://127.0.0.1:8802/api/operator/regulatory/status' -TimeoutSec 18 -ErrorAction Stop
if($data.version -cne 'fial5.8-regulatory-economic-v1' -or
 $data.state -cne 'REAL_PUBLIC_DATA_CHECK_COMPLETED' -or
 $data.boundaries.emails_sent -ne 0 -or
 $data.boundaries.automatic_filing -ne 0 -or
 $data.boundaries.model_calls -ne 0 -or
 $data.boundaries.verified_individual_due_dates -ne 0){Hold 'FINAL_REAL_PUBLIC_EVIDENCE_INVALID'}
Write-Host ('FIAL58_OFFICIAL_SOURCES_CONFIGURED='+$data.counts.monitored+
 ' FETCHED='+$data.counts.refreshed+
 ' CHANGES='+$data.counts.source_changes+
 ' HELD='+$data.counts.source_holds)
Write-Host ('FIAL58_ECONOMIC_SERIES='+$data.counts.economic_series+
 ' MILESTONES='+$data.counts.visible_milestones)
Write-Host 'FIAL58_GMAIL_AUTHORIZATION=NOT_REQUIRED'
Write-Host 'FIAL58_NO_EMAIL_SEND_NO_FILING_NO_SPENDING=TRUE'
Write-Host 'FIAL58_DASHBOARD=http://127.0.0.1:8802/operations/'
Write-Host 'FIAL58_ALL_IN_ONE=PASS'
