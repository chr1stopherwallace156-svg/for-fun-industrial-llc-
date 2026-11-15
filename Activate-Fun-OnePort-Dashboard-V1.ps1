# User-authorized one-time dashboard restart on 8802 only.
# Does not terminate Qwen, Cognee, ML, REA, gateway or ELEKTRON Ollama.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Branch='feature/fun-one-port-dashboard-v1-20261115'
$Url='http://127.0.0.1:8802'
function Hold([string]$why){throw ('FUN_ONEPORT_ACTIVATION_HOLD='+$why)}
$active=(& git.exe -C $Root branch --show-current|Out-String).Trim()
$remote=(& git.exe -C $Root remote get-url origin|Out-String).Trim()
$dirty=@(& git.exe -C $Root status --porcelain=v1 --untracked-files=all)
if($active -cne $Branch -or $remote -cne $Origin -or $dirty.Count){Hold 'UNKNOWN_OR_MODIFIED_SOURCE_NO_RESTART'}
$Deploy=Join-Path $Root 'Deploy-Fun-OnePort-Dashboard-V1.ps1'
if(!(Test-Path -LiteralPath $Deploy -PathType Leaf) -or
 ((Get-Item -LiteralPath $Deploy).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
 Hold 'DEPLOY_SCRIPT_MISSING_OR_LINKED'
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
Write-Host 'FUN_ONEPORT_SCOPE=REVIEWED_LOCAL_DASHBOARD_8802_ONLY'
Write-Host 'FUN_ONEPORT_UNRELATED_SERVICES=DO_NOT_RESTART'
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){Hold 'DASHBOARD_RESTART_OR_ROLLBACK_HOLD'}
$homeResponse=Invoke-WebRequest ($Url+'/') -UseBasicParsing -TimeoutSec 15
$style=Invoke-WebRequest ($Url+'/api/oneport/style.css') -UseBasicParsing -TimeoutSec 15
$client=Invoke-WebRequest ($Url+'/api/oneport/client.js') -UseBasicParsing -TimeoutSec 15
$ops=Invoke-WebRequest ($Url+'/operations/?embedded=1') -UseBasicParsing -TimeoutSec 15
$chat=Invoke-WebRequest ($Url+'/unified/?view=chat&embedded=1') -UseBasicParsing -TimeoutSec 15
$tools=Invoke-WebRequest ($Url+'/unified/?view=tools&embedded=1') -UseBasicParsing -TimeoutSec 15
$old=Invoke-WebRequest ($Url+'/workspace/?view=workspace&embedded=1') -UseBasicParsing -TimeoutSec 15
$task=Get-ScheduledTask -TaskName 'FunIndustrial-Executive-Operator-V1' -ErrorAction Stop
$expected='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+
 (Join-Path $HOME 'FunIndustrial-FIAL514-Demand\Run-Fun-Purchase-Demand-V5-14.ps1')+'"'
if($homeResponse.StatusCode -ne 200 -or $homeResponse.Headers['x-fi-dashboard-version'] -cne 'fun-industrial-one-port-dashboard-v1' -or
 $homeResponse.Content -notmatch 'id="fi-app"' -or
 $homeResponse.Content -notmatch 'data-section="procurement"' -or
 $style.StatusCode -ne 200 -or $client.StatusCode -ne 200 -or
 $ops.Content -notmatch 'fi-exec-queue' -or
 $chat.Content -notmatch 'fi-fial53-grounded' -or
 $tools.Content -notmatch 'id="action-review"' -or
 $old.Content -notmatch 'fi-ui-shell' -or
 @($task.Triggers).Count -ne 4 -or
 @($task.Actions).Count -ne 1 -or
 [string]$task.Actions[0].Arguments -cne $expected){Hold 'FINAL_ONE_ADDRESS_OR_FOUR_TASK_INTEGRATION_INVALID'}
$status=Invoke-RestMethod ($Url+'/api/fial/grounded/status') -TimeoutSec 12
if($status.authority_added -ne $false -or $status.tool_executions -ne 0 -or
 $status.rea_executions -ne 0){Hold 'QWEN_REA_AUTHORITY_BOUNDARY_CHANGED'}
Write-Host ('FUN_ONEPORT_DASHBOARD='+$Url+'/')
Write-Host ('FUN_ONEPORT_LEGACY_WORKSPACE='+$Url+'/workspace/?view=workspace')
Write-Host 'FUN_ONEPORT_USER_FACING_PORTS=1'
Write-Host 'FUN_ONEPORT_MODULES=CHAT_TOOLS_OPERATIONS_FLEET_PROCUREMENT_COMMERCE_ML'
Write-Host 'FUN_ONEPORT_SCHEDULE_TRIGGERS=4'
Write-Host 'FUN_ONEPORT_QWEN_TOOL_AUTHORITY=UNCHANGED'
Write-Host 'FUN_ONEPORT_ELEKTRON_AND_OTHER_SERVICES=UNTOUCHED'
Write-Host 'FUN_ONEPORT_ACTIVATION=PASS'
