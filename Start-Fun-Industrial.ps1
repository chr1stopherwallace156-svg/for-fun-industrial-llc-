# FUN_INDUSTRIAL_ONE_COMMAND_STARTUP_V43
# Explicitly invoking this one file authorizes only starting fixed local services.
# Never invokes /api/activate, /api/start, /api/ai/start, any MCP tools,
# model prompts, NetBird, source restoration, taskkill, or the Elektron process.
# Separate operator authorization remains mandatory for actual tool execution.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Primary=Join-Path $HOME 'FunIndustrial-REA-MCP-Activation'
$Source=Join-Path $Primary 'src\server.mjs'
$ExpectedSourceSha='9C8667C1299102156968A79FD8CF524AC23EFAC25B7E924D369954EC638C6844'
$QExe=Join-Path $HOME 'FunIndustrial\.runtime\llama.cpp\llama-server.exe'
$QModel=Join-Path $HOME 'FunIndustrial\.runtime\models\Qwen3-4B-Q4_K_M.gguf'
$Policy=Join-Path $env:LOCALAPPDATA 'FunIndustrial\DashboardAutostart\retired-watchdog-20261110-231030-a18f213e\policy.retired.json'
$LogDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\OneCommandStart-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
$Owned=@{};$Original=@{}
function Hold([string]$reason){throw ('FUN_ONE_COMMAND_HOLD='+$reason)}
function Socket([int]$port){
 $all=@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
 if($all.Count -eq 0){return $null}
 if($all.Count -ne 1 -or $all[0].LocalAddress -ne '127.0.0.1' -or
    [int]$all[0].OwningProcess -le 0){Hold ('UNEXPECTED_LISTENER_'+$port)}
 return [int]$all[0].OwningProcess
}
function File([string]$f){
 if(-not(Test-Path -LiteralPath $f -PathType Leaf)){Hold ('MISSING_REQUIRED_FILE_'+$f)}
 if((Get-Item -LiteralPath $f).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('LINK_REFUSED_'+$f)}
}
function Json([string]$url){
 # Every URL supplied by this script is a fixed localhost address.
 return Invoke-RestMethod -Uri $url -TimeoutSec 8 -ErrorAction Stop
}
function Existing([int]$port,[string]$name,[string]$cmdMarker){
 $pidFound=Socket $port
 if(-not $pidFound){return $false}
 $p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$pidFound) -ErrorAction Stop
 if(-not $p -or $p.Name -ne $name -or
    [string]::IsNullOrWhiteSpace([string]$p.CommandLine) -or
    ([string]$p.CommandLine).IndexOf($cmdMarker,[StringComparison]::OrdinalIgnoreCase) -lt 0){
  Hold ('UNKNOWN_PROCESS_OWNER_'+$port)
 }
 $script:Original[$port]=$pidFound
 Write-Host "FUN_ADOPTED_PORT_$port=PID_$pidFound"
 return $true
}
function VerifyCompute(){
 $id=Socket 8791
 if(-not $id){Hold 'COMPUTE_LISTENER_MISSING'}
 $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id) -ErrorAction Stop
 if(-not $proc -or $proc.Name -ne 'python.exe'){Hold 'COMPUTE_OWNER_NOT_PYTHON'}
 $health=Json 'http://127.0.0.1:8791/health'
 if($health.state -ne 'running' -or $health.graph_engine -ne 'networkx' -or
  $health.tensor_engine -ne 'quimb' -or $health.neural_engine -ne 'pytorch-cpu'){
  Hold 'COMPUTE_IDENTITY_OR_ENGINE_MISMATCH'
 }
 return $id
}
function Await([int]$port,[scriptblock]$probe,[int]$limit=80){
 for($i=0;$i -lt $limit;$i++){
  Start-Sleep -Milliseconds 600
  try{
   $p=Socket $port
   if($p -and (& $probe)) {return $p}
  }catch{}
 }
 Hold ('HEALTH_TIMEOUT_'+$port)
}
function StartNode([int]$port,[string]$script,[string]$mode,[string]$cwd){
 File $script
 & $script:Node --check $script
 if($LASTEXITCODE -ne 0){Hold ('NODE_SYNTAX_FAILED_'+$port)}
 if(Socket $port){Hold ('PORT_CLAIMED_BEFORE_START_'+$port)}
 $out=Join-Path $script:LogDir ($port.ToString()+'.stdout.log')
 $err=Join-Path $script:LogDir ($port.ToString()+'.stderr.log')
 $nodeArgs=('"'+$script+'"')+$(if($mode){' '+$mode}else{''})
 $child=Start-Process -FilePath $script:Node -ArgumentList $nodeArgs -WorkingDirectory $cwd -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
 $script:Owned[$port]=$child.Id
 Write-Host "FUN_START_REQUEST_PORT_$port=PID_$($child.Id)"
}
# No launches or file modifications until fixed inputs and old state pass checks.
$Node=(Get-Command node.exe -ErrorAction Stop).Source
File $Node;File $Source;File (Join-Path $Primary '.env')
foreach($file in @(
 (Join-Path $Repo 'scripts\Run-Fun-Auto-Sidecar8796.mjs'),
 (Join-Path $Repo 'scripts\Run-Fun-Rea229-Sidecar8797.mjs'),
 (Join-Path $Repo 'scripts\Run-Fun-Unified-Chat8798.mjs'),
 (Join-Path $Repo 'src\experimental\embedded-local-tools-v4-2.mjs'),
 (Join-Path $Repo 'src\experimental\unified-task-chat.mjs'),
 (Join-Path $Repo 'Recover-Fun-Compute.ps1')
)){File $file}
if((Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash -cne $ExpectedSourceSha){
 Hold '8789_SOURCE_HASH_CHANGED_MANUAL_REVIEW_NO_RESTORE'
}
& $Node --check $Source
if($LASTEXITCODE -ne 0){Hold '8789_SOURCE_SYNTAX_INVALID'}
foreach($port in @(11434,8088,8791,8789,8796,8797,8798)){ $Original[$port]=Socket $port }
if($Original[11434]){
 $owner=Get-Process -Id $Original[11434] -ErrorAction Stop
 if($owner.ProcessName -ne 'ollama'){Hold 'ELEKTRON_OLLAMA_IDENTITY_CHANGED'}
}
if($Original[8088]){[void](Existing 8088 'llama-server.exe' 'Qwen3-4B-Q4_K_M.gguf')}
if($Original[8791]){Write-Host ('FUN_ADOPTED_PORT_8791=PID_'+(VerifyCompute))}
if($Original[8789]){[void](Existing 8789 'node.exe' 'server.mjs')}
if($Original[8796]){[void](Existing 8796 'node.exe' 'Run-Fun-Auto-Sidecar8796.mjs')}
if($Original[8797]){[void](Existing 8797 'node.exe' 'Run-Fun-Rea229-Sidecar8797.mjs')}
if($Original[8798]){[void](Existing 8798 'node.exe' 'Run-Fun-Unified-Chat8798.mjs')}
if($CheckOnly){
 foreach($port in @(8088,8791,8789,8796,8797,8798,11434)){
  Write-Host ('FUN_PREFLIGHT_PORT_'+$port+'='+$(if($Original[$port]){'LISTENING'}else{'MISSING'}))
 }
 Write-Host 'FUN_ONE_COMMAND_CHECK_ONLY=PASS CHANGES=0 TOOL_CALLS=0'
 return
}
New-Item -ItemType Directory -Path $LogDir -Force|Out-Null
Write-Host "FUN_START_LOGS=$LogDir"
# 1. Adopt or start a single Qwen GGUF on loopback. No Ollama interaction.
if(-not $Original[8088]){
 File $QExe;File $QModel
 $args='--model "'+$QModel+'" --host 127.0.0.1 --port 8088 --threads 4 --ctx-size 4096 --n-gpu-layers 0 --jinja'
 $child=Start-Process -FilePath $QExe -ArgumentList $args -WorkingDirectory (Split-Path $QExe) -PassThru -RedirectStandardOutput (Join-Path $LogDir '8088.stdout.log') -RedirectStandardError (Join-Path $LogDir '8088.stderr.log')
 $Owned[8088]=$child.Id
 Write-Host "FUN_START_REQUEST_PORT_8088=PID_$($child.Id)"
}
$p=Await 8088 { (Json 'http://127.0.0.1:8088/health').status -eq 'ok' } 140
if($Owned[8088] -and $p -ne $Owned[8088]){Hold '8088_PROCESS_RACE'}
# 2. Use the prequalified compute-only recovery script if needed.
if(-not $Original[8791]){
 & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $Repo 'Recover-Fun-Compute.ps1')
 if($LASTEXITCODE -ne 0){Hold '8791_COMPUTE_RECOVERY_FAILED_NO_RETRY'}
}
$p=Await 8791 { (Json 'http://127.0.0.1:8791/health').state -eq 'running' }
$p=VerifyCompute
# Uvicorn may migrate from a launcher PID to a Python child worker PID.
# Health and identity, not a stale PID, are the durable compute assertions.
# 3. Adopt existing 8789; launch original source without restoration if missing.
if(-not $Original[8789]){
 File $Policy
 $pol=Get-Content -LiteralPath $Policy -Raw|ConvertFrom-Json
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 if($pol.schema -ne 'fun.dashboard.autostart.v1' -or $pol.sid -ne $sid -or
  $pol.deployedRoot -ne $Primary -or $pol.host -ne '127.0.0.1' -or
  [int]$pol.port -ne 8789 -or [int]$pol.computePort -ne 8791 -or
  @($pol.catalogueNames).Count -ne 229 -or @($pol.allowedTools).Count -gt 229){
  Hold '8789_SAVED_POLICY_IDENTITY_INVALID'
 }
 $env:HOST='127.0.0.1';$env:PORT='8789';$env:COMPUTE_PORT='8791'
 $env:LOCAL_FIRST_MODE='true'
 $env:FUN_VOICE_HOME=[string]$pol.voiceHome
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$pol.memoryBudgetMs
 $env:REA_ALLOWED_TOOLS=(@($pol.allowedTools)-join ',')
 StartNode 8789 $Source '' $Primary
}
$p=Await 8789 { try{(Json 'http://127.0.0.1:8789/api/ai/tools').local_tool_count -eq 19}catch{return $false} } 120
if($Owned[8789] -and $p -ne $Owned[8789]){Hold '8789_PROCESS_RACE'}
$tools=Json 'http://127.0.0.1:8789/api/ai/tools'
if($tools.local_tool_count -ne 19 -or @('0','229') -cnotcontains [string]$tools.rea_tool_count){
 Hold '8789_LOCAL_REGISTRY_DRIFT'
}
# No POST to /api/start or /api/activate: those routes also launch autonomy.
# Preserve independent 8789 MCP state; 8797 initializes its own real session.
# 4. Separate compatibility listener 8796, new 8798 embeds local orchestration.
if(-not $Original[8796]){
 StartNode 8796 (Join-Path $Repo 'scripts\Run-Fun-Auto-Sidecar8796.mjs') '--serve' $Repo
}
$p=Await 8796 { (Json 'http://127.0.0.1:8796/api/ai/auto-local/status').sidecar -eq $true }
if($Owned[8796] -and $p -ne $Owned[8796]){Hold '8796_PROCESS_RACE'}
$local=Json 'http://127.0.0.1:8796/api/ai/auto-local/status'
if($local.reaExecutionGrants -ne 0 -or $local.busy -eq $true){Hold '8796_LOCAL_AUTHORITY_DRIFT'}
# 5. Independent REA MCP initialization, inventory only; NO tools/call.
if(-not $Original[8797]){
 StartNode 8797 (Join-Path $Repo 'scripts\Run-Fun-Rea229-Sidecar8797.mjs') '--standalone' $Primary
}
$p=Await 8797 { $s=Json 'http://127.0.0.1:8797/api/rea229/status';$s.liveMcpHealth -eq 'ready' -and $s.realReaToolCount -eq 229 } 180
if($Owned[8797] -and $p -ne $Owned[8797]){Hold '8797_PROCESS_RACE'}
$rea=Json 'http://127.0.0.1:8797/api/rea229/status'
if($rea.busy -eq $true -or $rea.realReaToolCount -ne 229){Hold 'REA_EXECUTION_IN_PROGRESS_OR_DRIFT'}
# 6. Start 8798 unified UI after dependencies, no real action or model prompt.
if(-not $Original[8798]){
 StartNode 8798 (Join-Path $Repo 'scripts\Run-Fun-Unified-Chat8798.mjs') '--serve' $Repo
}
$p=Await 8798 { $s=Json 'http://127.0.0.1:8798/api/unified/status';$s.state -eq 'ready' -and $s.localExecutionPath -eq 'embedded_in_8798' } 140
if($Owned[8798] -and $p -ne $Owned[8798]){Hold '8798_PROCESS_RACE'}
$final=Json 'http://127.0.0.1:8798/api/unified/status'
$overview=Json 'http://127.0.0.1:8798/api/unified/v4/status'
if($overview.state -ne 'ready' -or $final.ai.ready -ne $true -or
 $final.rea.count -ne 229 -or $final.local.count -ne 19 -or
 $final.embeddedLocalV42.reaExecutionGrants -ne 0){Hold 'FINAL_GATEWAY_VERIFICATION_FAILED'}
foreach($port in @(11434,8088,8789,8796,8797,8798)){
 if($Original[$port] -and (Socket $port) -ne $Original[$port]){Hold ('PREEXISTING_PROCESS_CHANGED_'+$port)}
}
[void](VerifyCompute)
Write-Host 'FUN_INDUSTRIAL_ONE_COMMAND=PASS'
Write-Host 'FUN_DASHBOARD=http://127.0.0.1:8798/'
Write-Host 'FUN_LOCAL_TOOLS=19 FUN_INDEPENDENT_REA_TOOLS=229'
Write-Host ('FUN_LEGACY_PARENT_REA_INITIALIZED='+[bool]($tools.rea_tool_count -eq 229))
Write-Host 'FUN_TOOL_EXECUTIONS_DURING_STARTUP=0 FUN_REA_OPERATOR_APPROVAL=REQUIRED'
Write-Host 'FUN_ELEKTRON_OLLAMA=UNTOUCHED'
