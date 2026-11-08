# Reversible retirement of domestic + international sourcing from Fun Industrial.
# This script does NOT delete stored evidence, source files, SQLite, Git history, AI or REA.
[CmdletBinding()]
param([string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation')
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$source=[IO.Path]::GetFullPath($PSScriptRoot)
$installed=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$ps=(Get-Command powershell.exe -ErrorAction Stop).Source
$uiUrl='http://127.0.0.1:8789';$workerUrl='http://127.0.0.1:8792'
$transform=Join-Path $source 'scripts\retire-sourcing-transform.mjs'
$tests=Join-Path $source 'test\retire-sourcing.test.mjs'
$launcher=Join-Path $installed 'Start.ps1'
$logDir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
$paths=@(
 @{id='worker/src/http.mjs';original=(Join-Path $installed 'src\http.mjs')},
 @{id='worker/src/jobs.mjs';original=(Join-Path $installed 'src\jobs.mjs')},
 @{id='worker/src/service.mjs';original=(Join-Path $installed 'src\service.mjs')},
 @{id='platform/src/server.mjs';original=(Join-Path $Root 'src\server.mjs')},
 @{id='platform/public/index.html';original=(Join-Path $Root 'public\index.html')}
)
foreach($p in @($transform,$tests,$launcher)+@($paths|ForEach-Object {$_.original})){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){throw "SOURCING_RETIRE_PREREQUISITE_MISSING=$p"}
}
& $node --check $transform;if($LASTEXITCODE -ne 0){throw 'SOURCING_TRANSFORM_SYNTAX_HOLD'}
& $node --test $tests;if($LASTEXITCODE -ne 0){throw 'SOURCING_RETIRE_TEST_HOLD'}
# Verify live process identity BEFORE any file write or stop.
function ListenProcess([int]$port,[string]$pattern) {
 $listener=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop|Where-Object {$_.LocalAddress -eq '127.0.0.1'}|Select-Object -First 1
 if(-not $listener){throw "EXPECTED_LOOPBACK_PORT_MISSING=$port"}
 $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction Stop
 if(-not $process -or $process.Name -ne 'node.exe' -or $process.CommandLine -notmatch $pattern){throw "UNEXPECTED_PROCESS_FOR_PORT=$port"}
 return $process
}
function WaitForPortDown([int]$port){
 for($i=0;$i -lt 55;$i++){
  if(-not(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)){return}
  Start-Sleep -Milliseconds 300
 }
 throw "PORT_RELEASE_TIMEOUT=$port"
}
function VerifyRetired([string]$url,[string]$method='GET'){
 $code=$null
 try{
  $response=Invoke-WebRequest -Uri $url -Method $method -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
  $code=[int]$response.StatusCode
 }catch{
  $response=$_.Exception.Response
  if($response){$code=[int]$response.StatusCode}else{throw}
 }
 if($code -ne 410){throw "SOURCING_ROUTE_NOT_RETIRED=$url HTTP=$code"}
}
$uiStatus=Invoke-RestMethod "$uiUrl/api/status" -TimeoutSec 15
if($uiStatus.application -ne 'Fun Industrial Platform'){throw 'PRIMARY_PLATFORM_IDENTITY_HOLD'}
# Confirm the primary platform is truly our existing loopback Node process before
# considering an isolated recovery of the 8792 Sidequest service.
$uiProc=ListenProcess 8789 'src[/\\]server\.mjs'
$workerStatus=$null
try{$workerStatus=Invoke-RestMethod "$workerUrl/api/status" -TimeoutSec 15}catch{
 # Fail closed if another process owns the port, or the worker exists but is hung:
 # only start the already-installed trusted Sidequest worker when it is ABSENT.
 $occupied=@(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue)
 if($occupied.Count){throw 'AUTONOMY_8792_PORT_OCCUPIED_BUT_UNHEALTHY_HOLD'}
 $hanging=@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop|Where-Object {
  $_.CommandLine -match 'autonomy-v2-github.*service\.mjs'
 })
 if($hanging.Count){throw 'AUTONOMY_WORKER_PRESENT_BUT_UNHEALTHY_HOLD'}
 Write-Host 'AUTONOMY_8792=STOPPED RECOVERING_ONLY_SIDEQUEST_WORKER=TRUE'
 & $ps -NoProfile -ExecutionPolicy Bypass -File $launcher
 if($LASTEXITCODE -ne 0){throw 'AUTONOMY_WORKER_RECOVERY_FAILED'}
 $workerStatus=Invoke-RestMethod "$workerUrl/api/status" -TimeoutSec 20
}
if($workerStatus.application -ne 'Fun Industrial Autonomous Workers' -or $workerStatus.state -ne 'running'){throw 'LIVE_WORKER_IDENTITY_HOLD'}
$workerProc=ListenProcess 8792 'autonomy-v2-github.*service\.mjs'
if([int]$workerProc.ProcessId -ne [int]$workerStatus.pid){throw 'WORKER_STATUS_PID_MISMATCH'}
$reaTools=@((Invoke-RestMethod "$uiUrl/api/rea/tools" -TimeoutSec 45).tools)
$unified=Invoke-RestMethod "$uiUrl/api/unified/status" -TimeoutSec 30
$reaEnabled=[int]$unified.rea_enabled
if($reaTools.Count -ne 229 -or $reaEnabled -ne 229){throw "REA_REGISTRY_OR_SCOPE_HOLD_TOOLS=$($reaTools.Count)_ENABLED=$reaEnabled"}
if(([IO.File]::ReadAllText((Join-Path $Root 'public\index.html'))).Contains('FI_SOURCING_RETIRED_V1')){throw 'SOURCING_ALREADY_RETIRED'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutonomyLab\SourcingRetirementBackups\'+$stamp+'-'+[guid]::NewGuid().ToString('N').Substring(0,7))
$stage=Join-Path $backup 'stage'
$orig=Join-Path $backup 'original'
New-Item -ItemType Directory -Path @($stage,$orig,$logDir) -Force|Out-Null
foreach($p in $paths){
 $save=Join-Path $orig ($p.id.Replace('/','_'))
 Copy-Item -LiteralPath $p.original -Destination $save -ErrorAction Stop
}
Write-Host "SOURCING_BACKUP=PASS FILES=5 LOCATION=$backup"
& $node $transform $Root $installed $stage
if($LASTEXITCODE -ne 0){throw "SOURCING_RETIRE_STAGE_HOLD ORIGINALS_UNTOUCHED=TRUE BACKUP=$backup"}
$patched=$false;$workerStopped=$false;$uiStopped=$false;$workerNew=0;$uiNew=$null
try{
 foreach($p in $paths){
  $candidate=Join-Path $stage ($p.id.Replace('/','\'))
  if(-not(Test-Path -LiteralPath $candidate -PathType Leaf)){throw "STAGE_FILE_MISSING=$($p.id)"}
  Copy-Item -LiteralPath $candidate -Destination $p.original -Force -ErrorAction Stop
 }
 $patched=$true
 Write-Host "SOURCING_FILES_RETIRED=PASS"
 Write-Host "STOPPING_ONLY_WORKER_PID=$($workerProc.ProcessId)"
 Stop-Process -Id ([int]$workerProc.ProcessId) -Force -ErrorAction Stop;$workerStopped=$true
 WaitForPortDown 8792
 & $ps -NoProfile -ExecutionPolicy Bypass -File $launcher
 if($LASTEXITCODE -ne 0){throw 'WORKER_RESTART_FAILED'}
 $after=Invoke-RestMethod "$workerUrl/api/status" -TimeoutSec 30
 if($after.application -ne 'Fun Industrial Autonomous Workers' -or $after.state -ne 'running' -or $after.schedule.domestic -ne 'retired_no_new_scans'){throw 'WORKER_RETIREMENT_HEALTH_HOLD'}
 $workerNew=[int]$after.pid
 foreach($path in @('/api/opportunities','/api/international','/api/opportunities/scan')){
  VerifyRetired ($workerUrl+$path) $(if($path.EndsWith('/scan')){'POST'}else{'GET'})
 }
 $reaSnapshot=Invoke-RestMethod "$workerUrl/api/rea" -TimeoutSec 20
 $researchSnapshot=Invoke-RestMethod "$workerUrl/api/research" -TimeoutSec 20
 if($null -eq $reaSnapshot -or $null -eq $researchSnapshot){throw 'WORKER_NON_SOURCING_ROUTES_MISSING'}
 Write-Host "SOURCING_WORKER_ROUTES=410 PRESERVED_REA_RESEARCH=TRUE"
 Write-Host "STOPPING_ONLY_DASHBOARD_PID=$($uiProc.ProcessId)"
 Stop-Process -Id ([int]$uiProc.ProcessId) -ErrorAction Stop;$uiStopped=$true
 WaitForPortDown 8789
 $env:PORT='8789';$env:HOST='127.0.0.1'
 $env:REA_ALLOWED_TOOLS=(@($reaTools|ForEach-Object {$_.name}) -join ',')
 $uiNew=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir "sourcing-retired-$stamp.stdout.log") -RedirectStandardError (Join-Path $logDir "sourcing-retired-$stamp.stderr.log")
 $ready=$false
 for($i=0;$i -lt 50;$i++){
  Start-Sleep -Milliseconds 750
  $uiNew.Refresh();if($uiNew.HasExited){break}
  try{if((Invoke-RestMethod "$uiUrl/api/status" -TimeoutSec 4).application -eq 'Fun Industrial Platform'){$ready=$true;break}}catch{}
 }
 if(-not $ready){throw 'DASHBOARD_RESTART_HEALTH_HOLD'}
 $reaStart=Invoke-RestMethod "$uiUrl/api/rea/start" -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 120
 if($reaStart.state -ne 'ready'){throw 'REA_RECONNECT_HOLD'}
 $afterTools=@((Invoke-RestMethod "$uiUrl/api/rea/tools" -TimeoutSec 40).tools)
 $afterUnified=Invoke-RestMethod "$uiUrl/api/unified/status" -TimeoutSec 30
 if($afterTools.Count -ne $reaTools.Count -or [int]$afterUnified.rea_enabled -ne $reaEnabled){throw 'REA_SCOPE_CHANGED_AFTER_RETIREMENT'}
 foreach($route in @('/api/autonomy/opportunities','/api/autonomy/international','/api/autonomy/scan')){
  VerifyRetired ($uiUrl+$route) $(if($route.EndsWith('/scan')){'POST'}else{'GET'})
 }
 $page=(Invoke-WebRequest "$uiUrl/" -UseBasicParsing -TimeoutSec 15).Content
 if(-not $page.Contains('FI_SOURCING_RETIRED_V1') -or $page.Contains('id="fiDomesticScanBtn"') -or $page.Contains('id="fiIntlRefresh"')){throw 'SOURCING_UI_NOT_FULLY_RETIRED'}
 $up=Invoke-RestMethod "$uiUrl/api/autonomy/status" -TimeoutSec 20
 if($up.application -ne 'Fun Industrial Autonomous Workers' -or $up.state -ne 'running'){throw 'AUTONOMY_STATUS_REGRESSION'}
 Write-Host "SOURCING_RETIREMENT=PASS DOMESTIC=RETIRED INTERNATIONAL=RETIRED"
 Write-Host "DATA_DELETED=0 BACKUP=$backup"
 Write-Host "AUTONOMY=RUNNING REA_TOOL_COUNT=$($afterTools.Count) REA_ENABLED=$($afterUnified.rea_enabled)"
 Write-Host "DASHBOARD=$uiUrl/ WORKER=$workerUrl/ PID_DASHBOARD=$($uiNew.Id) PID_WORKER=$workerNew"
 Write-Host 'LOCAL_AI=UNTOUCHED OLLAMA=UNTOUCHED NETBIRD=UNTOUCHED GITHUB_HISTORY=RETAINED'
}catch{
 $why=$_.Exception.Message
 Write-Warning "SOURCING_RETIREMENT=HOLD REASON=$why RESTORE_FROM=$backup"
 # Restore all five original files even if a partial copy happened.
 if($uiNew){$uiNew.Refresh();if(-not $uiNew.HasExited){Stop-Process -Id $uiNew.Id -Force -ErrorAction SilentlyContinue}}
 # A restarted worker may have bound 8792 before its health check succeeded, so
 # identify and stop it even if the new PID was never captured in $workerNew.
 if($workerStopped){
  try{
   $conn=Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue|Where-Object {$_.LocalAddress -eq '127.0.0.1'}|Select-Object -First 1
   if($conn){
    $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
    if($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -match 'autonomy-v2-github.*service\.mjs' -and [int]$p.ProcessId -ne [int]$workerProc.ProcessId){
     Stop-Process -Id ([int]$p.ProcessId) -Force -ErrorAction SilentlyContinue
    }
   }
  }catch{Write-Warning 'ROLLBACK_WORKER_PROCESS_CHECK_FAILED'}
 }
 foreach($p in $paths){Copy-Item -LiteralPath (Join-Path $orig ($p.id.Replace('/','_'))) -Destination $p.original -Force -ErrorAction Stop}
 if($workerStopped){
  try{WaitForPortDown 8792;& $ps -NoProfile -ExecutionPolicy Bypass -File $launcher;Write-Warning 'PREVIOUS_WORKER_RESTART_ATTEMPTED'}catch{Write-Warning "WORKER_MANUAL_RECOVERY_FROM=$backup"}
 }
 if($uiStopped){
  try{
   WaitForPortDown 8789
   $rollback=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir "sourcing-rollback-$stamp.stdout.log") -RedirectStandardError (Join-Path $logDir "sourcing-rollback-$stamp.stderr.log")
   Write-Warning "PREVIOUS_DASHBOARD_RESTART_ATTEMPTED_PID=$($rollback.Id)"
  }catch{Write-Warning "DASHBOARD_MANUAL_RECOVERY_FROM=$backup"}
 }
 throw "SOURCING_RETIREMENT_FAILED=$why BACKUP=$backup"
}
