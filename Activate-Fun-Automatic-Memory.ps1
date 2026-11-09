# Deploy automatic contextual Cognee recall into EXISTING Fun Industrial chat.
# Only 8789 Node dashboard is restarted. No UI replacement, REA tool execution,
# Python installation, memory writes, autonomous-worker changes or Ollama access.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Root=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$Src=$PSScriptRoot
$Base="http://127.0.0.1:8789"
$Worker="http://127.0.0.1:8792"
$Server=Join-Path $Root "src\server.mjs"
$Module=Join-Path $Root "src\intelligence\automatic-memory.mjs"
$SourceModule=Join-Path $Src "src\intelligence\automatic-memory.mjs"
$Patcher=Join-Path $Src "scripts\patch-automatic-memory.mjs"
$Test=Join-Path $Src "intelligence-checks\automatic-memory-case.mjs"
$Recovery=Join-Path $Src "Recover-Fun-Compute.ps1"
$Backup=Join-Path $env:LOCALAPPDATA ("FunIndustrial\AutoMemoryDeployBackups\"+(Get-Date -Format "yyyyMMdd-HHmmss")+"-"+[guid]::NewGuid().ToString("N").Substring(0,8))
$node=(Get-Command node.exe -ErrorAction Stop).Source
$changed=$false;$stopped=$false;$newUI=$null;$oldTools=@();$original=$null;$oldAutonomy=$null;$step="not_started"
# This Windows deployment has an independently verified compute endpoint at 8791.
$ComputePort=8791
function CheckCompute(){
 try{
  $c=Invoke-RestMethod "http://127.0.0.1:$ComputePort/health" -TimeoutSec 5 -ErrorAction Stop
  return $c.state -eq "running"
 }catch{return $false}
}

function Okay([string]$label){if($LASTEXITCODE -ne 0){throw "$label EXIT=$LASTEXITCODE"}}
function RecoverCompute(){
 Write-Warning "AUTO_MEMORY_COMPUTE_UNAVAILABLE PORT=$ComputePort; attempting isolated compute recovery"
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Recovery
 Okay "AUTO_MEMORY_COMPUTE_RECOVERY_FAILED"
 if(-not(CheckCompute)){throw "AUTO_MEMORY_RECOVERY_UNHEALTHY_PORT=$ComputePort"}
 Write-Host "AUTO_MEMORY_COMPUTE_RECOVERY=PASS PORT=$ComputePort"
}
function Listener(){
 $list=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue|Where-Object {$_.LocalAddress -eq "127.0.0.1"})
 if($list.Count -ne 1){throw "AUTO_MEMORY_LISTENER_HOLD COUNT=$($list.Count)"}
 $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$($list[0].OwningProcess)" -ErrorAction Stop
 if(-not $proc -or $proc.Name -ne "node.exe" -or $proc.CommandLine -notmatch "src[/\\]server\.mjs"){throw "AUTO_MEMORY_NODE_IDENTITY_HOLD"}
 return $proc
}
function Gone([string]$url){
 try{$r=Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop;$code=[int]$r.StatusCode}
 catch{if($_.Exception.Response){$code=[int]$_.Exception.Response.StatusCode}else{throw}}
 if($code -ne 410){throw "RETIRED_SOURCING_CHANGED URL=$url CODE=$code"}
}
function StartDashboard([string]$out,[string]$err){
 $env:HOST="127.0.0.1";$env:PORT="8789";$env:COMPUTE_PORT=[string]$ComputePort
 # Preserve the catalog exposure observed before restart, matching legacy deployment.
 $env:REA_ALLOWED_TOOLS=($oldTools|ForEach-Object {$_.name}) -join ","
 return Start-Process -FilePath $node -ArgumentList "src/server.mjs" -WorkingDirectory $Root -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
}
function Ready([System.Diagnostics.Process]$p,[bool]$requireAuto){
 for($i=0;$i -lt 55;$i++){
  Start-Sleep -Milliseconds 700
  $p.Refresh();if($p.HasExited){return $false}
  try{
   $status=Invoke-RestMethod "$Base/api/intelligence/status" -TimeoutSec 4 -ErrorAction Stop
   if($status.memory.enabled -ne $true -or $status.rules.engine -ne "json-rules-engine"){continue}
   if($requireAuto){
    $s=Invoke-RestMethod "$Base/api/ai/automatic-memory/status" -TimeoutSec 4 -ErrorAction Stop
    if($s.mode -ne "automatic_contextual_read_only" -or $s.enabledByDefault -ne $true -or $s.memoryAvailable -ne $true){continue}
   }
   $owner=Listener
   if([int]$owner.ProcessId -ne $p.Id){throw "UNEXPECTED_8789_PROCESS"}
   return $true
  }catch{}
 }
 return $false
}
foreach($f in @($Server,$SourceModule,$Patcher,$Test,$Recovery,(Join-Path $Root "src\intelligence\memory.mjs"))){
 if(-not(Test-Path -LiteralPath $f -PathType Leaf)){throw "AUTO_MEMORY_REQUIRED_FILE_HOLD=$f"}
}
if(Test-Path -LiteralPath $Module){throw "AUTO_MEMORY_MODULE_ALREADY_EXISTS_HOLD"}
$serverText=[IO.File]::ReadAllText($Server)
if(-not $serverText.Contains("FI_LOCAL_INTELLIGENCE_V1") -or -not $serverText.Contains("FI_SOURCING_RETIRED_V1")){
 throw "AUTO_MEMORY_BASELINE_MISSING"
}
if($serverText.Contains("FI_AUTO_COGNEE_CHAT_V1") -or $serverText.Contains("FI_OPT_IN_MEMORY_CHAT_V1")){
 throw "AUTO_MEMORY_PATCH_CONFLICT_HOLD"
}
$original=Listener
if(-not(CheckCompute)){throw "AUTO_MEMORY_COMPUTE_PREFLIGHT_HOLD PORT=$ComputePort"}
$computeListeners=@(Get-NetTCPConnection -LocalPort $ComputePort -State Listen -ErrorAction Stop|Where-Object {$_.LocalAddress -eq "127.0.0.1"})
if($computeListeners.Count -ne 1){throw "AUTO_MEMORY_COMPUTE_LISTENER_HOLD"}
$computePid=[int]$computeListeners[0].OwningProcess
$computeProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$computePid" -ErrorAction Stop
if([int]$computeProcess.ParentProcessId -eq [int]$original.ProcessId){
 throw "AUTO_MEMORY_COMPUTE_CHILD_OF_DASHBOARD_HOLD PID=$computePid"
}
Write-Host "AUTO_MEMORY_COMPUTE_PREFLIGHT=PASS PORT=$ComputePort PID=$computePid"
$before=Invoke-RestMethod "$Base/api/status" -TimeoutSec 25 -ErrorAction Stop
if($before.application -ne "Fun Industrial Platform"){throw "AUTO_MEMORY_PLATFORM_NOT_RUNNING"}
$oldAutonomy=@($before.services|Where-Object {$_.id -eq "autonomy"}|Select-Object -First 1)
$mem=Invoke-RestMethod "$Base/api/intelligence/status" -TimeoutSec 25 -ErrorAction Stop
if($mem.memory.enabled -ne $true -or $mem.rules.engine -ne "json-rules-engine"){throw "AUTO_MEMORY_PRECHECK_HOLD"}
$ai=Invoke-RestMethod "$Base/api/ai/status" -TimeoutSec 25 -ErrorAction Stop
if($ai.state -ne "ready"){throw "AUTO_MEMORY_LLAMA_NOT_READY_HOLD=$($ai.state)"}
$oldTools=@((Invoke-RestMethod "$Base/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools)
$unified=Invoke-RestMethod "$Base/api/unified/status" -TimeoutSec 25 -ErrorAction Stop
if($oldTools.Count -ne 229 -or [int]$unified.rea_enabled -ne 229){throw "AUTO_MEMORY_REA_SCOPE_HOLD"}
Gone "$Base/api/autonomy/opportunities";Gone "$Base/api/autonomy/international"
Gone "$Worker/api/opportunities";Gone "$Worker/api/international"
& $node --check $SourceModule;Okay "AUTO_MEMORY_MODULE_SYNTAX_HOLD"
& $node --check $Patcher;Okay "AUTO_MEMORY_PATCHER_SYNTAX_HOLD"
& $node --test $Test;Okay "AUTO_MEMORY_TESTS_HOLD"
New-Item -ItemType Directory -Path $Backup -Force|Out-Null
$oldServer=Join-Path $Backup "original-server.mjs"
$stageServer=Join-Path $Backup "staged-server.mjs"
Copy-Item -LiteralPath $Server -Destination $oldServer -ErrorAction Stop
& $node $Patcher $Server $stageServer;Okay "AUTO_MEMORY_PATCH_HOLD"
& $node --check $stageServer;Okay "AUTO_MEMORY_STAGED_SYNTAX_HOLD"
$stagedText=[IO.File]::ReadAllText($stageServer)
if(-not $stagedText.Contains("FI_AUTO_COGNEE_CHAT_V1") -or -not $stagedText.Contains("FI_SOURCING_RETIRED_V1")){throw "AUTO_MEMORY_STAGING_HOLD"}
$hash=(Get-FileHash -LiteralPath $stageServer -Algorithm SHA256).Hash
$moduleHash=(Get-FileHash -LiteralPath $SourceModule -Algorithm SHA256).Hash
Write-Host "AUTO_MEMORY_PREFLIGHT=PASS REA=229 COGNEE=enabled LLAMA_CPP=ready COMPUTE_PORT=$ComputePort BACKUP=$Backup"
try{
 $step="install_staged_files"
 $changed=$true
 Copy-Item -LiteralPath $SourceModule -Destination $Module -ErrorAction Stop
 Copy-Item -LiteralPath $stageServer -Destination $Server -Force -ErrorAction Stop
 if((Get-FileHash $Server -Algorithm SHA256).Hash -ne $hash -or (Get-FileHash $Module -Algorithm SHA256).Hash -ne $moduleHash){throw "AUTO_MEMORY_HASH_HOLD"}
 $step="stop_old_dashboard"
 Stop-Process -Id ([int]$original.ProcessId) -ErrorAction Stop
 $stopped=$true
 for($i=0;$i -lt 40;$i++){
  if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Milliseconds 250
 }
 if(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue){throw "AUTO_MEMORY_PORT_STILL_LISTENING_HOLD"}
 $step="start_patched_dashboard"
 $newUI=StartDashboard (Join-Path $Backup "patched.stdout.log") (Join-Path $Backup "patched.stderr.log")
 $step="check_patched_dashboard_readiness"
 if(-not(Ready $newUI $true)){throw "AUTO_MEMORY_DASHBOARD_STARTUP_HOLD"}
 Write-Host "AUTO_MEMORY_STAGE=dashboard_ready"
 $step="compute_ready_after_restart"
 if(-not(CheckCompute)){
  $step="recover_compute_after_restart"
  RecoverCompute
 }
 $step="verify_recovered_compute"
 $computeReady=$false
 for($i=0;$i -lt 45;$i++){
  if(CheckCompute){
   try{
    $readyAI=Invoke-RestMethod "$Base/api/ai/status" -TimeoutSec 6 -ErrorAction Stop
    if($readyAI.state -eq "ready"){$computeReady=$true;break}
   }catch{}
  }
  Start-Sleep -Seconds 1
 }
 if(-not $computeReady){throw "AUTO_MEMORY_COMPUTE_NOT_READY_AFTER_RESTART PORT=$ComputePort"}
 Write-Host "AUTO_MEMORY_COMPUTE_AFTER_RESTART=PASS PORT=$ComputePort"
 $step="rea_start"
 $r=Invoke-RestMethod "$Base/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 120 -ErrorAction Stop
 if($r.state -ne "ready"){throw "AUTO_MEMORY_REA_RECONNECT_HOLD"}
 $step="rea_tools"
 $tools=@((Invoke-RestMethod "$Base/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools)
 $step="unified_status"
 $unifiedAfter=Invoke-RestMethod "$Base/api/unified/status" -TimeoutSec 25 -ErrorAction Stop
 if($tools.Count -ne $oldTools.Count -or [int]$unifiedAfter.rea_enabled -ne 229){throw "AUTO_MEMORY_REA_REGRESSION_HOLD"}
 $oldNames=@($oldTools|ForEach-Object {$_.name}|Sort-Object)
 $newNames=@($tools|ForEach-Object {$_.name}|Sort-Object)
 if((Compare-Object $oldNames $newNames).Count){throw "AUTO_MEMORY_REA_NAMES_REGRESSION_HOLD"}
 $step="retired_routes"
 Gone "$Base/api/autonomy/opportunities";Gone "$Base/api/autonomy/international"
 Gone "$Worker/api/opportunities";Gone "$Worker/api/international"
 $step="platform_status"
 $now=Invoke-RestMethod "$Base/api/status" -TimeoutSec 25 -ErrorAction Stop
 $autonomy=@($now.services|Where-Object {$_.id -eq "autonomy"}|Select-Object -First 1)
 if($oldAutonomy.Count -and $oldAutonomy[0].state -eq "running" -and (!$autonomy.Count -or $autonomy[0].state -ne "running")){throw "AUTO_MEMORY_AUTONOMY_REGRESSION_HOLD"}
 $step="automatic_memory_status"
 $status=Invoke-RestMethod "$Base/api/ai/automatic-memory/status" -TimeoutSec 15 -ErrorAction Stop
 if($status.mode -ne "automatic_contextual_read_only" -or $status.memoryWrites -ne $false -or $status.memoryGrantsToolAuthority -ne $false){throw "AUTO_MEMORY_POLICY_HOLD"}
 $body=@{messages=@(@{role="user";content="What approval is required before external tool execution at Fun Industrial?"});max_tokens=96;temperature=0;tools=@()}|ConvertTo-Json -Depth 7 -Compress
 $step="live_chat"
 $reply=Invoke-RestMethod "$Base/api/ai/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 210 -ErrorAction Stop
 if(-not ($reply.reply -is [string]) -or -not $reply.reply.Trim()){throw "AUTO_MEMORY_MODEL_RESPONSE_EMPTY"}
 if(@($reply.tool_calls).Count -gt 0){throw "AUTO_MEMORY_UNEXPECTED_TOOL_PROPOSAL_HOLD"}
 $step="post_chat_memory_status"
 $verify=Invoke-RestMethod "$Base/api/ai/automatic-memory/status" -TimeoutSec 15 -ErrorAction Stop
 if($verify.lastRecallState -ne "included" -or [int]$verify.lastExcerptsIncluded -lt 1){throw "AUTO_MEMORY_LIVE_RECALL_NOT_INCLUDED_HOLD STATE=$($verify.lastRecallState)"}
 Write-Host "AUTO_MEMORY_DEPLOY=PASS CHAT_HTTP=200 MODE=$($verify.mode) EXCERPTS=$($verify.lastExcerptsIncluded) REA=229 TOOLS_EXECUTED=0 MEMORY_WRITES=0"
 Write-Host "AUTO_MEMORY_UI=ORIGINAL_UNCHANGED NO_CHECKBOX ADDED=NONE"
 Write-Host "BACKUP=$Backup"
}catch{
 $reason=$_.Exception.Message
 $http="NO_RESPONSE";$httpBody=""
 if($_.Exception.Response){
  try{$http=[int]$_.Exception.Response.StatusCode}catch{}
  try{
   $responseStream=$_.Exception.Response.GetResponseStream()
   if($responseStream){$reader=New-Object System.IO.StreamReader($responseStream);$httpBody=$reader.ReadToEnd()}
  }catch{$httpBody="BODY_READ_FAILED"}
 }
 if($httpBody.Length -gt 1800){$httpBody=$httpBody.Substring(0,1800)}
 Write-Warning "AUTO_MEMORY_FAILURE_STAGE=$step HTTP=$http"
 if($httpBody){Write-Warning "AUTO_MEMORY_HTTP_RESPONSE=$httpBody"}
 Write-Warning "AUTO_MEMORY_DEPLOY=HOLD REASON=$reason"
 if($newUI){$newUI.Refresh();if(-not $newUI.HasExited){Stop-Process -Id $newUI.Id -Force -ErrorAction SilentlyContinue}}
 if($changed){
  Copy-Item -LiteralPath $oldServer -Destination $Server -Force -ErrorAction Stop
  Remove-Item -LiteralPath $Module -Force -ErrorAction SilentlyContinue
  Write-Warning "AUTO_MEMORY_ROLLBACK_FILES=RESTORED"
 }
 if($stopped){
  try{
   $restore=StartDashboard (Join-Path $Backup "rollback.stdout.log") (Join-Path $Backup "rollback.stderr.log")
   if(Ready $restore $false){
    Write-Warning "PREVIOUS_DASHBOARD_RESTART=PASS PID=$($restore.Id)"
    if(-not(CheckCompute)){
     try{RecoverCompute}catch{Write-Warning "ROLLBACK_COMPUTE_RECOVERY_HOLD=$($_.Exception.Message)"}
    }
    if(CheckCompute){Write-Warning "ROLLBACK_COMPUTE_HEALTH=PASS PORT=$ComputePort"}
    try{
     $re=Invoke-RestMethod "$Base/api/rea/start" -Method POST -Body "{}" -ContentType "application/json" -TimeoutSec 120 -ErrorAction Stop
     $count=@((Invoke-RestMethod "$Base/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools).Count
     Write-Warning "PREVIOUS_REA_CATALOG=$($re.state) COUNT=$count"
    }catch{Write-Warning "PREVIOUS_REA_RECONNECT_HOLD=$($_.Exception.Message)"}
   }else{Write-Warning "PREVIOUS_DASHBOARD_RESTART_UNCONFIRMED"}
  }catch{Write-Warning "AUTO_MEMORY_ROLLBACK_RESTART_HOLD=$($_.Exception.Message)"}
 }
 throw "AUTO_MEMORY_DEPLOY_HOLD=$reason BACKUP=$Backup"
}
