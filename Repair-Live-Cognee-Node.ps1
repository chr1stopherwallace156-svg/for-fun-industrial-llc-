# Repair only the deployed Fun Industrial Cognee Node adapter (8789).
# No Python package install, no Ollama, no REA tools/call, no broad activation.
# Requires a known original file hash, a verified listener, and 229 REA tools.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$Root=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$source=Join-Path $PSScriptRoot 'src\intelligence\memory.mjs'
$target=Join-Path $Root 'src\intelligence\memory.mjs'
$testFile=Join-Path $PSScriptRoot 'intelligence-checks\memory-bridge-settle-case.mjs'
$server=Join-Path $Root 'src\server.mjs'
$base='http://127.0.0.1:8789'
$backupDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\MemoryBridgeRepairBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$oldHash='852ee00ac535536f3a91828c01383143d8c8461a0c16a4fc9962bc24235bbd6b'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$changed=$false;$oldStopped=$false;$newUI=$null;$previousTools=@()
function CmdOkay([string]$label){if($LASTEXITCODE -ne 0){throw "$label EXIT_CODE=$LASTEXITCODE"}}
function Listener(){
 $conns=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalAddress -eq '127.0.0.1'})
 if($conns.Count -ne 1){throw "8789_LISTENER_IDENTITY_HOLD COUNT=$($conns.Count)"}
 $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$($conns[0].OwningProcess)" -ErrorAction Stop
 if(-not $proc -or $proc.Name -ne 'node.exe' -or $proc.CommandLine -notmatch 'src[/\\]server\.mjs'){throw '8789_NODE_SERVER_IDENTITY_HOLD'}
 return $proc
}
function CheckGone([string]$url){
 try{$web=Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop;$code=[int]$web.StatusCode}
 catch{if($_.Exception.Response){$code=[int]$_.Exception.Response.StatusCode}else{throw}}
 if($code -ne 410){throw "RETIRED_SOURCING_REGRESSION=$url HTTP=$code"}
}
function StartDashboard([string]$out,[string]$err){
 $env:HOST='127.0.0.1';$env:PORT='8789'
 $env:REA_ALLOWED_TOOLS=($previousTools|ForEach-Object {$_.name}) -join ','
 return Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
}
function Ready([System.Diagnostics.Process]$process){
 for($i=0;$i -lt 45;$i++){
  Start-Sleep -Milliseconds 700
  $process.Refresh()
  if($process.HasExited){return $false}
  try{
   $check=Invoke-RestMethod "$base/api/intelligence/status" -TimeoutSec 4 -ErrorAction Stop
   if($check.rules.engine -eq 'json-rules-engine' -and $check.memory.enabled -eq $true){
    $listener=Listener
    if([int]$listener.ProcessId -ne $process.Id){throw 'UNEXPECTED_8789_LISTENER_PID'}
    return $true
   }
  }catch{}
 }
 return $false
}
foreach($item in @($source,$target,$testFile,$server)){if(-not(Test-Path -LiteralPath $item -PathType Leaf)){throw "REPAIR_PREREQUISITE_MISSING=$item"}}
$serverSource=[IO.File]::ReadAllText($server)
if(-not $serverSource.Contains('FI_LOCAL_INTELLIGENCE_V1') -or -not $serverSource.Contains('FI_SOURCING_RETIRED_V1')){throw 'EXPECTED_INTELLIGENCE_AND_RETIREMENT_MARKERS_MISSING'}
$liveHash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
$newHash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
if($liveHash -eq $newHash){throw 'REPAIRED_FILE_ALREADY_DEPLOYED_HOLD_AVOID_DOUBLE_RESTART'}
if($liveHash -ne $oldHash){throw "DEPLOYED_MEMORY_MODULE_DRIFT_HOLD HASH=$liveHash"}
$sourceText=[IO.File]::ReadAllText($source)
if(-not $sourceText.Contains('settleMemoryBridgeResult(finish,action,code,data)')){throw 'SOURCE_FIX_NOT_PRESENT_HOLD'}
if(-not $sourceText.Contains('return finish(null,{engine:"cognee",action,...data});')){throw 'SUCCESS_RESOLUTION_FIX_NOT_PRESENT_HOLD'}
& $node --check $source;CmdOkay 'SOURCE_JS_SYNTAX_HOLD'
& $node --test $testFile;CmdOkay 'BRIDGE_SETTLEMENT_TEST_HOLD'
$before=Invoke-RestMethod "$base/api/status" -TimeoutSec 20
if($before.application -ne 'Fun Industrial Platform'){throw 'FUN_PLATFORM_NOT_RUNNING'}
$original=Listener
$intelligence=Invoke-RestMethod "$base/api/intelligence/status" -TimeoutSec 15
if($intelligence.memory.enabled -ne $true -or $intelligence.rules.engine -ne 'json-rules-engine'){throw 'INTELLIGENCE_PRECONDITION_HOLD'}
$previousTools=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 45).tools)
$unified=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 20
if($previousTools.Count -ne 229 -or [int]$unified.rea_enabled -ne 229){throw "REA_SCOPE_PRECHECK_HOLD COUNT=$($previousTools.Count)"}
CheckGone "$base/api/autonomy/opportunities"
CheckGone "$base/api/autonomy/international"
$activeBridge=@(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like '*memory_bridge.py*'})
if($activeBridge.Count){throw 'ACTIVE_COGNEE_BRIDGE_PROCESS_HOLD_NO_RESTART'}
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$originalPath=Join-Path $backupDir 'original-memory.mjs'
Copy-Item -LiteralPath $target -Destination $originalPath -ErrorAction Stop
Write-Host "COGNEE_NODE_FIX_PREFLIGHT=PASS EXISTING_REA=229 BACKUP=$backupDir"
try{
 Copy-Item -LiteralPath $source -Destination $target -Force -ErrorAction Stop
 $changed=$true
 if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $newHash){throw 'PATCH_HASH_VERIFY_HOLD'}
 Stop-Process -Id ([int]$original.ProcessId) -ErrorAction Stop
 $oldStopped=$true
 for($i=0;$i -lt 40;$i++){
  if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Milliseconds 250
 }
 if(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue){throw 'PORT_8789_NOT_RELEASED'}
 $newUI=StartDashboard (Join-Path $backupDir 'patched.stdout.log') (Join-Path $backupDir 'patched.stderr.log')
 if(-not(Ready $newUI)){throw 'PATCHED_DASHBOARD_STARTUP_HOLD'}
 Write-Host 'PATCHED_DASHBOARD=PASS'
 $rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 120 -ErrorAction Stop
 if($rea.state -ne 'ready'){throw "REA_CATALOG_RESTORE_HOLD=$($rea.state)"}
 $tools=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools)
 $unified=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 25
 if($tools.Count -ne 229 -or [int]$unified.rea_enabled -ne 229){throw 'REA_229_RECHECK_HOLD'}
 CheckGone "$base/api/autonomy/opportunities"
 CheckGone "$base/api/autonomy/international"
 Write-Host 'REA_CATALOG=PASS COUNT=229 TOOLS_EXECUTED=0 SOURCING_RETIRED=TRUE'
 # Read-only recall: no new remember; log only count/matching marker, not data.
 $query='Fun Industrial requires operator approval before executing external tools.'
 $body=@{query=$query}|ConvertTo-Json -Compress
 $retrieved=Invoke-RestMethod "$base/api/intelligence/memory/recall" -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 245 -ErrorAction Stop
 if($retrieved.ok -ne $true -or $retrieved.state -ne 'retrieved'){throw 'MEMORY_RECALL_RESPONSE_INVALID'}
 $items=@();if($null -ne $retrieved.results){$items=@($retrieved.results)}
 $noteMatch=($items|Where-Object {[string]$_ -like '*Fun Industrial requires operator approval before executing external tools*'}).Count -gt 0
 Write-Host "COGNEE_NODE_MEMORY_FIX=PASS HTTP_RECALL=200 RESULT_COUNT=$($items.Count) ORIGINAL_NOTE_TEXT_MATCH=$noteMatch"
 Write-Host 'MEMORY_WRITES=0 PIP_INSTALLS=0 MODEL_DOWNLOADS_REQUESTED=0'
 Write-Host "BACKUP=$backupDir"
}catch{
 $reason=$_.Exception.Message
 Write-Warning "COGNEE_NODE_FIX=HOLD REASON=$reason"
 if($newUI){$newUI.Refresh();if(-not $newUI.HasExited){Stop-Process -Id $newUI.Id -Force -ErrorAction SilentlyContinue}}
 if($changed){Copy-Item -LiteralPath $originalPath -Destination $target -Force -ErrorAction Stop;Write-Warning 'MEMORY_MODULE_ROLLBACK=RESTORED'}
 if($oldStopped){
  try{
   $restore=StartDashboard (Join-Path $backupDir 'rollback.stdout.log') (Join-Path $backupDir 'rollback.stderr.log')
   if(Ready $restore){
    Write-Warning "PREVIOUS_DASHBOARD_RESTORED=PASS PID=$($restore.Id)"
    try{
     $rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 120 -ErrorAction Stop
     $cnt=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools).Count
     Write-Warning "PREVIOUS_REA_REINITIALIZATION=$($rea.state) TOOLS=$cnt"
    }catch{Write-Warning "PREVIOUS_REA_REINITIALIZATION_HOLD=$($_.Exception.Message)"}
   }else{Write-Warning 'PREVIOUS_DASHBOARD_RESTART_UNCONFIRMED'}
  }catch{Write-Warning "ROLLBACK_RESTART_HOLD=$($_.Exception.Message)"}
 }
 throw "COGNEE_NODE_MEMORY_FIX_HOLD=$reason BACKUP=$backupDir"
}
