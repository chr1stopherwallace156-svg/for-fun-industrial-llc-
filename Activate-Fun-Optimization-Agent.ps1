# FI_OPTIMIZATION_AGENT_V1 — additive agent installation on a qualified Phase2/3 dashboard.
# Only the verified 127.0.0.1:8789 Node dashboard is restarted.
# External llama.cpp (8088), compute (8791), HTTPS (8443), REA tool authority,
# voice and Cognee storage are not restarted or altered.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Source=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Base="http://127.0.0.1:8789"
$Server=Join-Path $Live "src\server.mjs"
$Page=Join-Path $Live "public\index.html"
$Module=Join-Path $Live "src\optimization\agent.mjs"
$Client=Join-Path $Live "src\optimization\agent-client.js"
$SrcModule=Join-Path $Source "src\optimization\agent.mjs"
$SrcClient=Join-Path $Source "src\optimization\agent-client.js"
$Panel=Join-Path $Source "src\optimization\agent-panel.html"
$Patcher=Join-Path $Source "scripts\patch-optimization-agent.mjs"
$Test=Join-Path $Source "intelligence-checks\optimization-agent-v1-case.mjs"
$Backup=Join-Path $env:LOCALAPPDATA ("FunIndustrial\OptimizationDeployBackups\"+(Get-Date -Format "yyyyMMdd-HHmmss")+"-agent-"+[guid]::NewGuid().ToString("N").Substring(0,8))
$changed=$false;$stopped=$false;$newNode=$null;$stage="preflight"
function Hold([string]$code){throw "FUN_OPT_AGENT_HOLD=$code"}
function Check([string]$code){if($LASTEXITCODE -ne 0){Hold ("COMMAND_"+$code+"_"+$LASTEXITCODE)}}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ",")
}
function Listener(){
 $ls=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue|Where-Object{$_.LocalAddress -eq "127.0.0.1"})
 if($ls.Count -ne 1){Hold "DASHBOARD_LISTENER_IDENTITY"}
 $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($ls[0].OwningProcess)" -ErrorAction Stop
 if(-not $p -or $p.Name -ne "node.exe" -or $p.CommandLine -notmatch "src[/\\]server\.mjs"){Hold "DASHBOARD_PROCESS_IDENTITY"}
 return $p
}
function Req([string]$url,[int]$timeout=15){
 return Invoke-RestMethod -Uri $url -TimeoutSec $timeout -ErrorAction Stop
}
function StartDashboard([string]$out,[string]$err){
 $env:HOST="127.0.0.1";$env:PORT="8789";$env:COMPUTE_PORT="8791"
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$MemoryBudget
 $env:FUN_VOICE_HOME=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab"
 # Never widen REA_ALLOWED_TOOLS or alter existing REA execution guards.
 return Start-Process -FilePath $Node -ArgumentList @("src/server.mjs") -WorkingDirectory $Live -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
}
function WaitDashboard([System.Diagnostics.Process]$proc,[bool]$agent){
 for($i=0;$i -lt 60;$i++){
  Start-Sleep -Milliseconds 500;$proc.Refresh();if($proc.HasExited){return $false}
  try{
   $m=Req "$Base/api/ai/automatic-memory/status" 4
   if($m.mode -ne "automatic_contextual_read_only" -or $m.enabledByDefault -ne $true){continue}
   if($agent){
    $a=Req "$Base/api/optimization/agent/status" 4
    if($a.state -ne "ready" -or $a.rea_execution -eq $true){continue}
   }
   if([int](Listener).ProcessId -eq $proc.Id){return $true}
  }catch{}
 }
 return $false
}
foreach($p in @($Server,$Page,$SrcModule,$SrcClient,$Panel,$Patcher,$Test,
  (Join-Path $Live "src\optimization\runner.mjs"))){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Hold ("REQUIRED_FILE_MISSING_"+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "SYMLINK_FILE_DENIED"}
}
if(Test-Path -LiteralPath $Module){Hold "AGENT_ALREADY_OR_PARTIALLY_INSTALLED"}
if(Test-Path -LiteralPath $Client){Hold "AGENT_CLIENT_ALREADY_INSTALLED"}
foreach($p in @($Source,$Live,(Join-Path $Live "src\optimization"))){
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "SYMLINK_DIR_DENIED"}
}
$originalServer=[IO.File]::ReadAllText($Server)
$originalPage=[IO.File]::ReadAllText($Page)
if(-not $originalServer.Contains("FI_OPTIMIZATION_PHASE23_V1") -or
   -not $originalServer.Contains("FI_AUTO_COGNEE_CHAT_V1") -or
   -not $originalServer.Contains("FI_VOICE_MOBILE_DASHBOARD_V1") -or
   -not $originalPage.Contains("FI_OPTIMIZATION_PHASE23_PANEL_V1") -or
   -not $originalPage.Contains("FI_VOICE_MOBILE_PANEL_V1")){Hold "EXISTING_DASHBOARD_BASELINE"}
$protected=@{};foreach($port in @(8088,8791,8443)){$protected[$port]=Snapshot $port;if(-not $protected[$port]){Hold "PROTECTED_PORT_MISSING_$port"}}
$old=Listener
$optimizer=Req "$Base/api/optimization/status" 10
if($optimizer.state -ne "ready"){Hold "PHASE23_OPTIMIZER_NOT_READY"}
$memory=Req "$Base/api/ai/automatic-memory/status" 15
if($memory.mode -ne "automatic_contextual_read_only" -or $memory.enabledByDefault -ne $true -or $memory.memoryAvailable -ne $true){Hold "MEMORY_NOT_READY"}
$MemoryBudget=[int]$memory.recallBudgetMs
if($MemoryBudget -lt 12000 -or $MemoryBudget -gt 180000){Hold "MEMORY_BUDGET_UNEXPECTED"}
$voice=Req "$Base/api/voice/mobile/status" 15
if($voice.code -ne "FI_VOICE_MOBILE_UPLOAD_V1"){Hold "VOICE_NOT_READY"}
$ai=Req "$Base/api/ai/status" 15
if($ai.state -ne "ready" -or $ai.ownership -ne "external"){Hold "EXTERNAL_LLAMA_NOT_READY"}
$reaBefore=@((Req "$Base/api/rea/tools" 45).tools)
if($reaBefore.Count -ne 229){Hold "REA_229_NOT_READY"}
& $Node --check $SrcModule;Check "AGENT_SYNTAX"
& $Node --check $SrcClient;Check "CLIENT_SYNTAX"
& $Node --check $Patcher;Check "PATCHER_SYNTAX"
& $Node --test $Test;Check "AGENT_TESTS"
New-Item -ItemType Directory -Path $Backup -Force|Out-Null
$OldServer=Join-Path $Backup "server.before.mjs"
$OldPage=Join-Path $Backup "dashboard.before.html"
$StageServer=Join-Path $Backup "server.staged.mjs"
$StagePage=Join-Path $Backup "dashboard.staged.html"
Copy-Item $Server $OldServer;Copy-Item $Page $OldPage
& $Node $Patcher $Server $Page $StageServer $StagePage $Panel;Check "STAGING"
& $Node --check $StageServer;Check "STAGED_SERVER_SYNTAX"
if(-not([IO.File]::ReadAllText($StageServer)).Contains("FI_OPTIMIZATION_AGENT_V1") -or
   -not([IO.File]::ReadAllText($StagePage)).Contains("FI_OPTIMIZATION_AGENT_PANEL_V1")){Hold "STAGED_MARKERS"}
Write-Host "FUN_OPT_AGENT_PREFLIGHT=PASS BACKUP=$Backup DASHBOARD_PID=$($old.ProcessId) REA=229"
try{
 $stage="copy_staged_sources";$changed=$true
 Copy-Item $SrcModule $Module -ErrorAction Stop
 Copy-Item $SrcClient $Client -ErrorAction Stop
 Copy-Item $StageServer $Server -Force -ErrorAction Stop
 Copy-Item $StagePage $Page -Force -ErrorAction Stop
 if((Get-FileHash $SrcModule).Hash -ne (Get-FileHash $Module).Hash -or
    (Get-FileHash $SrcClient).Hash -ne (Get-FileHash $Client).Hash -or
    (Get-FileHash $StageServer).Hash -ne (Get-FileHash $Server).Hash -or
    (Get-FileHash $StagePage).Hash -ne (Get-FileHash $Page).Hash){Hold "STAGED_HASH_MISMATCH"}
 $stage="restart_only_dashboard_8789"
 Stop-Process -Id ([int]$old.ProcessId) -ErrorAction Stop;$stopped=$true
 for($i=0;$i -lt 40;$i++){if(-not(Snapshot 8789)){break};Start-Sleep -Milliseconds 250}
 if(Snapshot 8789){Hold "PORT_8789_NOT_RELEASED"}
 $newNode=StartDashboard (Join-Path $Backup "new.stdout.log") (Join-Path $Backup "new.stderr.log")
 if(-not(WaitDashboard $newNode $true)){Hold "DASHBOARD_RESTART_HEALTH"}
 $stage="rea_read_only_catalogue"
 $reaReady=$false
 for($i=1;$i -le 3;$i++){
  try{
   $started=Invoke-RestMethod "$Base/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 120 -ErrorAction Stop
   if($started.state -eq "ready"){$reaReady=$true;break}
  }catch{Write-Warning "FUN_OPT_AGENT_REA_REINITIALIZE_RETRY=$i"}
  if($i -lt 3){Start-Sleep -Seconds 3}
 }
 if(-not $reaReady){Hold "REA_REINITIALIZE_FAILED"}
 $reaAfter=@();$catalogueReady=$false
 for($i=1;$i -le 5;$i++){
  try{$reaAfter=@((Req "$Base/api/rea/tools" 45).tools);if($reaAfter.Count -eq 229){$catalogueReady=$true;break}}catch{Write-Warning "FUN_OPT_AGENT_REA_CATALOGUE_RETRY=$i"}
  if($i -lt 5){Start-Sleep -Seconds 3}
 }
 if(-not $catalogueReady -or
  (Compare-Object @($reaBefore|ForEach-Object{$_.name}|Sort-Object) @($reaAfter|ForEach-Object{$_.name}|Sort-Object)).Count){Hold "REA_CATALOGUE_CHANGED"}
 $stage="read_only_regression_checks"
 $m=Req "$Base/api/ai/automatic-memory/status" 15
 $v=Req "$Base/api/voice/mobile/status" 15
 $a=Req "$Base/api/ai/status" 15
 if($m.mode -ne $memory.mode -or $m.enabledByDefault -ne $true -or [int]$m.recallBudgetMs -ne $MemoryBudget){Hold "MEMORY_REGRESSION"}
 if($v.code -ne $voice.code -or $v.enabled -ne $voice.enabled){Hold "VOICE_REGRESSION"}
 if($a.state -ne "ready" -or $a.ownership -ne "external"){Hold "LLAMA_ADOPTION_REGRESSION"}
 foreach($port in @(8088,8791,8443)){if((Snapshot $port) -ne $protected[$port]){Hold "PROTECTED_PORT_CHANGED_$port"}}
 $stage="agent_http_smoke"
 $status=Req "$Base/api/optimization/agent/status" 10
 if($status.state -ne "ready" -or $status.rea_execution -ne $false -or $status.local_solver_execution -ne $true){Hold "AGENT_STATUS"}
 $web=Invoke-WebRequest "$Base/" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
 if(-not $web.Content.Contains("FI_OPTIMIZATION_AGENT_PANEL_V1") -or
    -not $web.Content.Contains("FI_OPTIMIZATION_PHASE23_PANEL_V1") -or
    -not $web.Content.Contains("FI_VOICE_MOBILE_PANEL_V1")){Hold "UI_PRESERVATION"}
 $clientWeb=Invoke-WebRequest "$Base/api/optimization/agent/client.js" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
 if(-not $clientWeb.Content.Contains("FI_OPTIMIZATION_AGENT_CLIENT_V1")){Hold "CLIENT_ROUTE"}
 $denied=$false
 try{
  Invoke-RestMethod "$Base/api/optimization/agent/approve" -Method POST -ContentType "application/json" -Body '{"action":"save-report","ticket":"fake"}' -TimeoutSec 10 -ErrorAction Stop|Out-Null
 }catch{$denied=([int]$_.Exception.Response.StatusCode -eq 403)}
 if(-not $denied){Hold "UNAPPROVED_ACTION_WAS_NOT_DENIED"}
 $problem='{"request":"Optimize project allocation","problem":{"budget":20,"labor_capacity":12,"projects":[{"id":"repair","cost":6,"labor":4,"value":15,"max_units":2},{"id":"inspection","cost":4,"labor":2,"value":8,"max_units":3}]}}'
 $result=Invoke-RestMethod "$Base/api/optimization/agent/analyze" -Method POST -Headers @{"x-fi-optimization-approval"="operator-reviewed"} -ContentType "application/json" -Body $problem -TimeoutSec 35 -ErrorAction Stop
 if($result.state -ne "computed" -or $result.engine -ne "google-or-tools" -or
    $result.result.result.solution_found -ne $true -or $result.rea_tools_executed -ne 0 -or
    $result.external_actions_executed -ne 0 -or -not $result.approval_ticket){Hold "AGENT_LOCAL_SOLVER_EXECUTION"}
 foreach($port in @(8088,8791,8443)){if((Snapshot $port) -ne $protected[$port]){Hold "POST_TEST_PROTECTED_PORT_CHANGED_$port"}}
 Write-Host "FUN_OPT_AGENT_LOCAL_SOLVER=PASS ENGINE=GOOGLE_OR_TOOLS REAL_EXECUTION=TRUE"
 Write-Host "FUN_OPT_AGENT_ACTION_PLAN=READY APPROVED_EXPORT=AVAILABLE EXTERNAL_ACTIONS=0 REA_TOOLS=0"
 Write-Host "FUN_OPT_AGENT_DEPLOY=PASS DASHBOARD=8789 REA=229 MEMORY=READ_ONLY VOICE=PRESERVED LLAMA_CPP=EXTERNAL"
 Write-Host "FUN_OPT_AGENT_BACKUP=$Backup"
}catch{
 $why=$_.Exception.Message
 Write-Warning "FUN_OPT_AGENT_DEPLOY=HOLD STAGE=$stage REASON=$why"
 if($newNode){$newNode.Refresh();if(-not $newNode.HasExited){Stop-Process -Id $newNode.Id -Force -ErrorAction SilentlyContinue}}
 if($changed){
  Copy-Item $OldServer $Server -Force -ErrorAction SilentlyContinue
  Copy-Item $OldPage $Page -Force -ErrorAction SilentlyContinue
  Remove-Item $Module -Force -ErrorAction SilentlyContinue
  Remove-Item $Client -Force -ErrorAction SilentlyContinue
  Write-Warning "FUN_OPT_AGENT_ROLLBACK_FILES=RESTORED"
 }
 if($stopped){
  try{
   for($i=0;$i -lt 30;$i++){if(-not(Snapshot 8789)){break};Start-Sleep -Milliseconds 200}
   if(Snapshot 8789){Write-Warning "FUN_OPT_AGENT_ROLLBACK_PORT_OCCUPIED"}
   else{
    $restore=StartDashboard (Join-Path $Backup "rollback.stdout.log") (Join-Path $Backup "rollback.stderr.log")
    if(WaitDashboard $restore $false){
     Write-Warning "FUN_OPT_AGENT_PREVIOUS_DASHBOARD=RESTORED PID=$($restore.Id)"
     try{Invoke-RestMethod "$Base/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 120 -ErrorAction Stop|Out-Null}catch{Write-Warning "FUN_OPT_AGENT_ROLLBACK_REA_RECONNECT_HOLD"}
    }else{Write-Warning "FUN_OPT_AGENT_ROLLBACK_DASHBOARD_UNCONFIRMED"}
   }
  }catch{Write-Warning "FUN_OPT_AGENT_ROLLBACK_START_FAILED"}
 }
 throw "FUN_OPT_AGENT_DEPLOY_HOLD=$why BACKUP=$Backup"
}
