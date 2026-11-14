# FI_FUN_LOCAL_DEPENDENCY_RECOVERY_V3
# Reuse healthy Fun Industrial services; start only missing fixed 8796/8797.
# This file never reads, restores, starts, or modifies 8789 server.mjs.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
$Primary=Join-Path $HOME 'FunIndustrial-REA-MCP-Activation'
$LocalRunner=Join-Path $Root 'scripts\Run-Fun-Auto-Sidecar8796.mjs'
$ReaRunner=Join-Path $Root 'scripts\Run-Fun-Rea229-Sidecar8797.mjs'
$BaseUrl='http://127.0.0.1:'
function Hold([string]$why){throw ('FUN_DEPENDENCY_RECOVERY_HOLD='+$why)}
function Listeners([int]$p){
 return @(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$p){
 return (@(Listeners $p | ForEach-Object { "$($_.LocalAddress):$($_.OwningProcess)" } | Sort-Object)-join ';')
}
function OnlyLoopback([int]$p){
 $entries=@(Listeners $p)
 if($entries.Count -ne 1 -or $entries[0].LocalAddress -cne '127.0.0.1' -or [int]$entries[0].OwningProcess -le 0){
  Hold ('PORT_'+$p+'_NOT_EXACTLY_ONE_LOOPBACK_OWNER')
 }
 return [int]$entries[0].OwningProcess
}
function Probe([int]$p,[string]$endpoint){
 $listeners=@(Listeners $p)
 if(-not $listeners.Count){Write-Host ('FUN_DEPENDENCY_'+$p+'=MISSING');return $null}
 [void](OnlyLoopback $p)
 try{$value=Invoke-RestMethod ($BaseUrl+$p+$endpoint) -TimeoutSec 8 -ErrorAction Stop}
 catch{Hold ('PORT_'+$p+'_EXISTS_BUT_UNHEALTHY_NO_RESTART')}
 if($p -eq 8796){
  if($value.version -cne 'fi-auto-local-dashboard-v1' -or $value.sidecar -ne $true -or
     $value.reaExecutionGrants -ne 0 -or $value.busy -eq $true){Hold '8796_IDENTITY_OR_BUSY_MISMATCH'}
 }
 if($p -eq 8797){
  if($value.version -cne 'fi-rea-229-full-mcp-v1' -or $value.liveMcpHealth -cne 'ready' -or
     [int]$value.realReaToolCount -ne 229 -or $value.busy -eq $true){Hold '8797_IDENTITY_OR_MCP_MISMATCH'}
 }
 Write-Host ('FUN_DEPENDENCY_'+$p+'=READY')
 return $value
}
function RequireFile([string]$path){
 if(-not(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('SOURCE_MISSING='+$path)}
 if((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SOURCE_LINK_REFUSED='+$path)}
}
if((git.exe -C $Root branch --show-current) -cne 'feature/fun-ml-unified-dashboard-v3-20261113' -or $LASTEXITCODE -ne 0){Hold 'BRANCH_MISMATCH'}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -or $LASTEXITCODE -ne 0){Hold 'DIRTY_SOURCE_TREE'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
RequireFile $Node
foreach($file in @($LocalRunner,$ReaRunner,
 (Join-Path $Root 'src\experimental\auto-local-dashboard.mjs'),
 (Join-Path $Root 'src\experimental\auto-local-tools.mjs'),
 (Join-Path $Root 'src\experimental\rea-full-229.mjs'),
 (Join-Path $Root 'src\adapters\rea.mjs'),
 (Join-Path $Primary '.env'))){
 RequireFile $file
}
foreach($file in @($LocalRunner,$ReaRunner,
 (Join-Path $Root 'src\experimental\auto-local-dashboard.mjs'),
 (Join-Path $Root 'src\experimental\auto-local-tools.mjs'),
 (Join-Path $Root 'src\experimental\rea-full-229.mjs'))){
 & $Node --check $file
 if($LASTEXITCODE -ne 0){Hold ('JAVASCRIPT_SYNTAX_FAILED='+$file)}
}
# Never assume missing parent, compute, or llama.cpp can be recreated by this sidecar helper.
foreach($p in @(8789,8088,8791)){[void](OnlyLoopback $p)}
$tools=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/tools' -TimeoutSec 10 -ErrorAction Stop
if([int]$tools.local_tool_count -ne 19){Hold 'PARENT_LOCAL_19_MISMATCH'}
$llama=Invoke-RestMethod 'http://127.0.0.1:8088/health' -TimeoutSec 8 -ErrorAction Stop
if($llama.status -cne 'ok'){Hold 'QWEN_NOT_READY'}
$compute=Invoke-RestMethod 'http://127.0.0.1:8791/health' -TimeoutSec 8 -ErrorAction Stop
if($compute.state -cne 'running'){Hold 'COMPUTE_NOT_READY'}
$local=Probe 8796 '/api/ai/auto-local/status'
$rea=Probe 8797 '/api/rea229/status'
$protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8443)
$before=@{}
foreach($p in $protected){$before[$p]=Snapshot $p}
if($CheckOnly){
 Write-Host ('FUN_LOCAL_DEPENDENCIES_CHECK=PASS MISSING_8796='+[bool]($null -eq $local)+' MISSING_8797='+[bool]($null -eq $rea)+' NO_START=TRUE')
 return
}
function SpawnMissing([int]$port,[string]$script,[string]$mode,[string]$cwd){
 if((Listeners $port).Count){Hold ('PORT_'+$port+'_CLAIMED_BEFORE_START')}
 $logs=Join-Path $env:LOCALAPPDATA ('FunIndustrial\MLHubRecoveryV3\'+$port+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
 New-Item -ItemType Directory -Path $logs -Force | Out-Null
 $args='"'+$script+'" '+$mode
 $child=Start-Process -FilePath $Node -ArgumentList $args -WorkingDirectory $cwd -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $logs 'stdout.log') -RedirectStandardError (Join-Path $logs 'stderr.log')
 Write-Host ('FUN_DEPENDENCY_START_REQUEST_'+$port+'=PID_'+$child.Id)
 $tries=if($port -eq 8797){160}else{45}
 $endpoint=if($port -eq 8797){'/api/rea229/status'}else{'/api/ai/auto-local/status'}
 $ok=$false
 for($i=0;$i -lt $tries;$i++){
  Start-Sleep -Milliseconds 500
  if($child.HasExited){break}
  try{
   $entries=@(Listeners $port)
   if($entries.Count -ne 1 -or $entries[0].LocalAddress -cne '127.0.0.1' -or
      [int]$entries[0].OwningProcess -ne [int]$child.Id){continue}
   $state=Invoke-RestMethod ($BaseUrl+$port+$endpoint) -TimeoutSec 5 -ErrorAction Stop
   if($port -eq 8796 -and $state.version -ceq 'fi-auto-local-dashboard-v1' -and
       $state.sidecar -eq $true -and $state.reaExecutionGrants -eq 0 -and $state.busy -eq $false){$ok=$true;break}
   if($port -eq 8797 -and $state.version -ceq 'fi-rea-229-full-mcp-v1' -and
       $state.liveMcpHealth -ceq 'ready' -and [int]$state.realReaToolCount -eq 229 -and
       $state.busy -eq $false){$ok=$true;break}
  }catch{}
 }
 if(-not $ok){Hold ('PORT_'+$port+'_START_OR_HEALTH_FAILED_NO_RETRY_LOGS='+$logs)}
 Write-Host ('FUN_DEPENDENCY_'+$port+'=STARTED_VERIFIED_PID_'+$child.Id)
}
if($null -eq $local){SpawnMissing 8796 $LocalRunner '--serve' $Root}
if($null -eq $rea){SpawnMissing 8797 $ReaRunner '--standalone' $Primary}
[void](Probe 8796 '/api/ai/auto-local/status')
[void](Probe 8797 '/api/rea229/status')
foreach($p in $protected){
 if($before[$p] -and (Snapshot $p) -cne $before[$p]){Hold ('PREEXISTING_LISTENER_CHANGED_'+$p)}
}
Write-Host 'FUN_LOCAL_DEPENDENCY_RECOVERY=PASS PROTECTED_SERVICES_PRESERVED=TRUE'
Write-Host 'REA_TOOL_EXECUTIONS=0 REA_OPERATOR_AUTHORITY_UNCHANGED=TRUE'
