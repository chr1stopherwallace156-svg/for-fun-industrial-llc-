# FUN_CAPABILITY_LIVE_DEPLOY_V1
# Default: staged qualification ONLY. -Apply explicitly restarts ONLY known 8789 Node.
# No REA initialization/execution, Ollama, llama.cpp, compute, VPN or gateway actions.
[CmdletBinding()]param([switch]$Apply)
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Server=Join-Path $Live 'src\server.mjs'
$ModuleDir=Join-Path $Live 'src\cognition'
$Names=@('capability-index.mjs','capability-chat.mjs')
$Patcher=Join-Path $Repo 'scripts\patch-capability-live.mjs'
$Base='http://127.0.0.1:8789'
$Protected=@(8088,8791,8443,4479,8794)
$Work=Join-Path $env:LOCALAPPDATA ('FunIndustrial\CapabilityIndex8789\deploy-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$PortBefore=@{};$Existed=@{}
$OldProcess=0;$NewProcess=$null;$NodeExe='';$Changed=$false;$Restarted=$false;$MemoryBudget=0;$OldHash='';$StageHash=''
function Hold([string]$reason){throw ('FUN_CAPABILITY_LIVE_HOLD='+$reason)}
function CheckFile([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('FILE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('REPARSE_FILE_'+$p)}
}
function CheckDir([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Container)){Hold ('DIR_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('REPARSE_DIR_'+$p)}
}
function Hash([string]$p){return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}
function PortSnap([int]$n){
 return (@(Get-NetTCPConnection -State Listen -LocalPort $n -ErrorAction SilentlyContinue|
  ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object) -join ';')
}
function Owner8789(){
 $all=@(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue)
 if($all.Count -ne 1 -or $all[0].LocalAddress -ne '127.0.0.1'){Hold '8789_LISTENER_NOT_UNIQUE_LOCAL'}
 $ownerNumber=[int]$all[0].OwningProcess
 $p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$ownerNumber) -ErrorAction Stop
 if(-not $p -or $p.Name -ne 'node.exe' -or [string]$p.CommandLine -notmatch 'src[/\\]server\.mjs'){
  Hold '8789_NOT_EXPECTED_FUN_DASHBOARD'
 }
 if(-not $p.ExecutablePath){Hold 'DASHBOARD_NODE_PATH_MISSING'}
 CheckFile ([string]$p.ExecutablePath)
 return @{Pid=$ownerNumber;Exe=[string]$p.ExecutablePath}
}
function Json([string]$path,[int]$timeout=12){
 return Invoke-RestMethod -Uri ($Base+$path) -TimeoutSec $timeout -ErrorAction Stop
}
function CheckReaDenied(){
 $denied=$false
 try{
  $value=Json '/api/rea/tools' 12
  Hold 'REA_CATALOGUE_UNEXPECTEDLY_AVAILABLE'
 }catch{
  if($_.Exception.Message -like '*REA_CATALOGUE_UNEXPECTEDLY_AVAILABLE*'){throw}
  $status=0
  if($_.Exception.Response){$status=[int]$_.Exception.Response.StatusCode}
  if($status -eq 403){$denied=$true}else{Hold ('REA_DENIAL_UNEXPECTED_HTTP_'+$status)}
 }
 if(-not $denied){Hold 'REA_403_NOT_CONFIRMED'}
}
function Services(){
 $c=Json '/api/cognition/status' 15
 $memory=Json '/api/ai/automatic-memory/status' 15
 $voice=Json '/api/voice/mobile/status' 15
 $ai=Json '/api/ai/status' 15
 $tools=Json '/api/ai/tools' 25
 $platform=Json '/api/status' 25
 $compute=Invoke-RestMethod 'http://127.0.0.1:8791/ai/runtime/llama-cpp' -TimeoutSec 12
 if($c.version -ne 'fi-cognitive-live-bridge-v1' -or $c.liveChatDecorator -ne $true -or
    $c.reaExecutionGrants -ne 0 -or $c.automaticKnowledgeWrites -ne $false){Hold 'EXISTING_COGNITION_UNEXPECTED'}
 if($memory.enabledByDefault -ne $true -or $voice.enabled -ne $true){Hold 'MEMORY_OR_VOICE_NOT_READY'}
 if($ai.state -ne 'ready' -or $compute.state -ne 'ready'){Hold 'AI_NOT_READY'}
 if($platform.application -ne 'Fun Industrial Platform' -or
    $platform.safety.localFirstMode -ne $true -or $platform.vpn_policy.required -ne $false){Hold 'PLATFORM_IDENTITY_UNEXPECTED'}
 $r=@($platform.services | Where-Object {$_.id -eq 'rea'})
 if($r.Count -ne 1 -or $r[0].state -ne 'stopped'){Hold 'REA_STATE_UNEXPECTED'}
 CheckReaDenied
 $definitions=@($tools.tools|ForEach-Object {$_.function.name})
 if($definitions.Count -lt 4 -or @($definitions|Sort-Object -Unique).Count -ne $definitions.Count){Hold 'TOOL_CATALOGUE_UNEXPECTED'}
 if([int]$tools.rea_tool_count -ne 0 -or @($definitions|Where-Object {$_ -like 'rea__*'}).Count -ne 0){Hold 'REA_TOOL_ACCESS_UNEXPECTED'}
 return @{Names=$definitions;Budget=[int]$memory.recallBudgetMs;Cognitive=$c;AiState=$ai.state}
}
function AssertEmptyCognitiveMemory($c){
 $claims=[int]$c.cognition.claims.total
 $predictions=[int]$c.cognition.predictions.total
 $events=[int]$c.cognition.historyEvents
 if($claims -ne 0 -or $predictions -ne 0 -or $events -ne 0){
  Hold ('COGNITION_VOLATILE_DATA_PRESENT_CLAIMS_'+$claims+'_PREDICTIONS_'+$predictions+'_EVENTS_'+$events)
 }
}
function StartDashboard([string]$prefix){
 # Match the reviewed cognitive release's existing restart settings.
 # Never turn REA catalogue into execution permissions.
 $env:HOST='127.0.0.1';$env:PORT='8789';$env:COMPUTE_PORT='8791'
 $env:LOCAL_FIRST_MODE='true';$env:REA_ALLOWED_TOOLS=''
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$script:MemoryBudget
 $env:FUN_VOICE_HOME=Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceLab'
 return Start-Process -FilePath $NodeExe -ArgumentList 'src/server.mjs' -WorkingDirectory $Live -PassThru -RedirectStandardOutput ($prefix+'.stdout.log') -RedirectStandardError ($prefix+'.stderr.log') -ErrorAction Stop
}
function WaitNew([int]$id){
 $script:WaitReason='NO_HTTP_RESPONSE'
 for($i=0;$i -lt 80;$i++){
  Start-Sleep -Milliseconds 500
  try{
   if((Owner8789).Pid -ne $id){$script:WaitReason='DASHBOARD_OWNER_MISMATCH';continue}
   $v=Json '/api/cognition/health' 4
   $a=Json '/api/cognition/catalogue/status' 4
   if($v.version -ne 'fi-cognitive-live-bridge-v1' -or $v.liveChatDecorator -ne $true -or $v.reaExecutionGrants -ne 0){
    $script:WaitReason='COGNITION_HEALTH_IDENTITY'
    continue
   }
   if($a.version -ne 'fi-capability-index-v1' -or $a.localCount -lt 4 -or
      $a.reaCatalogued -ne 0 -or $a.reaState -ne 'not_loaded' -or
      $a.executionGrants -ne 0 -or $a.modelExecutionEnabled -ne $false){
    $script:WaitReason='CAPABILITY_REGISTRY_IDENTITY'
    continue
   }
   $script:WaitReason='READY'
   return $true
  }catch{
   $script:WaitReason='HTTP_OR_PROCESS_NOT_READY'
  }
 }
 return $false
}
foreach($d in @($Repo,$Live,(Join-Path $Live 'src'))){CheckDir $d}
foreach($p in @($Server,$Patcher,(Join-Path $Repo 'src\cognition\capability-index.mjs'),
 (Join-Path $Repo 'src\cognition\capability-chat.mjs'),
 (Join-Path $Repo 'intelligence-checks\capability-index-case.mjs'))){CheckFile $p}
$Original=[IO.File]::ReadAllText($Server)
if(-not $Original.Contains('FI_COGNITIVE_LIVE_PATCH_V1') -or
    $Original.Contains('FI_CAPABILITY_INDEX_LIVE_V1')){Hold 'LIVE_COGNITION_BASELINE_NOT_EXPECTED'}
$owner=Owner8789
$OldProcess=[int]$owner.Pid;$NodeExe=[string]$owner.Exe
$OldHash=Hash $Server
& $NodeExe --check $Patcher
if($LASTEXITCODE -ne 0){Hold 'PATCHER_SYNTAX'}
foreach($m in $Names){
 $source=Join-Path $Repo ('src\cognition\'+$m)
 & $NodeExe --check $source
 if($LASTEXITCODE -ne 0){Hold ('MODULE_SYNTAX_'+$m)}
}
Push-Location $Repo
try{
 & $NodeExe --test 'intelligence-checks\capability-index-case.mjs'
 if($LASTEXITCODE -ne 0){Hold 'CAPABILITY_TESTS_FAILED'}
}finally{Pop-Location}
New-Item -ItemType Directory -Path $Work -Force -ErrorAction Stop|Out-Null
Copy-Item -LiteralPath $Server -Destination (Join-Path $Work 'server.original.mjs') -ErrorAction Stop
$Staged=Join-Path $Work 'server.staged.mjs'
& $NodeExe $Patcher $Server $Staged
if($LASTEXITCODE -ne 0){Hold 'PATCH_FAILED'}
& $NodeExe --check $Staged
if($LASTEXITCODE -ne 0){Hold 'STAGED_SERVER_SYNTAX_FAILED'}
$StageHash=Hash $Staged
if((Hash $Server) -ne $OldHash){Hold 'SOURCE_CHANGED_DURING_STAGING'}
if(Test-Path -LiteralPath $ModuleDir){CheckDir $ModuleDir}
foreach($m in $Names){
 $dest=Join-Path $ModuleDir $m
 $src=Join-Path $Repo ('src\cognition\'+$m)
 $Existed[$m]=Test-Path -LiteralPath $dest -PathType Leaf
 if($Existed[$m]){
  CheckFile $dest
  if((Hash $dest) -ne (Hash $src)){Hold ('EXISTING_MODULE_CONFLICT_'+$m)}
 }
}
Write-Host 'FUN_CAPABILITY_DEPLOY_STAGE=PASS LIVE_SOURCE_UNCHANGED=TRUE'
Write-Host "FUN_CAPABILITY_DEPLOY_BACKUP=$Work"
if(-not $Apply){Write-Host 'FUN_CAPABILITY_LIVE_DEPLOY=NOT_PERFORMED';exit 0}
try{
 $pre=Services
 AssertEmptyCognitiveMemory $pre.Cognitive
 $MemoryBudget=[int]$pre.Budget
 if($MemoryBudget -lt 1000 -or $MemoryBudget -gt 180000){Hold 'COGNEE_BUDGET_UNEXPECTED'}
 foreach($port in $Protected){$PortBefore[$port]=PortSnap $port}
 if(-not $PortBefore[8088] -or -not $PortBefore[8791]){Hold 'MODEL_OR_COMPUTE_LISTENER_MISSING'}
 if((Owner8789).Pid -ne $OldProcess -or (Hash $Server) -ne $OldHash){Hold 'DASHBOARD_SOURCE_OR_PID_CHANGED'}
 $Changed=$true
 if(-not(Test-Path -LiteralPath $ModuleDir)){New-Item -ItemType Directory -Path $ModuleDir -ErrorAction Stop|Out-Null}
 foreach($m in $Names){
  if(-not $Existed[$m]){
   Copy-Item -LiteralPath (Join-Path $Repo ('src\cognition\'+$m)) -Destination (Join-Path $ModuleDir $m) -ErrorAction Stop
  }
 }
 Copy-Item -LiteralPath $Staged -Destination $Server -Force -ErrorAction Stop
 if((Hash $Server) -ne $StageHash){Hold 'STAGED_FILE_INSTALL_HASH_MISMATCH'}
 & $NodeExe --check $Server
 if($LASTEXITCODE -ne 0){Hold 'INSTALLED_SYNTAX_INVALID'}
 if((Owner8789).Pid -ne $OldProcess){Hold 'DASHBOARD_CHANGED_BEFORE_RESTART'}
 # Re-check volatile kernel store immediately before the restart.
 AssertEmptyCognitiveMemory (Json '/api/cognition/status' 15)
 Stop-Process -Id $OldProcess -ErrorAction Stop
 $Restarted=$true
 for($i=0;$i -lt 40;$i++){if(-not(PortSnap 8789)){break};Start-Sleep -Milliseconds 250}
 if(PortSnap 8789){Hold 'OLD_DASHBOARD_LISTENER_STILL_PRESENT'}
 $NewProcess=StartDashboard (Join-Path $Work 'deployed')
 if(-not (WaitNew ([int]$NewProcess.Id))){Hold ('NEW_DASHBOARD_NOT_READY_'+$script:WaitReason)}
 $post=Services
 if(($post.Names -join '|') -cne ($pre.Names -join '|')){Hold 'EXISTING_TOOL_REGISTRY_CHANGED'}
 AssertEmptyCognitiveMemory $post.Cognitive
 foreach($port in $Protected){
  if((PortSnap $port) -cne $PortBefore[$port]){Hold ('PROTECTED_PORT_CHANGED_'+$port)}
 }
 $query=Invoke-RestMethod -Uri ($Base+'/api/cognition/catalogue/search') -Method Post -ContentType 'application/json' -Body '{"query":"graph analysis","limit":4}' -TimeoutSec 12
 if(@($query.matches|Where-Object {$_.name -eq 'fi_graph_analyze'}).Count -ne 1 -or
    $query.permissionsChanged -ne $false -or $query.modelExecutionEnabled -ne $false){Hold 'LIVE_CATALOGUE_QUERY_UNEXPECTED'}
 Write-Host 'FUN_CAPABILITY_LIVE_DEPLOY=PASS'
 Write-Host 'FUN_CAPABILITY_STATUS=READY READ_ONLY=TRUE REA=STOPPED EXECUTION_GRANTS=0'
 Write-Host "BACKUP=$Work"
}catch{
 $reason=$_.Exception.Message
 Write-Warning "FUN_CAPABILITY_LIVE=HOLD REASON=$reason BACKUP=$Work"
 if($NewProcess){
  try{
   $NewProcess.Refresh()
   if(-not $NewProcess.HasExited -and (Owner8789).Pid -eq [int]$NewProcess.Id){
    Stop-Process -Id $NewProcess.Id -ErrorAction Stop
   }
  }catch{Write-Warning 'NEW_DASHBOARD_COULD_NOT_BE_SAFELY_STOPPED'}
 }
 if($Changed){
  try{
   if((Hash $Server) -eq $StageHash){
    Copy-Item -LiteralPath (Join-Path $Work 'server.original.mjs') -Destination $Server -Force -ErrorAction Stop
    if((Hash $Server) -ne $OldHash){Write-Warning 'SOURCE_HASH_ROLLBACK_NOT_VERIFIED'}
   }else{Write-Warning 'LIVE_SOURCE_CHANGED_EXTERNALLY_NO_AUTOMATIC_OVERWRITE'}
   foreach($m in $Names){
    if(-not $Existed[$m]){
     $dest=Join-Path $ModuleDir $m;$src=Join-Path $Repo ('src\cognition\'+$m)
     if((Test-Path -LiteralPath $dest -PathType Leaf) -and (Hash $dest) -eq (Hash $src)){
      Remove-Item -LiteralPath $dest -Force -ErrorAction Stop
     }
    }
   }
  }catch{Write-Warning 'SOURCE_ROLLBACK_REQUIRES_MANUAL_REVIEW'}
 }
 if($Restarted){
  try{
   for($i=0;$i -lt 35;$i++){if(-not (PortSnap 8789)){break};Start-Sleep -Milliseconds 250}
   if(-not(PortSnap 8789) -and (Hash $Server) -eq $OldHash){
    $recovered=StartDashboard (Join-Path $Work 'rollback')
    Write-Warning ('FUN_CAPABILITY_ROLLBACK_STARTED_PID='+$recovered.Id+' VERIFY_SERVICE_HEALTH')
   }else{Write-Warning 'ROLLBACK_NOT_SAFE_TO_AUTOSTART_CHECK_SOURCE_AND_PORT'}
  }catch{Write-Warning 'ROLLBACK_DASHBOARD_RESTART_FAILED'}
 }
 throw ('FUN_CAPABILITY_LIVE_DEPLOY_HOLD='+$reason+' BACKUP='+$Work)
}
