# Guarded integration of the Autonomy V2 view into the existing Fun Industrial 8789 UI.
# Restarts only the dashboard Node host; REA is re-initialized after that restart.
# Qwen/llama.cpp, compute, NetBird and Ollama are not directly restarted.
[CmdletBinding()]
param([string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation')
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$server=Join-Path $Root 'src\server.mjs';$ui=Join-Path $Root 'public\index.html'
$base='http://127.0.0.1:8789'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$listener=Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction Stop | Where-Object { $_.LocalAddress -in @('127.0.0.1','::1') } | Select-Object -First 1
if(-not $listener){throw 'UNIFIED_8789_LISTENER_NOT_FOUND'}
$old=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
if(-not $old -or $old.Name -ne 'node.exe' -or $old.CommandLine -notmatch 'src[/\\]server\.mjs'){throw 'REFUSE_TO_RESTART_UNRECOGNIZED_PROCESS'}
$up=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 25
if($up.state -ne 'ready'){throw 'UNIFIED_NOT_READY_BEFORE_RESTART'}
$tools=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 30).tools)
if($tools.Count -ne 229){throw "REA_229_PREFLIGHT_HOLD=$($tools.Count)"}
$autonomy=Invoke-RestMethod 'http://127.0.0.1:8792/api/status' -TimeoutSec 15
if($autonomy.state -ne 'running'){throw 'AUTONOMY_BACKEND_UNAVAILABLE'}
# Some existing service launchers supply the entire REA allowlist as process environment.
# Capture these observed names so they remain present after a dashboard-only restart.
$env:REA_ALLOWED_TOOLS=(@($tools|ForEach-Object{$_.name}) -join ',')
$env:PORT='8789';$env:HOST='127.0.0.1'
try {
 $coding=Invoke-RestMethod "$base/api/unified/coding/status" -TimeoutSec 15
 if($coding.model_port -and [int]$coding.model_port -gt 0){$env:LLAMA_CPP_PORT=[string]$coding.model_port}
}catch{}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutonomyLab\8789DeployBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
Copy-Item -LiteralPath $server -Destination (Join-Path $backup 'server.mjs') -ErrorAction Stop
Copy-Item -LiteralPath $ui -Destination (Join-Path $backup 'index.html') -ErrorAction Stop
$from=Split-Path -Parent $MyInvocation.MyCommand.Path
$patched=$false;$newProc=$null
try {
 $s=[IO.File]::ReadAllText($server);$h=[IO.File]::ReadAllText($ui)
 if($s.Contains('FI_AUTONOMY_8789_PROXY_V1') -xor $h.Contains('FI_AUTONOMY_8789_VIEW_V1')){throw 'INCOMPLETE_PREEXISTING_PATCH'}
 if(-not $s.Contains('FI_AUTONOMY_8789_PROXY_V1')){
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $from 'Integrate-With-8789.ps1') -Root $Root
  if($LASTEXITCODE -ne 0){throw 'SOURCE_INTEGRATION_FAILED'}
  $patched=$true
 }
 if(-not ([IO.File]::ReadAllText($server)).Contains('FI_AUTONOMY_8789_PROXY_V1')){throw 'SERVER_PATCH_NOT_PRESENT'}
 if(-not ([IO.File]::ReadAllText($ui)).Contains('FI_AUTONOMY_8789_VIEW_V1')){throw 'UI_PATCH_NOT_PRESENT'}
 & $node --check $server
 if($LASTEXITCODE -ne 0){throw 'SERVER_SYNTAX_FAILED'}
 $logDir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
 New-Item -ItemType Directory -Path $logDir -Force|Out-Null
 $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
 Write-Host "RESTARTING_8789_DASHBOARD_ONLY_PID=$($old.ProcessId)"
 Stop-Process -Id $old.ProcessId -ErrorAction Stop
 for($i=0;$i -lt 45;$i++){if(-not(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 400}
 if(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue){throw '8789_STILL_IN_USE'}
 $newProc=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir "autonomy-8789-$stamp.stdout.log") -RedirectStandardError (Join-Path $logDir "autonomy-8789-$stamp.stderr.log")
 $ready=$false
 for($i=0;$i -lt 50;$i++){Start-Sleep -Seconds 1;$newProc.Refresh();if($newProc.HasExited){break};try{$v=Invoke-RestMethod "$base/api/status" -TimeoutSec 4;if($v.application -eq 'Fun Industrial Platform'){$ready=$true;break}}catch{}}
 if(-not $ready){throw 'NEW_8789_NOT_READY'}
 $rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 120
 if($rea.state -ne 'ready'){throw "REA_REINIT_NOT_READY=$($rea.state)"}
 $enabled=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 45).tools)
 if($enabled.Count -ne 229){throw "REA_229_RECONNECT_HOLD=$($enabled.Count)"}
 $unified=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 30
 if($unified.state -ne 'ready'){throw 'UNIFIED_NOT_READY_AFTER_RESTART'}
 $view=(Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 15).Content
 if(-not $view.Contains('FI_AUTONOMY_8789_VIEW_V1')){throw 'AUTONOMY_VIEW_NOT_SERVED'}
 $route=Invoke-RestMethod "$base/api/autonomy/status" -TimeoutSec 15
 if($route.state -ne 'running'){throw 'AUTONOMY_ROUTE_NOT_READY'}
 Write-Host "UNIFIED_8789_AUTONOMY=PASS DASHBOARD_PID=$($newProc.Id)"
 Write-Host "REA_ENABLED=$($enabled.Count) AUTONOMY_BACKEND_PID=$($route.pid)"
 Write-Host "BACKUP=$backup"
 Write-Host 'OPEN=http://127.0.0.1:8789/'
 Write-Host 'OTHER_SERVICES_NOT_RESTARTED'
}catch{
 $failure=$_.Exception.Message
 Write-Warning "AUTONOMY_8789_DEPLOY_FAILED=$failure"
 if($newProc){$newProc.Refresh();if(-not $newProc.HasExited){Stop-Process -Id $newProc.Id -Force -ErrorAction SilentlyContinue}}
 Copy-Item (Join-Path $backup 'server.mjs') $server -Force
 Copy-Item (Join-Path $backup 'index.html') $ui -Force
 for($i=0;$i -lt 35;$i++){if(-not(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 500}
 if(-not(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue)){
  try{
   $restore=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs\autonomy-8789-rollback.stdout.log') -RedirectStandardError (Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs\autonomy-8789-rollback.stderr.log')
   for($i=0;$i -lt 45;$i++){Start-Sleep -Milliseconds 800;try{$v=Invoke-RestMethod "$base/api/status" -TimeoutSec 3;if($v.application -eq 'Fun Industrial Platform'){break}}catch{}}
   try{Invoke-RestMethod "$base/api/rea/start" -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 120|Out-Null}catch{Write-Warning 'REA_RECONNECT_AFTER_ROLLBACK_NEEDS_OPERATOR_REVIEW'}
   Write-Warning "PREVIOUS_DASHBOARD_SOURCE_RESTORED PID=$($restore.Id)"
  }catch{Write-Warning "MANUAL_RECOVERY_NEEDED_FROM=$backup"}
 }else{Write-Warning '8789_PORT_BUSY_RECOVERY_NOT_ATTEMPTED'}
 throw "AUTONOMY_8789_DEPLOY_FAILED_BACKUP=$backup ERROR=$failure"
}
