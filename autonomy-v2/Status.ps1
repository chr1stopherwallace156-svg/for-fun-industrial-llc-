$ErrorActionPreference='Stop'
$homeDir=Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile=Join-Path $homeDir 'data\service.pid'
if(-not(Test-Path $pidFile)){throw 'AUTONOMY_PID_FILE_MISSING'}
$workerId=[int](Get-Content $pidFile -Raw)
$p=Get-CimInstance Win32_Process -Filter "ProcessId=$workerId" -ErrorAction SilentlyContinue
if(-not $p -or $p.CommandLine -notlike '*autonomy-v2-github*service.mjs*'){throw 'AUTONOMY_PROCESS_NOT_RUNNING'}
$s=Invoke-RestMethod 'http://127.0.0.1:8792/api/status' -TimeoutSec 15
if($s.state -ne 'running' -or $s.pid -ne $workerId){throw 'AUTONOMY_HEALTH_MISMATCH'}
$e=Invoke-RestMethod 'http://127.0.0.1:8792/api/events' -TimeoutSec 15
$t=Invoke-RestMethod 'http://127.0.0.1:8792/api/tasks' -TimeoutSec 15
Write-Host "AUTONOMY_V2=RUNNING PID=$workerId"
Write-Host "RECENT_STAGES=$(@($e.events|Select-Object -First 12|ForEach-Object{$_.stage}) -join ',')"
Write-Host "REA_CATALOG=$($s.registry.count) REA_TOOL_CALLS=$($s.reaToolCalls)"
Write-Host "PENDING_REVIEW=$(@($t.tasks).Count)"
Write-Host 'DASHBOARD=http://127.0.0.1:8792/'
Write-Host 'AUTONOMY_STATUS=PASS'
