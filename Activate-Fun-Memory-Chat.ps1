# Opt-in, read-only Cognee -> local llama.cpp chat, separate from Elektron.
# One dashboard/Node 8789 restart only; no package installation or Cognee writes.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Root=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Src=$PSScriptRoot
$Base='http://127.0.0.1:8789'
$Worker='http://127.0.0.1:8792'
$Server=Join-Path $Root 'src\server.mjs'
$UI=Join-Path $Root 'public\index.html'
$Module=Join-Path $Root 'src\intelligence\memory-chat.mjs'
$SourceModule=Join-Path $Src 'src\intelligence\memory-chat.mjs'
$Patcher=Join-Path $Src 'scripts\patch-memory-chat.mjs'
$Test=Join-Path $Src 'intelligence-checks\memory-chat-case.mjs'
$Backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\MemoryChatDeployBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$Stage=Join-Path $Backup 'stage'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$changed=$false;$stopped=$false;$newUI=$null;$oldTools=@()
function CmdOkay([string]$what){if($LASTEXITCODE -ne 0){throw "$what EXIT=$LASTEXITCODE"}}
function Listener(){
 $items=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue|Where-Object {$_.LocalAddress -eq '127.0.0.1'})
 if($items.Count -ne 1){throw "LISTENER_8789_HOLD COUNT=$($items.Count)"}
 $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$($items[0].OwningProcess)" -ErrorAction Stop
 if(-not $proc -or $proc.Name -ne 'node.exe' -or $proc.CommandLine -notmatch 'src[/\\]server\.mjs'){throw 'NODE_8789_IDENTITY_HOLD'}
 return $proc
}
function Gone([string]$url){
 try{$r=Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop;$code=[int]$r.StatusCode}
 catch{if($_.Exception.Response){$code=[int]$_.Exception.Response.StatusCode}else{throw}}
 if($code -ne 410){throw "RETIRED_SOURCING_CHANGED URL=$url CODE=$code"}
}
function StartDashboard([string]$out,[string]$err){
 $env:HOST='127.0.0.1';$env:PORT='8789'
 $env:REA_ALLOWED_TOOLS=($oldTools|ForEach-Object {$_.name}) -join ','
 return Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
}
function Ready([System.Diagnostics.Process]$p,[bool]$requireMemoryChat){
 for($i=0;$i -lt 50;$i++){
  Start-Sleep -Milliseconds 700
  $p.Refresh()
  if($p.HasExited){return $false}
  try{
   $status=Invoke-RestMethod "$Base/api/intelligence/status" -TimeoutSec 4 -ErrorAction Stop
   if($status.memory.enabled -ne $true -or $status.rules.engine -ne 'json-rules-engine'){continue}
   if($requireMemoryChat){
    $feature=Invoke-RestMethod "$Base/api/ai/memory-chat/status" -TimeoutSec 4 -ErrorAction Stop
    if($feature.mode -ne 'opt_in_read_only' -or $feature.memoryAvailable -ne $true){continue}
   }
   $owner=Listener
   if([int]$owner.ProcessId -ne $p.Id){throw 'UNEXPECTED_8789_PROCESS'}
   return $true
  }catch{}
 }
 return $false
}
foreach($file in @($Server,$UI,$SourceModule,$Patcher,$Test,(Join-Path $Root 'src\intelligence\memory.mjs'))){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw "REQUIRED_FILE_HOLD=$file"}
}
if(Test-Path -LiteralPath $Module){throw 'MEMORY_CHAT_MODULE_ALREADY_EXISTS_HOLD'}
$serverText=[IO.File]::ReadAllText($Server)
if(-not $serverText.Contains('FI_LOCAL_INTELLIGENCE_V1') -or -not $serverText.Contains('FI_SOURCING_RETIRED_V1')){
 throw 'MEMORY_CHAT_BASELINE_MARKERS_MISSING'
}
if($serverText.Contains('FI_OPT_IN_MEMORY_CHAT_V1')){throw 'MEMORY_CHAT_ALREADY_INSTALLED_HOLD'}
$memoryText=[IO.File]::ReadAllText((Join-Path $Root 'src\intelligence\memory.mjs'))
if(-not $memoryText.Contains('settleMemoryBridgeResult(finish,action,code,data)')){throw 'MEMORY_NODE_BRIDGE_FIX_REQUIRED'}
$before=Invoke-RestMethod "$Base/api/status" -TimeoutSec 25
if($before.application -ne 'Fun Industrial Platform'){throw 'FUN_PLATFORM_NOT_RUNNING'}
$original=Listener
$mem=Invoke-RestMethod "$Base/api/intelligence/status" -TimeoutSec 20
if($mem.memory.enabled -ne $true -or $mem.rules.engine -ne 'json-rules-engine'){throw 'MEMORY_ENGINE_PRECHECK_HOLD'}
$ai=Invoke-RestMethod "$Base/api/ai/status" -TimeoutSec 20
if($ai.state -ne 'ready'){throw "LOCAL_LLAMA_NOT_READY_PRECHECK=$($ai.state) NO_CHANGES_MADE"}
$oldTools=@((Invoke-RestMethod "$Base/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools)
$unified=Invoke-RestMethod "$Base/api/unified/status" -TimeoutSec 25 -ErrorAction Stop
if($oldTools.Count -ne 229 -or [int]$unified.rea_enabled -ne 229){throw "REA_PRECHECK_HOLD TOOLS=$($oldTools.Count) ENABLED=$($unified.rea_enabled)"}
Gone "$Base/api/autonomy/opportunities";Gone "$Base/api/autonomy/international"
Gone "$Worker/api/opportunities";Gone "$Worker/api/international"
$busy=@(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue|Where-Object {$_.CommandLine -like '*memory_bridge.py*'})
if($busy.Count){throw 'COGNEE_MEMORY_BRIDGE_BUSY_HOLD'}
& $node --check $SourceModule;CmdOkay 'MEMORY_CHAT_MODULE_SYNTAX_HOLD'
& $node --check $Patcher;CmdOkay 'MEMORY_CHAT_PATCHER_SYNTAX_HOLD'
& $node --test $Test;CmdOkay 'MEMORY_CHAT_TESTS_HOLD'
New-Item -ItemType Directory -Path $Stage -Force|Out-Null
$oldServer=Join-Path $Backup 'original-server.mjs'
$oldUI=Join-Path $Backup 'original-index.html'
$stageServer=Join-Path $Stage 'server.mjs'
$stageUI=Join-Path $Stage 'index.html'
Copy-Item -LiteralPath $Server -Destination $oldServer -ErrorAction Stop
Copy-Item -LiteralPath $UI -Destination $oldUI -ErrorAction Stop
& $node $Patcher $Server $stageServer $UI $stageUI;CmdOkay 'MEMORY_CHAT_PATCH_FAILED'
& $node --check $stageServer;CmdOkay 'PATCHED_SERVER_SYNTAX_HOLD'
$stagedText=[IO.File]::ReadAllText($stageServer)
$stagedUI=[IO.File]::ReadAllText($stageUI)
if(-not $stagedText.Contains('FI_OPT_IN_MEMORY_CHAT_V1') -or -not $stagedText.Contains('FI_SOURCING_RETIRED_V1') -or -not $stagedUI.Contains('id="chat-memory"')){
 throw 'MEMORY_CHAT_STAGING_CONTENT_HOLD'
}
$stageHash=(Get-FileHash -LiteralPath $stageServer -Algorithm SHA256).Hash
$moduleHash=(Get-FileHash -LiteralPath $SourceModule -Algorithm SHA256).Hash
$uiHash=(Get-FileHash -LiteralPath $stageUI -Algorithm SHA256).Hash
Write-Host "MEMORY_CHAT_PREFLIGHT=PASS REA=229 LLAMA_CPP=ready BACKUP=$Backup"
try{
 $changed=$true
 Copy-Item -LiteralPath $SourceModule -Destination $Module -ErrorAction Stop
 Copy-Item -LiteralPath $stageServer -Destination $Server -Force -ErrorAction Stop
 Copy-Item -LiteralPath $stageUI -Destination $UI -Force -ErrorAction Stop
 if((Get-FileHash $Module -Algorithm SHA256).Hash -ne $moduleHash -or (Get-FileHash $Server -Algorithm SHA256).Hash -ne $stageHash -or (Get-FileHash $UI -Algorithm SHA256).Hash -ne $uiHash){
  throw 'DEPLOYED_MEMORY_CHAT_FILE_HASH_HOLD'
 }
 Stop-Process -Id ([int]$original.ProcessId) -ErrorAction Stop
 $stopped=$true
 for($i=0;$i -lt 40;$i++){
  if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Milliseconds 250
 }
 if(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue){throw 'PORT_8789_STILL_LISTENING_HOLD'}
 $newUI=StartDashboard (Join-Path $Backup 'patched.stdout.log') (Join-Path $Backup 'patched.stderr.log')
 if(-not(Ready $newUI $true)){throw 'MEMORY_CHAT_STARTUP_HOLD'}
 Write-Host 'MEMORY_CHAT_DASHBOARD=PASS'
 $r=Invoke-RestMethod "$Base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120 -ErrorAction Stop
 if($r.state -ne 'ready'){throw "REA_RECONNECT_HOLD=$($r.state)"}
 $tools=@((Invoke-RestMethod "$Base/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools)
 $current=Invoke-RestMethod "$Base/api/unified/status" -TimeoutSec 25
 if($tools.Count -ne 229 -or [int]$current.rea_enabled -ne 229){throw 'REA_SCOPE_REGRESSION'}
 Gone "$Base/api/autonomy/opportunities";Gone "$Base/api/autonomy/international"
 Gone "$Worker/api/opportunities";Gone "$Worker/api/international"
 Write-Host 'MEMORY_CHAT_REA=PASS COUNT=229 TOOLS_EXECUTED=0 SOURCING_RETIRED=TRUE'
 $status=Invoke-RestMethod "$Base/api/ai/memory-chat/status" -TimeoutSec 15 -ErrorAction Stop
 if($status.enabledByDefault -ne $false -or $status.reaExecution -ne $false){throw 'MEMORY_CHAT_POLICY_STATUS_HOLD'}
 # Invalid request is rejected before Python. No REA tool call or memory write.
 $bad='{"messages":[{"role":"user","content":"test"}],"tools":[{"name":"rea__unsafe"}]}'
 try{
  $void=Invoke-WebRequest "$Base/api/ai/memory-chat" -UseBasicParsing -Method POST -Body $bad -ContentType 'application/json' -TimeoutSec 15 -ErrorAction Stop
  throw 'MEMORY_CHAT_FORBIDDEN_FIELDS_ACCEPTED'
 }catch{
  if($_.Exception.Message -eq 'MEMORY_CHAT_FORBIDDEN_FIELDS_ACCEPTED'){throw}
  $code=if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{-1}
  if($code -ne 400){throw "MEMORY_CHAT_INVALID_INPUT_HTTP_HOLD=$code"}
 }
 $query='What is Fun Industrial policy about operator approval before executing external tools?'
 $body=@{messages=@(@{role='user';content=$query});max_tokens=100;temperature=0}|ConvertTo-Json -Depth 5 -Compress
 $response=Invoke-RestMethod "$Base/api/ai/memory-chat" -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 210 -ErrorAction Stop
 if(-not($response.reply -is [string]) -or -not $response.reply.Trim()){throw 'LLAMA_MEMORY_CHAT_REPLY_EMPTY'}
 if($response.memory.mode -ne 'opt_in_read_only' -or $response.memory.toolsForwarded -ne 0 -or $response.memory.reaToolsExecuted -ne 0 -or $response.toolExecutionAuthorized -ne $false -or @($response.tool_calls).Count -ne 0){
  throw 'MEMORY_CHAT_BOUNDARY_VIOLATION'
 }
 Write-Host "MEMORY_CHAT_LIVE=PASS HTTP=200 EXCERPTS=$($response.memory.excerptsIncluded) TOOLS=0 MEMORY_WRITES=0"
 Write-Host 'MEMORY_CHAT_UI=CHECKBOX_DEFAULT_OFF LOCAL_LLAMA_CPP_ONLY=TRUE'
 Write-Host "BACKUP=$Backup"
}catch{
 $reason=$_.Exception.Message
 Write-Warning "MEMORY_CHAT_DEPLOY=HOLD REASON=$reason"
 if($newUI){$newUI.Refresh();if(-not $newUI.HasExited){Stop-Process -Id $newUI.Id -Force -ErrorAction SilentlyContinue}}
 if($changed){
  Copy-Item -LiteralPath $oldServer -Destination $Server -Force -ErrorAction Stop
  Copy-Item -LiteralPath $oldUI -Destination $UI -Force -ErrorAction Stop
  Remove-Item -LiteralPath $Module -Force -ErrorAction SilentlyContinue
  Write-Warning 'MEMORY_CHAT_ROLLBACK_FILES=RESTORED'
 }
 if($stopped){
  try{
   $restore=StartDashboard (Join-Path $Backup 'rollback.stdout.log') (Join-Path $Backup 'rollback.stderr.log')
   if(Ready $restore $false){
    Write-Warning "PREVIOUS_DASHBOARD_RESTART=PASS PID=$($restore.Id)"
    try{
     $re=Invoke-RestMethod "$Base/api/rea/start" -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 120 -ErrorAction Stop
     $count=@((Invoke-RestMethod "$Base/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools).Count
     Write-Warning "PREVIOUS_REA_CATALOG=$($re.state) COUNT=$count"
    }catch{Write-Warning "PREVIOUS_REA_RECONNECT_HOLD=$($_.Exception.Message)"}
   }else{Write-Warning 'PREVIOUS_DASHBOARD_RESTART_UNCONFIRMED'}
  }catch{Write-Warning "ROLLBACK_RESTART_HOLD=$($_.Exception.Message)"}
 }
 throw "MEMORY_CHAT_DEPLOY_HOLD=$reason BACKUP=$Backup"
}
