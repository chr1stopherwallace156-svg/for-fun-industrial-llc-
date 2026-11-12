# FUN_INDUSTRIAL_ONE_COMMAND_START_V43 — explicit ONE -Start consent
# Start/adopt only named local services; never stop/restart any occupied port.
# No platform /api/start, /api/activate, /api/stop, tool calls, NetBird or Ollama actions.
[CmdletBinding()]param([switch]$Start)
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
$Primary=Join-Path $HOME 'FunIndustrial-REA-MCP-Activation'
$ExpectedBranch='feature/fun-one-command-startup-v43-20261112'
$Model=Join-Path $HOME 'FunIndustrial\.runtime\models\Qwen3-4B-Q4_K_M.gguf'
$Llama=Join-Path $HOME 'FunIndustrial\.runtime\llama.cpp\llama-server.exe'
$Policy=Join-Path $env:LOCALAPPDATA 'FunIndustrial\DashboardAutostart\retired-watchdog-20261110-231030-a18f213e\policy.retired.json'
$Server=Join-Path $Primary 'src\server.mjs'
$Scripts=@{
  8796='scripts\Run-Fun-Auto-Sidecar8796.mjs'
  8797='scripts\Run-Fun-Rea229-Sidecar8797.mjs'
  8798='scripts\Run-Fun-Unified-Chat8798.mjs'
}
$LogRoot=Join-Path $env:LOCALAPPDATA ('FunIndustrial\OneCommandStartup\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
$Started=[System.Collections.Generic.List[int]]::new()
function Hold([string]$Reason){throw ('FUN_ONE_COMMAND_HOLD='+$Reason)}
function Listener([int]$Port){
 $r=@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
 if($r.Count -gt 1){Hold ('MULTIPLE_LISTENERS_'+$Port)}
 if($r.Count -eq 1 -and $r[0].LocalAddress -cne '127.0.0.1'){Hold ('NONLOOPBACK_LISTENER_'+$Port)}
 return $r
}
function SafeFile([string]$File){
 if(-not (Test-Path -LiteralPath $File -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING_'+$File)}
 if((Get-Item -LiteralPath $File).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('UNEXPECTED_FILE_LINK_'+$File)}
}
function GetJson([int]$Port,[string]$Path,[int]$Timeout=8){
 return Invoke-RestMethod -Uri ("http://127.0.0.1:"+$Port+$Path) -TimeoutSec $Timeout -ErrorAction Stop
}
function Own([int]$Port,[string]$Process,[string]$Script=''){
 $l=@(Listener $Port)
 if($l.Count -eq 0){return 0}
 $id=[int]$l[0].OwningProcess
 $p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$id) -ErrorAction Stop
 if(-not $p -or $p.Name -cne $Process){Hold ('UNRECOGNIZED_PORT_OWNER_'+$Port)}
 if($Script -and [string]$p.CommandLine -notmatch [regex]::Escape($Script)){Hold ('OWNER_COMMAND_LINE_CHANGED_'+$Port)}
 return $id
}
function WaitHealth([int]$Port,[string]$Path,[int]$Pid,[scriptblock]$Check,[int]$Attempts=100){
 for($i=0;$i -lt $Attempts;$i++){
  Start-Sleep -Milliseconds 500
  $l=@(Listener $Port)
  if($l.Count -eq 1 -and [int]$l[0].OwningProcess -ne $Pid){Hold ('UNEXPECTED_NEW_PORT_OWNER_'+$Port)}
  if($l.Count -ne 1){continue}
  try{
   $status=GetJson $Port $Path 4
   if(& $Check $status){return}
  }catch{}
 }
 Hold ('STARTED_PROCESS_NOT_HEALTHY_'+$Port+'_NO_AUTOMATIC_RETRY')
}
function ExistingHealthy([int]$Port,[string]$Path,[scriptblock]$Check){
 $l=@(Listener $Port)
 if($l.Count -eq 0){return $false}
 try{$s=GetJson $Port $Path 8;return [bool](& $Check $s)}
 catch{return $false}
}
function Record([int]$Port,[string]$State){
 $pidNow=@(Listener $Port)
 Write-Host ("FUN_PORT_"+$Port+"="+$State+" PID="+$(if($pidNow.Count){$pidNow[0].OwningProcess}else{0}))
}
function Launch([int]$Port,[string]$Source,[string]$Cwd){
 $Node=(Get-Command node.exe -ErrorAction Stop).Source
 SafeFile $Source
 & $Node --check $Source
 if($LASTEXITCODE -ne 0){Hold ('STARTER_SYNTAX_INVALID_'+$Port)}
 if(@(Listener $Port).Count){Hold ('PORT_CLAIMED_PRESTART_'+$Port)}
 New-Item -ItemType Directory -Path $LogRoot -Force|Out-Null
 $p=Start-Process -FilePath $Node -ArgumentList @(('"'+$Source+'"'),'--serve') -WorkingDirectory $Cwd -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $LogRoot ($Port+'.out.log')) -RedirectStandardError (Join-Path $LogRoot ($Port+'.err.log'))
 $Started.Add($Port)
 return [int]$p.Id
}
if((git.exe -C $Root branch --show-current) -cne $ExpectedBranch){Hold 'BRANCH_NOT_VERIFIED'}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count){Hold 'SOURCE_WORKTREE_NOT_CLEAN'}
if(-not $Start){
 foreach($n in @(8088,8791,8789,8796,8797,8798,11434)){Record $n 'CHECK_ONLY'}
 Write-Host 'FUN_ONE_COMMAND=CHECK_ONLY NO_START_OR_EXECUTION=TRUE'
 exit 0
}
# -Start is a single deliberate operator authorization for process startup ONLY.
# Read or verify required known paths without modifying source, .env or policy.
foreach($f in @($Server,$Policy,(Join-Path $Primary '.env'),(Join-Path $Root 'Recover-Fun-Compute.ps1'))){SafeFile $f}
foreach($v in $Scripts.Values){SafeFile (Join-Path $Root $v)}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$P=Get-Content -LiteralPath $Policy -Raw -ErrorAction Stop|ConvertFrom-Json
$UserSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if($P.schema -cne 'fun.dashboard.autostart.v1' -or $P.sid -cne $UserSid -or
   $P.deployedRoot -cne $Primary -or $P.host -cne '127.0.0.1' -or
   [int]$P.port -ne 8789 -or [int]$P.computePort -ne 8791 -or
   [int]$P.memoryBudgetMs -lt 12000 -or [int]$P.memoryBudgetMs -gt 180000 -or
   @($P.catalogueNames).Count -ne 229){Hold 'SAVED_DASHBOARD_POLICY_INVALID'}
if(@($P.allowedTools).Count -gt 229 -or
   @($P.allowedTools|Where-Object {$_ -cnotin $P.catalogueNames}).Count){Hold 'REA_EXECUTION_PERMISSION_DRIFT'}
SafeFile ([string]$P.nodePath)
$SourceText=[IO.File]::ReadAllText($Server)
foreach($mark in @('FI_AUTO_COGNEE_CHAT_V1','FI_VOICE_MOBILE_DASHBOARD_V1','FI_SOURCING_RETIRED_V1','FI_CAPABILITY_INDEX_LIVE_V1')){
 if(-not $SourceText.Contains($mark)){Hold ('DASHBOARD_CAPABILITY_MARKER_MISSING_'+$mark)}
}
& $P.nodePath --check $Server;if($LASTEXITCODE -ne 0){Hold 'DASHBOARD_SERVER_SYNTAX_INVALID'}
$Ollama=@(Listener 11434)
$OllamaPid=if($Ollama.Count){[int]$Ollama[0].OwningProcess}else{0}
if($OllamaPid){[void](Own 11434 'ollama.exe')}
try{
 # Workloads are adopted, not duplicated. Never restart an occupied port.
 $lm=Own 8088 'llama-server.exe'
 if($lm){
  if(-not(ExistingHealthy 8088 '/health' {param($s)$s.status -eq 'ok'})){Hold 'EXISTING_QWEN_NOT_HEALTHY_NO_RESTART'}
  Record 8088 'PRESERVED'
 }else{
  SafeFile $Llama;SafeFile $Model
  New-Item -ItemType Directory -Path $LogRoot -Force|Out-Null
  $args=@('--model',('"'+$Model+'"'),'--host','127.0.0.1','--port','8088','--threads','4','--ctx-size','4096','--n-gpu-layers','0','--jinja')
  $child=Start-Process -FilePath $Llama -ArgumentList $args -WorkingDirectory (Split-Path $Llama) -PassThru -RedirectStandardOutput (Join-Path $LogRoot '8088.out.log') -RedirectStandardError (Join-Path $LogRoot '8088.err.log')
  $Started.Add(8088)
  WaitHealth 8088 '/health' $child.Id {param($s)$s.status -eq 'ok'} 180
  Record 8088 'STARTED'
 }
 $compute=Own 8791 'python.exe'
 if($compute){
  if(-not(ExistingHealthy 8791 '/health' {param($s)$s.state -eq 'running'})){Hold 'EXISTING_COMPUTE_NOT_HEALTHY_NO_RESTART'}
  Record 8791 'PRESERVED'
 }else{
  $recover=Join-Path $Root 'Recover-Fun-Compute.ps1'
  & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $recover
  if($LASTEXITCODE -ne 0){Hold 'COMPUTE_RECOVERY_FAILED_NO_RETRY'}
  $Started.Add(8791)
  if(-not(ExistingHealthy 8791 '/health' {param($s)$s.state -eq 'running'})){Hold 'COMPUTE_HEALTH_AFTER_RECOVERY_HOLD'}
  [void](Own 8791 'python.exe')
  Record 8791 'STARTED'
 }
 $parent=Own 8789 'node.exe' 'src/server.mjs'
 if(-not $parent){
  if(@(Listener 8789).Count){Hold 'DASHBOARD_PORT_CONFLICT'}
  $env:HOST='127.0.0.1';$env:PORT='8789';$env:COMPUTE_PORT='8791'
  $env:LOCAL_FIRST_MODE='true';$env:FUN_VOICE_HOME=[string]$P.voiceHome
  $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$P.memoryBudgetMs
  $env:REA_ALLOWED_TOOLS=(@($P.allowedTools)-join ',')
  New-Item -ItemType Directory -Path $LogRoot -Force|Out-Null
  $child=Start-Process -FilePath ([string]$P.nodePath) -ArgumentList 'src/server.mjs' -WorkingDirectory $Primary -PassThru -RedirectStandardOutput (Join-Path $LogRoot '8789.out.log') -RedirectStandardError (Join-Path $LogRoot '8789.err.log')
  $Started.Add(8789)
  WaitHealth 8789 '/api/status' $child.Id {param($s)$s.application -eq 'Fun Industrial Platform'}
 }
 $tools=GetJson 8789 '/api/ai/tools' 20
 $index=GetJson 8789 '/api/cognition/catalogue/status' 20
 $cog=GetJson 8789 '/api/cognition/health' 20
 if($tools.local_tool_count -ne 19 -or $tools.rea_tool_count -notin @(0,229) -or
    $index.version -ne 'fi-capability-index-v1' -or $index.localCount -ne 19 -or
    $index.executionGrants -ne 0 -or $cog.version -ne 'fi-cognitive-live-bridge-v1' -or
    $cog.reaExecutionGrants -ne 0){Hold 'DASHBOARD_LOCAL_19_OR_COGNITION_HOLD'}
 Record 8789 'READY_19_LOCAL'
 $local=Own 8796 'node.exe' 'Run-Fun-Auto-Sidecar8796.mjs'
 if(-not $local){
  $local=Launch 8796 (Join-Path $Root $Scripts[8796]) $Root
  WaitHealth 8796 '/api/ai/auto-local/status' $local {param($s)$s.sidecar -eq $true -and $s.busy -eq $false -and $s.reaExecutionGrants -eq 0}
 }
 if(-not(ExistingHealthy 8796 '/api/ai/auto-local/status' {param($s)$s.sidecar -eq $true -and $s.busy -eq $false -and $s.reaExecutionGrants -eq 0})){Hold '8796_NOT_IDLE_OR_STATUS_DRIFT'}
 Record 8796 'READY'
 $rea=Own 8797 'node.exe' 'Run-Fun-Rea229-Sidecar8797.mjs'
 if(-not $rea){
  $rea=Launch 8797 (Join-Path $Root $Scripts[8797]) $Primary
  WaitHealth 8797 '/api/rea229/status' $rea {param($s)$s.liveMcpHealth -eq 'ready' -and $s.realReaToolCount -eq 229 -and $s.busy -eq $false} 240
 }
 if(-not(ExistingHealthy 8797 '/api/rea229/status' {param($s)$s.liveMcpHealth -eq 'ready' -and $s.realReaToolCount -eq 229 -and $s.busy -eq $false})){Hold '8797_NOT_READY_OR_BUSY'}
 $catalog=GetJson 8797 '/api/rea229/tools?limit=229' 15
 if(@($catalog.tools).Count -ne 229 -or @($catalog.tools.name|Sort-Object -Unique).Count -ne 229){Hold '8797_CATALOGUE_DRIFT'}
 Record 8797 'READY_229_REA_NO_TOOL_CALLS'
 $gateway=Own 8798 'node.exe' 'Run-Fun-Unified-Chat8798.mjs'
 if(-not $gateway){
  $gateway=Launch 8798 (Join-Path $Root $Scripts[8798]) $Root
  WaitHealth 8798 '/api/unified/status' $gateway {param($s)$s.version -eq 'fi-unified-task-chat-8798-v1' -and $s.localExecutionPath -eq 'embedded_in_8798'}
 }
 $live=GetJson 8798 '/api/unified/status' 15
 $v4=GetJson 8798 '/api/unified/v4/status' 15
 if($live.state -ne 'ready' -or $live.localExecutionPath -ne 'embedded_in_8798' -or
   $live.embeddedLocalV42.enabled -ne $true -or $live.embeddedLocalV42.reaExecutionGrants -ne 0 -or
   $v4.state -ne 'ready' -or $v4.registered.verifiedCounts -ne $true){Hold '8798_UNIFIED_V43_HEALTH_HOLD'}
 Record 8798 'READY_V43_EMBEDDED'
 $o2=@(Listener 11434)
 if($OllamaPid -and ($o2.Count -ne 1 -or $o2[0].OwningProcess -ne $OllamaPid)){Hold 'ELEKTRON_OLLAMA_OWNER_CHANGED'}
 Write-Host 'FUN_ONE_COMMAND=PASS'
 Write-Host 'FUN_ENTRYPOINT=http://127.0.0.1:8798/'
 Write-Host 'FUN_STARTUP_TOOL_CALLS=0 REA_APPROVALS_GRANTED=0'
 Write-Host 'FUN_PARENT_REA_REGISTRATION='+$tools.rea_tool_count+' INDEPENDENT_REA=229'
 Write-Host 'FUN_ELEKTRON_11434=PRESERVED'
 Write-Host ('FUN_STARTED_PORTS='+($Started -join ','))
}catch{
 Write-Host ('FUN_ONE_COMMAND=HOLD MESSAGE='+[string]$_.Exception.Message)
 Write-Host ('FUN_STARTUP_LOGS='+$LogRoot)
 Write-Host 'NO_AUTOMATIC_RESTART_OR_TERMINATION=TRUE'
 throw
}
