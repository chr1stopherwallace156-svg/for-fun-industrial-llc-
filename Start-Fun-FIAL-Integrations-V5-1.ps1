# Fun Industrial FIAL 5.1 -- integrate eight existing module APIs into entire system.
# Single purpose: adopt or start ONLY a new 127.0.0.1:8805 process.
# Existing FIAL4/5, Qwen, REA, controls, compute, gateway, Elektron unchanged.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fial5-1-eight-module-integration-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Runner=Join-Path $Root 'scripts\Run-Fun-FIAL-Integrations8805.mjs'
$Url='http://127.0.0.1:8805'
function Hold([string]$why){throw ('FIAL51_ACTIVATION_HOLD='+$why)}
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
$files=@('src\fial\module-adapters-v5-1.mjs',
 'src\fial\module-widget-v5-1.js',
 'scripts\Run-Fun-FIAL-Integrations8805.mjs',
 'intelligence-checks\fial-eight-module-v5-1-case.mjs')
foreach($rel in $files){
 $file=Join-Path $Root $rel
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('MISSING_SOURCE='+$rel)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_SOURCE_DENIED='+$rel)
 }
 & $Node --check $file
 if($LASTEXITCODE -ne 0){Hold ('SYNTAX_FAILED='+$rel)}
}
& $Node --test (Join-Path $Root 'intelligence-checks\fial-eight-module-v5-1-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'EIGHT_ADAPTER_TESTS_FAILED'}
Write-Host 'FIAL51_EIGHT_ADAPTER_TESTS=PASS'
# No restarts or process changes until FIAL5 existing session is verified.
$core=Invoke-RestMethod 'http://127.0.0.1:8804/api/fial/system/status' -TimeoutSec 10 -ErrorAction Stop
if($core.version -cne 'fial-system-runtime-v0.5' -or
 $core.module_count -ne 18 -or
 @($core.modules).Count -ne 18){Hold 'FIAL5_CORE_INCOMPATIBLE_OR_OFFLINE'}
$protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8802,8803,8804,8443)
$before=@{}
foreach($p in $protected){$before[$p]=Snapshot $p}
$existing=@(Listeners 8805)
if($existing.Count){
 if($existing.Count -ne 1 -or $existing[0].LocalAddress -cne '127.0.0.1'){
  Hold '8805_MULTIPLE_OR_UNSAFE_LISTENERS'
 }
 $ownerPid=[int]$existing[0].OwningProcess
 $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$ownerPid) -ErrorAction Stop
 if(!$proc -or $proc.Name -ne 'node.exe' -or
  [string]$proc.CommandLine -notmatch [regex]::Escape($Runner)){
  Hold '8805_OWNER_NOT_VERIFIED_NO_RESTART'
 }
 Write-Host ('FIAL51_EXISTING_PROCESS_ADOPTED_PID='+$ownerPid)
}else{
 $logs=Join-Path $env:LOCALAPPDATA ('FunIndustrial\FIAL51Integrations\logs\'+
  (Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $child=Start-Process -FilePath $Node -ArgumentList ('"'+$Runner+'" --serve') -WorkingDirectory $Root -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $logs 'stdout.log') -RedirectStandardError (Join-Path $logs 'stderr.log')
 $ready=$false
 for($i=0;$i -lt 90;$i++){
  Start-Sleep -Milliseconds 300
  try{
   $listeners=@(Listeners 8805)
   if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -cne '127.0.0.1' -or
    [int]$listeners[0].OwningProcess -ne [int]$child.Id){continue}
   $health=Invoke-RestMethod ($Url+'/api/fial/modules/health') -TimeoutSec 5
   if($health.version -eq 'fial5.1-integrated-hub-v1' -and
    $health.actions_without_user_click -eq 0 -and
    $health.rea_authority_added -eq $false){$ready=$true;break}
  }catch{}
 }
 if(!$ready){Hold ('8805_START_OR_IDENTITY_HOLD_LOGS='+$logs)}
 Write-Host ('FIAL51_NEW_PROCESS_PID='+$child.Id+' LOGS='+$logs)
}
$health=Invoke-RestMethod ($Url+'/api/fial/modules/health') -TimeoutSec 10
if($health.version -cne 'fial5.1-integrated-hub-v1' -or
 $health.port -ne 8805 -or
 $health.actions_without_user_click -ne 0 -or
 $health.rea_authority_added -ne $false){Hold 'FIAL51_HEALTH_CONTRACT_INVALID'}
foreach($p in $protected){
 if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_SERVICE_CHANGED_PORT_'+$p)}
}
$report=$null
for($i=0;$i -lt 100;$i++){
 try{
  $report=Invoke-RestMethod ($Url+'/api/fial/modules/status') -TimeoutSec 7
  if($report.state -in @('SYSTEM_WIDE_ADAPTERS_CONNECTED','hold')){break}
 }catch{}
 Start-Sleep -Milliseconds 400
}
if($null -eq $report){Hold 'FIAL51_MODULE_STATUS_UNAVAILABLE'}
if($report.state -ne 'SYSTEM_WIDE_ADAPTERS_CONNECTED'){
 Write-Host ('FIAL51_INTEGRATION_HOLD='+$report.last_error)
 Hold 'FIAL51_INITIAL_MODULE_INTEGRATION_HOLD'
}
if($report.register_count -ne 18 -or $report.real_adapters_connected -ne 8 -or
 @($report.modules).Count -ne 18 -or $report.rea_tools_executed -ne 0 -or
 $report.unattended_module_actions -ne 0){Hold 'FIAL51_MODULE_COVERAGE_INVALID'}
Write-Host 'FIAL51_EIGHT_REAL_MODULE_ADAPTERS=CONNECTED'
Write-Host ('FIAL51_CONFIGURED_ADAPTERS='+$report.real_adapters_configured)
Write-Host ('FIAL51_CORE_IDENTITY_VERIFIED='+$report.core_identity_verified)
Write-Host ('FIAL51_UNAVAILABLE_OR_UNCONFIGURED='+$report.missing_or_unconfigured)
foreach($m in $report.modules){
 Write-Host ('FIAL51_MODULE='+$m.id+' STATE='+$m.state+' INTEGRATION='+$m.integration)
}
Write-Host 'FIAL51_WHOLE_SYSTEM_ACTIVATION=PASS'
Write-Host ('FIAL51_URL='+$Url+'/')
Write-Host 'FIAL51_STATUS_REFRESH=STARTUP_AND_EVERY_15_MINUTES'
Write-Host 'FIAL51_OPERATOR_APPROVALS=REQUIRED_FOR_EACH_MODULE_OPERATION'
Write-Host 'FIAL51_REA_AND_ELEKTRON=NOT_TOUCHED'
