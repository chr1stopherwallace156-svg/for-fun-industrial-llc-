# FI_UNIFIED_RUNTIME_V4_STAGE1 — single command, explicit start-only recovery.
# Default is READ-ONLY. -StartMissing needs a separate exact operator phrase.
# Never terminates processes or starts/restarts Qwen/Ollama, compute, 8789,
# Electron, NetBird, Elektron, or any pre-existing sidecar.
[CmdletBinding()]param([switch]$StartMissing,[string]$ApprovalPhrase='')
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Expected='feature/fun-unified-runtime-v4-stage1-20261112'
function Hold([string]$Reason){throw ('V4_SINGLE_LAUNCH_HOLD='+$Reason)}
function Port([int]$Number){return @(Get-NetTCPConnection -LocalPort $Number -State Listen -ErrorAction SilentlyContinue)}
function GetStatus([int]$Number,[string]$Path){
 try{return Invoke-RestMethod "http://127.0.0.1:$Number$Path" -TimeoutSec 10}
 catch{Hold ('HEALTH_NOT_READY_'+$Number)}
}
if((git.exe -C $Repo branch --show-current) -ne $Expected){Hold 'SOURCE_BRANCH_NOT_REVIEWED'}
if($LASTEXITCODE -ne 0){Hold 'SOURCE_REVIEW_GIT_FAILURE'}
$Dirty=@(git.exe -C $Repo status --porcelain=v1 --untracked-files=all)
if($LASTEXITCODE -ne 0 -or $Dirty.Count){Hold 'DIRTY_SOURCE_TREE'}
$protected=@(8789,8088,8791)
$baseline=@{}
foreach($p in $protected){
 $owners=@(Port $p)
 if($owners.Count -ne 1){Hold ('PROTECTED_PORT_NOT_EXACTLY_ONE_'+$p)}
 $baseline[$p]="$($owners[0].LocalAddress):$($owners[0].OwningProcess)"
}
$T=GetStatus 8789 '/api/ai/tools'
$AI=GetStatus 8789 '/api/ai/status'
if($T.rea_tool_count -ne 229 -or $T.local_tool_count -ne 19 -or $AI.state -ne 'ready'){
 Hold 'PARENT_229_19_AI_NOT_READY'
}
$existing=@{}
foreach($p in @(8796,8797,8798)){
 $owners=@(Port $p)
 if($owners.Count -gt 1){Hold ('UNEXPECTED_MULTI_LISTENER_'+$p)}
 if($owners.Count -eq 1 -and $owners[0].LocalAddress -ne '127.0.0.1'){
  Hold ('NON_LOOPBACK_SERVICE_'+$p)
 }
 $existing[$p]=$owners.Count -eq 1
}
if(-not $StartMissing){
 foreach($p in @(8796,8797,8798)){
  Write-Host ('V4_SERVICE_PORT_'+$p+'=' + $(if($existing[$p]){'LISTENING'}else{'MISSING'}))
 }
 if($existing[8798]){
  try{
   $S=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/v4/status' -TimeoutSec 8
   Write-Host ('V4_GATEWAY_STATE='+$S.state+' V4_VERSION='+$S.version)
  }catch{Write-Host 'V4_GATEWAY_STATE=NOT_AVAILABLE_NEEDS_SEPARATE_GUARDED_DEPLOYMENT'}
 }
 Write-Host 'V4_CHECK_ONLY=PASS PROCESSES_STARTED=0 PROCESSES_STOPPED=0 MCP_CALLS=0'
 exit 0
}
if($ApprovalPhrase -cne 'AUTHORIZE V4 START MISSING SIDECARS'){Hold 'EXPLICIT_APPROVAL_MISSING'}
$sequence=@(
 @{p=8796;script='Start-Fun-Auto-Sidecar8796.ps1';endpoint='/api/ai/auto-local/status'},
 @{p=8797;script='Start-Fun-Rea229-Sidecar8797.ps1';endpoint='/api/rea229/status'},
 @{p=8798;script='Start-Fun-Unified-Chat8798.ps1';endpoint='/api/unified/v4/status'}
)
foreach($entry in $sequence){
 $p=$entry.p
 if(-not $existing[$p]){
  # Run the repo's existing exact start-only and guarded source scripts.
  $script=Join-Path $Repo $entry.script
  if(-not (Test-Path -LiteralPath $script -PathType Leaf)){Hold ('STARTER_MISSING_'+$p)}
  if((Get-Item -LiteralPath $script).Attributes -band [IO.FileAttributes]::ReparsePoint){
   Hold ('STARTER_SYMLINK_REFUSED_'+$p)
  }
  Write-Host ('V4_START_MISSING='+$p)
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script
  if($LASTEXITCODE -ne 0){Hold ('START_FAILURE_NO_AUTOMATIC_RETRY_'+$p)}
 }else{Write-Host ('V4_EXISTING_LISTENER_PRESERVED='+$p)}
 $state=GetStatus $p $entry.endpoint
 if($p -eq 8796 -and $state.sidecar -ne $true){Hold '8796_NOT_VERIFIED'}
 if($p -eq 8797 -and ($state.liveMcpHealth -ne 'ready' -or $state.realReaToolCount -ne 229)){
  Hold '8797_NOT_VERIFIED'
 }
 if($p -eq 8798 -and ($state.version -ne 'fi-unified-runtime-v4-stage1' -or $state.state -ne 'ready')){
  Hold '8798_V4_NOT_READY'
 }
 foreach($protectedPort in $protected){
  $now=@(Port $protectedPort)
  if($now.Count -ne 1 -or "$($now[0].LocalAddress):$($now[0].OwningProcess)" -cne $baseline[$protectedPort]){
   Hold ('PROTECTED_SERVICE_CHANGED_'+$protectedPort)
  }
 }
 Write-Host ('V4_VERIFIED_PORT='+$p)
}
Write-Host 'V4_SINGLE_LAUNCH=PASS USER_ENTRYPOINT=http://127.0.0.1:8798/'
Write-Host 'V4_EXISTING_PORTS_RETIRED=0 QWEN_COMPUTE_ORIGINAL_PRESERVED=TRUE'
Write-Host 'NO_MCP_EXECUTION=TRUE NO_SERVICE_TERMINATION=TRUE'
