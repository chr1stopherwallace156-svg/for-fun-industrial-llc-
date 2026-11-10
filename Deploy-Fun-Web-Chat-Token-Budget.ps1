# FI_WEB_TOKEN_BUDGET_DEPLOY_V2 - guarded web-chat evidence and token telemetry rollout.
# Restarts only dashboard 8789; no REA, compute, llama.cpp, Ollama, DDGS or gateway restarts.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Root=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$Module=Join-Path $Root "src\intelligence\chat-web.mjs"
$Target=Join-Path $Live "src\intelligence\chat-web.mjs"
$Server=Join-Path $Live "src\server.mjs"
$Test=Join-Path $Root "intelligence-checks\web-chat-token-budget-case.mjs"
$Patch=Join-Path $Root "scripts\patch-chat-web-budget-v2.mjs"
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Base="http://127.0.0.1:8789"
$Backup=Join-Path $env:LOCALAPPDATA ("FunIndustrial\WebChatTokenBudget\"+(Get-Date -Format "yyyyMMdd-HHmmss")+"-"+[guid]::NewGuid().ToString("N").Substring(0,8))
$changed=$false;$stopped=$false;$newNode=$null;$phase="preflight"
function Hold([string]$code){throw ("FUN_WEB_TOKEN_BUDGET_HOLD="+$code)}
function Snap([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object) -join ",")
}
function Req([string]$path,[int]$timeout=12){
 return Invoke-RestMethod -Uri ($Base+$path) -TimeoutSec $timeout -ErrorAction Stop
}
function Pid8789(){
 $ps=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue|Where-Object{$_.LocalAddress -eq "127.0.0.1"})
 if($ps.Count -ne 1){Hold "DASHBOARD_LISTENER_IDENTITY"}
 $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($ps[0].OwningProcess)" -ErrorAction Stop
 if(-not $p -or $p.Name -ne "node.exe" -or $p.CommandLine -notmatch 'src[/\\]server\.mjs'){Hold "DASHBOARD_PROCESS_IDENTITY"}
 return [int]$p.ProcessId
}
function StartDashboard([string]$out,[string]$err){
 $env:HOST="127.0.0.1";$env:PORT="8789";$env:COMPUTE_PORT="8791"
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$MemoryBudget
 $env:FUN_VOICE_HOME=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab"
 return Start-Process -FilePath $Node -ArgumentList @("src/server.mjs") -WorkingDirectory $Live -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
}
function WaitDashboard([System.Diagnostics.Process]$process){
 for($i=0;$i -lt 60;$i++){
  Start-Sleep -Milliseconds 500;$process.Refresh()
  if($process.HasExited){return $false}
  try{
   $ai=Req "/api/ai/status" 4
   $web=Req "/api/web/status" 4
   $mem=Req "/api/ai/automatic-memory/status" 4
   if($ai.state -ne "ready" -or $ai.ownership -ne "external" -or
      $web.state -ne "running" -or $mem.mode -ne "automatic_contextual_read_only"){continue}
   if((Pid8789) -eq $process.Id){return $true}
  }catch{}
 }
 return $false
}
foreach($file in @($Module,$Target,$Server,$Patch,$Test)){
 if(-not (Test-Path -LiteralPath $file -PathType Leaf)){Hold ("MISSING_"+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "SYMLINK_FILE_DENIED"}
}
foreach($dir in @($Live,$Root,(Join-Path $Live "src\intelligence"))){
 if((Get-Item -LiteralPath $dir).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "SYMLINK_DIRECTORY_DENIED"}
}
$serverCode=[IO.File]::ReadAllText($Server)
$before=[IO.File]::ReadAllText($Target)
if(-not $serverCode.Contains("FI_WEB_CHAT_CONSOLIDATION_V1") -or -not $serverCode.Contains('enrichWebChat(body,{modelPayload:enriched.payload})')){Hold "LIVE_WEB_CHAT_NOT_INSTALLED"}
if(-not $before.Contains("FI_WEB_IN_CHAT_V1") -or -not $before.Contains("webQueryFromUser(latest.content)") -or $before.Contains("FI_WEB_EVIDENCE_BUDGET_V2")){Hold "UNRECOGNIZED_LIVE_MODULE"}
if(-not ([IO.File]::ReadAllText($Module)).Contains("FI_WEB_EVIDENCE_BUDGET_V2")){Hold "SOURCE_EVIDENCE_BUDGET_MISSING"}
if($serverCode.Contains("FI_WEB_EVIDENCE_BUDGET_SERVER_PATCH_V2")){Hold "SERVER_ALREADY_PATCHED"}
$beforePorts=@{}
foreach($port in @(8088,8791,8443,4479)){
 $beforePorts[$port]=Snap $port
 if(-not $beforePorts[$port]){Hold ("REQUIRED_SERVICE_OFFLINE_"+$port)}
}
$memory=Req "/api/ai/automatic-memory/status";$MemoryBudget=[int]$memory.recallBudgetMs
$ai=Req "/api/ai/status";$web=Req "/api/web/status"
if($memory.mode -ne "automatic_contextual_read_only" -or $ai.state -ne "ready" -or $ai.ownership -ne "external" -or $web.state -ne "running"){Hold "SERVICE_PREFLIGHT_NOT_READY"}
$originalPid=Pid8789
& $Node --check $Module
if($LASTEXITCODE -ne 0){Hold "MODULE_SYNTAX"}
& $Node --check $Patch
if($LASTEXITCODE -ne 0){Hold "PATCH_SYNTAX"}
& $Node --test $Test
if($LASTEXITCODE -ne 0){Hold "MODULE_TESTS"}
New-Item -ItemType Directory -Path $Backup -Force|Out-Null
$Previous=Join-Path $Backup "chat-web.before.mjs"
$PreviousServer=Join-Path $Backup "server.before.mjs"
$StagedServer=Join-Path $Backup "server.staged.mjs"
Copy-Item -LiteralPath $Target -Destination $Previous -ErrorAction Stop
Copy-Item -LiteralPath $Server -Destination $PreviousServer -ErrorAction Stop
& $Node $Patch $Server $StagedServer
if($LASTEXITCODE -ne 0){Hold "SERVER_STAGE_FAILED"}
& $Node --check $StagedServer
if($LASTEXITCODE -ne 0){Hold "STAGED_SERVER_SYNTAX"}
if(-not ([IO.File]::ReadAllText($StagedServer)).Contains("FI_WEB_EVIDENCE_BUDGET_SERVER_PATCH_V2")){Hold "STAGED_MARKER_MISSING"}
try{
 $phase="copy_staged_server_and_module";$changed=$true
 Copy-Item -LiteralPath $Module -Destination $Target -Force -ErrorAction Stop
 Copy-Item -LiteralPath $StagedServer -Destination $Server -Force -ErrorAction Stop
 if((Get-FileHash $Module).Hash -ne (Get-FileHash $Target).Hash -or
    (Get-FileHash $StagedServer).Hash -ne (Get-FileHash $Server).Hash){Hold "STAGED_HASH_MISMATCH"}
 $phase="restart_dashboard_only"
 Stop-Process -Id $originalPid -ErrorAction Stop;$stopped=$true
 for($i=0;$i -lt 40;$i++){if(-not(Snap 8789)){break};Start-Sleep -Milliseconds 250}
 if(Snap 8789){Hold "DASHBOARD_PORT_NOT_RELEASED"}
 $newNode=StartDashboard (Join-Path $Backup "new.stdout.log") (Join-Path $Backup "new.stderr.log")
 if(-not (WaitDashboard $newNode)){Hold "DASHBOARD_RESTART_NOT_READY"}
 $phase="postflight"
 foreach($port in @(8088,8791,8443,4479)){
  if((Snap $port) -ne $beforePorts[$port]){Hold ("PROTECTED_SERVICE_PID_CHANGED_"+$port)}
 }
 if((Req "/api/web/status").state -ne "running" -or
    (Req "/api/ai/status").ownership -ne "external" -or
    (Req "/api/voice/mobile/status").code -ne "FI_VOICE_MOBILE_UPLOAD_V1" -or
    (Req "/api/optimization/agent/status").state -ne "ready"){Hold "POSTFLIGHT_SERVICE_REGRESSION"}
 Write-Host "FUN_WEB_TOKEN_BUDGET_DEPLOY=PASS DASHBOARD=8789 EVIDENCE=COMPACT USAGE=MEASURED_IF_AVAILABLE LLAMA=EXTERNAL OTHER_PROCESSES=PRESERVED"
 Write-Host "FUN_WEB_TOKEN_BUDGET_BACKUP=$Backup"
}catch{
 $why=$_.Exception.Message
 Write-Warning "FUN_WEB_TOKEN_BUDGET=HOLD PHASE=$phase REASON=$why"
 if($newNode){$newNode.Refresh();if(-not $newNode.HasExited){Stop-Process -Id $newNode.Id -Force -ErrorAction SilentlyContinue}}
 if($changed){
  Copy-Item -LiteralPath $Previous -Destination $Target -Force -ErrorAction SilentlyContinue
  Copy-Item -LiteralPath $PreviousServer -Destination $Server -Force -ErrorAction SilentlyContinue
  Write-Warning "FUN_WEB_TOKEN_BUDGET_ROLLBACK_FILES=RESTORED"
 }
 if($stopped){
  try{
   for($i=0;$i -lt 30;$i++){if(-not (Snap 8789)){break};Start-Sleep -Milliseconds 200}
   if(-not (Snap 8789)){
    $restored=StartDashboard (Join-Path $Backup "rollback.stdout.log") (Join-Path $Backup "rollback.stderr.log")
    if(WaitDashboard $restored){Write-Warning "FUN_WEB_TOKEN_BUDGET_ROLLBACK_DASHBOARD=RESTORED"}
    else{Write-Warning "FUN_WEB_TOKEN_BUDGET_ROLLBACK_DASHBOARD=UNCONFIRMED"}
   }else{Write-Warning "FUN_WEB_TOKEN_BUDGET_ROLLBACK_PORT_OCCUPIED"}
  }catch{Write-Warning "FUN_WEB_TOKEN_BUDGET_ROLLBACK_START_FAILED"}
 }
 throw ("FUN_WEB_TOKEN_BUDGET_DEPLOY_HOLD="+$why+" BACKUP="+$Backup)
}