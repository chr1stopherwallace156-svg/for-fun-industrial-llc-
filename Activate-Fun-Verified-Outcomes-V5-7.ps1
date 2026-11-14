# FIAL5.7 all-in-one guarded upgrade of existing operator and 8802 dashboard.
# Never sends email, applies licenses, restarts Qwen, or grants OAuth.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Install=Join-Path $Root 'Install-Fun-Verified-Outcomes-V5-7.ps1'
$Deploy=Join-Path $Root 'Deploy-Fun-FIAL57-PrimaryDashboard.ps1'
function Hold([string]$reason){throw ('FIAL57_ALL_IN_ONE_HOLD='+$reason)}
foreach($p in @($Install,$Deploy)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('MISSING_STEP='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'UNREVIEWED_SYMLINK'}
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Install
if($LASTEXITCODE -ne 0){Hold 'SCHEDULER_OR_LOCAL_OBSERVATION_FAILED'}
Write-Host 'FIAL57_PHASE_1=LOCAL_SCHEDULER_AND_OUTCOME_LEDGER_PASS'
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){Hold 'DASHBOARD_HANDOFF_OR_QWEN_CHECK_FAILED'}
Write-Host 'FIAL57_PHASE_2=PRIMARY_DASHBOARD_AND_QWEN_PASS'
$r=Invoke-RestMethod 'http://127.0.0.1:8802/api/operator/outcomes/status' -TimeoutSec 12 -ErrorAction Stop
if($r.version -cne 'fial5.7-verified-outcomes-v1' -or
 $r.external_form_submissions -ne 0 -or
 $r.verified_customer_revenue -ne 0 -or
 $r.certified_license_status -ne $false -or
 $r.send_attempts -gt 1){Hold 'FINAL_RECEIPT_NOT_VERIFIED'}
Write-Host ('FIAL57_MEASURED_OUTCOME='+$r.progress_measure)
Write-Host ('FIAL57_MAILBOX='+$r.mailbox_state)
Write-Host ('FIAL57_NEXT_GATE='+$r.next_gate)
Write-Host 'FIAL57_SCHEDULER_CANNOT_SEND_EMAIL=TRUE'
Write-Host 'FIAL57_GOOGLE_SEND_AUTH=SEPARATE_EXPLICIT_CONSENT_REQUIRED'
Write-Host 'FIAL57_DASHBOARD=http://127.0.0.1:8802/operations/'
Write-Host 'FIAL57_ALL_IN_ONE=PASS'
