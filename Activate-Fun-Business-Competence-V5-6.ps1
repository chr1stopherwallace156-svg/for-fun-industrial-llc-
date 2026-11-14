# FIAL5.6 one-command activation of both the existing four-trigger worker
# and the existing 8802 dashboard. No unrelated service or process restarts.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Install=Join-Path $Root 'Install-Fun-Business-Competence-V5-6.ps1'
$Deploy=Join-Path $Root 'Deploy-Fun-FIAL56-PrimaryDashboard.ps1'
function Hold([string]$why){throw ('FIAL56_ALL_IN_ONE_HOLD='+$why)}
foreach($file in @($Install,$Deploy)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('SCRIPT_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_SCRIPT_REFUSED='+$file)
 }
}
$PowerShellExe=(Get-Command powershell.exe -ErrorAction Stop).Source
& $PowerShellExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Install
if($LASTEXITCODE -ne 0){Hold 'INSTALL_OR_FIRST_REAL_CYCLE_UNQUALIFIED'}
Write-Host 'FIAL56_PHASE_1=SCHEDULER_AND_LOCAL_COMPETENCE_PASS'
& $PowerShellExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){Hold 'DASHBOARD_UPGRADE_OR_LIVE_QWEN_UNQUALIFIED'}
Write-Host 'FIAL56_PHASE_2=PRIMARY_8802_DASHBOARD_PASS'
$Uri='http://127.0.0.1:8802/api/operator/competence/status'
$result=Invoke-RestMethod -Uri $Uri -TimeoutSec 15 -ErrorAction Stop
if($result.version -cne 'fial5.6-business-operator-v1' -or
 $result.state -cne 'EXECUTED_LOCAL_BUSINESS_COMPETENCE_CYCLE' -or
 $result.actions.mail_sent -ne 0 -or
 $result.actions.government_filings -ne 0 -or
 $result.actions.rea_executions -ne 0 -or
 $result.actions.code_mutations -ne 0 -or
 $result.actions.model_invocations -ne 0){
 Hold 'FINAL_BUSINESS_COMPETENCE_RECEIPT_NOT_VERIFIED'
}
Write-Host ('FIAL56_REAL_COMPETENCE_TASKS='+$result.tracked_tasks+
 ' FRAMEWORKS='+$result.framework_count+
 ' NEW_PACKETS='+$result.packets_created)
Write-Host 'FIAL56_PREVIOUS_QWEN_COGNEE_REA_COMMERCE=PROTECTED'
Write-Host 'FIAL56_FUN_INDUSTRIAL=SOFTWARE_WORKSPACE'
Write-Host 'FIAL56_BUSINESS=ELEKTRON_INDUSTRIAL_LLC'
Write-Host 'FIAL56_EXTERNAL_ACTIONS=ZERO'
Write-Host 'FIAL56_DASHBOARD=http://127.0.0.1:8802/operations/'
Write-Host 'FIAL56_ALL_IN_ONE=PASS'
