# Fun Industrial International Sourcing V1 — guarded deployment.
# Changes ONLY the existing 8792 Sidequest worker modules and 8789 UI/proxy.
# Preserves SQLite, REA, Ollama, llama.cpp, Qwen, NetBird, domestic grants and GSA snapshots.
[CmdletBinding()]
param([string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation')
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$source=[IO.Path]::GetFullPath($PSScriptRoot)
$installed=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$ps=(Get-Command powershell.exe -ErrorAction Stop).Source
$base='http://127.0.0.1:8789';$worker='http://127.0.0.1:8792'
$server=Join-Path $Root 'src\server.mjs'
$html=Join-Path $Root 'public\index.html'
$patcher=Join-Path $source 'scripts\patch-international-dashboard.mjs'
$launcher=Join-Path $installed 'Start.ps1'
$modules=@('src\international.mjs','src\http.mjs','Import-International.mjs','Estimate-International-Cost.mjs')
foreach($f in @($server,$html,$patcher,$launcher,(Join-Path $installed 'src\service.mjs'))){
 if(-not(Test-Path $f -PathType Leaf)){throw "INTERNATIONAL_PREREQUISITE_MISSING=$f"}
}
foreach($f in $modules){
 $src=Join-Path $source $f;if(-not(Test-Path $src -PathType Leaf)){throw "INTERNATIONAL_SOURCE_MISSING=$f"}
 & $node --check $src;if($LASTEXITCODE -ne 0){throw "INTERNATIONAL_SYNTAX_HOLD=$f"}
}
$tests=@('test\international.test.mjs','test\international-import.test.mjs','test\international-patcher.test.mjs','test\domestic.test.mjs','test\gsa-bridge.test.mjs','test\gsa-import.test.mjs')
foreach($f in $tests){if(-not(Test-Path (Join-Path $source $f) -PathType Leaf)){throw "INTERNATIONAL_TEST_MISSING=$f"}}
$args=@('--test')+@($tests|ForEach-Object {Join-Path $source $_})
& $node @args
if($LASTEXITCODE -ne 0){throw 'INTERNATIONAL_REGRESSION_TESTS_FAILED'}
$uiStatus=Invoke-RestMethod "$base/api/status" -TimeoutSec 15
$workStatus=Invoke-RestMethod "$worker/api/status" -TimeoutSec 15
if($uiStatus.application -ne 'Fun Industrial Platform'){throw 'PRIMARY_PLATFORM_NOT_VERIFIED'}
if($workStatus.application -ne 'Fun Industrial Autonomous Workers' -or $workStatus.state -ne 'running'){throw 'AUTONOMY_NOT_VERIFIED'}
$uiListen=Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction Stop|Where-Object {$_.LocalAddress -eq '127.0.0.1'}|Select-Object -First 1
if(-not $uiListen){throw 'PRIMARY_DASHBOARD_NOT_ON_LOOPBACK'}
$uiProc=Get-CimInstance Win32_Process -Filter "ProcessId=$($uiListen.OwningProcess)" -ErrorAction Stop
$workerProc=Get-CimInstance Win32_Process -Filter "ProcessId=$($workStatus.pid)" -ErrorAction Stop
if($uiProc.Name -ne 'node.exe' -or $uiProc.CommandLine -notmatch 'src[/\\]server\.mjs'){throw 'UNEXPECTED_DASHBOARD_PROCESS'}
if($workerProc.Name -ne 'node.exe' -or $workerProc.CommandLine -notmatch 'autonomy-v2-github.*service\.mjs'){throw 'UNEXPECTED_SIDEQUEST_PROCESS'}
$beforeCatalog=(Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 35).tools
if(@($beforeCatalog).Count -ne 229){throw "REA_CATALOG_PREFLIGHT_HOLD=$(@($beforeCatalog).Count)"}
$origServer=[IO.File]::ReadAllText($server)
$origHtml=[IO.File]::ReadAllText($html)
if(-not $origServer.Contains('FI_DOMESTIC_OPPORTUNITIES_V1') -or -not $origHtml.Contains('FI_DOMESTIC_OPPORTUNITIES_V1')){throw 'EXISTING_DOMESTIC_UI_REQUIRED'}
if($origServer.Contains('FI_INTERNATIONAL_SOURCE_V1') -or $origHtml.Contains('FI_INTERNATIONAL_SOURCE_V1')){throw 'INTERNATIONAL_ALREADY_INSTALLED_HOLD'}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutonomyLab\InternationalBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,7))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
Copy-Item $server (Join-Path $backup 'server.mjs') -ErrorAction Stop
Copy-Item $html (Join-Path $backup 'index.html') -ErrorAction Stop
$manifest=@()
foreach($f in $modules){
 $dest=Join-Path $installed $f;$existing=Test-Path $dest -PathType Leaf;$save=Join-Path $backup ($f -replace '\\','_')
 if($existing){Copy-Item $dest $save -ErrorAction Stop}
 $manifest+=@{path=$dest;backup=$save;existed=$existing}
}
$stoppedWorker=$false;$stoppedUI=$false;$newWorkerPid=0;$newUI=$null
$logDir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
New-Item -ItemType Directory -Path $logDir -Force|Out-Null
try {
 foreach($f in $modules){Copy-Item (Join-Path $source $f) (Join-Path $installed $f) -Force -ErrorAction Stop}
 & $node $patcher $Root
 if($LASTEXITCODE -ne 0){throw 'INTERNATIONAL_8789_PATCH_FAILED'}
 & $node --check $server
 if($LASTEXITCODE -ne 0){throw 'LIVE_SERVER_SYNTAX_FAILED'}
 Push-Location $Root
 try{& $node --test;if($LASTEXITCODE -ne 0){throw 'PRIMARY_PLATFORM_TESTS_FAILED'}}finally{Pop-Location}
 Write-Host "RESTART_INTERNATIONAL_WORKER_ONLY_PID=$($workStatus.pid)"
 Stop-Process -Id ([int]$workStatus.pid) -Force -ErrorAction Stop;$stoppedWorker=$true
 for($i=0;$i -lt 55;$i++){if(-not(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 350}
 if(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue){throw 'WORKER_PORT_NOT_RELEASED'}
 & $ps -NoProfile -ExecutionPolicy Bypass -File $launcher
 if($LASTEXITCODE -ne 0){throw 'INTERNATIONAL_WORKER_RESTART_FAILED'}
 $after=Invoke-RestMethod "$worker/api/status" -TimeoutSec 20
 if($after.application -ne 'Fun Industrial Autonomous Workers' -or $after.state -ne 'running'){throw 'INTERNATIONAL_WORKER_HEALTH_FAILED'}
 $newWorkerPid=[int]$after.pid
 $api=Invoke-RestMethod "$worker/api/international" -TimeoutSec 15
 if($api.scope -ne 'international' -or @($api.sources).Count -lt 3){throw 'INTERNATIONAL_RESEARCH_API_NOT_READY'}
 $gsa=Invoke-RestMethod "$worker/api/opportunities" -TimeoutSec 15
 if($gsa.scope -ne 'United States' -or -not $gsa.gsaSnapshot){throw 'DOMESTIC_GSA_REGRESSION_HOLD'}
 Write-Host "RESTARTING_ONLY_8789_DASHBOARD_PID=$($uiProc.ProcessId)"
 Stop-Process -Id ([int]$uiProc.ProcessId) -ErrorAction Stop;$stoppedUI=$true
 for($i=0;$i -lt 55;$i++){if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 350}
 if(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue){throw 'DASHBOARD_PORT_NOT_RELEASED'}
 $env:PORT='8789';$env:HOST='127.0.0.1'
 $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
 $newUI=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir "international-$stamp.stdout.log") -RedirectStandardError (Join-Path $logDir "international-$stamp.stderr.log")
 $uiOk=$false
 for($i=0;$i -lt 50;$i++){Start-Sleep -Milliseconds 800;$newUI.Refresh();if($newUI.HasExited){break};try{$s=Invoke-RestMethod "$base/api/status" -TimeoutSec 5;if($s.application -eq 'Fun Industrial Platform'){$uiOk=$true;break}}catch{}}
 if(-not $uiOk){throw '8789_DASHBOARD_RESTART_FAILED'}
 $rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 120
 if($rea.state -ne 'ready'){throw 'REA_RECONNECT_HOLD'}
 $catalog=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 40).tools)
 if($catalog.Count -ne 229){throw 'REA_REGISTRY_RECONNECT_FAILED'}
 $intl=Invoke-RestMethod "$base/api/autonomy/international" -TimeoutSec 20
 if($intl.scope -ne 'international' -or @($intl.sources).Count -lt 3){throw '8789_INTERNATIONAL_PROXY_FAILED'}
 $checkDomestic=Invoke-RestMethod "$base/api/autonomy/opportunities" -TimeoutSec 20
 if($checkDomestic.scope -ne 'United States'){throw '8789_DOMESTIC_ROUTE_FAILED'}
 $page=(Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 15).Content
 if(-not $page.Contains('FI_INTERNATIONAL_SOURCE_V1')){throw '8789_INTERNATIONAL_PANEL_NOT_SERVED'}
 Write-Host "INTERNATIONAL_SOURCING_V1=PASS DASHBOARD_PID=$($newUI.Id) WORKER_PID=$newWorkerPid REA_CATALOG=$($catalog.Count)"
 Write-Host "COUNTRIES=JP,KR,VN SOURCE_COUNT=$(@($intl.sources).Count) INVENTORY_COUNT=$($intl.summary.total) MODE=RESEARCH_ONLY"
 Write-Host "DASHBOARD=$base/ MENU=Autonomy"
 Write-Host "BACKUP=$backup"
 Write-Host 'AUTOMATED_INTERNATIONAL_MARKETPLACE_FEEDS=NOT_YET_QUALIFIED'
 Write-Host 'BIDS=DISABLED PURCHASES=DISABLED ACCOUNT_CREATION=DISABLED'
}catch{
 $reason=$_.Exception.Message
 Write-Warning "INTERNATIONAL_DEPLOY_HOLD=$reason"
 if($newUI){$newUI.Refresh();if(-not $newUI.HasExited){Stop-Process -Id $newUI.Id -Force -ErrorAction SilentlyContinue}}
 Copy-Item (Join-Path $backup 'server.mjs') $server -Force
 Copy-Item (Join-Path $backup 'index.html') $html -Force
 if($newWorkerPid -gt 0){
  $p=Get-CimInstance Win32_Process -Filter "ProcessId=$newWorkerPid" -ErrorAction SilentlyContinue
  if($p -and $p.CommandLine -match 'autonomy-v2-github.*service\.mjs'){Stop-Process -Id $newWorkerPid -Force -ErrorAction SilentlyContinue}
 }
 foreach($m in $manifest){
  if($m.existed){Copy-Item $m.backup $m.path -Force}
  else{Remove-Item $m.path -Force -ErrorAction SilentlyContinue}
 }
 if($stoppedWorker){
  for($i=0;$i -lt 40;$i++){if(-not(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 350}
  if(-not(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue)){
   try{& $ps -NoProfile -ExecutionPolicy Bypass -File $launcher;Write-Warning 'PREVIOUS_WORKER_RESTART_ATTEMPTED'}catch{Write-Warning "WORKER_MANUAL_RECOVERY_REQUIRED_FROM=$backup"}
  }
 }
 if($stoppedUI){
  for($i=0;$i -lt 40;$i++){if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 350}
  if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){
   try{$rollback=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir 'international-rollback.stdout.log') -RedirectStandardError (Join-Path $logDir 'international-rollback.stderr.log');Write-Warning "PREVIOUS_DASHBOARD_RESTART_ATTEMPTED_PID=$($rollback.Id)"}catch{Write-Warning "DASHBOARD_MANUAL_RECOVERY_REQUIRED_FROM=$backup"}
  }
 }
 throw "INTERNATIONAL_NOT_QUALIFIED=$reason BACKUP=$backup"
}
