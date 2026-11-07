# In-place GSA camelCase adapter upgrade for an ALREADY DEPLOYED U.S. Opportunity Intelligence V1.
# Safely restarts only the Sidequest worker on 8792; preserves the 8789 dashboard and REA.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$sourceRoot=[IO.Path]::GetFullPath($PSScriptRoot)
$src=Join-Path $sourceRoot 'src\domestic.mjs'
$tests=Join-Path $sourceRoot 'test\domestic.test.mjs'
$stage=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github'
$live=Join-Path $stage 'src\domestic.mjs'
$starter=Join-Path $stage 'Start.ps1'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$power=(Get-Command powershell.exe -ErrorAction Stop).Source
$host8789='http://127.0.0.1:8789'
$worker8792='http://127.0.0.1:8792'
foreach($p in @($src,$tests,$live,$starter)){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){throw "REQUIRED_FILE_MISSING=$p"}
}
& $node --check $src
if($LASTEXITCODE -ne 0){throw 'GSA_NODE_SYNTAX_HOLD'}
& $node --test $tests
if($LASTEXITCODE -ne 0){throw 'GSA_REGRESSION_TESTS_HOLD'}
$liveStatus=Invoke-RestMethod "$host8789/api/status" -TimeoutSec 15
if($liveStatus.application -ne 'Fun Industrial Platform'){throw '8789_PLATFORM_IDENTITY_HOLD'}
$before=Invoke-RestMethod "$worker8792/api/status" -TimeoutSec 15
if($before.state -ne 'running' -or $before.application -ne 'Fun Industrial Autonomous Workers'){throw '8792_WORKER_IDENTITY_HOLD'}
$pidBefore=[int]$before.pid
$process=Get-CimInstance Win32_Process -Filter "ProcessId=$pidBefore" -ErrorAction Stop
if($process.Name -ne 'node.exe' -or $process.CommandLine -notmatch 'autonomy-v2-github.*service\.mjs'){throw 'REFUSE_UNRECOGNIZED_PROCESS'}
$oldHash=(Get-FileHash $live -Algorithm SHA256).Hash
$newHash=(Get-FileHash $src -Algorithm SHA256).Hash
if($oldHash -eq $newHash){
 Write-Host "GSA_ADAPTER=ALREADY_CURRENT WORKER_PID=$pidBefore"
 Write-Host 'DASHBOARD_8789_UNCHANGED=TRUE'
 return
}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutonomyLab\GSAPatchBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
$copy=Join-Path $backup 'domestic.mjs'
Copy-Item $live $copy -ErrorAction Stop
$changed=$false;$stopped=$false;$newPid=0
try{
 Copy-Item $src $live -Force -ErrorAction Stop
 $changed=$true
 if((Get-FileHash $live -Algorithm SHA256).Hash -ne $newHash){throw 'STAGE_HASH_MISMATCH'}
 & $node --check $live
 if($LASTEXITCODE -ne 0){throw 'STAGED_MODULE_SYNTAX_HOLD'}
 Write-Host "RESTARTING_AUTONOMY_WORKER_ONLY_PID=$pidBefore"
 Stop-Process -Id $pidBefore -Force -ErrorAction Stop
 $stopped=$true
 for($i=0;$i -lt 50;$i++){
  if(-not(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Milliseconds 300
 }
 if(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue){throw '8792_PORT_NOT_RELEASED'}
 & $power -NoProfile -ExecutionPolicy Bypass -File $starter
 if($LASTEXITCODE -ne 0){throw '8792_WORKER_RESTART_FAILED'}
 $after=Invoke-RestMethod "$worker8792/api/status" -TimeoutSec 20
 if($after.application -ne 'Fun Industrial Autonomous Workers' -or $after.state -ne 'running'){throw '8792_NEW_WORKER_HEALTH_HOLD'}
 $newPid=[int]$after.pid
 $proxy=Invoke-RestMethod "$host8789/api/autonomy/status" -TimeoutSec 15
 if($proxy.state -ne 'running' -or [int]$proxy.pid -ne $newPid){throw '8789_AUTONOMY_PROXY_HEALTH_HOLD'}
 $opps=Invoke-RestMethod "$host8789/api/autonomy/opportunities" -TimeoutSec 15
 if($opps.scope -ne 'United States'){throw '8789_OPPORTUNITY_PROXY_HOLD'}
 Write-Host "GSA_ADAPTER=PASS WORKER_PID=$newPid"
 Write-Host "GSA_PRODUCTION_KEY_PRESENT=$([bool]($env:GSA_API_KEY -and $env:GSA_API_KEY -ne 'DEMO_KEY'))"
 Write-Host 'DASHBOARD_8789_UNCHANGED=TRUE REA_UNCHANGED=TRUE SIDEQUEST_DATA_PRESERVED=TRUE'
 Write-Host "BACKUP=$backup"
 Write-Host 'A permanent GSA_API_KEY must be configured for scheduled live auction scans.'
}catch{
 $reason=$_.Exception.Message
 Write-Warning "GSA_ADAPTER_UPGRADE_FAILED=$reason"
 if($newPid -gt 0){
  $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$newPid" -ErrorAction SilentlyContinue
  if($proc -and $proc.Name -eq 'node.exe' -and $proc.CommandLine -match 'autonomy-v2-github.*service\.mjs'){
   Stop-Process -Id $newPid -Force -ErrorAction SilentlyContinue
  }
 }
 if($changed){Copy-Item $copy $live -Force -ErrorAction SilentlyContinue}
 if($stopped){
  for($i=0;$i -lt 40;$i++){
   if(-not(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue)){break}
   Start-Sleep -Milliseconds 250
  }
  if(-not(Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue)){
   try{& $power -NoProfile -ExecutionPolicy Bypass -File $starter;Write-Warning 'PREVIOUS_WORKER_RESTART_ATTEMPTED'}
   catch{Write-Warning "MANUAL_WORKER_RECOVERY_NEEDED_FROM=$backup"}
  }
 }
 throw "GSA_PATCH_NOT_QUALIFIED=$reason BACKUP=$backup"
}
