# Fun Industrial Opportunity Intelligence V1 — guarded Windows deployment.
# Never changes REA allowlist, Gmail, Ollama, Qwen, NetBird, Aider or bidding authority.
[CmdletBinding()]
param([string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation')
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$source=[IO.Path]::GetFullPath($PSScriptRoot)
$stage=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$psExe=(Get-Command powershell.exe -ErrorAction Stop).Source
$base='http://127.0.0.1:8789'
$backend='http://127.0.0.1:8792'
$server=Join-Path $Root 'src\server.mjs'
$ui=Join-Path $Root 'public\index.html'
$stageFiles=@('src\jobs.mjs','src\service.mjs','src\http.mjs','src\domestic.mjs')
foreach($f in @($server,$ui,(Join-Path $stage 'Start.ps1'),(Join-Path $stage 'src\service.mjs'),(Join-Path $source 'scripts\patch-domestic-dashboard.mjs'))){if(-not(Test-Path -LiteralPath $f -PathType Leaf)){throw "PREREQUISITE_MISSING=$f"}}
foreach($f in @('src\domestic.mjs','src\jobs.mjs','src\service.mjs','src\http.mjs')){
 & $node --check (Join-Path $source $f);if($LASTEXITCODE -ne 0){throw "SOURCE_SYNTAX_FAILED=$f"}
}
& $node --test (Join-Path $source 'test\domestic.test.mjs') (Join-Path $source 'test\domestic-patcher.test.mjs')
if($LASTEXITCODE -ne 0){throw 'DOMESTIC_FEED_OR_DASHBOARD_TESTS_FAILED'}
$live=Invoke-RestMethod "$base/api/status" -TimeoutSec 20
if($live.application -ne 'Fun Industrial Platform'){throw 'PRIMARY_DASHBOARD_IDENTITY_MISMATCH'}
$listener=Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction Stop|Where-Object {$_.LocalAddress -in @('127.0.0.1','::1')}|Select-Object -First 1
$oldDash=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction Stop
if($oldDash.Name -ne 'node.exe' -or $oldDash.CommandLine -notmatch 'src[/\\]server\.mjs'){throw 'PRIMARY_DASHBOARD_PROCESS_UNRECOGNIZED'}
$oldAuto=Invoke-RestMethod "$backend/api/status" -TimeoutSec 20
if($oldAuto.application -ne 'Fun Industrial Autonomous Workers' -or $oldAuto.state -ne 'running'){throw 'AUTONOMY_BACKEND_NOT_HEALTHY'}
$oldWorker=Get-CimInstance Win32_Process -Filter "ProcessId=$($oldAuto.pid)" -ErrorAction Stop
if($oldWorker.Name -ne 'node.exe' -or $oldWorker.CommandLine -notmatch 'autonomy-v2-github.*service\.mjs'){throw 'AUTONOMY_WORKER_IDENTITY_MISMATCH'}
$allowed=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 35).tools|ForEach-Object {$_.name})
if($allowed.Count -ne 229){throw "REA_CATALOG_PREFLIGHT_HOLD=$($allowed.Count)"}
$env:REA_ALLOWED_TOOLS=$allowed -join ','
$env:PORT='8789';$env:HOST='127.0.0.1'
$oldServer=[IO.File]::ReadAllText($server)
$oldUi=[IO.File]::ReadAllText($ui)
if(-not $oldServer.Contains('FI_AUTONOMY_PLATFORM_ACTIVATION_V1') -or -not $oldUi.Contains('FI_AUTONOMY_8789_VIEW_V1')){throw 'UNIFIED_AUTONOMY_INTEGRATION_REQUIRED'}
if($oldServer.Contains('FI_DOMESTIC_OPPORTUNITIES_V1') -or $oldUi.Contains('FI_DOMESTIC_OPPORTUNITIES_V1')){throw 'DOMESTIC_ALREADY_PATCHED_HOLD'}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutonomyLab\DomesticBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
Copy-Item $server (Join-Path $backup 'server.mjs')
Copy-Item $ui (Join-Path $backup 'index.html')
foreach($f in $stageFiles){$original=Join-Path $stage $f;if(Test-Path $original){$name=($f -replace '\\','-');Copy-Item $original (Join-Path $backup $name)}}
$created=New-Object System.Collections.Generic.List[string]
$dashStopped=$false;$workerStopped=$false;$newDash=$null;$newWorkerId=0
$logDir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
New-Item -ItemType Directory -Path $logDir -Force|Out-Null
try{
 foreach($f in $stageFiles){
  $dest=Join-Path $stage $f
  if(-not(Test-Path $dest)){$created.Add($dest)}
  Copy-Item (Join-Path $source $f) $dest -Force
 }
 $intake=Join-Path $stage 'data\domestic-manual.json'
 if(-not(Test-Path $intake)){Copy-Item (Join-Path $source 'data\domestic-manual.json') $intake;$created.Add($intake)}
 & $node (Join-Path $source 'scripts\patch-domestic-dashboard.mjs') $Root
 if($LASTEXITCODE -ne 0){throw 'DASHBOARD_SOURCE_PATCH_FAILED'}
 & $node --check $server
 if($LASTEXITCODE -ne 0){throw 'LIVE_SERVER_SYNTAX_FAILED'}
 Push-Location $Root
 try{& $node --test;if($LASTEXITCODE -ne 0){throw 'PLATFORM_REGRESSION_HOLD'}}finally{Pop-Location}
 Write-Host "RESTARTING_AUTONOMY_WORKER_PID=$($oldAuto.pid)"
 Stop-Process -Id ([int]$oldAuto.pid) -Force -ErrorAction Stop;$workerStopped=$true
 for($i=0;$i -lt 50;$i++){if(-not(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 350}
 if(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue){throw 'AUTONOMY_PORT_NOT_RELEASED'}
 & $psExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $stage 'Start.ps1')
 if($LASTEXITCODE -ne 0){throw 'AUTONOMY_RESTART_FAILED'}
 $newAuto=Invoke-RestMethod "$backend/api/status" -TimeoutSec 20
 if($newAuto.state -ne 'running' -or $newAuto.application -ne 'Fun Industrial Autonomous Workers'){throw 'AUTONOMY_HEALTH_FAILED'}
 $newWorkerId=[int]$newAuto.pid
 $op=Invoke-RestMethod "$backend/api/opportunities" -TimeoutSec 20
 if($op.scope -ne 'United States'){throw 'DOMESTIC_BACKEND_ROUTE_FAILED'}
 Write-Host "RESTARTING_PRIMARY_DASHBOARD_PID=$($oldDash.ProcessId)"
 Stop-Process -Id ([int]$oldDash.ProcessId) -ErrorAction Stop;$dashStopped=$true
 for($i=0;$i -lt 45;$i++){if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 350}
 if(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue){throw 'DASHBOARD_PORT_NOT_RELEASED'}
 $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
 $newDash=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir "domestic-$stamp.stdout.log") -RedirectStandardError (Join-Path $logDir "domestic-$stamp.stderr.log")
 $ready=$false
 for($i=0;$i -lt 45;$i++){Start-Sleep -Milliseconds 850;$newDash.Refresh();if($newDash.HasExited){break};try{$r=Invoke-RestMethod "$base/api/status" -TimeoutSec 4;if($r.application -eq 'Fun Industrial Platform'){$ready=$true;break}}catch{}}
 if(-not $ready){throw 'PRIMARY_DASHBOARD_RESTART_FAILED'}
 $rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 120
 if($rea.state -ne 'ready'){throw 'REA_RECONNECT_FAILED'}
 $enabled=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 40).tools)
 if($enabled.Count -ne 229){throw "REA_REGISTRY_RESTORE_FAILED_$($enabled.Count)"}
 $status=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 30
 if($status.state -ne 'ready'){throw 'UNIFIED_AGENT_NOT_READY'}
 $liveDomestic=Invoke-RestMethod "$base/api/autonomy/opportunities" -TimeoutSec 20
 if($liveDomestic.scope -ne 'United States'){throw 'UNIFIED_DOMESTIC_PROXY_FAILED'}
 $web=(Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 20).Content
 if(-not $web.Contains('FI_DOMESTIC_OPPORTUNITIES_V1')){throw 'DOMESTIC_VIEW_NOT_SERVED'}
 $scan=Invoke-RestMethod "$base/api/autonomy/scan" -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 20
 if($scan.state -ne 'queued' -and $scan.error -ne 'SCAN_COOLDOWN'){throw "SCAN_ENQUEUE_FAILED=$($scan.state)"}
 Write-Host "US_OPPORTUNITY_INTELLIGENCE=PASS DASHBOARD_PID=$($newDash.Id) WORKER_PID=$newWorkerId REA_ENABLED=$($enabled.Count)"
 Write-Host "INITIAL_SCAN=$($scan.state) BACKUP=$backup"
 Write-Host "OPEN=$base/ MENU=Autonomy"
 Write-Host 'BIDDING=DISABLED ACCOUNT_CREATION=DISABLED AUTOMATIC_PURCHASES=DISABLED'
}catch{
 $reason=$_.Exception.Message
 Write-Warning "DOMESTIC_DEPLOY_FAILED=$reason"
 if($newDash){$newDash.Refresh();if(-not $newDash.HasExited){Stop-Process -Id $newDash.Id -Force -ErrorAction SilentlyContinue}}
 Copy-Item (Join-Path $backup 'server.mjs') $server -Force
 Copy-Item (Join-Path $backup 'index.html') $ui -Force
 if($newWorkerId -gt 0){
  $current=Get-CimInstance Win32_Process -Filter "ProcessId=$newWorkerId" -ErrorAction SilentlyContinue
  if($current -and $current.CommandLine -match 'autonomy-v2-github.*service\.mjs'){Stop-Process -Id $newWorkerId -Force -ErrorAction SilentlyContinue}
 }
 foreach($f in $stageFiles){
  $name=$f -replace '\\','-';$saved=Join-Path $backup $name;$dest=Join-Path $stage $f
  if(Test-Path $saved){Copy-Item $saved $dest -Force}
  elseif($created.Contains($dest)){Remove-Item $dest -Force -ErrorAction SilentlyContinue}
 }
 foreach($f in $created){if(Test-Path $f){Remove-Item $f -Force -ErrorAction SilentlyContinue}}
 if($workerStopped){
  for($i=0;$i -lt 40;$i++){if(-not(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 300}
  if(-not(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue)){
   try{& $psExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $stage 'Start.ps1');Write-Warning 'OLD_AUTONOMY_RESTART_ATTEMPTED'}catch{Write-Warning "MANUAL_AUTONOMY_RECOVERY_REQUIRED_FROM=$backup"}
  }
 }
 if($dashStopped){
  for($i=0;$i -lt 40;$i++){if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 300}
  if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){
   try{
    $oldDash2=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir 'domestic-rollback.stdout.log') -RedirectStandardError (Join-Path $logDir 'domestic-rollback.stderr.log')
    Write-Warning "OLD_DASHBOARD_RESTART_ATTEMPTED_PID=$($oldDash2.Id)"
   }catch{Write-Warning "MANUAL_DASHBOARD_RECOVERY_REQUIRED_FROM=$backup"}
  }
 }
 throw "US_OPPORTUNITIES_NOT_QUALIFIED=$reason BACKUP=$backup"
}
