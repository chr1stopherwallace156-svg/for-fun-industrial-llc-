$ErrorActionPreference='Stop'
$homeDir=Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile=Join-Path $homeDir 'data\service.pid'
if(-not(Test-Path $pidFile)){Write-Host 'AUTONOMY_ALREADY_STOPPED';return}
$workerId=[int](Get-Content $pidFile -Raw)
$p=Get-CimInstance Win32_Process -Filter "ProcessId=$workerId" -ErrorAction SilentlyContinue
if(-not $p){Write-Host 'AUTONOMY_ALREADY_STOPPED';return}
if($p.CommandLine -notlike '*autonomy-v2-github*service.mjs*'){throw 'REFUSE_TO_STOP_UNRELATED_PROCESS'}
Stop-Process -Id $workerId -Force
Write-Host "AUTONOMY_STOPPED_PID=$workerId"
Write-Host 'EXISTING_FUN_INDUSTRIAL_SERVICES_UNCHANGED'
