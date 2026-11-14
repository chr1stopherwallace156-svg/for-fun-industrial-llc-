# Fun Industrial FIAL5 system-wide core. Starts only new loopback 8804 service.
# Existing Elektron, Qwen, REA, dashboard and FIAL4 listeners are never restarted.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fial5-system-wide-core-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Runner=Join-Path $Root 'scripts\Run-Fun-FIAL-System8804.mjs'
$Url='http://127.0.0.1:8804'
function Hold([string]$why){throw ('FIAL5_SYSTEM_HOLD='+$why)}
function Listeners([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function PortSnapshot([int]$port){
 return (@(Listeners $port|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
if((git.exe -C $Root remote get-url origin) -cne $Origin -or
 (git.exe -C $Root branch --show-current) -cne $Branch -or
 $LASTEXITCODE -ne 0){Hold 'REPOSITORY_IDENTITY_MISMATCH'}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -gt 0 -or
 $LASTEXITCODE -ne 0){Hold 'WORKTREE_DIRTY'}
$files=@('src\fial\system-compiler-v5.mjs','src\fial\system-runtime-v5.mjs',
 'src\fial\system-widget-v5.js','src\fial\programs\system-coordination.fial',
 'scripts\Run-Fun-FIAL-System8804.mjs',
 'intelligence-checks\fial-system-v5-case.mjs')
$Node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($relative in $files){
 $path=Join-Path $Root $relative
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('MISSING_SOURCE='+$relative)}
 if(((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_SOURCE_DENIED='+$relative)
 }
 if($path.EndsWith('.mjs') -or $path.EndsWith('.js')){
  & $Node --check $path
  if($LASTEXITCODE -ne 0){Hold ('SYNTAX_FAILED='+$relative)}
 }
}
& $Node --test (Join-Path $Root 'intelligence-checks\fial-system-v5-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'FIAL5_SYSTEM_TESTS_FAILED'}
Write-Host 'FIAL5_SYSTEM_TESTS=PASS'
$protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8802,8803,8443)
$before=@{}
foreach($p in $protected){$before[$p]=PortSnapshot $p}
$existing=@(Listeners 8804)
if($existing.Count){
 if($existing.Count -ne 1 -or $existing[0].LocalAddress -ne '127.0.0.1'){
  Hold '8804_UNEXPECTED_LISTENER'
 }
 $pidOwner=[int]$existing[0].OwningProcess
 $owner=Get-CimInstance Win32_Process -Filter ('ProcessId='+$pidOwner) -ErrorAction Stop
 if($owner.Name -ne 'node.exe' -or
  !$owner.CommandLine.Contains($Runner)){Hold '8804_UNEXPECTED_OWNER_NO_RESTART'}
 Write-Host ('FIAL5_SYSTEM_ADOPTED_PID='+$pidOwner)
}else{
 $logs=Join-Path $env:LOCALAPPDATA ('FunIndustrial\FIAL5System\logs\'+
  (Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $child=Start-Process -FilePath $Node -ArgumentList ('"'+$Runner+'" --serve') -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logs 'stdout.log') -RedirectStandardError (Join-Path $logs 'stderr.log')
 $ready=$false
 for($i=0;$i -lt 80;$i++){
  Start-Sleep -Milliseconds 300
  try{
   $current=@(Listeners 8804)
   if($current.Count -ne 1 -or $current[0].LocalAddress -ne '127.0.0.1' -or
    [int]$current[0].OwningProcess -ne [int]$child.Id){continue}
   $h=Invoke-RestMethod ($Url+'/api/fial/system/health') -TimeoutSec 4
   if($h.version -eq 'fi-fial-system-dashboard-v5' -and
    $h.services_restarted -eq 0){$ready=$true;break}
  }catch{}
 }
 if(!$ready){Hold ('8804_START_HEALTH_FAILED_LOGS='+$logs)}
 Write-Host ('FIAL5_SYSTEM_STARTED_PID='+$child.Id+' LOGS='+$logs)
}
$health=Invoke-RestMethod ($Url+'/api/fial/system/health') -TimeoutSec 8
if($health.version -ne 'fi-fial-system-dashboard-v5' -or
 $health.whole_system_registry -ne $true -or
 $health.schedule_minutes -ne 15 -or $health.external_tool_authority_added -ne $false){
 Hold '8804_HEALTH_ATTESTATION_FAILED'
}
foreach($p in $protected){
 if((PortSnapshot $p) -cne $before[$p]){Hold ('PROTECTED_SERVICE_CHANGED_PORT_'+$p)}
}
Write-Host 'FIAL5_SYSTEM_DASHBOARD=ACTIVE'
Write-Host ('FIAL5_SYSTEM_URL='+$Url+'/')
Write-Host 'FIAL5_SYSTEM_SCHEDULE=STARTUP_AND_EVERY_15_MINUTES'
$status=$null
for($i=0;$i -lt 35;$i++){
 try{
  $status=Invoke-RestMethod ($Url+'/api/fial/system/status') -TimeoutSec 5
  if($status.state -in @('SYSTEM_WIDE_COORDINATOR_ACTIVE_EVIDENCE_ONLY','hold')){break}
 }catch{}
 Start-Sleep -Milliseconds 400
}
if($null -eq $status){Hold 'FIAL5_SYSTEM_STATUS_UNAVAILABLE'}
Write-Host ('FIAL5_SYSTEM_STATE='+$status.state)
if($status.state -ne 'SYSTEM_WIDE_COORDINATOR_ACTIVE_EVIDENCE_ONLY'){
 Write-Host ('FIAL5_SYSTEM_CYCLE_HOLD='+$status.reason)
 Hold 'FIAL5_SYSTEM_INITIAL_CYCLE_HOLD'
}
Write-Host ('FIAL5_MODULES_REGISTERED='+$status.module_count)
Write-Host ('FIAL5_SERVICES_IDENTITY_VERIFIED='+$status.verified_modules)
Write-Host ('FIAL5_MODULES_NOT_INSTRUMENTED='+$status.uninstrumented)
Write-Host ('FIAL5_PENDING_REVIEW='+$status.pending)
foreach($module in $status.modules){
 Write-Host ('FIAL5_MODULE='+$module.id+' DOMAIN='+$module.domain+' STATE='+$module.state+' DECISION='+$module.decision)
}
Write-Host 'FIAL5_SYSTEM_ACTIVATION=PASS'
Write-Host 'FIAL5_PROTECTED_SERVICES=NOT_TOUCHED'
Write-Host 'FIAL5_AUTHORITY=OBSERVATION_DECISIONS_ONLY_APPROVALS_UNCHANGED'
