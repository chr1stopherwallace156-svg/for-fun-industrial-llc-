# FI_AUTO_SIDECAR_PRESERVE_REA_V1
# Start ONLY an independent localhost 8796 operator-click dashboard.
# Do not restart or modify 8789, 8088, 8791, REA MCP, Ollama, or NetBird.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Sidecar=Join-Path $Repo 'scripts\Run-Fun-Auto-Sidecar8796.mjs'
$LocalUrl='http://127.0.0.1:8796'
$Parent='http://127.0.0.1:8789'
$Child=$null
function Hold([string]$why){throw ('FUN_AUTO_SIDECAR_HOLD='+$why)}
function PortOwners([int]$port){
 return @((Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object))
}
if(-not (Test-Path -LiteralPath $Sidecar -PathType Leaf)){Hold 'SIDECAR_SCRIPT_NOT_FOUND'}
if((Get-Item -LiteralPath $Sidecar).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SIDECAR_SYMLINK_NOT_ALLOWED'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
& $Node --check $Sidecar
if($LASTEXITCODE -ne 0){Hold 'SIDECAR_SYNTAX_FAILED'}
& $Node --check (Join-Path $Repo 'src\experimental\auto-local-dashboard.mjs')
if($LASTEXITCODE -ne 0){Hold 'BRIDGE_SYNTAX_FAILED'}
& $Node --check (Join-Path $Repo 'src\experimental\auto-local-client.js')
if($LASTEXITCODE -ne 0){Hold 'CLIENT_SYNTAX_FAILED'}
Push-Location $Repo
try{
 & $Node --test 'intelligence-checks\auto-sidecar-case.mjs' 'intelligence-checks\auto-local-dashboard-case.mjs' 'intelligence-checks\auto-local-tools-case.mjs'
 if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED'}
}finally{Pop-Location}
$Before=@{}
foreach($port in @(8789,8088,8791,8794,4479)){$Before[$port]=(PortOwners $port) -join ';'}
if(-not $Before[8789] -or -not $Before[8088] -or -not $Before[8791]){Hold 'PARENT_MODEL_OR_COMPUTE_LISTENER_MISSING'}
if((PortOwners 8796).Count -ne 0){Hold 'SIDECAR_PORT_8796_ALREADY_OWNED_NO_RESTART'}
$Platform=Invoke-RestMethod ($Parent+'/api/status') -TimeoutSec 20
$Rea=@($Platform.services|Where-Object {$_.id -eq 'rea'})
$Tools=Invoke-RestMethod ($Parent+'/api/ai/tools') -TimeoutSec 20
$Ai=Invoke-RestMethod ($Parent+'/api/ai/status') -TimeoutSec 15
$Kernel=Invoke-RestMethod ($Parent+'/api/cognition/health') -TimeoutSec 15
$Index=Invoke-RestMethod ($Parent+'/api/cognition/catalogue/status') -TimeoutSec 15
if($Rea.Count -ne 1 -or $Rea[0].state -ne 'ready'){Hold 'REA_229_SESSION_NOT_READY_PRESERVE_HOST'}
if([int]$Tools.local_tool_count -ne 19 -or [int]$Tools.rea_tool_count -ne 229){Hold 'EXPECTED_19_PLUS_229_CATALOGUE_CHANGED'}
if($Ai.state -ne 'ready'){Hold 'LOCAL_LLAMA_NOT_READY'}
if($Kernel.version -ne 'fi-cognitive-live-bridge-v1' -or $Kernel.reaExecutionGrants -ne 0){Hold 'COGNITIVE_IDENTITY_CHANGED'}
if($Index.version -ne 'fi-capability-index-v1' -or [int]$Index.localCount -ne 19 -or $Index.executionGrants -ne 0){Hold 'INDEX_IDENTITY_CHANGED'}
$LogDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutoSidecar8796\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$Out=Join-Path $LogDir 'sidecar.stdout.log'
$Err=Join-Path $LogDir 'sidecar.stderr.log'
try{
 $Child=Start-Process -FilePath $Node -ArgumentList @(('"' + $Sidecar + '"'),'--serve') -WorkingDirectory $Repo -PassThru -RedirectStandardOutput $Out -RedirectStandardError $Err -ErrorAction Stop
 $verified=$false
 for($i=0;$i -lt 45;$i++){
  Start-Sleep -Milliseconds 300
  try{
   $port=@(Get-NetTCPConnection -State Listen -LocalPort 8796 -ErrorAction SilentlyContinue)
   if($port.Count -ne 1 -or $port[0].LocalAddress -ne '127.0.0.1' -or $port[0].OwningProcess -ne $Child.Id){continue}
   $Status=Invoke-RestMethod ($LocalUrl+'/api/ai/auto-local/status') -TimeoutSec 4
   $Ui=Invoke-WebRequest $LocalUrl -UseBasicParsing -TimeoutSec 4
   $Js=Invoke-WebRequest ($LocalUrl+'/api/ai/auto-local/client.js') -UseBasicParsing -TimeoutSec 4
   if($Status.version -ne 'fi-auto-local-dashboard-v1' -or $Status.sidecar -ne $true -or
     $Status.parentProcessesPreserved -ne $true -or $Status.reaExecutionGrants -ne 0 -or
     $Status.busy -ne $false -or $Ui.Content -notmatch 'id="fi-auto-local-panel"' -or
     $Js.Content -notmatch 'FI_AUTO_LOCAL_DASHBOARD_CLIENT_V2'){continue}
   $verified=$true;break
  }catch{ }
 }
 if(-not $verified){Hold 'SIDECAR_STARTUP_OR_HTTP_IDENTITY_FAILED'}
 foreach($port in $Before.Keys){if(((PortOwners $port) -join ';') -cne $Before[$port]){Hold ('PROTECTED_PARENT_LISTENER_CHANGED_'+$port)}}
 $After=Invoke-RestMethod ($Parent+'/api/status') -TimeoutSec 20
 $ReaAfter=@($After.services|Where-Object {$_.id -eq 'rea'})
 $ToolsAfter=Invoke-RestMethod ($Parent+'/api/ai/tools') -TimeoutSec 20
 if($ReaAfter.Count -ne 1 -or $ReaAfter[0].state -ne 'ready' -or
   [int]$ToolsAfter.rea_tool_count -ne 229 -or [int]$ToolsAfter.local_tool_count -ne 19){Hold 'REA_OR_LOCAL_REGISTRY_CHANGED_AFTER_START'}
 Write-Host ('FUN_AUTO_SIDECAR=PASS URL='+$LocalUrl+' PID='+$Child.Id)
 Write-Host 'PARENT_8789=PRESERVED REA=READY REA_TOOLS=229 LOCAL_TOOLS=19 LLAMA_8088=PRESERVED COMPUTE_8791=PRESERVED'
 Write-Host 'AUTO_TOOL_EXECUTION=OPERATOR_STARTED_LOCAL_ONLY REA_EXECUTION_GRANTS=0'
 Write-Host ('FUN_AUTO_SIDECAR_LOGS='+$LogDir)
}catch{
 if($Child){
  try{
   $Child.Refresh()
   if(-not $Child.HasExited){
    $owned=@(Get-NetTCPConnection -State Listen -LocalPort 8796 -ErrorAction SilentlyContinue|Where-Object {$_.OwningProcess -eq $Child.Id})
    if($owned.Count -eq 1){Stop-Process -Id $Child.Id -ErrorAction Stop}
   }
  }catch{Write-Warning 'SIDECAR_CLEANUP_REQUIRES_REVIEW'}
 }
 throw
}
