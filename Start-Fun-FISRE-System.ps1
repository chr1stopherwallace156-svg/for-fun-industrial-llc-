# Fun Industrial full single-command startup with integrated FISRE at 8802.
# Preserve existing vetted core/ML/gateway starters; replace ONLY older 8802 step.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Old=Join-Path $HOME 'FunIndustrial-SpatialUX-V2'
$ML=Join-Path $HOME 'FunIndustrial-QwenML-V2'
$Steps=@(
 @{Name='CORE';Script=(Join-Path $Old 'Start-Fun-Industrial.ps1');Args=@('-SkipPrivateGateway')},
 @{Name='ML';Script=(Join-Path $ML 'Start-Fun-Qwen-ML-V2.ps1');Args=@()},
 @{Name='FISRE_8802';Script=(Join-Path $PSScriptRoot 'Activate-Fun-FISRE-Live-V4.ps1');Args=@()},
 @{Name='PRIVATE_IPHONE';Script=(Join-Path $Old 'Start-Fun-Private-Gateway-V43.ps1');Args=@()}
)
foreach($step in $Steps){
 if(!(Test-Path -LiteralPath $step.Script -PathType Leaf)){
  throw ('FUN_FISRE_START_HOLD_MISSING_SCRIPT='+$step.Script)
 }
 Write-Host ('FUN_FISRE_STARTING='+$step.Name)
 $commandArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',[string]$step.Script)+@($step.Args)
 & powershell.exe @commandArgs
 if($LASTEXITCODE -ne 0){throw ('FUN_FISRE_START_HOLD='+$step.Name)}
}
Write-Host 'FUN_INDUSTRIAL_FISRE_FULL_START=PASS'
Write-Host 'FUN_DASHBOARD=http://127.0.0.1:8802/#reasoning'
Write-Host 'FUN_IPHONE=https://100.109.4.20:8443/'
Write-Host 'FUN_ELEKTRON=UNTOUCHED'
