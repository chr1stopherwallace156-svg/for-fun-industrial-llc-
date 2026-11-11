# FI_REA229_SEPARATE_MCP_START_V1
# Spawn ONLY a new Node 8797 and independent MCP child. Existing 8789/8796/8088/8791 preserved.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Primary=Join-Path $HOME 'FunIndustrial-REA-MCP-Activation'
$Source=Join-Path $Repo 'scripts\Run-Fun-Rea229-Sidecar8797.mjs'
$Url='http://127.0.0.1:8797'
$Parent='http://127.0.0.1:8789'
$Child=$null
$Protected=@(8789,8796,8088,8791,8794,4479)
function Hold([string]$reason){throw ('FUN_REA229_HOLD='+$reason)}
function Listener([int]$port){
 return (@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue|
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
foreach($f in @($Source,(Join-Path $Repo 'src\experimental\rea-full-229.mjs'),
  (Join-Path $Repo 'src\experimental\rea229-client.js'),
  (Join-Path $Repo 'intelligence-checks\rea229-full-case.mjs'),
  (Join-Path $Primary '.env'))){
 if(-not (Test-Path -LiteralPath $f -PathType Leaf)){Hold ('SOURCE_MISSING_'+$f)}
 if((Get-Item -LiteralPath $f).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('UNEXPECTED_SYMLINK_'+$f)}
}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($f in @($Source,(Join-Path $Repo 'src\experimental\rea-full-229.mjs'),(Join-Path $Repo 'src\experimental\rea229-client.js'))){
 & $Node --check $f
 if($LASTEXITCODE -ne 0){Hold ('NODE_SYNTAX_'+$f)}
}
Push-Location $Repo
try{
 & $Node --test 'intelligence-checks\rea229-full-case.mjs'
 if($LASTEXITCODE -ne 0){Hold 'OFFLINE_229_TESTS_FAILED'}
}finally{Pop-Location}
$Before=@{}
foreach($p in $Protected){$Before[$p]=Listener $p}
if(-not $Before[8789] -or -not $Before[8796] -or -not $Before[8088] -or -not $Before[8791]){Hold 'PARENT_SERVICES_NOT_ALL_RUNNING'}
if(Listener 8797){Hold '8797_ALREADY_OWNED_NO_RESTART'}
$S=Invoke-RestMethod ($Parent+'/api/status') -TimeoutSec 22
$R=@($S.services|Where-Object {$_.id -eq 'rea'})
$C=Invoke-RestMethod ($Parent+'/api/rea/catalog') -TimeoutSec 25
$T=Invoke-RestMethod ($Parent+'/api/ai/tools') -TimeoutSec 25
$AI=Invoke-RestMethod ($Parent+'/api/ai/status') -TimeoutSec 15
$K=Invoke-RestMethod ($Parent+'/api/cognition/health') -TimeoutSec 15
$Existing=Invoke-RestMethod 'http://127.0.0.1:8796/api/ai/auto-local/status' -TimeoutSec 12
if($R.Count -ne 1 -or $R[0].state -ne 'ready'){Hold 'PARENT_REA_NOT_READY'}
if(@($C.tools).Count -ne 229 -or [int]$T.local_tool_count -ne 19 -or [int]$T.rea_tool_count -ne 229){Hold 'PARENT_229_PLUS_19_NOT_CONFIRMED'}
if($AI.state -ne 'ready' -or $K.version -ne 'fi-cognitive-live-bridge-v1' -or $Existing.sidecar -ne $true){Hold 'PARENT_AI_KERNEL_OR_8796_NOT_READY'}
$ParentNames=(@($C.tools|ForEach-Object {$_.name}|Sort-Object) -join [char]10)
$LogDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\REA229Full8797\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $LogDir -Force|Out-Null
try{
 $Child=Start-Process -FilePath $Node -ArgumentList @(('"'+$Source+'"'),'--serve') -WorkingDirectory $Repo -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $LogDir 'rea229.stdout.log') -RedirectStandardError (Join-Path $LogDir 'rea229.stderr.log')
 $Healthy=$false
 for($i=0;$i -lt 135;$i++){
  Start-Sleep -Milliseconds 500
  try{
   $L=@(Get-NetTCPConnection -State Listen -LocalPort 8797 -ErrorAction SilentlyContinue)
   if($L.Count -ne 1 -or $L[0].LocalAddress -ne '127.0.0.1' -or $L[0].OwningProcess -ne $Child.Id){continue}
   $A=Invoke-RestMethod ($Url+'/api/rea229/status') -TimeoutSec 4
   $U=Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 4
   $J=Invoke-WebRequest ($Url+'/api/rea229/client.js') -UseBasicParsing -TimeoutSec 4
   if($A.version -eq 'fi-rea-229-full-mcp-v1' -and $A.state -eq 'ready' -and
      $A.liveMcpHealth -eq 'ready' -and [int]$A.realReaToolCount -eq 229 -and
      $A.allRealToolsAddressable -eq $true -and $U.Content -match 'id="rea-run"' -and
      $J.Content -match 'FI_REA229_BROWSER_V1'){$Healthy=$true;break}
  }catch{}
 }
 if(-not $Healthy){Hold 'REA229_INDEPENDENT_MCP_OR_UI_NOT_READY'}
 foreach($p in $Protected){if((Listener $p) -cne $Before[$p]){Hold ('PARENT_LISTENER_CHANGED_'+$p)}}
 $S2=Invoke-RestMethod ($Parent+'/api/status') -TimeoutSec 20
 $R2=@($S2.services|Where-Object {$_.id -eq 'rea'})
 $C2=Invoke-RestMethod ($Parent+'/api/rea/catalog') -TimeoutSec 20
 $T2=Invoke-RestMethod ($Parent+'/api/ai/tools') -TimeoutSec 20
 $Existing2=Invoke-RestMethod 'http://127.0.0.1:8796/api/ai/auto-local/status' -TimeoutSec 12
 if($R2.Count -ne 1 -or $R2[0].state -ne 'ready' -or @($C2.tools).Count -ne 229 -or
   [int]$T2.rea_tool_count -ne 229 -or [int]$T2.local_tool_count -ne 19 -or $Existing2.sidecar -ne $true){Hold 'PARENT_SERVICES_CHANGED_AFTER_REA229_START'}
 $Names2=(@($C2.tools|ForEach-Object {$_.name}|Sort-Object) -join [char]10)
 if($Names2 -cne $ParentNames){Hold 'PARENT_REA_NAMES_CHANGED'}
 Write-Host ('FUN_REA229_EXECUTION=PASS URL='+$Url+' SIDECAR_PID='+$Child.Id)
 Write-Host 'REAL_REA_MCP_TOOLS=229 ADDRESSABLE=229 EXECUTION_ENABLED=TRUE INDEPENDENT_MCP=TRUE'
 Write-Host 'EXISTING_8789=PRESERVED EXISTING_8796=PRESERVED LLAMA_8088=PRESERVED COMPUTE_8791=PRESERVED'
 Write-Host ('FUN_REA229_LOGS='+$LogDir)
}catch{
 if($Child){
  try{
   $Child.Refresh()
   if(-not $Child.HasExited){
    $owned=@(Get-NetTCPConnection -State Listen -LocalPort 8797 -ErrorAction SilentlyContinue|Where-Object {$_.OwningProcess -eq $Child.Id})
    if($owned.Count -eq 1){
     # Terminate only this sidecar and descendants, including its own REA MCP child.
     & taskkill.exe /PID $Child.Id /T /F | Out-Null
    }else{Write-Warning 'SIDECAR_8797_OWNER_UNVERIFIED_NO_TERMINATION'}
   }
  }catch{Write-Warning 'REVIEW_8797_SIDECAR_CLEANUP_MANUALLY'}
 }
 throw
}
