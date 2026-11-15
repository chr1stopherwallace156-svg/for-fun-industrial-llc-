# FIAL5.11 all in one: first real public source review, in-place scheduler
# and existing 8802 live Qwen/dashboard verification. No outreach or bids.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Install=Join-Path $Root 'Install-Fun-Commercial-Fit-V5-11.ps1'
$Deploy=Join-Path $Root 'Deploy-Fun-FIAL511-PrimaryDashboard.ps1'
function Hold([string]$why){throw ('FIAL511_ALL_IN_ONE_HOLD='+$why)}
foreach($p in @($Install,$Deploy)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_SCRIPT_MISSING='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'UNTRUSTED_LINK'}
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Install
if($LASTEXITCODE -ne 0){Hold 'COMMERCIAL_QUALIFICATION_CYCLE_OR_SCHEDULE_NOT_VERIFIED'}
Write-Host 'FIAL511_PHASE_1=COMMERCIAL_FIT_SOURCE_AND_SCHEDULER_PASS'
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){Hold 'PRIMARY_DASHBOARD_OR_QWEN_LIVE_NOT_VERIFIED'}
Write-Host 'FIAL511_PHASE_2=PRIMARY_DASHBOARD_AND_QWEN_PASS'
$u='http://127.0.0.1:8802'
$fit=Invoke-RestMethod ($u+'/api/operator/fit/status') -TimeoutSec 15 -ErrorAction Stop
$proc=Invoke-RestMethod ($u+'/api/operator/procurement/status') -TimeoutSec 15 -ErrorAction Stop
$fleet=Invoke-RestMethod ($u+'/api/operator/fleet/status') -TimeoutSec 15 -ErrorAction Stop
$reg=Invoke-RestMethod ($u+'/api/operator/regulatory/status') -TimeoutSec 15 -ErrorAction Stop
$task=Get-ScheduledTask -TaskName 'FunIndustrial-Executive-Operator-V1' -ErrorAction Stop
if($fit.version -cne 'fial5.11-commercial-fit-v1' -or
 $fit.counts.named_programs -ne 3 -or
 $fit.counts.directly_qualified_bids -ne 0 -or
 $fit.boundaries.rea_calls -ne 0 -or
 $proc.version -cne 'fial5.10-published-procurement-v1' -or
 $fleet.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
 $reg.source_catalog_version -cne 'fial5.8.1-regulatory-catalog-2026-amendment-v1' -or
 @($task.Triggers).Count -ne 4){Hold 'FINAL_COMMERCIAL_FIT_OR_EXISTING_SYSTEM_INVALID'}
Write-Host ('FIAL511_PROGRAMS_RESEARCHED='+$fit.counts.named_programs)
Write-Host ('FIAL511_OFFICIAL_DOCS_CURRENT='+$fit.counts.source_docs_current)
Write-Host ('FIAL511_DIRECTLY_QUALIFIED_BIDS='+$fit.counts.directly_qualified_bids)
Write-Host ('FIAL511_RETAINED_FLEET_PROSPECTS='+$fleet.counts.named_prospects)
Write-Host ('FIAL511_SCHEDULED_CYCLES='+@($task.Triggers).Count)
Write-Host 'FIAL511_BUSINESS_CREDENTIALS=UNVERIFIED'
Write-Host 'FIAL511_BIDS_EMAILS_FILINGS_PAYMENTS_MODELS_REA=ZERO'
Write-Host ('FIAL511_OPERATIONS='+$u+'/operations/')
Write-Host ('FIAL511_QWEN='+$u+'/unified/?view=chat')
Write-Host 'FIAL511_ALL_IN_ONE=PASS'
