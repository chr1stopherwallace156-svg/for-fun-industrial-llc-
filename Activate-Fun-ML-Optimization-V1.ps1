# FUN_COMPUTE_QWEN_ACTIVATION_V1
# Explicit user command: install only two solver libraries to a user-local venv,
# then upgrade only the reviewed 8802 Node dashboard using existing rollback.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$install=Join-Path $PSScriptRoot 'Initialize-Fun-Optimization-V1.ps1'
$activate=Join-Path $PSScriptRoot 'Activate-Fun-FISRE-Live-V4.ps1'
foreach($s in @($install,$activate)){
 if(!(Test-Path -LiteralPath $s -PathType Leaf)){throw ('FUN_COMPUTE_ACTIVATION_SCRIPT_MISSING='+$s)}
 if((Get-Item -LiteralPath $s).Attributes -band [IO.FileAttributes]::ReparsePoint){
  throw ('FUN_COMPUTE_ACTIVATION_LINK_DENIED='+$s)
 }
}
Write-Host 'FUN_QWEN_COMPUTE_ACTIVATION=INSTALL_ISOLATED_OPTIMIZATION_DEPENDENCIES'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $install
if($LASTEXITCODE -ne 0){throw 'FUN_QWEN_COMPUTE_DEPENDENCY_INSTALL_HOLD_NO_DASHBOARD_RESTART'}
Write-Host 'FUN_QWEN_COMPUTE_ACTIVATION=UPGRADE_KNOWN_8802_ONLY'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $activate
if($LASTEXITCODE -ne 0){throw 'FUN_QWEN_COMPUTE_8802_ACTIVATION_HOLD'}
Write-Host 'FUN_QWEN_ML_OPTIMIZATION_SETUP=PASS'
Write-Host 'FUN_QWEN_CHAT=http://127.0.0.1:8802/#chat'
Write-Host 'FUN_QWEN_ADDITIONAL_AI_MODELS=ZERO'
Write-Host 'FUN_QWEN_OTHER_SERVICES_AND_ELEKTRON=UNTOUCHED'
