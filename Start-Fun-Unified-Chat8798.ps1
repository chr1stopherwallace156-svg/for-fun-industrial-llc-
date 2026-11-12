# FI_UNIFIED_CHAT_8798_START_V1 — new process only, no protected service restart.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Url='http://127.0.0.1:8798'
$Runner=Join-Path $Repo 'scripts\Run-Fun-Unified-Chat8798.mjs'
$Client=Join-Path $Repo 'src\experimental\unified-task-client.js'
$Modules=@($Runner,$Client,(Join-Path $Repo 'src\experimental\unified-task-chat.mjs'),(Join-Path $Repo 'src\experimental\unified-public-web.mjs'),(Join-Path $Repo 'intelligence-checks\unified-task-chat-case.mjs'),(Join-Path $Repo 'src\experimental\adaptive-capability-v2.mjs'),(Join-Path $Repo 'scripts\Diagnose-Fun-Adaptive-V2.mjs'),(Join-Path $Repo 'intelligence-checks\adaptive-capability-v2-case.mjs'),(Join-Path $Repo 'src\experimental\verified-rea-v3.mjs'),(Join-Path $Repo 'intelligence-checks\verified-rea-v3-case.mjs'),(Join-Path $Repo 'src\experimental\verified-file-v3-1.mjs'),(Join-Path $Repo 'scripts\Diagnose-Fun-Verified-File-V31.mjs'),(Join-Path $Repo 'intelligence-checks\verified-file-v3-1-case.mjs' 'intelligence-checks\verified-binary-layout-v3-2-case.mjs'),(Join-Path $Repo 'src\experimental\verified-binary-layout-v3-2.mjs'),(Join-Path $Repo 'scripts\Diagnose-Fun-Verified-Binary-V32.mjs'),(Join-Path $Repo 'intelligence-checks\verified-binary-layout-v3-2-case.mjs'))
$Protected=@(8789,8796,8797,8088,8791)
$Child=$null
function Hold([string]$Code){throw ('FUN_UNIFIED_CHAT_HOLD='+$Code)}
function Listener([int]$P){
 return (@(Get-NetTCPConnection -State Listen -LocalPort $P -ErrorAction SilentlyContinue|
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
if(Listener 8798){Hold 'PORT_8798_ALREADY_OWNED_NO_RESTART'}
foreach($F in $Modules){
 if(-not (Test-Path -LiteralPath $F -PathType Leaf)){Hold ('SOURCE_MISSING_'+$F)}
 if((Get-Item -LiteralPath $F).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_SOURCE_REFUSED_'+$F)}
}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($F in $Modules){& $Node --check $F;if($LASTEXITCODE -ne 0){Hold ('NODE_SYNTAX_'+$F)}}
Push-Location $Repo
try{
 & $Node --test 'intelligence-checks\unified-task-chat-case.mjs' 'intelligence-checks\adaptive-capability-v2-case.mjs' 'intelligence-checks\verified-rea-v3-case.mjs' 'intelligence-checks\verified-file-v3-1-case.mjs'
 if($LASTEXITCODE -ne 0){Hold 'OFFLINE_UNIFIED_TEST_HOLD'}
}finally{Pop-Location}
$Before=@{};foreach($P in $Protected){$Before[$P]=Listener $P;if(-not $Before[$P]){Hold ('REQUIRED_SERVICE_LISTENER_MISSING_'+$P)}}
$R=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/status' -TimeoutSec 15
$L=Invoke-RestMethod 'http://127.0.0.1:8796/api/ai/auto-local/status' -TimeoutSec 15
$T=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/tools' -TimeoutSec 15
$AI=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/status' -TimeoutSec 15
if($R.liveMcpHealth -ne 'ready' -or [int]$R.realReaToolCount -ne 229){Hold 'REA229_NOT_READY'}
if($L.sidecar -ne $true -or [int]$T.local_tool_count -ne 19){Hold 'LOCAL19_NOT_READY'}
if($AI.state -ne 'ready'){Hold 'QWEN_LOCAL_MODEL_NOT_READY'}
$LogDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\UnifiedChat8798\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $LogDir -Force|Out-Null
try{
 $Child=Start-Process -FilePath $Node -ArgumentList @(('"'+$Runner+'"'),'--serve') -WorkingDirectory $Repo -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $LogDir 'unified.stdout.log') -RedirectStandardError (Join-Path $LogDir 'unified.stderr.log')
 $Ready=$false
 for($i=0;$i -lt 60;$i++){
  Start-Sleep -Milliseconds 400
  try{
   $Listening=@(Get-NetTCPConnection -State Listen -LocalPort 8798 -ErrorAction SilentlyContinue)
   if($Listening.Count -ne 1 -or $Listening[0].LocalAddress -ne '127.0.0.1' -or $Listening[0].OwningProcess -ne $Child.Id){continue}
   $S=Invoke-RestMethod ($Url+'/api/unified/status') -TimeoutSec 5
   $Page=Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 5
   $JS=Invoke-WebRequest ($Url+'/api/unified/client.js') -UseBasicParsing -TimeoutSec 5
   if($S.version -eq 'fi-unified-task-chat-8798-v1' -and $S.rea.ready -eq $true -and $S.local.ready -eq $true -and
      [int]$S.rea.count -eq 229 -and [int]$S.local.count -eq 19 -and $S.ai.ready -eq $true -and
      $Page.Content -match 'id="task"' -and $Page.Content -match 'id="local-consent"' -and
      $JS.Content -match 'FI_UNIFIED_TASK_CHAT_CLIENT_V1' -and $Page.Content -match 'id="v3-confirm"' -and $S.verifiedReaV3.readOnlyPilot -eq $true -and $S.verifiedFileV31.enabled -eq $true -and $Page.Content -match 'id="v31-prepare"' -and $S.verifiedLayoutV32.enabled -eq $true -and $Page.Content -match 'id="v32-prepare"'){$Ready=$true;break}
  }catch{}
 }
 if(-not $Ready){Hold 'UNIFIED_HTTP_OR_PARENT_NOT_READY'}
 foreach($P in $Protected){if((Listener $P) -cne $Before[$P]){Hold ('PROTECTED_LISTENER_CHANGED_'+$P)}}
 $R2=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/status' -TimeoutSec 15
 $L2=Invoke-RestMethod 'http://127.0.0.1:8796/api/ai/auto-local/status' -TimeoutSec 15
 $T2=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/tools' -TimeoutSec 15
 $AI2=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/status' -TimeoutSec 15
 if($R2.liveMcpHealth -ne 'ready' -or [int]$R2.realReaToolCount -ne 229 -or
    $L2.sidecar -ne $true -or [int]$T2.local_tool_count -ne 19 -or $AI2.state -ne 'ready'){Hold 'ORIGINAL_SERVICES_CHANGED'}
 Write-Host ('FUN_UNIFIED_CHAT=PASS URL='+$Url+' PID='+$Child.Id)
 Write-Host 'QWEN_LLAMA_8088=PRESERVED REA_8797_229=PRESERVED LOCAL_8796_19=PRESERVED ORIGINAL_8789=PRESERVED COMPUTE_8791=PRESERVED'
 Write-Host 'UNIFIED_CHAT_MODE=READ_ONLY_AUTO ADAPTIVE_V2=LIVE_CATALOGUE_PLANNING_ONLY V3=EXACT_REA_SINGLE_USE_APPROVAL V31=STAGED_FILE_EXACT_INSPECTION V32=GENERAL_BINARY_LAYOUT_EXACT_INSPECTION LOCAL_EXECUTION=EXPLICIT_CLICK NO_BACKGROUND=TRUE'
 Write-Host ('FUN_UNIFIED_CHAT_LOGS='+$LogDir)
}catch{
 if($Child){
  try{
   $Child.Refresh()
   if(-not $Child.HasExited){
    $Owned=@(Get-NetTCPConnection -State Listen -LocalPort 8798 -ErrorAction SilentlyContinue|Where-Object {$_.OwningProcess -eq $Child.Id})
    if($Owned.Count -eq 1){& taskkill.exe /PID $Child.Id /T /F | Out-Null}
    else{Write-Warning 'UNIFIED_8798_OWNER_UNVERIFIED_NO_TERMINATION'}
   }
  }catch{Write-Warning 'UNIFIED_8798_CLEANUP_REVIEW_REQUIRED'}
 }
 throw
}
