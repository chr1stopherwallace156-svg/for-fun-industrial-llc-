# FI_CHAT_OPTIMIZATION_DEPLOY_V1 — guarded Windows dashboard update.
# Only the verified 127.0.0.1:8789 dashboard process restarts once.
# Never stop llama.cpp, compute, REA tools, Cognee storage, gateway, or Elektron/Ollama.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$LiveWorkflows=Join-Path $Live 'src\workflows'
$SourceWorkflows=Join-Path $Root 'src\workflows'
$Server=Join-Path $Live 'src\server.mjs'
$Page=Join-Path $Live 'public\index.html'
$Patch=Join-Path $Root 'scripts\patch-chat-optimization.mjs'
$Base='http://127.0.0.1:8789'
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Git=(Get-Command git.exe -ErrorAction Stop).Source
$Names=@('chat-optimization.mjs','chat-optimization-http.mjs','chat-optimization-client.js')
$Backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\ChatOptimizationDeployBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$FilesChanged=$false
$Stopped=$false
$NewNode=$null
$Copied=@()
$Phase='preflight'
function Hold([string]$reason){throw ('FUN_CHAT_OPTIMIZATION_HOLD='+$reason)}
function Snap([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { "$($_.LocalAddress):$($_.OwningProcess)" } | Sort-Object) -join ',')
}
function Request([string]$path,[int]$timeout=15){
 return Invoke-RestMethod -Uri ($Base+$path) -TimeoutSec $timeout -ErrorAction Stop
}
function DashboardPid(){
 $listeners=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue |
  Where-Object {$_.LocalAddress -eq '127.0.0.1'})
 if($listeners.Count -ne 1){Hold 'DASHBOARD_LISTENER_NOT_UNIQUE'}
 $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($listeners[0].OwningProcess)" -ErrorAction Stop
 if(-not $p -or $p.Name -ne 'node.exe' -or $p.CommandLine -notmatch 'src[/\\]server\.mjs'){Hold 'DASHBOARD_IDENTITY_INVALID'}
 return [int]$p.ProcessId
}
function StartDashboard([string]$stdout,[string]$stderr){
 $env:HOST='127.0.0.1'
 $env:PORT='8789'
 $env:COMPUTE_PORT='8791'
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$MemoryBudget
 $env:FUN_VOICE_HOME=Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceLab'
 return Start-Process -FilePath $Node -ArgumentList @('src/server.mjs') -WorkingDirectory $Live -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
}
function WaitDashboard([System.Diagnostics.Process]$process){
 for($i=0;$i -lt 70;$i++){
  Start-Sleep -Milliseconds 500
  $process.Refresh()
  if($process.HasExited){return $false}
  try{
   if((DashboardPid) -ne $process.Id){continue}
   $ai=Request '/api/ai/status' 4
   $chat=Request '/api/ai/chat-optimization/status' 4
   $memory=Request '/api/ai/automatic-memory/status' 4
   $voice=Request '/api/voice/mobile/status' 4
   $web=Request '/api/web/status' 4
   $agent=Request '/api/optimization/agent/status' 4
   if($ai.state -eq 'ready' -and $chat.state -eq 'ready' -and
      $memory.mode -eq 'automatic_contextual_read_only' -and
      $voice.code -eq 'FI_VOICE_MOBILE_UPLOAD_V1' -and
      $web.state -eq 'running' -and $agent.state -eq 'ready'){return $true}
  }catch{}
 }
 return $false
}
foreach($dir in @($Root,$Live,$LiveWorkflows,$SourceWorkflows,(Join-Path $Live 'public'))){
 if(-not(Test-Path -LiteralPath $dir -PathType Container)){Hold ('MISSING_DIRECTORY_'+$dir)}
 if((Get-Item -LiteralPath $dir -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_DIRECTORY_'+$dir)}
}
$branch=(& $Git -C $Root branch --show-current)
if($LASTEXITCODE -ne 0 -or $branch.Trim() -ne 'feature/fun-phase221-chat-optimizer-20261110'){Hold 'WRONG_STAGING_BRANCH'}
if(@(& $Git -C $Root status --porcelain).Count -ne 0){Hold 'STAGING_WORKTREE_NOT_CLEAN'}
foreach($path in @($Server,$Page,$Patch,
 (Join-Path $LiveWorkflows 'phase22.mjs'),
 (Join-Path $LiveWorkflows 'phase22-cli.mjs'))){
 if(-not(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('MISSING_FILE_'+$path)}
 if((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_FILE'}
}
foreach($name in @('phase22.mjs','phase22-cli.mjs')){
 $s=Join-Path $SourceWorkflows $name
 $l=Join-Path $LiveWorkflows $name
 if((Get-FileHash -LiteralPath $s).Hash -ne (Get-FileHash -LiteralPath $l).Hash){Hold ('PHASE22_SOURCE_DRIFT_'+$name)}
}
foreach($name in $Names){
 $s=Join-Path $SourceWorkflows $name
 $t=Join-Path $LiveWorkflows $name
 if(-not(Test-Path -LiteralPath $s -PathType Leaf)){Hold ('MISSING_SOURCE_'+$name)}
 if((Get-Item -LiteralPath $s -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_SOURCE'}
 if(Test-Path -LiteralPath $t){Hold ('ALREADY_OR_PARTIALLY_INSTALLED_'+$name)}
 & $Node --check $s
 if($LASTEXITCODE -ne 0){Hold ('SYNTAX_'+$name)}
}
$code=[IO.File]::ReadAllText($Server)
if(-not $code.Contains('FI_WEB_CHAT_CONSOLIDATION_V1') -or
   -not $code.Contains('FI_OPTIMIZATION_AGENT_V1') -or
   -not $code.Contains('FI_AUTO_COGNEE_CHAT_V1')){Hold 'UNRECOGNIZED_SERVER_BASELINE'}
if($code.Contains('FI_CHAT_OPTIMIZATION_SERVER_V1')){Hold 'CHAT_OPT_ALREADY_DEPLOYED'}
$before=@{}
foreach($port in @(8088,8791,8443,4479)){$before[$port]=Snap $port}
if(-not $before[8088] -or -not $before[8791]){Hold 'LLAMA_OR_COMPUTE_OFFLINE'}
$oldPid=DashboardPid
$memoryBefore=Request '/api/ai/automatic-memory/status'
$aiBefore=Request '/api/ai/status'
$voiceBefore=Request '/api/voice/mobile/status'
$webBefore=Request '/api/web/status'
$agentBefore=Request '/api/optimization/agent/status'
if($aiBefore.state -ne 'ready' -or $aiBefore.ownership -ne 'external' -or
   $memoryBefore.mode -ne 'automatic_contextual_read_only' -or
   $voiceBefore.code -ne 'FI_VOICE_MOBILE_UPLOAD_V1' -or
   $webBefore.state -ne 'running' -or $agentBefore.state -ne 'ready'){Hold 'SERVICES_NOT_READY'}
$MemoryBudget=[int]$memoryBefore.recallBudgetMs
if($MemoryBudget -lt 12000 -or $MemoryBudget -gt 180000){Hold 'MEMORY_BUDGET_UNRECOGNIZED'}
$reaCountBefore=$null
try{$reaCountBefore=@((Request '/api/rea/tools' 30).tools).Count}catch{Hold 'REA_CATALOGUE_NOT_READY'}
if($reaCountBefore -ne 229){Hold ('REA_CATALOGUE_COUNT_UNEXPECTED_'+$reaCountBefore)}
& $Node --check $Patch
if($LASTEXITCODE -ne 0){Hold 'PATCH_SYNTAX'}
$tests=@('chat-optimization-case.mjs','workflow-phase22-case.mjs','workflow-optimization-case.mjs','workflow-coordinator-case.mjs')|
 ForEach-Object {Join-Path $Root ('intelligence-checks\'+$_)}
& $Node --test @tests
if($LASTEXITCODE -ne 0){Hold 'FOCUSED_REGRESSION_TESTS_FAILED'}
New-Item -ItemType Directory -Path $Backup -Force -ErrorAction Stop|Out-Null
$ServerOld=Join-Path $Backup 'server.before.mjs'
$PageOld=Join-Path $Backup 'dashboard.before.html'
$ServerStage=Join-Path $Backup 'server.staged.mjs'
$PageStage=Join-Path $Backup 'dashboard.staged.html'
Copy-Item -LiteralPath $Server -Destination $ServerOld -ErrorAction Stop
Copy-Item -LiteralPath $Page -Destination $PageOld -ErrorAction Stop
& $Node $Patch $Server $Page $ServerStage $PageStage
if($LASTEXITCODE -ne 0){Hold 'STAGING_PATCH_FAILED'}
& $Node --check $ServerStage
if($LASTEXITCODE -ne 0){Hold 'STAGED_SERVER_SYNTAX'}
$staged=[IO.File]::ReadAllText($ServerStage)
if(-not $staged.Contains('FI_CHAT_OPTIMIZATION_SERVER_V1')){Hold 'STAGE_SERVER_MARKER'}
if(-not ([IO.File]::ReadAllText($PageStage)).Contains('FI_CHAT_OPTIMIZATION_UI_V1')){Hold 'STAGE_UI_MARKER'}
try{
 $Phase='copy_staged_files'
 $FilesChanged=$true
 foreach($name in $Names){
  $s=Join-Path $SourceWorkflows $name
  $t=Join-Path $LiveWorkflows $name
  Copy-Item -LiteralPath $s -Destination $t -ErrorAction Stop
  $Copied+=,$t
  if((Get-FileHash -LiteralPath $s).Hash -ne (Get-FileHash -LiteralPath $t).Hash){Hold ('COPY_HASH_'+$name)}
 }
 Copy-Item -LiteralPath $ServerStage -Destination $Server -Force -ErrorAction Stop
 Copy-Item -LiteralPath $PageStage -Destination $Page -Force -ErrorAction Stop
 if((Get-FileHash -LiteralPath $ServerStage).Hash -ne (Get-FileHash -LiteralPath $Server).Hash -or
    (Get-FileHash -LiteralPath $PageStage).Hash -ne (Get-FileHash -LiteralPath $Page).Hash){Hold 'LIVE_STAGE_HASH_MISMATCH'}
 $Phase='restart_dashboard_8789_only'
 Stop-Process -Id $oldPid -ErrorAction Stop
 $Stopped=$true
 for($i=0;$i -lt 40;$i++){if(-not(Snap 8789)){break};Start-Sleep -Milliseconds 250}
 if(Snap 8789){Hold 'DASHBOARD_PORT_NOT_RELEASED'}
 $NewNode=StartDashboard (Join-Path $Backup 'new.stdout.log') (Join-Path $Backup 'new.stderr.log')
 if(-not (WaitDashboard $NewNode)){Hold 'DASHBOARD_POST_RESTART_NOT_READY'}
 $Phase='rea_read_only_catalogue_reconnect'
 # Dashboard restart may lose its REA MCP pipe. Reinitialize *catalog only*, no tools/call.
 $reaReady=$false
 for($i=0;$i -lt 3;$i++){
  try{
   $start=Invoke-RestMethod -Uri ($Base+'/api/rea/start') -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 90
   if($start.state -eq 'ready'){$reaReady=$true;break}
  }catch{}
  Start-Sleep -Seconds 2
 }
 if(-not $reaReady){Hold 'REA_READONLY_REINITIALIZE_FAILED'}
 $sameCatalogue=$false
 for($i=0;$i -lt 5;$i++){
  try{
   $count=@((Request '/api/rea/tools' 30).tools).Count
   if($count -eq $reaCountBefore){$sameCatalogue=$true;break}
  }catch{}
  Start-Sleep -Seconds 2
 }
 if(-not $sameCatalogue){Hold 'REA_CATALOGUE_CHANGED_OR_UNAVAILABLE'}
 $Phase='postflight'
 foreach($port in @(8088,8791,8443,4479)){
  if((Snap $port) -cne $before[$port]){Hold ('PROTECTED_PORT_CHANGED_'+$port)}
 }
 $ui=Invoke-WebRequest -Uri ($Base+'/') -UseBasicParsing -TimeoutSec 10
 if(-not $ui.Content.Contains('FI_CHAT_OPTIMIZATION_UI_V1')){Hold 'CHAT_UI_MARKER_UNAVAILABLE'}
 $client=Invoke-WebRequest -Uri ($Base+'/api/ai/chat-optimization/client.js') -UseBasicParsing -TimeoutSec 10
 if(-not $client.Content.Contains('FI_CHAT_OPTIMIZATION_CLIENT_V1')){Hold 'CHAT_CLIENT_UNAVAILABLE'}
 Write-Host 'FUN_CHAT_OPTIMIZATION_DEPLOY=PASS CHAT_INTEGRATION=APPROVAL_GATED QWEN=EXTERNAL OPTUNA_OR_TOOLS=EXISTING REA=UNCHANGED OTHER_SERVICES=UNCHANGED'
 Write-Host ('FUN_CHAT_OPTIMIZATION_BACKUP='+$Backup)
 Write-Host ('FUN_CHAT_OPTIMIZATION_DASHBOARD='+$Base)
}catch{
 $why=$_.Exception.Message
 Write-Warning ('FUN_CHAT_OPTIMIZATION_DEPLOY_HOLD PHASE='+$Phase+' REASON='+$why)
 if($NewNode){
  $NewNode.Refresh()
  if(-not $NewNode.HasExited){Stop-Process -Id $NewNode.Id -Force -ErrorAction SilentlyContinue}
 }
 if($FilesChanged){
  Copy-Item -LiteralPath $ServerOld -Destination $Server -Force -ErrorAction SilentlyContinue
  Copy-Item -LiteralPath $PageOld -Destination $Page -Force -ErrorAction SilentlyContinue
  foreach($file in $Copied){Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue}
  Write-Warning 'FUN_CHAT_OPTIMIZATION_ROLLBACK_FILES=RESTORED'
 }
 if($Stopped){
  try{
   for($i=0;$i -lt 40;$i++){if(-not(Snap 8789)){break};Start-Sleep -Milliseconds 200}
   if(-not(Snap 8789)){
    $restored=StartDashboard (Join-Path $Backup 'rollback.stdout.log') (Join-Path $Backup 'rollback.stderr.log')
    if(WaitDashboard $restored){Write-Warning 'FUN_CHAT_OPTIMIZATION_ROLLBACK_DASHBOARD=RESTORED'}
    else{Write-Warning 'FUN_CHAT_OPTIMIZATION_ROLLBACK_DASHBOARD=UNCONFIRMED'}
   }else{Write-Warning 'FUN_CHAT_OPTIMIZATION_ROLLBACK_PORT_OCCUPIED'}
  }catch{Write-Warning 'FUN_CHAT_OPTIMIZATION_ROLLBACK_START_FAILED'}
 }
 throw ('FUN_CHAT_OPTIMIZATION_DEPLOY_HOLD='+$why+' BACKUP='+$Backup)
}
