# Phase 2/3: controlled additive optimization dashboard and AI advisory deployment.
# Only the verified 127.0.0.1:8789 Node dashboard is briefly restarted.
# Does not stop/alter compute 8791, llama.cpp 8088, gateway 8443,
# Cognee storage, NetBird, voice, Elektron/Ollama, or REA tool permissions.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Source=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$Opt=Join-Path $env:USERPROFILE "FunIndustrial-Optimization-20261109"
$Py=Join-Path $env:LOCALAPPDATA "FunIndustrial\OptimizationRuntime\venv\Scripts\python.exe"
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Server=Join-Path $Live "src\server.mjs"
$Page=Join-Path $Live "public\index.html"
$ModuleDir=Join-Path $Live "src\optimization"
$Module=Join-Path $ModuleDir "runner.mjs"
$Client=Join-Path $ModuleDir "client.js"
$SourceModule=Join-Path $Source "src\optimization\runner.mjs"
$SourceClient=Join-Path $Source "src\optimization\client.js"
$Panel=Join-Path $Source "src\optimization\panel.html"
$Patcher=Join-Path $Source "scripts\patch-optimization-dashboard.mjs"
$Test=Join-Path $Source "intelligence-checks\optimization-phase23-case.mjs"
$Base="http://127.0.0.1:8789"
$Backup=Join-Path $env:LOCALAPPDATA ("FunIndustrial\OptimizationDeployBackups\"+(Get-Date -Format "yyyyMMdd-HHmmss")+"-"+[guid]::NewGuid().ToString("N").Substring(0,8))
$changed=$false;$stopped=$false;$newNode=$null;$phase="preflight"
function Hold([string]$code){throw "FUN_OPTIMIZATION_DEPLOY_HOLD=$code"}
function Check([string]$where){if($LASTEXITCODE -ne 0){Hold ("COMMAND_"+$where+"_"+$LASTEXITCODE)}}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
   ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ",")
}
function Listener(){
 $l=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue|
   Where-Object{$_.LocalAddress -eq "127.0.0.1"})
 if($l.Count -ne 1){Hold "DASHBOARD_LISTENER_IDENTITY"}
 $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($l[0].OwningProcess)" -ErrorAction Stop
 if(-not $p -or $p.Name -ne "node.exe" -or $p.CommandLine -notmatch "src[/\\]server\.mjs"){Hold "DASHBOARD_PROCESS_NOT_VERIFIED"}
 return $p
}
function Request([string]$url,[int]$timeout=15){
 return Invoke-RestMethod -Uri $url -TimeoutSec $timeout -ErrorAction Stop
}
function StartDashboard([string]$stdout,[string]$stderr){
 $env:HOST="127.0.0.1";$env:PORT="8789";$env:COMPUTE_PORT="8791"
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$MemoryBudget
 return Start-Process -FilePath $Node -ArgumentList @("src/server.mjs") -WorkingDirectory $Live -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
}
function WaitDashboard([System.Diagnostics.Process]$process,[bool]$optimization){
 for($i=0;$i -lt 60;$i++){
  Start-Sleep -Milliseconds 500;$process.Refresh();if($process.HasExited){return $false}
  try{
   $m=Request "$Base/api/ai/automatic-memory/status" 4
   if($m.mode -ne "automatic_contextual_read_only" -or $m.enabledByDefault -ne $true){continue}
   if($optimization){
    $o=Request "$Base/api/optimization/status" 4
    if($o.state -ne "ready" -or $o.reaToolsExecuted -ne 0){continue}
   }
   if([int](Listener).ProcessId -eq $process.Id){return $true}
  }catch{}
 }
 return $false
}
foreach($p in @($Server,$Page,$Py,$SourceModule,$SourceClient,$Panel,$Patcher,$Test,
 (Join-Path $Opt "fun_optimization\bridge.py"),
 (Join-Path $Opt "fun_optimization\core.py"))){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Hold "REQUIRED_FILE_MISSING"}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "SYMLINK_FILE_DENIED"}
}
if(Test-Path -LiteralPath $ModuleDir){Hold "OPTIMIZATION_ALREADY_OR_PARTIALLY_DEPLOYED"}
foreach($p in @($Source,$Live,$Opt)){
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "SYMLINK_DIR_DENIED"}
}
if(-not([IO.File]::ReadAllText($Server)).Contains("FI_VOICE_MOBILE_DASHBOARD_V1") -or
   -not([IO.File]::ReadAllText($Server)).Contains("FI_AUTO_COGNEE_CHAT_V1") -or
   -not([IO.File]::ReadAllText($Server)).Contains("FI_SOURCING_RETIRED_V1")){Hold "LIVE_SERVER_CUSTOMIZATION_BASELINE"}
if(-not([IO.File]::ReadAllText($Page)).Contains("FI_VOICE_MOBILE_PANEL_V1")){Hold "LIVE_PAGE_VOICE_PRESERVATION"}
$portBefore=@{};foreach($port in @(8088,8791,8443)){$portBefore[$port]=Snapshot $port}
if(-not $portBefore[8088] -or -not $portBefore[8791]){Hold "EXISTING_COMPUTE_OR_LLAMA_UNAVAILABLE"}
$old=Listener
$memory=Request "$Base/api/ai/automatic-memory/status" 15
if($memory.mode -ne "automatic_contextual_read_only" -or
   $memory.enabledByDefault -ne $true -or $memory.memoryAvailable -ne $true){Hold "AUTOMATIC_MEMORY_NOT_READY"}
$MemoryBudget=[int]$memory.recallBudgetMs
if($MemoryBudget -lt 12000 -or $MemoryBudget -gt 180000){Hold "COGNEE_RECALL_BUDGET_UNEXPECTED"}
$reaBefore=@((Request "$Base/api/rea/tools" 45).tools)
if($reaBefore.Count -ne 229){Hold "REA_229_CATALOG_NOT_READY"}
$voiceBefore=Request "$Base/api/voice/mobile/status" 15
if($voiceBefore.code -ne "FI_VOICE_MOBILE_UPLOAD_V1"){Hold "VOICE_PANEL_NOT_READY"}
$aiBefore=Request "$Base/api/ai/status" 12
if($aiBefore.state -ne "ready"){Hold "LLAMA_CPP_NOT_READY"}
Push-Location $Source
try{
 & $Node --check $SourceModule;Check "RUNNER_SYNTAX"
 & $Node --check $SourceClient;Check "CLIENT_SYNTAX"
 & $Node --check $Patcher;Check "PATCHER_SYNTAX"
 & $Node --test $Test;Check "NODE_BOUNDARY_TESTS"
 & $Py -m unittest discover -s tests -p test_fun_optimization.py -v;Check "PYTHON_OPTIMIZATION_TESTS"
 $sample='{"action":"allocation","problem":{"budget":20,"labor_capacity":12,"projects":[{"id":"repair","cost":6,"labor":4,"value":15,"max_units":2},{"id":"inspection","cost":4,"labor":2,"value":8,"max_units":3}]}}'
 $result=$sample|& $Py -m fun_optimization.bridge
 Check "PYTHON_STDIN_BRIDGE"
 $decoded=$result|ConvertFrom-Json
 if($decoded.schema -ne "fun.optimization.result.v1" -or $decoded.result.solution_found -ne $true){Hold "PYTHON_BRIDGE_RESULT"}
}finally{Pop-Location}
New-Item -ItemType Directory -Path $Backup -Force|Out-Null
$OldServer=Join-Path $Backup "server.before.mjs";$OldPage=Join-Path $Backup "dashboard.before.html"
$StageServer=Join-Path $Backup "server.staged.mjs";$StagePage=Join-Path $Backup "dashboard.staged.html"
Copy-Item $Server $OldServer;Copy-Item $Page $OldPage
& $Node $Patcher $Server $Page $StageServer $StagePage $Panel;Check "STAGING"
& $Node --check $StageServer;Check "STAGED_SERVER_SYNTAX"
if(-not([IO.File]::ReadAllText($StageServer)).Contains("FI_OPTIMIZATION_PHASE23_V1") -or
   -not([IO.File]::ReadAllText($StagePage)).Contains("FI_OPTIMIZATION_PHASE23_PANEL_V1")){Hold "STAGED_MARKERS_MISSING"}
Write-Host "FUN_OPTIMIZATION_PREFLIGHT=PASS BACKUP=$Backup DASHBOARD_PID=$($old.ProcessId) REA=229"
try{
 $phase="copy_staged_files"
 $changed=$true
 New-Item -ItemType Directory -Path $ModuleDir -Force|Out-Null
 Copy-Item -LiteralPath $SourceModule -Destination $Module -ErrorAction Stop
 Copy-Item -LiteralPath $SourceClient -Destination $Client -ErrorAction Stop
 Copy-Item -LiteralPath $StageServer -Destination $Server -Force -ErrorAction Stop
 Copy-Item -LiteralPath $StagePage -Destination $Page -Force -ErrorAction Stop
 foreach($pair in @(@($SourceModule,$Module),@($SourceClient,$Client),@($StageServer,$Server),@($StagePage,$Page))){
  if((Get-FileHash $pair[0]).Hash -ne (Get-FileHash $pair[1]).Hash){Hold "STAGED_FILE_HASH_MISMATCH"}
 }
 $phase="restart_only_8789"
 Stop-Process -Id ([int]$old.ProcessId) -ErrorAction Stop;$stopped=$true
 for($i=0;$i -lt 40;$i++){if(-not(Snapshot 8789)){break};Start-Sleep -Milliseconds 250}
 if(Snapshot 8789){Hold "DASHBOARD_PORT_8789_NOT_RELEASED"}
 $newNode=StartDashboard (Join-Path $Backup "new.stdout.log") (Join-Path $Backup "new.stderr.log")
 if(-not(WaitDashboard $newNode $true)){Hold "DASHBOARD_RESTART_HEALTH"}
 $phase="read_only_rea_reinitialize"
 $reaStart=Invoke-RestMethod "$Base/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 120 -ErrorAction Stop
 if($reaStart.state -ne "ready"){Hold "REA_CATALOG_REINITIALIZE"}
 $reaAfter=@((Request "$Base/api/rea/tools" 45).tools)
 if($reaAfter.Count -ne 229 -or
   (Compare-Object @($reaBefore|ForEach-Object{$_.name}|Sort-Object) @($reaAfter|ForEach-Object{$_.name}|Sort-Object)).Count){Hold "REA_229_CHANGED"}
 $memAfter=Request "$Base/api/ai/automatic-memory/status" 15
 if($memAfter.mode -ne $memory.mode -or $memAfter.enabledByDefault -ne $true -or
    [int]$memAfter.recallBudgetMs -ne $MemoryBudget){Hold "COGNEE_MEMORY_REGRESSION"}
 $voiceAfter=Request "$Base/api/voice/mobile/status" 15
 if($voiceAfter.code -ne $voiceBefore.code -or $voiceAfter.enabled -ne $voiceBefore.enabled){Hold "VOICE_REGRESSION"}
 if((Request "$Base/api/ai/status" 12).state -ne "ready"){Hold "LLAMA_CPP_REGRESSION"}
 foreach($port in @(8088,8791,8443)){if((Snapshot $port) -ne $portBefore[$port]){Hold "PROTECTED_PORT_CHANGED_$port"}}
 $phase="optimization_http_smoke"
 $status=Request "$Base/api/optimization/status" 10
 if($status.state -ne "ready" -or $status.aiDraftExecutes -ne $false){Hold "OPTIMIZATION_HTTP_STATUS"}
 $web=Invoke-WebRequest "$Base/" -UseBasicParsing -TimeoutSec 12 -ErrorAction Stop
 if(-not $web.Content.Contains("FI_OPTIMIZATION_PHASE23_PANEL_V1") -or
    -not $web.Content.Contains("FI_VOICE_MOBILE_PANEL_V1")){Hold "DASHBOARD_UI_PRESERVATION"}
 $clientWeb=Invoke-WebRequest "$Base/api/optimization/client.js" -UseBasicParsing -TimeoutSec 12 -ErrorAction Stop
 if(-not $clientWeb.Content.Contains("FI_OPTIMIZATION_PHASE23_CLIENT_V1")){Hold "AI_CLIENT_ROUTE"}
 $denied=$false
 try{Invoke-RestMethod "$Base/api/optimization/run" -Method POST -ContentType "application/json" -Body '{"action":"route","problem":{}}' -TimeoutSec 10 -ErrorAction Stop|Out-Null}catch{$denied=([int]$_.Exception.Response.StatusCode -eq 403)}
 if(-not $denied){Hold "UNAPPROVED_SOLVER_NOT_DENIED"}
 $body='{"action":"allocation","problem":{"budget":20,"labor_capacity":12,"projects":[{"id":"repair","cost":6,"labor":4,"value":15,"max_units":2},{"id":"inspection","cost":4,"labor":2,"value":8,"max_units":3}]}}'
 $approved=Invoke-RestMethod "$Base/api/optimization/run" -Method POST -Headers @{"x-fi-optimization-approval"="operator-reviewed"} -ContentType "application/json" -Body $body -TimeoutSec 30 -ErrorAction Stop
 if($approved.schema -ne "fun.optimization.result.v1" -or
   $approved.result.solution_found -ne $true -or
   $approved.rea_tools_executed -ne 0 -or
   $approved.external_actions_executed -ne 0){Hold "APPROVED_SOLVER_HTTP_RESULT"}
 foreach($port in @(8088,8791,8443)){if((Snapshot $port) -ne $portBefore[$port]){Hold "POST_TEST_PROTECTED_PORT_CHANGED_$port"}}
 Write-Host "FUN_OPTIMIZATION_PHASE2=PASS DASHBOARD=8789 SOLVER_HTTP=PASS"
 Write-Host "FUN_OPTIMIZATION_PHASE3=ADVISORY_UI_READY LOCAL_LLAMA_CPP=READY AI_GENERATION_TEST=NOT_PERFORMED"
 Write-Host "FUN_OPTIMIZATION_REA_PRESERVED=229 MEMORY=$($memAfter.mode) VOICE=$($voiceAfter.code)"
 Write-Host "FUN_OPTIMIZATION_UNAPPROVED_RUN_DENIAL=PASS OPERATOR_APPROVED_TEST=PASS"
 Write-Host "FUN_OPTIMIZATION_PROTECTED_SERVICES=UNCHANGED COMPUTE=8791 LLAMA_CPP=8088 GATEWAY=8443"
 Write-Host "FUN_OPTIMIZATION_BACKUP=$Backup"
}catch{
 $why=$_.Exception.Message
 Write-Warning "FUN_OPTIMIZATION_DEPLOY=HOLD STAGE=$phase REASON=$why"
 if($newNode){$newNode.Refresh();if(-not $newNode.HasExited){Stop-Process -Id $newNode.Id -Force -ErrorAction SilentlyContinue}}
 if($changed){
  Copy-Item -LiteralPath $OldServer -Destination $Server -Force -ErrorAction SilentlyContinue
  Copy-Item -LiteralPath $OldPage -Destination $Page -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $ModuleDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Warning "FUN_OPTIMIZATION_ROLLBACK_FILES=RESTORED"
 }
 if($stopped){
  try{
   for($i=0;$i -lt 30;$i++){if(-not(Snapshot 8789)){break};Start-Sleep -Milliseconds 200}
   if(Snapshot 8789){Write-Warning "FUN_OPTIMIZATION_ROLLBACK_PORT_OCCUPIED_VERIFY_OWNER"}
   else{
    $restore=StartDashboard (Join-Path $Backup "rollback.stdout.log") (Join-Path $Backup "rollback.stderr.log")
    if(WaitDashboard $restore $false){
     Write-Warning "FUN_OPTIMIZATION_PREVIOUS_DASHBOARD=RESTORED PID=$($restore.Id)"
     try{Invoke-RestMethod "$Base/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 120 -ErrorAction Stop|Out-Null}catch{Write-Warning "FUN_OPTIMIZATION_ROLLBACK_REA_RECONNECT_HOLD"}
    }else{Write-Warning "FUN_OPTIMIZATION_ROLLBACK_DASHBOARD_NOT_CONFIRMED"}
   }
  }catch{Write-Warning "FUN_OPTIMIZATION_ROLLBACK_START_FAILED"}
 }
 throw "FUN_OPTIMIZATION_DEPLOY_HOLD=$why BACKUP=$Backup"
}
