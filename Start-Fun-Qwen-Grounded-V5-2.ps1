# Guarded FIAL 5.2 grounded Qwen answer sidecar. Does not touch protected processes.
[CmdletBinding()]param([switch]$VerifyLive)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fial5-2-qwen-grounded-replies-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Runner=Join-Path $Root 'scripts\Run-Fun-QwenGrounded8806.mjs'
$Url='http://127.0.0.1:8806'
function Hold([string]$why){throw ('FIAL52_ACTIVATION_HOLD='+$why)}
function Listeners([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$port){
 return (@(Listeners $port|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
if((git.exe -C $Root remote get-url origin) -cne $Origin -or
 (git.exe -C $Root branch --show-current) -cne $Branch -or $LASTEXITCODE -ne 0){
 Hold 'SOURCE_REPOSITORY_IDENTITY_CHANGED'
}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -gt 0 -or
 $LASTEXITCODE -ne 0){Hold 'SOURCE_WORKTREE_DIRTY'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$files=@('src\fial\grounded-chat-v5-2.mjs',
 'scripts\Run-Fun-QwenGrounded8806.mjs',
 'intelligence-checks\fial-grounded-qwen-v5-2-case.mjs')
foreach($relative in $files){
 $file=Join-Path $Root $relative
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('SOURCE_MISSING='+$relative)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SOURCE_SYMLINK_REFUSED='+$relative)
 }
 & $Node --check $file
 if($LASTEXITCODE -ne 0){Hold ('SOURCE_SYNTAX_FAILED='+$relative)}
}
& $Node --test (Join-Path $Root 'intelligence-checks\fial-grounded-qwen-v5-2-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'QWEN_GROUNDED_TESTS_FAILED'}
Write-Host 'FIAL52_INDEPENDENT_TESTS=PASS'
$health=Invoke-RestMethod 'http://127.0.0.1:8088/health' -TimeoutSec 10 -ErrorAction Stop
if($health.status -cne 'ok'){Hold 'EXISTING_QWEN_NOT_READY'}
$memory=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/automatic-memory/status' -TimeoutSec 12 -ErrorAction Stop
if($memory.memoryAvailable -ne $true -or
 $memory.mode -cne 'automatic_contextual_read_only' -or
 $memory.memoryWrites -ne $false){Hold 'EXISTING_READ_ONLY_MEMORY_NOT_READY'}
$integration=Invoke-RestMethod 'http://127.0.0.1:8805/api/fial/modules/health' -TimeoutSec 10 -ErrorAction Stop
if($integration.version -cne 'fial5.1-integrated-hub-v1' -or
 $integration.rea_authority_added -ne $false){Hold 'FIAL51_INTEGRATION_NOT_READY'}
$protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8802,8803,8804,8805,8443)
$before=@{}
foreach($p in $protected){$before[$p]=Snapshot $p}
$current=@(Listeners 8806)
if($current.Count){
 if($current.Count -ne 1 -or $current[0].LocalAddress -cne '127.0.0.1'){
  Hold '8806_MULTIPLE_OR_NON_LOOPBACK_OWNERS'
 }
 $ownerPid=[int]$current[0].OwningProcess
 $owner=Get-CimInstance Win32_Process -Filter ('ProcessId='+$ownerPid) -ErrorAction Stop
 if(!$owner -or $owner.Name -cne 'node.exe' -or
  [string]$owner.CommandLine -notmatch [regex]::Escape($Runner)){
  Hold '8806_UNKNOWN_OWNER_NO_RESTART'
 }
 Write-Host ('FIAL52_EXISTING_SIDECAR_ADOPTED_PID='+$ownerPid)
}else{
 $log=Join-Path $env:LOCALAPPDATA ('FunIndustrial\FIAL52GroundedChat\logs\'+
  (Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,7))
 New-Item -ItemType Directory -Path $log -Force|Out-Null
 $child=Start-Process -FilePath $Node -ArgumentList ('"'+$Runner+'" --serve') -WorkingDirectory $Root -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $log 'stdout.log') -RedirectStandardError (Join-Path $log 'stderr.log')
 $ready=$false
 for($i=0;$i -lt 80;$i++){
  Start-Sleep -Milliseconds 250
  try{
   $listeners=@(Listeners 8806)
   if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -cne '127.0.0.1' -or
    [int]$listeners[0].OwningProcess -ne [int]$child.Id){continue}
   $state=Invoke-RestMethod ($Url+'/api/fial/grounded/health') -TimeoutSec 5
   if($state.version -ceq 'fial5.2-grounded-qwen-sidecar-v1' -and
    $state.tool_executions -eq 0 -and
    $state.rea_permissions_added -eq $false){$ready=$true;break}
  }catch{}
 }
 if(!$ready){Hold ('8806_NEW_SIDECAR_START_FAILED_LOG='+$log)}
 Write-Host ('FIAL52_NEW_SIDECAR_PID='+$child.Id+' LOGS='+$log)
}
foreach($p in $protected){
 if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_SERVICE_CHANGED_PORT_'+$p)}
}
Write-Host 'FIAL52_QWEN_GROUNDED_CHAT=ACTIVE'
Write-Host ('FIAL52_URL='+$Url+'/')
Write-Host 'FIAL52_PROTECTED_SERVICES=UNCHANGED'
Write-Host 'FIAL52_MEMORY_WRITES=0 REA_EXECUTIONS=0 MODEL_STARTS=0'
if($VerifyLive){
 # One operator-authorized inference request, no automatic retries or tool definitions.
 $body=@{question='What approval is required before external tool execution at Fun Industrial?'}|ConvertTo-Json -Compress
 $result=Invoke-RestMethod -Uri ($Url+'/api/fial/grounded/chat') -Method POST -ContentType 'application/json' -Headers @{Origin=$Url;'x-fi-chat-click'='one-local-model-response'} -Body $body -TimeoutSec 310 -ErrorAction Stop
 Write-Host ('FIAL52_LIVE_STATE='+$result.state)
 Write-Host ('FIAL52_MEMORY_STATE='+$result.memory_state+' EXCERPTS='+$result.memory_excerpts_included)
 Write-Host ('FIAL52_SOURCE='+$result.source)
 Write-Host ('FIAL52_ANSWER='+$result.answer)
 if($result.state -ne 'ANSWERED_BY_QWEN' -or
  $result.tool_executions -ne 0 -or $result.rea_executions -ne 0 -or
  $result.memory_excerpts_included -lt 1){
  Hold 'LIVE_GROUNDED_QWEN_ANSWER_NOT_VERIFIED_REVIEW_STATUS_NO_RETRY'
 }
 if($result.answer -notmatch 'operator approval'){
  Hold 'LIVE_QWEN_ANSWER_CONTENT_NOT_QUALIFIED'
 }
 Write-Host 'FIAL52_LIVE_MEMORY_GROUNDED_ANSWER=PASS'
}else{
 Write-Host 'FIAL52_LIVE_MODEL_INFERENCE=NOT_RUN'
}
Write-Host 'FIAL52_ACTIVATION=PASS'
