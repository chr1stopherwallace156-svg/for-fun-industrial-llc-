# One-command, standalone live FIAL4 dashboard and official-source updater.
# Launches only a verified new 8803 sidecar. Protected services never restarted.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fial4-live-official-activation-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Runner=Join-Path $Root 'scripts\Run-Fun-FIAL-Live-Dashboard8803.mjs'
$Url='http://127.0.0.1:8803'
function Hold([string]$reason){throw ('FIAL4_LIVE_ACTIVATION_HOLD='+$reason)}
function Listen([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$port){
 return (@(Listen $port|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
if((git.exe -C $Root remote get-url origin) -cne $Origin -or
 (git.exe -C $Root branch --show-current) -cne $Branch -or $LASTEXITCODE -ne 0){
 Hold 'REPOSITORY_IDENTITY_MISMATCH'
}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -gt 0 -or
 $LASTEXITCODE -ne 0){Hold 'SOURCE_CHECKOUT_DIRTY'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$required=@('src\fial\live-official-v4.mjs',
 'src\fial\live-widget-v4.js','scripts\Run-Fun-FIAL-Live-Dashboard8803.mjs',
 'intelligence-checks\fial-live-official-v4-case.mjs',
 'src\fial\grounded-review-v4.mjs')
foreach($rel in $required){
 $path=Join-Path $Root $rel
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('MISSING_SOURCE='+$rel)}
 if(((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_SOURCE_DENIED='+$rel)
 }
 & $Node --check $path
 if($LASTEXITCODE -ne 0){Hold ('SOURCE_SYNTAX_INVALID='+$rel)}
}
& $Node --test (Join-Path $Root 'intelligence-checks\fial-live-official-v4-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'INDEPENDENT_LIVE_TESTS_FAILED'}
Write-Host 'FIAL4_LIVE_INDEPENDENT_TESTS=PASS'
$data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RealApplicationWorkerV1'
foreach($rel in @('fial\grounded-v4\last-run.json','fial\semantic-v2\last-run.json')){
 if(!(Test-Path -LiteralPath (Join-Path $data $rel) -PathType Leaf)){
  Hold ('FIAL4_LOCAL_BASELINE_MISSING='+$rel)
 }
}
$baseline=Get-Content -LiteralPath (Join-Path $data 'fial\grounded-v4\last-run.json') -Raw|ConvertFrom-Json
if($baseline.version -cne 'fial-grounded-review-v0.4' -or
 $baseline.network_requests -ne 0 -or
 $baseline.applications_submitted -ne 0){Hold 'FIAL4_LOCAL_BASELINE_INVALID'}
$protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8802,8443)
$before=@{}
foreach($p in $protected){$before[$p]=Snapshot $p}
$existing=@(Listen 8803)
if($existing.Count){
 if($existing.Count -ne 1 -or $existing[0].LocalAddress -ne '127.0.0.1'){
  Hold '8803_UNEXPECTED_LISTENERS'
 }
 $pidOwner=[int]$existing[0].OwningProcess
 $owner=Get-CimInstance Win32_Process -Filter ('ProcessId='+$pidOwner) -ErrorAction Stop
 if($owner.Name -ne 'node.exe' -or
  !$owner.CommandLine.Contains($Runner)){Hold '8803_OWNER_NOT_VERIFIED_NO_RESTART'}
 Write-Host ('FIAL4_LIVE_ADOPTED_PID='+$pidOwner)
}else{
 $logDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\FIAL4Live\logs\'+
  (Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
 New-Item -ItemType Directory -Path $logDir -Force|Out-Null
 $child=Start-Process -FilePath $Node -ArgumentList ('"'+$Runner+'" --serve') -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir 'stdout.log') -RedirectStandardError (Join-Path $logDir 'stderr.log')
 $ready=$false
 for($i=0;$i -lt 80;$i++){
  Start-Sleep -Milliseconds 350
  try{
   $bound=@(Listen 8803)
   if($bound.Count -ne 1 -or $bound[0].LocalAddress -ne '127.0.0.1' -or
    [int]$bound[0].OwningProcess -ne [int]$child.Id){continue}
   $health=Invoke-RestMethod ($Url+'/api/fial/live/health') -TimeoutSec 5
   if($health.version -eq 'fi-fial4-live-hub-v1' -and
    $health.existing_services_restarted -eq 0){$ready=$true;break}
  }catch{}
 }
 if(!$ready){Hold ('FIAL4_LIVE_8803_START_FAILED_LOGS='+$logDir)}
 Write-Host ('FIAL4_LIVE_STARTED_PID='+$child.Id+' LOGS='+$logDir)
}
$health=Invoke-RestMethod ($Url+'/api/fial/live/health') -TimeoutSec 10
if($health.version -ne 'fi-fial4-live-hub-v1' -or
 $health.auto_refresh_hours -ne 6 -or
 $health.rea_permissions_added -ne 0){Hold 'FIAL4_LIVE_IDENTITY_INVALID'}
foreach($p in $protected){
 if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_PORT_CHANGED_'+$p)}
}
Write-Host 'FIAL4_LIVE_DASHBOARD=ACTIVE'
Write-Host ('FIAL4_LIVE_URL='+$Url+'/')
Write-Host 'FIAL4_LIVE_SCHEDULE=STARTUP_AND_EVERY_6_HOURS'
$state=$null
for($i=0;$i -lt 140;$i++){
 try{
  $state=Invoke-RestMethod ($Url+'/api/fial/live/status') -TimeoutSec 6
  if($state.state -in @('LIVE_OFFICIAL_FEED_RETRIEVED',
   'LIVE_FEED_RETRIEVED_WITH_RECORD_HOLDS','hold')){break}
 }catch{}
 Start-Sleep -Milliseconds 450
}
if($null -eq $state){Hold 'LIVE_SOURCE_STATUS_UNAVAILABLE'}
Write-Host ('FIAL4_LIVE_STATE='+$state.state)
if($state.state -in @('LIVE_OFFICIAL_FEED_RETRIEVED',
 'LIVE_FEED_RETRIEVED_WITH_RECORD_HOLDS')){
 Write-Host ('FIAL4_LIVE_VERIFIED_UTC='+$state.verified_at_utc)
 Write-Host ('FIAL4_LIVE_OFFICIAL_RECORDS='+$state.rows)
 Write-Host ('FIAL4_LIVE_MATCHES='+$state.matches)
 foreach($c in $state.cases){Write-Host ('FIAL4_LIVE_GRANT='+$c.grant_id+' STATE='+$c.state)}
 Write-Host 'FIAL4_LIVE_OFFICIAL_SOURCE=PASS'
}else{
 Write-Host ('FIAL4_LIVE_OFFICIAL_SOURCE=HOLD REASON='+$state.reason)
}
Write-Host 'FIAL4_PROTECTED_SERVICES=NOT_TOUCHED'
Write-Host 'FIAL4_PERMISSIONS=OFFICIAL_FEED_GET_ONLY_NO_REA_NO_SUBMISSIONS_NO_SPENDING'
