# Installs the official GSA snapshot overlay in the existing Fun Industrial worker.
# No 8789 dashboard restart, no modifications to live SQLite / existing research JSON.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$stage=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github'
$src=$PSScriptRoot
$node=(Get-Command node.exe -ErrorAction Stop).Source
$launcher=Join-Path $stage 'Start.ps1'
$base='http://127.0.0.1:8789'
$worker='http://127.0.0.1:8792'
$files=@('src\http.mjs','src\gsa-bridge.mjs','GSA-Import-From-File.mjs')
foreach($f in $files){$s=Join-Path $src $f;if(-not(Test-Path $s -PathType Leaf)){throw "SOURCE_FILE_MISSING=$f"};& $node --check $s;if($LASTEXITCODE -ne 0){throw "SOURCE_SYNTAX_HOLD=$f"}}
foreach($f in @('test\gsa-bridge.test.mjs','test\gsa-import.test.mjs','test\domestic.test.mjs','test\gsa-windows-preview.test.mjs')){if(-not(Test-Path (Join-Path $src $f))){throw "TEST_FILE_MISSING=$f"}}
& $node --test (Join-Path $src 'test\gsa-bridge.test.mjs') (Join-Path $src 'test\gsa-import.test.mjs') (Join-Path $src 'test\domestic.test.mjs') (Join-Path $src 'test\gsa-windows-preview.test.mjs')
if($LASTEXITCODE -ne 0){throw 'GSA_BRIDGE_TESTS_FAILED'}
if(-not(Test-Path $launcher -PathType Leaf)){throw 'INSTALLED_WORKER_LAUNCHER_MISSING'}
$platform=Invoke-RestMethod "$base/api/status" -TimeoutSec 15
$before=Invoke-RestMethod "$worker/api/status" -TimeoutSec 15
if($platform.application -ne 'Fun Industrial Platform'){throw 'PLATFORM_NOT_VERIFIED'}
if($before.application -ne 'Fun Industrial Autonomous Workers' -or $before.state -ne 'running'){throw 'WORKER_NOT_READY'}
$p=Get-CimInstance Win32_Process -Filter "ProcessId=$($before.pid)" -ErrorAction Stop
if(-not $p -or $p.Name -ne 'node.exe' -or $p.CommandLine -notmatch 'autonomy-v2-github.*service\.mjs'){throw 'WORKER_IDENTITY_REJECTED'}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutonomyLab\GsaBridgeBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Force -Path $backup | Out-Null
$manifest=@()
foreach($f in $files){
 $dest=Join-Path $stage $f
 $wasPresent=Test-Path $dest -PathType Leaf
 $copy=Join-Path $backup ($f -replace '\\','_')
 if($wasPresent){Copy-Item $dest $copy -ErrorAction Stop}
 $manifest+=@{path=$dest;backup=$copy;existed=$wasPresent}
}
$stopped=$false;$newPid=0
try{
 foreach($f in $files){Copy-Item (Join-Path $src $f) (Join-Path $stage $f) -Force -ErrorAction Stop}
 Write-Host "RESTARTING_GSA_BRIDGE_WORKER_PID=$($before.pid)"
 Stop-Process -Id ([int]$before.pid) -Force -ErrorAction Stop
 $stopped=$true
 for($i=0;$i -lt 60;$i++){if(-not(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 350}
 if(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue){throw 'WORKER_8792_PORT_BUSY'}
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher
 if($LASTEXITCODE -ne 0){throw 'GSA_WORKER_START_FAILED'}
 $after=Invoke-RestMethod "$worker/api/status" -TimeoutSec 20
 if($after.application -ne 'Fun Industrial Autonomous Workers' -or $after.state -ne 'running'){throw 'GSA_WORKER_RESTART_IDENTITY_FAILED'}
 $newPid=[int]$after.pid
 $r=Invoke-RestMethod "$base/api/autonomy/opportunities" -TimeoutSec 20
 if($r.scope -ne 'United States' -or -not $r.gsaSnapshot -or $r.gsaSnapshot.state -notin @('not_imported','expired_or_invalid','active')){throw 'GSA_BRIDGE_ROUTE_NOT_READY'}
 $check=Invoke-RestMethod "$base/api/status" -TimeoutSec 15
 if($check.application -ne 'Fun Industrial Platform'){throw 'DASHBOARD_DROPPED'}
 Write-Host "GSA_DASHBOARD_BRIDGE=PASS WORKER_PID=$newPid DASHBOARD_8789_PRESERVED=TRUE"
 Write-Host "GSA_SNAPSHOT_STATE=$($r.gsaSnapshot.state)"
 Write-Host "BACKUP=$backup"
 Write-Host 'NEXT=IMPORT_GSA_OFFICIAL_FEED_USING_WINDOWS_HTTP'
}catch{
 $reason=$_.Exception.Message
 Write-Warning "GSA_BRIDGE_DEPLOY_FAILED=$reason"
 if($newPid -gt 0){
  $t=Get-CimInstance Win32_Process -Filter "ProcessId=$newPid" -ErrorAction SilentlyContinue
  if($t -and $t.CommandLine -match 'autonomy-v2-github.*service\.mjs'){Stop-Process -Id $newPid -Force -ErrorAction SilentlyContinue}
 }
 foreach($m in $manifest){
  if($m.existed){Copy-Item $m.backup $m.path -Force}
  else{Remove-Item $m.path -Force -ErrorAction SilentlyContinue}
 }
 if($stopped){
  for($i=0;$i -lt 60;$i++){if(-not(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 350}
  if(-not(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue)){
   try{& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher;Write-Warning 'PREVIOUS_WORKER_RECOVERY_ATTEMPTED'}catch{Write-Warning "MANUAL_RECOVERY_REQUIRED_BACKUP=$backup"}
  }
 }
 throw "GSA_BRIDGE_NOT_QUALIFIED=$reason BACKUP=$backup"
}
