# FI_WEB_CHAT_CONSOLIDATION_V1 — hide duplicate web page and add read-only web search to existing chat.
# Restarts only the existing localhost:8789 Node dashboard; never stops DDGS/llama.cpp/compute/gateway.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Source=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$Server=Join-Path $Live "src\server.mjs"
$Page=Join-Path $Live "public\index.html"
$Target=Join-Path $Live "src\intelligence\chat-web.mjs"
$UiTarget=Join-Path $Live "src\intelligence\chat-web-client.js"
$Module=Join-Path $Source "src\intelligence\chat-web.mjs"
$UiModule=Join-Path $Source "src\intelligence\chat-web-client.js"
$Patcher=Join-Path $Source "scripts\patch-chat-web-consolidation.mjs"
$Test=Join-Path $Source "intelligence-checks\web-chat-consolidation-case.mjs"
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Base="http://127.0.0.1:8789"
$Backup=Join-Path $env:LOCALAPPDATA ("FunIndustrial\WebChatDeployBackups\"+(Get-Date -Format "yyyyMMdd-HHmmss")+"-"+[guid]::NewGuid().ToString("N").Substring(0,8))
$changed=$false;$stopped=$false;$newNode=$null;$phase="preflight"
function Hold([string]$reason){throw ("FUN_WEB_CHAT_HOLD="+$reason)}
function Check([string]$step){if($LASTEXITCODE -ne 0){Hold ("COMMAND_"+$step+"_"+$LASTEXITCODE)}}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ",")
}
function Req([string]$url,[int]$timeout=15){
 Invoke-RestMethod -Uri $url -TimeoutSec $timeout -ErrorAction Stop
}
function DashboardPid(){
 $list=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue|Where-Object{$_.LocalAddress -eq "127.0.0.1"})
 if($list.Count -ne 1){Hold "DASHBOARD_LISTENER_IDENTITY"}
 $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($list[0].OwningProcess)" -ErrorAction Stop
 if(-not $process -or $process.Name -ne "node.exe" -or $process.CommandLine -notmatch 'src[/\\]server\.mjs'){Hold "DASHBOARD_PROCESS_IDENTITY"}
 return [int]$process.ProcessId
}
function StartDashboard([string]$out,[string]$err){
 $env:HOST="127.0.0.1";$env:PORT="8789";$env:COMPUTE_PORT="8791"
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$MemoryBudget
 $env:FUN_VOICE_HOME=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab"
 return Start-Process -FilePath $Node -ArgumentList @("src/server.mjs") -WorkingDirectory $Live -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
}
function WaitDashboard([System.Diagnostics.Process]$process,[bool]$requireWeb){
 for($i=0;$i -lt 60;$i++){
  Start-Sleep -Milliseconds 500;$process.Refresh()
  if($process.HasExited){return $false}
  try{
   $agent=Req "$Base/api/optimization/agent/status" 4
   $memory=Req "$Base/api/ai/automatic-memory/status" 4
   if($agent.state -ne "ready" -or $memory.mode -ne "automatic_contextual_read_only"){continue}
   if($requireWeb){
    $web=Req "$Base/api/web/status" 4
    if($web.state -notin @("running","stopped")){continue}
   }
   if((DashboardPid) -eq $process.Id){return $true}
  }catch{}
 }
 return $false
}
foreach($file in @($Server,$Page,$Module,$UiModule,$Patcher,$Test)){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){Hold ("REQUIRED_FILE_MISSING_"+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "SYMLINK_FILE_DENIED"}
}
if((Test-Path -LiteralPath $Target) -or (Test-Path -LiteralPath $UiTarget)){Hold "WEB_CHAT_ALREADY_OR_PARTIALLY_INSTALLED"}
foreach($dir in @($Source,$Live,(Join-Path $Live "src"),(Join-Path $Live "src\intelligence"))){
 if((Get-Item -LiteralPath $dir).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "SYMLINK_DIRECTORY_DENIED"}
}
$original=[IO.File]::ReadAllText($Server)
foreach($marker in @("FI_WEB_PLATFORM_ACTIVATION_V1","FI_OPTIMIZATION_AGENT_V1","FI_OPTIMIZATION_PHASE23_V1","FI_AUTO_COGNEE_CHAT_V1","FI_VOICE_MOBILE_DASHBOARD_V1","FI_SOURCING_RETIRED_V1")){
 if(-not $original.Contains($marker)){Hold ("BASELINE_MARKER_MISSING_"+$marker)}
}
$originalUi=[IO.File]::ReadAllText($Page)
if(-not $originalUi.Contains("FI_VOICE_MOBILE_PANEL_V1") -or -not $originalUi.Contains("FI_OPTIMIZATION_PHASE23_PANEL_V1")){Hold "CUSTOM_DASHBOARD_UI_BASELINE"}
$protected=@{}
foreach($port in @(8088,8791,8443)){
 $protected[$port]=Snapshot $port
 if(-not $protected[$port]){Hold ("PROTECTED_SERVICE_OFFLINE_"+$port)}
}
$webBefore=Snapshot 4479
$ddgsExecutable=Join-Path $env:USERPROFILE 'FunIndustrial-WebResearch\.venv-search\Scripts\ddgs.exe'
if(-not(Test-Path -LiteralPath $ddgsExecutable -PathType Leaf)){Hold "DDGS_VENV_EXECUTABLE_MISSING"}
if((Get-Item -LiteralPath $ddgsExecutable).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "DDGS_SYMLINK_EXECUTABLE_DENIED"}
if($webBefore){
 $ddgs=Req "http://127.0.0.1:4479/health" 8
 $api=Req "http://127.0.0.1:4479/openapi.json" 8
 if($ddgs.status -ne "healthy" -or $ddgs.service -ne "DDGS API" -or -not $ddgs.version -or -not $api.paths.'/search/text' -or -not $api.paths.'/extract'){Hold "DDGS_IDENTITY_OR_SCHEMA_HOLD"}
 Write-Host 'FUN_WEB_CHAT_EXISTING_WEB=RUNNING_WILL_ADOPT'
}else{
 Write-Host 'FUN_WEB_CHAT_EXISTING_WEB=OFFLINE_WILL_START_ON_ACTIVATE'
}
$originalPid=DashboardPid
$memory=Req "$Base/api/ai/automatic-memory/status" 15
$MemoryBudget=[int]$memory.recallBudgetMs
$voice=Req "$Base/api/voice/mobile/status" 15
$ai=Req "$Base/api/ai/status" 15
$optimizer=Req "$Base/api/optimization/agent/status" 15
$reaBefore=@((Req "$Base/api/rea/tools" 45).tools)
if($memory.mode -ne "automatic_contextual_read_only" -or $memory.enabledByDefault -ne $true -or
   $memory.memoryAvailable -ne $true -or $MemoryBudget -lt 12000 -or $MemoryBudget -gt 180000 -or
   $voice.code -ne "FI_VOICE_MOBILE_UPLOAD_V1" -or $ai.state -ne "ready" -or
   $ai.ownership -ne "external" -or $optimizer.state -ne "ready" -or $reaBefore.Count -ne 229){
 Hold "PRESERVED_SERVICES_NOT_READY"
}
& $Node --check $Module;Check "MODULE_SYNTAX"
& $Node --check $UiModule;Check "CLIENT_SYNTAX"
& $Node --check $Patcher;Check "PATCHER_SYNTAX"
& $Node --test $Test;Check "WEB_CHAT_TESTS"
New-Item -ItemType Directory -Path $Backup -Force|Out-Null
$Before=Join-Path $Backup "server.before.mjs"
$UiBefore=Join-Path $Backup "ui.before.html"
$Staged=Join-Path $Backup "server.staged.mjs"
$StagedUi=Join-Path $Backup "ui.staged.html"
Copy-Item $Server $Before -ErrorAction Stop
Copy-Item $Page $UiBefore -ErrorAction Stop
& $Node $Patcher $Server $Page $Staged $StagedUi;Check "STAGING"
& $Node --check $Staged;Check "STAGED_SERVER_SYNTAX"
if(-not([IO.File]::ReadAllText($Staged)).Contains("FI_WEB_CHAT_CONSOLIDATION_V1") -or
   -not([IO.File]::ReadAllText($StagedUi)).Contains("FI_WEB_CHAT_CONSOLIDATION_UI_V1")){Hold "STAGED_MARKER_MISSING"}
Write-Host "FUN_WEB_CHAT_PREFLIGHT=PASS BACKUP=$Backup DASHBOARD_PID=$originalPid REA=229"
try{
 $phase="copy_staged_chat_sources";$changed=$true
 Copy-Item $Module $Target -ErrorAction Stop
 Copy-Item $UiModule $UiTarget -ErrorAction Stop
 Copy-Item $Staged $Server -Force -ErrorAction Stop
 Copy-Item $StagedUi $Page -Force -ErrorAction Stop
 if((Get-FileHash $Module).Hash -ne (Get-FileHash $Target).Hash -or
    (Get-FileHash $UiModule).Hash -ne (Get-FileHash $UiTarget).Hash -or
    (Get-FileHash $Staged).Hash -ne (Get-FileHash $Server).Hash -or
    (Get-FileHash $StagedUi).Hash -ne (Get-FileHash $Page).Hash){Hold "STAGED_HASH_MISMATCH"}
 $phase="restart_only_dashboard"
 Stop-Process -Id $originalPid -ErrorAction Stop;$stopped=$true
 for($i=0;$i -lt 40;$i++){if(-not(Snapshot 8789)){break};Start-Sleep -Milliseconds 250}
 if(Snapshot 8789){Hold "DASHBOARD_PORT_NOT_RELEASED"}
 $newNode=StartDashboard (Join-Path $Backup "new.stdout.log") (Join-Path $Backup "new.stderr.log")
 if(-not(WaitDashboard $newNode $true)){Hold "DASHBOARD_RESTART_NOT_READY"}
 $phase="web_chat_ui_verification"
 $js=Invoke-WebRequest "$Base/api/ai/chat-web-client.js" -UseBasicParsing -TimeoutSec 12 -ErrorAction Stop
 $home=Invoke-WebRequest "$Base/" -UseBasicParsing -TimeoutSec 12 -ErrorAction Stop
 if($js.StatusCode -ne 200 -or -not $js.Content.Contains("FI_WEB_CHAT_UI_V1") -or
    -not $home.Content.Contains("FI_WEB_CHAT_CONSOLIDATION_UI_V1")){Hold "CHAT_CLIENT_NOT_SERVED"}
 Write-Host "FUN_WEB_CHAT_UI=PASS EXISTING_CHAT_PRESERVED=TRUE WEB_PAGE_HIDDEN=TRUE"
 $phase="exercise_existing_platform_activate"
 $activation=Invoke-RestMethod "$Base/api/activate" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 120 -ErrorAction Stop
 if($activation.web.state -ne "running"){Hold ("WEB_ACTIVATE_DID_NOT_RECOVER_"+$activation.web.action)}
 $activatedWeb=Req "$Base/api/web/status" 15
 if($activatedWeb.state -ne "running" -or -not(Snapshot 4479)){Hold "WEB_ACTIVATE_NOT_HEALTHY"}
 Write-Host ("FUN_WEB_CHAT_ACTIVATE_BUTTON=PASS WEB_ACTION="+$activation.web.action)
 $phase="read_only_rea_reinitialization"
 $reaStarted=$false
 for($i=1;$i -le 3;$i++){
  try{
   $response=Invoke-RestMethod "$Base/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 120 -ErrorAction Stop
   if($response.state -eq "ready"){$reaStarted=$true;break}
  }catch{Write-Warning "FUN_WEB_CHAT_REA_REINIT_RETRY=$i"}
  if($i -lt 3){Start-Sleep -Seconds 3}
 }
 if(-not $reaStarted){Hold "REA_REINITIALIZATION_HOLD"}
 $reaAfter=@();$catalogReady=$false
 for($i=1;$i -le 5;$i++){
  try{
   $reaAfter=@((Req "$Base/api/rea/tools" 45).tools)
   if($reaAfter.Count -eq 229){$catalogReady=$true;break}
  }catch{Write-Warning "FUN_WEB_CHAT_REA_CATALOG_RETRY=$i"}
  if($i -lt 5){Start-Sleep -Seconds 3}
 }
 if(-not $catalogReady -or
    (Compare-Object @($reaBefore|ForEach-Object{$_.name}|Sort-Object) @($reaAfter|ForEach-Object{$_.name}|Sort-Object)).Count){Hold "REA_CATALOGUE_CHANGED"}
 $phase="platform_control_smoke"
 $status=Req "$Base/api/status" 15
 $web=Req "$Base/api/web/status" 15
 $mem=Req "$Base/api/ai/automatic-memory/status" 15
 $v=Req "$Base/api/voice/mobile/status" 15
 $a=Req "$Base/api/ai/status" 15
 $opt=Req "$Base/api/optimization/agent/status" 15
 if($web.state -ne "running" -or @($status.services|Where-Object{$_.id -eq "web" -and $_.state -eq "running"}).Count -ne 1){Hold "WEB_NOT_VISIBLE_IN_PLATFORM_CONTROL"}
 if($mem.mode -ne $memory.mode -or $mem.enabledByDefault -ne $true -or [int]$mem.recallBudgetMs -ne $MemoryBudget){Hold "MEMORY_REGRESSION"}
 if($v.code -ne $voice.code -or $v.enabled -ne $voice.enabled -or
    $a.state -ne "ready" -or $a.ownership -ne "external" -or $opt.state -ne "ready"){Hold "SERVICE_REGRESSION"}
 foreach($port in @(8088,8791,8443)){
  if((Snapshot $port) -ne $protected[$port]){Hold ("PROTECTED_PORT_CHANGED_"+$port)}
 }
 if($webBefore -and (Snapshot 4479) -ne $webBefore){Hold "PREEXISTING_WEB_PROCESS_CHANGED"}
 if(-not $webBefore -and -not(Snapshot 4479)){Hold "WEB_PORT_4479_NOT_STARTED"}
 Write-Host "FUN_WEB_CHAT_CONSOLIDATION=PASS CHAT_LOOKUP=INTEGRATED SEPARATE_WEB_SECTION=HIDDEN"
 Write-Host ("FUN_WEB_CHAT_DDGS=PASS PORT=4479 ACTION="+$activation.web.action)
 Write-Host "FUN_WEB_CHAT_DEPLOY=PASS DASHBOARD=8789 WEB=4479 REA=229 AI=EXTERNAL MEMORY=READ_ONLY VOICE=PRESERVED OPTIMIZATION=PRESERVED"
 Write-Host "FUN_WEB_CHAT_BACKUP=$Backup"
}catch{
 $why=$_.Exception.Message
 Write-Warning "FUN_WEB_CHAT_DEPLOY=HOLD STAGE=$phase REASON=$why"
 if($newNode){$newNode.Refresh();if(-not $newNode.HasExited){Stop-Process -Id $newNode.Id -Force -ErrorAction SilentlyContinue}}
 if($changed){
  Copy-Item $Before $Server -Force -ErrorAction SilentlyContinue
  Copy-Item $UiBefore $Page -Force -ErrorAction SilentlyContinue
  Remove-Item $Target -Force -ErrorAction SilentlyContinue
  Remove-Item $UiTarget -Force -ErrorAction SilentlyContinue
  Write-Warning "FUN_WEB_CHAT_ROLLBACK_FILES=RESTORED"
 }
 if($stopped){
  try{
   for($i=0;$i -lt 30;$i++){if(-not(Snapshot 8789)){break};Start-Sleep -Milliseconds 200}
   if(-not(Snapshot 8789)){
    $restored=StartDashboard (Join-Path $Backup "rollback.stdout.log") (Join-Path $Backup "rollback.stderr.log")
    if(WaitDashboard $restored $false){
     Write-Warning "FUN_WEB_CHAT_PREVIOUS_DASHBOARD=RESTORED PID=$($restored.Id)"
     try{Invoke-RestMethod "$Base/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 120 -ErrorAction Stop|Out-Null}catch{Write-Warning "FUN_WEB_CHAT_ROLLBACK_REA_HOLD"}
    }else{Write-Warning "FUN_WEB_CHAT_ROLLBACK_DASHBOARD_UNCONFIRMED"}
   }else{Write-Warning "FUN_WEB_CHAT_ROLLBACK_PORT_OCCUPIED"}
  }catch{Write-Warning "FUN_WEB_CHAT_ROLLBACK_START_FAILED"}
 }
 throw ("FUN_WEB_CHAT_DEPLOY_HOLD="+$why+" BACKUP="+$Backup)
}
