# Repair only the live GSA auction parser in the deployed autonomous worker.
# Does NOT change the 8789 dashboard, SQLite, credentials, REA policy or Qwen.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'src\domestic.mjs'
$tests=Join-Path $PSScriptRoot 'test\domestic.test.mjs'
$installed=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github'
$dest=Join-Path $installed 'src\domestic.mjs'
$launcher=Join-Path $installed 'Start.ps1'
$node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($p in @($source,$tests,$dest,$launcher)){if(-not(Test-Path $p -PathType Leaf)){throw "REQUIRED_FILE_MISSING=$p"}}
& $node --check $source
if($LASTEXITCODE -ne 0){throw 'GSA_MODULE_SYNTAX_HOLD'}
& $node --test $tests
if($LASTEXITCODE -ne 0){throw 'GSA_PARSER_TESTS_FAILED'}
$base='http://127.0.0.1:8789'
$workerBase='http://127.0.0.1:8792'
$before=Invoke-RestMethod "$workerBase/api/status" -TimeoutSec 15
$platform=Invoke-RestMethod "$base/api/status" -TimeoutSec 15
if($before.application -ne 'Fun Industrial Autonomous Workers' -or $before.state -ne 'running'){throw 'CURRENT_WORKER_NOT_VERIFIED'}
if($platform.application -ne 'Fun Industrial Platform'){throw 'DASHBOARD_IDENTITY_HOLD'}
$proc=Get-CimInstance Win32_Process -Filter "ProcessId=$($before.pid)" -ErrorAction Stop
if(-not $proc -or $proc.Name -ne 'node.exe' -or $proc.CommandLine -notmatch 'autonomy-v2-github.*service\.mjs'){throw 'WORKER_PROCESS_NOT_RECOGNIZED'}
$backupDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutonomyLab\GsaParserBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $backupDir -Force|Out-Null
Copy-Item $dest (Join-Path $backupDir 'domestic.mjs') -ErrorAction Stop
$newPid=0;$stopped=$false
try{
 Copy-Item $source $dest -Force
 Write-Host "RESTARTING_ONLY_AUTONOMY_WORKER_PID=$($before.pid)"
 Stop-Process -Id ([int]$before.pid) -Force -ErrorAction Stop
 $stopped=$true
 for($i=0;$i -lt 50;$i++){
  if(-not(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Milliseconds 300
 }
 if(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue){throw 'WORKER_PORT_8792_NOT_RELEASED'}
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher
 if($LASTEXITCODE -ne 0){throw 'WORKER_RESTART_FAILED'}
 $after=Invoke-RestMethod "$workerBase/api/status" -TimeoutSec 20
 if($after.application -ne 'Fun Industrial Autonomous Workers' -or $after.state -ne 'running' -or -not $after.pid){throw 'WORKER_RESTART_NOT_VERIFIED'}
 $newPid=[int]$after.pid
 $proxy=Invoke-RestMethod "$base/api/autonomy/opportunities" -TimeoutSec 20
 if($proxy.scope -ne 'United States'){throw 'OPPORTUNITY_PROXY_UNAVAILABLE'}
 $status=Invoke-RestMethod "$base/api/status" -TimeoutSec 20
 if($status.application -ne 'Fun Industrial Platform'){throw 'PRIMARY_PLATFORM_DROPPED'}
 Write-Host "GSA_PARSER_REPAIR=PASS WORKER_PID=$newPid DASHBOARD_PRESERVED=TRUE"
 Write-Host "BACKUP=$backupDir"
 Write-Host 'GSA_SCHEDULED_FEED_REQUIRES_PERSONAL_GSA_API_KEY'
 Write-Host 'ONE_TIME_DEMO_PREVIEW= node autonomy-v2\GSA-Live-Preview.mjs'
}catch{
 $reason=$_.Exception.Message
 Write-Warning "GSA_PARSER_REPAIR_FAILED=$reason"
 if($newPid -gt 0){
  $p=Get-CimInstance Win32_Process -Filter "ProcessId=$newPid" -ErrorAction SilentlyContinue
  if($p -and $p.CommandLine -match 'autonomy-v2-github.*service\.mjs'){Stop-Process -Id $newPid -Force -ErrorAction SilentlyContinue}
 }
 Copy-Item (Join-Path $backupDir 'domestic.mjs') $dest -Force
 if($stopped){
  for($i=0;$i -lt 40;$i++){
   if(-not(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue)){break}
   Start-Sleep -Milliseconds 300
  }
  if(-not(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue)){
   try{
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher
    Write-Warning 'PREVIOUS_WORKER_RESTART_ATTEMPTED'
   }catch{Write-Warning "MANUAL_WORKER_RECOVERY_REQUIRED_FROM=$backupDir"}
  }
 }
 throw "GSA_PARSER_REPAIR_NOT_QUALIFIED=$reason"
}
