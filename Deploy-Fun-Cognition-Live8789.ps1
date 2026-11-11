# FI_COGNITIVE_LIVE_DEPLOY_V1 — additive integration with the existing 8789 UI.
# Default: stage/verify only. -Apply explicitly permits restarting ONLY port 8789's
# verified dashboard Node process. NEVER starts/stops 8088, 8791, 8443, REA,
# NetBird, Ollama, browser services, or independent compute/model processes.
[CmdletBinding()]param([switch]$Apply)
$ErrorActionPreference='Stop'
$Src=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Base='http://127.0.0.1:8789'
$Server=Join-Path $Live 'src\server.mjs'
$Patcher=Join-Path $Src 'scripts\patch-cognitive-live.mjs'
$Modules=@('kernel.mjs','live-bridge.mjs')
$CognitionDir=Join-Path $Live 'src\cognition'
$Work=Join-Path $env:LOCALAPPDATA ('FunIndustrial\CognitionLive8789\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$OriginalPid=0;$NodeExe=$null;$Restarted=$false;$Changed=$false;$NewProcess=$null
$ProtectedPorts=@(8088,8791,8443,4479,8794)
$PortBefore=@{};$ModuleExisted=@{};$PreTools=@();$PreRea=@();$MemoryBudget=90000
function Hold([string]$reason){throw ('FUN_COGNITION_LIVE_HOLD='+$reason)}
function CheckFile([string]$p){
 if(-not (Test-Path -LiteralPath $p -PathType Leaf)){Hold ('FILE_NOT_FOUND_'+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold ('REPARSE_FILE_'+$p)}
}
function CheckDir([string]$p){
 if(-not (Test-Path -LiteralPath $p -PathType Container)){Hold ('DIRECTORY_NOT_FOUND_'+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold ('REPARSE_DIRECTORY_'+$p)}
}
function PortSnapshot([int]$port){
 return (@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
}
function Owner8789(){
 $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue)
 if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1'){Hold '8789_LOOPBACK_OWNER_AMBIGUOUS'}
 $id=[int]$listeners[0].OwningProcess
 $p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$id) -ErrorAction Stop
 if(-not $p -or $p.Name -ne 'node.exe' -or [string]$p.CommandLine -notmatch 'src[/\\]server\.mjs'){Hold '8789_OWNER_NOT_FUN_INDUSTRIAL_NODE'}
 # Relative src/server.mjs arguments are normal; validate live source and API separately.
 if(-not $p.ExecutablePath){Hold '8789_NODE_EXECUTABLE_UNVERIFIED'}
 CheckFile ([string]$p.ExecutablePath)
 return @{Pid=$id;Exe=[string]$p.ExecutablePath}
}
function GetJson([string]$path,[int]$timeout=12){
 return Invoke-RestMethod -Uri ($Base+$path) -TimeoutSec $timeout -ErrorAction Stop
}
function VerifyExistingServices(){
 $security=GetJson '/api/security/status'
 $memory=GetJson '/api/ai/automatic-memory/status'
 $voice=GetJson '/api/voice/mobile/status'
 $ai=GetJson '/api/ai/status'
 $definitions=GetJson '/api/ai/tools' 40
 $rea=GetJson '/api/rea/tools' 40
 $compute=Invoke-RestMethod -Uri 'http://127.0.0.1:8791/ai/runtime/llama-cpp' -TimeoutSec 8
 if($security.state -ne 'ready' -or $memory.enabledByDefault -ne $true -or $voice.enabled -ne $true){Hold 'PROTECTED_SERVICES_UNHEALTHY'}
 if($ai.state -ne 'ready' -or $compute.state -ne 'ready'){Hold 'LIVE_MODEL_COMPUTE_UNAVAILABLE_FIX_FIRST'}
 $names=@($definitions.tools | ForEach-Object {$_.function.name})
 if($names.Count -lt 4 -or @($names|Sort-Object -Unique).Count -ne $names.Count){Hold 'TOOL_REGISTRY_UNEXPECTED'}
 return @{Names=$names;Allowed=@($rea.tools|ForEach-Object {$_.name});MemoryBudget=[int]$memory.recallBudgetMs}
}
function Launch8789([string]$name){
 # Reuse actual Node executable, preserved REA allowlist and Cognee recall budget.
 $env:HOST='127.0.0.1';$env:PORT='8789';$env:COMPUTE_PORT='8791';$env:LOCAL_FIRST_MODE='true'
 $env:REA_ALLOWED_TOOLS=($script:PreRea -join ',')
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$script:MemoryBudget
 $env:FUN_VOICE_HOME=Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceLab'
 return Start-Process -FilePath $script:NodeExe -ArgumentList 'src/server.mjs' -WorkingDirectory $Live -PassThru -RedirectStandardOutput ($name+'.stdout.log') -RedirectStandardError ($name+'.stderr.log')
}
function WaitFor8789([int]$id){
 for($i=0;$i -lt 60;$i++){
  Start-Sleep -Milliseconds 500
  try{
   if((Owner8789).Pid -ne $id){continue}
   $c=GetJson '/api/cognition/status' 4
   $a=GetJson '/api/ai/status' 4
   if($c.version -eq 'fi-cognitive-live-bridge-v1' -and $a.state -eq 'ready'){return $true}
  }catch{}
 }
 return $false
}
foreach($d in @($Src,$Live,(Join-Path $Live 'src'),(Join-Path $Src 'src\cognition'))){CheckDir $d}
foreach($f in @($Server,$Patcher,(Join-Path $Src 'src\cognition\kernel.mjs'),(Join-Path $Src 'src\cognition\live-bridge.mjs'),(Join-Path $Src 'intelligence-checks\cognitive-live-bridge-case.mjs'),(Join-Path $Src 'intelligence-checks\cognitive-kernel-case.mjs'))){CheckFile $f}
$Original=[IO.File]::ReadAllText($Server)
if($Original.Contains('FI_COGNITIVE_LIVE_PATCH_V1')){Hold 'ALREADY_INSTALLED'}
$Owner=Owner8789
$OriginalPid=[int]$Owner.Pid;$NodeExe=$Owner.Exe
& $NodeExe --check $Patcher; if($LASTEXITCODE -ne 0){Hold 'PATCHER_SYNTAX'}
& $NodeExe --check (Join-Path $Src 'src\cognition\kernel.mjs'); if($LASTEXITCODE -ne 0){Hold 'KERNEL_SYNTAX'}
& $NodeExe --check (Join-Path $Src 'src\cognition\live-bridge.mjs'); if($LASTEXITCODE -ne 0){Hold 'BRIDGE_SYNTAX'}
& $NodeExe --test (Join-Path $Src 'intelligence-checks\cognitive-kernel-case.mjs') (Join-Path $Src 'intelligence-checks\cognitive-live-bridge-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'COGNITION_TESTS_FAILED'}
New-Item -ItemType Directory -Path $Work -Force | Out-Null
Copy-Item $Server (Join-Path $Work 'server.original.mjs')
$Stage=Join-Path $Work 'server.staged.mjs'
& $NodeExe $Patcher $Server $Stage
if($LASTEXITCODE -ne 0){Hold 'PATCH_ANCHOR_MISMATCH'}
& $NodeExe --check $Stage
if($LASTEXITCODE -ne 0){Hold 'STAGED_SERVER_SYNTAX'}
if(Test-Path -LiteralPath $CognitionDir){CheckDir $CognitionDir}
foreach($name in $Modules){
 $dest=Join-Path $CognitionDir $name;$source=Join-Path $Src ('src\cognition\'+$name)
 $ModuleExisted[$name]=(Test-Path -LiteralPath $dest -PathType Leaf)
 if($ModuleExisted[$name]){
  CheckFile $dest
  if((Get-FileHash -LiteralPath $dest).Hash -ne (Get-FileHash -LiteralPath $source).Hash){Hold ('CONFLICT_EXISTING_COGNITION_MODULE_'+$name)}
 }
}
Write-Host 'FUN_COGNITION_LIVE_STAGE=PASS NEW_ROUTES=7 CHAT_DECORATOR=VERIFIED LIVE_CHANGED=FALSE'
Write-Host ('FUN_COGNITION_BACKUP='+$Work)
if(-not $Apply){Write-Host 'FUN_COGNITION_LIVE_DEPLOY=NOT_PERFORMED RUN_WITH_-Apply_AFTER_SERVICE_HEALTH_READY';exit 0}
try {
 # No runtime mutations until all preflight requirements are verified.
 $Pre=VerifyExistingServices
 $PreTools=@($Pre.Names);$PreRea=@($Pre.Allowed);$MemoryBudget=[int]$Pre.MemoryBudget
 if($MemoryBudget -lt 1000 -or $MemoryBudget -gt 180000){Hold 'MEMORY_BUDGET_INVALID'}
 foreach($port in $ProtectedPorts){$PortBefore[$port]=PortSnapshot $port}
 if(-not $PortBefore[8088] -or -not $PortBefore[8791]){Hold 'LIVE_COMPUTE_OR_LLAMA_PORT_MISSING'}
 if((Owner8789).Pid -ne $OriginalPid){Hold 'DASHBOARD_OWNER_CHANGED'}
 $Changed=$true
 if(-not(Test-Path -LiteralPath $CognitionDir)){New-Item -ItemType Directory -Path $CognitionDir -ErrorAction Stop|Out-Null}
 foreach($name in $Modules){
  if(-not $ModuleExisted[$name]){Copy-Item -LiteralPath (Join-Path $Src ('src\cognition\'+$name)) -Destination (Join-Path $CognitionDir $name) -ErrorAction Stop}
 }
 Copy-Item -LiteralPath $Stage -Destination $Server -Force -ErrorAction Stop
 & $NodeExe --check $Server
 if($LASTEXITCODE -ne 0){Hold 'NEW_SERVER_SYNTAX'}
 if((Owner8789).Pid -ne $OriginalPid){Hold 'DASHBOARD_PID_CHANGED_BEFORE_RESTART'}
 Stop-Process -Id $OriginalPid -ErrorAction Stop
 $Restarted=$true
 for($i=0;$i -lt 30;$i++){if(-not (PortSnapshot 8789)){break};Start-Sleep -Milliseconds 250}
 if(PortSnapshot 8789){Hold 'OLD_DASHBOARD_STILL_LISTENING'}
 $NewProcess=Launch8789 (Join-Path $Work 'applied')
 if(-not (WaitFor8789 ([int]$NewProcess.Id))){Hold 'NEW_DASHBOARD_NOT_READY'}
 $After=VerifyExistingServices
 if(($After.Names -join '|') -cne ($PreTools -join '|')){Hold 'TOOL_REGISTRY_CHANGED'}
 if(($After.Allowed -join '|') -cne ($PreRea -join '|')){Hold 'REA_ALLOWED_TOOLS_CHANGED'}
 foreach($port in $ProtectedPorts){if((PortSnapshot $port) -cne $PortBefore[$port]){Hold ('PROTECTED_PORT_OWNER_CHANGED_'+$port)}}
 $status=GetJson '/api/cognition/status'
 if($status.automaticKnowledgeWrites -ne $false -or $status.reaExecutionGrants -ne 0){Hold 'COGNITION_AUTHORITY_REGRESSION'}
 Write-Host 'FUN_COGNITION_LIVE_DEPLOY=PASS CHAT=WIRED API=READY TOOLS=UNCHANGED REA=UNCHANGED'
 Write-Host ('FUN_COGNITION_URL='+$Base+'/api/cognition/status')
 Write-Host ('FUN_COGNITION_BACKUP='+$Work)
}catch{
 $reason=$_.Exception.Message
 Write-Warning ('FUN_COGNITION_LIVE=HOLD REASON='+$reason+' BACKUP='+$Work)
 if($NewProcess){try{$NewProcess.Refresh();if(-not $NewProcess.HasExited){Stop-Process -Id $NewProcess.Id -ErrorAction SilentlyContinue}}catch{}}
 if($Changed){
  Copy-Item -LiteralPath (Join-Path $Work 'server.original.mjs') -Destination $Server -Force -ErrorAction SilentlyContinue
  foreach($name in $Modules){
   if(-not $ModuleExisted[$name]){
    $dest=Join-Path $CognitionDir $name
    if(Test-Path -LiteralPath $dest){
     if((Get-FileHash -LiteralPath $dest).Hash -eq (Get-FileHash -LiteralPath (Join-Path $Src ('src\cognition\'+$name))).Hash){Remove-Item -LiteralPath $dest -Force -ErrorAction SilentlyContinue}
    }
   }
  }
 }
 if($Restarted){
  try{
   for($i=0;$i -lt 25;$i++){if(-not (PortSnapshot 8789)){break};Start-Sleep -Milliseconds 300}
   if(-not (PortSnapshot 8789)){
    $recovered=Launch8789 (Join-Path $Work 'rollback')
    Write-Warning ('FUN_COGNITION_ROLLBACK_STARTED_PID='+$recovered.Id+' VERIFY_EXISTING_CHAT')
   }else{Write-Warning 'FUN_COGNITION_ROLLBACK_PORT_OCCUPIED_REQUIRES_MANUAL_RECOVERY'}
  }catch{Write-Warning 'FUN_COGNITION_ROLLBACK_MANUAL_RECOVERY_REQUIRED'}
 }
 throw ('FUN_COGNITION_LIVE_DEPLOY_HOLD='+$reason+' BACKUP='+$Work)
}
