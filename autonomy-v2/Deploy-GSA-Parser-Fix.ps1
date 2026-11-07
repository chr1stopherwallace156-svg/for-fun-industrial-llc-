# Live GSA schema patch only: update one internal worker module with backup/rollback.
# No changes to 8789 code, REA, Qwen, NetBird, credentials, or auction bidding.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'src\domestic.mjs'
$tests=Join-Path $PSScriptRoot 'test\domestic.test.mjs'
$runtime=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github'
$target=Join-Path $runtime 'src\domestic.mjs'
$startup=Join-Path $runtime 'Start.ps1'
$node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($f in @($source,$tests,$target,$startup)){
 if(-not(Test-Path $f -PathType Leaf)){throw "GSA_PATCH_PREREQUISITE_MISSING=$f"}
}
& $node --check $source
if($LASTEXITCODE -ne 0){throw 'GSA_SOURCE_SYNTAX_HOLD'}
& $node --test $tests
if($LASTEXITCODE -ne 0){throw 'GSA_PARSER_TESTS_HOLD'}
$old=Invoke-RestMethod 'http://127.0.0.1:8792/api/status' -TimeoutSec 15
if($old.application -ne 'Fun Industrial Autonomous Workers' -or $old.state -ne 'running'){throw 'AUTONOMY_PROCESS_NOT_READY'}
$pidNumber=[int]$old.pid
$process=Get-CimInstance Win32_Process -Filter "ProcessId=$pidNumber" -ErrorAction Stop
if($process.Name -ne 'node.exe' -or $process.CommandLine -notmatch 'autonomy-v2-github.*service\.mjs'){throw 'REFUSE_TO_RESTART_UNKNOWN_PROCESS'}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutonomyLab\GSAParserBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
Copy-Item -LiteralPath $target -Destination (Join-Path $backup 'domestic.mjs')
$stopped=$false
try{
 Write-Host "STOPPING_AUTONOMY_WORKER_ONLY_PID=$pidNumber"
 Stop-Process -Id $pidNumber -ErrorAction Stop
 $stopped=$true
 for($i=0;$i -lt 45;$i++){if(-not(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 350}
 if(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue){throw 'AUTONOMY_PORT_8792_BUSY'}
 Copy-Item -LiteralPath $source -Destination $target -Force
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startup
 if($LASTEXITCODE -ne 0){throw 'WORKER_RESTART_FAILED'}
 $next=Invoke-RestMethod 'http://127.0.0.1:8792/api/status' -TimeoutSec 20
 if($next.application -ne 'Fun Industrial Autonomous Workers' -or $next.state -ne 'running'){throw 'WORKER_RESTART_NOT_VERIFIED'}
 $proxy=Invoke-RestMethod 'http://127.0.0.1:8789/api/autonomy/status' -TimeoutSec 20
 if($proxy.state -ne 'running' -or [int]$proxy.pid -ne [int]$next.pid){throw 'DASHBOARD_AUTONOMY_PROXY_NOT_READY'}
 Write-Host "GSA_LIVE_SCHEMA_PATCH=PASS WORKER_PID=$($next.pid) DASHBOARD=8789"
 Write-Host "BACKUP=$backup"
 Write-Host 'PERSONAL_GSA_KEY_NOT_CONFIGURED_BY_THIS_PATCH'
 Write-Host 'TEST_LIVE_FEED_WITH=Preview-GSA-Live.mjs'
}catch{
 $reason=$_.Exception.Message
 Write-Warning "GSA_LIVE_SCHEMA_PATCH_HOLD=$reason"
 if($stopped){
  try{
   $live=Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1
   if($live){
    $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($live.OwningProcess)" -ErrorAction SilentlyContinue
    if($p -and $p.CommandLine -match 'autonomy-v2-github.*service\.mjs'){Stop-Process -Id $p.ProcessId -ErrorAction SilentlyContinue}
   }
   for($i=0;$i -lt 40;$i++){if(-not(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 300}
   Copy-Item -LiteralPath (Join-Path $backup 'domestic.mjs') -Destination $target -Force
   if(-not(Get-NetTCPConnection -LocalPort 8792 -State Listen -ErrorAction SilentlyContinue)){
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startup
    Write-Warning 'PREVIOUS_WORKER_RESTART_ATTEMPTED'
   }else{Write-Warning 'WORKER_PORT_BUSY_RECOVERY_REQUIRES_REVIEW'}
  }catch{Write-Warning "MANUAL_RECOVERY_REQUIRED_FROM=$backup"}
 }
 throw "GSA_PATCH_NOT_QUALIFIED=$reason BACKUP=$backup"
}
