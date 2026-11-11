# FI_AUTO_LOCAL_DASHBOARD_DEPLOY_V1
# Stage-only by default. -Apply restarts ONLY the verified 8789 Node dashboard.
# Never changes 8088 llama.cpp, 8791 compute, NetBird, REA, Ollama or Elektron.
[CmdletBinding()]param([switch]$Apply)
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot;$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Server=Join-Path $Live 'src\server.mjs'
$Ui=Join-Path $Live 'public\index.html'
$Root='http://127.0.0.1:8789'
$Patcher=Join-Path $Repo 'scripts\patch-auto-local-dashboard-server.mjs'
$UiPatcher=Join-Path $Repo 'scripts\patch-auto-local-dashboard-ui.mjs'
$Dir=Join-Path $Live 'src\experimental'
$Modules=@('auto-local-dashboard.mjs','auto-local-tools.mjs')
$ProtectedPorts=@(8088,8791,8443,4479,8794)
$Work=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutoDashboard8789\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$OldPid=0;$NodeExe='';$NewProcess=$null;$Changed=$false;$Restarted=$false
$PreTools=@();$PortBefore=@{};$ModuleWasPresent=@{};$OldServerHash='';$OldUiHash='';$StagedServerHash='';$StagedUiHash='';$MemoryBudget=0
function Hold([string]$reason){throw ('FUN_AUTO_DASH_HOLD='+$reason)}
function File([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('MISSING_FILE_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('REPARSE_FILE_'+$p)}
}
function DirCheck([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Container)){Hold ('MISSING_DIRECTORY_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('REPARSE_DIR_'+$p)}
}
function Hash([string]$p){return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}
function PortSnap([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object) -join ';')
}
function Owner(){
 $connections=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)
 if($connections.Count -ne 1 -or $connections[0].LocalAddress -ne '127.0.0.1'){Hold '8789_LISTENER_UNEXPECTED'}
 $number=[int]$connections[0].OwningProcess
 $p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$number) -ErrorAction Stop
 if(-not $p -or $p.Name -ne 'node.exe' -or [string]$p.CommandLine -notmatch 'src[/\\]server\.mjs'){Hold '8789_NOT_VERIFIED_FUN_NODE'}
 if(-not $p.ExecutablePath){Hold 'NODE_EXECUTABLE_NOT_FOUND'}
 File ([string]$p.ExecutablePath)
 return @{Pid=$number;Exe=[string]$p.ExecutablePath}
}
function Json([string]$route,[int]$timeout=12){
 return Invoke-RestMethod ($Root+$route) -TimeoutSec $timeout -ErrorAction Stop
}
function CheckRea(){
 $status=0
 try{$ignored=Json '/api/rea/tools' 12;Hold 'REA_CATALOGUE_UNEXPECTEDLY_AVAILABLE'}catch{
  if($_.Exception.Message -like '*REA_CATALOGUE_UNEXPECTEDLY_AVAILABLE*'){throw}
  if($_.Exception.Response){$status=[int]$_.Exception.Response.StatusCode}
 }
 if($status -ne 403){Hold ('REA_DENIAL_UNEXPECTED_HTTP_'+$status)}
}
function Baseline(){
 $c=Json '/api/cognition/status' 20
 $k=Json '/api/cognition/health' 8
 $r=Json '/api/cognition/catalogue/status' 12
 $a=Json '/api/ai/status' 15
 $mem=Json '/api/ai/automatic-memory/status' 15
 $voice=Json '/api/voice/mobile/status' 15
 $tools=Json '/api/ai/tools' 25
 $platform=Json '/api/status' 25
 $compute=Invoke-RestMethod 'http://127.0.0.1:8791/ai/runtime/llama-cpp' -TimeoutSec 10
 if($c.version -ne 'fi-cognitive-live-bridge-v1' -or $k.liveChatDecorator -ne $true -or
    $c.reaExecutionGrants -ne 0 -or $c.automaticKnowledgeWrites -ne $false){Hold 'COGNITIVE_BASELINE_CHANGED'}
 if($r.version -ne 'fi-capability-index-v1' -or $r.executionGrants -ne 0 -or $r.localCount -lt 4){Hold 'CAPABILITY_REGISTRY_UNEXPECTED'}
 if($a.state -ne 'ready' -or $compute.state -ne 'ready'){Hold 'LLAMA_OR_COMPUTE_NOT_READY'}
 if($mem.enabledByDefault -ne $true -or $voice.enabled -ne $true){Hold 'MEMORY_OR_VOICE_UNHEALTHY'}
 if($platform.application -ne 'Fun Industrial Platform' -or $platform.safety.localFirstMode -ne $true -or
    $platform.vpn_policy.required -ne $false){Hold 'LOCAL_FIRST_IDENTITY_UNEXPECTED'}
 $rea=@($platform.services|Where-Object {$_.id -eq 'rea'})
 if($rea.Count -ne 1 -or $rea[0].state -ne 'stopped'){Hold 'REA_STATE_CHANGED'}
 CheckRea
 $names=@($tools.tools|ForEach-Object {$_.function.name})
 if($names.Count -ne [int]$tools.local_tool_count -or $names.Count -ne [int]$r.localCount -or
    @($names|Sort-Object -Unique).Count -ne $names.Count){Hold 'FIXED_LOCAL_TOOLS_CHANGED'}
 if([int]$tools.rea_tool_count -ne 0 -or @($names|Where-Object {$_ -like 'rea__*'}).Count -ne 0){Hold 'REA_TOOLS_LEAKED'}
 if($Original.Contains('FI_SECURITY_PRIMARY_8789_V1')){
  $sec=Json '/api/security/status'
  if($sec.state -ne 'ready'){Hold 'SECURITY_PRIMARY_NOT_READY'}
 }
 return @{Cognitive=$c;ToolNames=$names;MemoryBudget=[int]$mem.recallBudgetMs}
}
function EmptyCognition($c){
 if([int]$c.cognition.claims.total -ne 0 -or [int]$c.cognition.predictions.total -ne 0 -or
    [int]$c.cognition.historyEvents -ne 0){Hold 'COGNITIVE_VOLATILE_DATA_WOULD_BE_LOST'}
}
function Launch([string]$prefix){
 $env:HOST='127.0.0.1';$env:PORT='8789';$env:COMPUTE_PORT='8791'
 $env:LOCAL_FIRST_MODE='true';$env:REA_ALLOWED_TOOLS=''
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$script:MemoryBudget
 $env:FUN_VOICE_HOME=Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceLab'
 return Start-Process -FilePath $NodeExe -ArgumentList 'src/server.mjs' -WorkingDirectory $Live -PassThru -ErrorAction Stop -RedirectStandardOutput ($prefix+'.stdout.log') -RedirectStandardError ($prefix+'.stderr.log')
}
function WaitNew([int]$expected){
 $script:WaitReason='NO_HTTP'
 for($i=0;$i -lt 90;$i++){
  Start-Sleep -Milliseconds 500
  try{
   if((Owner).Pid -ne $expected){$script:WaitReason='WRONG_8789_OWNER';continue}
   $k=Json '/api/cognition/health' 4
   $idx=Json '/api/cognition/catalogue/status' 4
   $auto=Json '/api/ai/auto-local/status' 4
   if($k.version -ne 'fi-cognitive-live-bridge-v1' -or $k.reaExecutionGrants -ne 0 -or
      $idx.version -ne 'fi-capability-index-v1' -or $auto.version -ne 'fi-auto-local-dashboard-v1' -or
      $auto.reaExecutionGrants -ne 0 -or $auto.busy -ne $false -or $auto.backgroundExecution -ne $false){
    $script:WaitReason='NEW_DASHBOARD_IDENTITY_UNEXPECTED';continue
   }
   return $true
  }catch{$script:WaitReason='HTTP_OR_IDENTITY_NOT_YET_READY'}
 }
 return $false
}
foreach($d in @($Repo,$Live,(Join-Path $Live 'src'),(Join-Path $Live 'public'))){DirCheck $d}
foreach($p in @($Server,$Ui,$Patcher,$UiPatcher,
 (Join-Path $Repo 'src\experimental\auto-local-dashboard.mjs'),
 (Join-Path $Repo 'src\experimental\auto-local-tools.mjs'),
 (Join-Path $Repo 'intelligence-checks\auto-local-dashboard-case.mjs'),
 (Join-Path $Repo 'intelligence-checks\auto-local-tools-case.mjs'))){File $p}
$Original=[IO.File]::ReadAllText($Server)
$OriginalUi=[IO.File]::ReadAllText($Ui)
if(-not $Original.Contains('FI_COGNITIVE_LIVE_PATCH_V1') -or
   -not $Original.Contains('FI_CAPABILITY_INDEX_LIVE_V1') -or
   $Original.Contains('FI_AUTO_LOCAL_DASHBOARD_PATCH_V1') -or
   $OriginalUi.Contains('FI_AUTO_LOCAL_DASHBOARD_UI_V1')){Hold 'LIVE_AUTO_DASH_BASELINE_NOT_EXPECTED'}
$found=Owner
$OldPid=[int]$found.Pid;$NodeExe=[string]$found.Exe
$OldServerHash=Hash $Server;$OldUiHash=Hash $Ui
foreach($mod in @($Patcher,$UiPatcher,
 (Join-Path $Repo 'src\experimental\auto-local-dashboard.mjs'),
 (Join-Path $Repo 'src\experimental\auto-local-tools.mjs'))){
 & $NodeExe --check $mod
 if($LASTEXITCODE -ne 0){Hold ('MODULE_SYNTAX_FAILED_'+$mod)}
}
Push-Location $Repo
try{
 & $NodeExe --test 'intelligence-checks\auto-local-dashboard-case.mjs' 'intelligence-checks\auto-local-tools-case.mjs'
 if($LASTEXITCODE -ne 0){Hold 'AUTO_DASH_TESTS_FAILED'}
}finally{Pop-Location}
New-Item -ItemType Directory -Path $Work -Force -ErrorAction Stop|Out-Null
Copy-Item -LiteralPath $Server -Destination (Join-Path $Work 'server.original.mjs')
Copy-Item -LiteralPath $Ui -Destination (Join-Path $Work 'index.original.html')
$StagedServer=Join-Path $Work 'server.staged.mjs'
$StagedUi=Join-Path $Work 'index.staged.html'
& $NodeExe $Patcher $Server $StagedServer
if($LASTEXITCODE -ne 0){Hold 'SERVER_STAGING_FAILED'}
& $NodeExe $UiPatcher $Ui $StagedUi
if($LASTEXITCODE -ne 0){Hold 'UI_STAGING_FAILED'}
& $NodeExe --check $StagedServer
if($LASTEXITCODE -ne 0){Hold 'STAGED_SERVER_SYNTAX_FAILED'}
$StagedServerHash=Hash $StagedServer;$StagedUiHash=Hash $StagedUi
if((Hash $Server) -ne $OldServerHash -or (Hash $Ui) -ne $OldUiHash){Hold 'LIVE_FILES_CHANGED_DURING_STAGING'}
if(Test-Path -LiteralPath $Dir){DirCheck $Dir}
foreach($m in $Modules){
 $src=Join-Path $Repo ('src\experimental\'+$m)
 $dest=Join-Path $Dir $m
 $ModuleWasPresent[$m]=Test-Path -LiteralPath $dest -PathType Leaf
 if($ModuleWasPresent[$m]){
  File $dest
  if((Hash $dest) -ne (Hash $src)){Hold ('CONFLICTING_EXISTING_MODULE_'+$m)}
 }
}
Write-Host 'FUN_AUTO_DASH_STAGE=PASS SERVER_AND_UI_ORIGINALS_UNCHANGED=TRUE'
Write-Host ('FUN_AUTO_DASH_BACKUP='+$Work)
if(-not $Apply){Write-Host 'FUN_AUTO_DASH_LIVE_DEPLOY=NOT_PERFORMED';exit 0}
try{
 $pre=Baseline
 EmptyCognition $pre.Cognitive
 $PreTools=@($pre.ToolNames);$MemoryBudget=[int]$pre.MemoryBudget
 if($MemoryBudget -lt 1000 -or $MemoryBudget -gt 180000){Hold 'COGNEE_BUDGET_UNEXPECTED'}
 foreach($p in $ProtectedPorts){$PortBefore[$p]=PortSnap $p}
 if(-not $PortBefore[8088] -or -not $PortBefore[8791]){Hold 'MODEL_OR_COMPUTE_MISSING'}
 if((Owner).Pid -ne $OldPid -or (Hash $Server) -ne $OldServerHash -or (Hash $Ui) -ne $OldUiHash){Hold 'LIVE_BASELINE_CHANGED'}
 $Changed=$true
 if(-not(Test-Path -LiteralPath $Dir)){New-Item -ItemType Directory -Path $Dir -ErrorAction Stop|Out-Null}
 foreach($m in $Modules){
  if(-not $ModuleWasPresent[$m]){
   Copy-Item -LiteralPath (Join-Path $Repo ('src\experimental\'+$m)) -Destination (Join-Path $Dir $m) -ErrorAction Stop
  }
 }
 Copy-Item -LiteralPath $StagedServer -Destination $Server -Force -ErrorAction Stop
 Copy-Item -LiteralPath $StagedUi -Destination $Ui -Force -ErrorAction Stop
 if((Hash $Server) -ne $StagedServerHash -or (Hash $Ui) -ne $StagedUiHash){Hold 'APPLIED_BYTES_MISMATCH'}
 & $NodeExe --check $Server
 if($LASTEXITCODE -ne 0){Hold 'NEW_SERVER_INVALID'}
 if((Owner).Pid -ne $OldPid){Hold 'DASHBOARD_OWNER_CHANGED_BEFORE_RESTART'}
 EmptyCognition (Json '/api/cognition/status' 12)
 Stop-Process -Id $OldPid -ErrorAction Stop
 $Restarted=$true
 for($i=0;$i -lt 40;$i++){if(-not(PortSnap 8789)){break};Start-Sleep -Milliseconds 250}
 if(PortSnap 8789){Hold 'OLD_DASHBOARD_PORT_OCCUPIED'}
 $NewProcess=Launch (Join-Path $Work 'applied')
 if(-not(WaitNew ([int]$NewProcess.Id))){Hold ('NEW_DASHBOARD_NOT_READY_'+$script:WaitReason)}
 $post=Baseline
 if(($post.ToolNames -join '|') -cne ($PreTools -join '|')){Hold 'LOCAL_TOOL_REGISTRY_CHANGED'}
 EmptyCognition $post.Cognitive
 foreach($p in $ProtectedPorts){if((PortSnap $p) -cne $PortBefore[$p]){Hold ('PROTECTED_LISTENER_CHANGED_'+$p)}}
 if((Hash $Server) -ne $StagedServerHash -or (Hash $Ui) -ne $StagedUiHash){Hold 'LIVE_SOURCE_CHANGED_POST_DEPLOY'}
 $auto=Json '/api/ai/auto-local/status' 12
 if($auto.version -ne 'fi-auto-local-dashboard-v1' -or $auto.backgroundExecution -ne $false -or
   $auto.reaExecutionGrants -ne 0){Hold 'AUTO_DASH_STATUS_MISMATCH'}
 Write-Host 'FUN_AUTO_DASH_LIVE_DEPLOY=PASS'
 Write-Host 'AUTO_CHAT=READY COGNITION=PRESERVED AI=READY REA=STOPPED GRANTS=0'
 Write-Host ('FUN_AUTO_DASH_URL='+$Root)
 Write-Host ('FUN_AUTO_DASH_BACKUP='+$Work)
}catch{
 $reason=$_.Exception.Message
 Write-Warning ('FUN_AUTO_DASH_DEPLOY_HOLD='+$reason+' BACKUP='+$Work)
 if($NewProcess){
  try{
   $NewProcess.Refresh()
   if(-not $NewProcess.HasExited -and (Owner).Pid -eq [int]$NewProcess.Id){
    Stop-Process -Id $NewProcess.Id -ErrorAction Stop
   }
  }catch{Write-Warning 'NEW_DASHBOARD_NOT_OWNED_OR_CANNOT_STOP'}
 }
 if($Changed){
  try{
   # Restore each file independently if it still has either the original
   # bytes or the exact bytes installed by this run. A partial copy failure
   # must not strand the live server with mixed original/staged files.
   $serverCurrent=Hash $Server
   $uiCurrent=Hash $Ui
   if($serverCurrent -eq $StagedServerHash){
    Copy-Item -LiteralPath (Join-Path $Work 'server.original.mjs') -Destination $Server -Force -ErrorAction Stop
   }elseif($serverCurrent -ne $OldServerHash){Write-Warning 'SERVER_EXTERNALLY_CHANGED_NO_OVERWRITE'}
   if($uiCurrent -eq $StagedUiHash){
    Copy-Item -LiteralPath (Join-Path $Work 'index.original.html') -Destination $Ui -Force -ErrorAction Stop
   }elseif($uiCurrent -ne $OldUiHash){Write-Warning 'UI_EXTERNALLY_CHANGED_NO_OVERWRITE'}
   if((Hash $Server) -ne $OldServerHash -or (Hash $Ui) -ne $OldUiHash){Write-Warning 'BACKUP_HASH_RESTORE_MISMATCH'}
   foreach($m in $Modules){
    if(-not $ModuleWasPresent[$m]){
     $dest=Join-Path $Dir $m
     if((Test-Path -LiteralPath $dest -PathType Leaf) -and
        (Hash $dest) -eq (Hash (Join-Path $Repo ('src\experimental\'+$m)))){
      Remove-Item -LiteralPath $dest -Force -ErrorAction Stop
     }
    }
   }
  }catch{Write-Warning 'ROLLBACK_SOURCE_REQUIRES_MANUAL_INSPECTION'}
 }
 if($Restarted){
  try{
   for($i=0;$i -lt 35;$i++){if(-not(PortSnap 8789)){break};Start-Sleep -Milliseconds 250}
   if(-not(PortSnap 8789) -and (Hash $Server) -eq $OldServerHash -and (Hash $Ui) -eq $OldUiHash){
    $restored=Launch (Join-Path $Work 'rollback')
    Write-Warning ('FUN_AUTO_DASH_ROLLBACK_STARTED_PID='+$restored.Id+' VERIFY_HEALTH')
   }else{Write-Warning 'ROLLBACK_NOT_SAFE_TO_AUTO_RESTART'}
  }catch{Write-Warning 'ROLLBACK_DASHBOARD_RESTART_FAILED'}
 }
 throw ('FUN_AUTO_DASH_LIVE_DEPLOY_HOLD='+$reason+' BACKUP='+$Work)
}
