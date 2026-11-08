# Fun Industrial situational engine (json-rules-engine) + keyless local Cognee.
# Additive changes only. Leaves retired sourcing, REA, Sidequest and llama.cpp untouched.
[CmdletBinding()]
param(
 [switch]$InstallCognee,
 [switch]$EnableMemoryWrites,
 [switch]$SkipCogneePip,
 [string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation'
)
$ErrorActionPreference='Stop'
$src=[IO.Path]::GetFullPath($PSScriptRoot)
$Root=[IO.Path]::GetFullPath($Root)
if($Root -ne (Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation')){throw 'WRONG_PLATFORM_ROOT_HOLD'}
if($EnableMemoryWrites -and -not $InstallCognee){throw 'ENABLE_MEMORY_WRITES_REQUIRES_COGNEE_INSTALL'}
if($SkipCogneePip -and -not $InstallCognee){throw 'SKIP_COGNEE_PIP_REQUIRES_INSTALL_COGNEE'}
$node=(Get-Command node.exe -ErrorAction Stop).Source
$npm=(Get-Command npm.cmd -ErrorAction Stop).Source
$ps=(Get-Command powershell.exe -ErrorAction Stop).Source
$base='http://127.0.0.1:8789';$worker='http://127.0.0.1:8792'
$target=Join-Path $Root 'src\server.mjs'
$modules=Join-Path $Root 'src\intelligence'
$cogneeFiles=Join-Path $Root 'cognee'
$memoryRoot=Join-Path $env:LOCALAPPDATA 'FunIndustrial\CognitiveMemory'
$python=Join-Path $memoryRoot 'venv\Scripts\python.exe'
$logs=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\IntelligenceBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$stage=Join-Path $backup 'stage'
$stagedInt=Join-Path $stage 'src\intelligence'
$stagedPy=Join-Path $stage 'cognee'
$tests=Join-Path $stage 'test'
$patcher=Join-Path $stage 'scripts\patch-local-intelligence.mjs'
$stagedServer=Join-Path $stage 'src\server.mjs'
$changed=$false;$oldStopped=$false;$newUI=$null
function CmdOkay([string]$context){if($LASTEXITCODE -ne 0){throw "$context EXIT_CODE=$LASTEXITCODE"}}
function Listener([int]$port){
 $conn=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|Where-Object {$_.LocalAddress -eq '127.0.0.1'})
 if($conn.Count -ne 1){throw "PORT_IDENTITY_HOLD=$port COUNT=$($conn.Count)"}
 $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$($conn[0].OwningProcess)" -ErrorAction Stop
 if(-not $proc -or $proc.Name -ne 'node.exe' -or $proc.CommandLine -notmatch 'src[/\\]server\.mjs'){throw "PROCESS_IDENTITY_HOLD=$port"}
 return $proc
}
function Gone([string]$url){
 try{$response=Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop;$status=[int]$response.StatusCode}
 catch{if($_.Exception.Response){$status=[int]$_.Exception.Response.StatusCode}else{throw}}
 if($status -ne 410){throw "RETIRED_SOURCING_ROUTE_CHANGED=$url CODE=$status"}
}
foreach($path in @(
 $target,
 (Join-Path $src 'src\intelligence\rules.mjs'),
 (Join-Path $src 'src\intelligence\memory.mjs'),
 (Join-Path $src 'src\intelligence\package.json'),
 (Join-Path $src 'cognee\memory_bridge.py'),
 (Join-Path $src 'cognee\probe_local.py'),
 (Join-Path $src 'cognee\requirements-local.txt'),
 (Join-Path $src 'scripts\patch-local-intelligence.mjs'),
 (Join-Path $src 'intelligence-checks\situational-case.mjs'),
 (Join-Path $src 'intelligence-checks\patcher-case.mjs')
)){if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw "SOURCE_PREREQUISITE_MISSING=$path"}}
if(Test-Path $modules){throw 'INTELLIGENCE_ALREADY_INSTALLED_HOLD'}
if(Test-Path $cogneeFiles){throw 'COGNEE_PLATFORM_DIRECTORY_ALREADY_EXISTS_HOLD'}
$actual=[IO.File]::ReadAllText($target)
if(-not $actual.Contains('FI_SOURCING_RETIRED_V1')){throw 'SOURCING_RETIREMENT_REQUIRED'}
if($actual.Contains('FI_LOCAL_INTELLIGENCE_V1')){throw 'INTELLIGENCE_ALREADY_ACTIVE'}
$before=Invoke-RestMethod "$base/api/status" -TimeoutSec 20
if($before.application -ne 'Fun Industrial Platform'){throw 'MAIN_PLATFORM_UNAVAILABLE'}
$original=Listener 8789
$reaTools=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 45).tools)
$unified=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 25
if($reaTools.Count -ne 229 -or [int]$unified.rea_enabled -ne 229){throw 'REA_229_SCOPE_HOLD'}
Gone "$base/api/autonomy/opportunities"
Gone "$base/api/autonomy/international"
Gone "$worker/api/opportunities"
Gone "$worker/api/international"
New-Item -ItemType Directory -Path @($stagedInt,$stagedPy,$tests,(Join-Path $stage 'scripts'),(Join-Path $stage 'src'),$logs) -Force|Out-Null
Copy-Item -LiteralPath $target -Destination (Join-Path $backup 'original-server.mjs') -ErrorAction Stop
foreach($file in @('rules.mjs','memory.mjs','package.json')){Copy-Item (Join-Path $src "src\intelligence\$file") (Join-Path $stagedInt $file)}
foreach($file in @('memory_bridge.py','probe_local.py','requirements-local.txt')){Copy-Item (Join-Path $src "cognee\$file") (Join-Path $stagedPy $file)}
foreach($file in @('situational-case.mjs','patcher-case.mjs')){Copy-Item (Join-Path $src "intelligence-checks\$file") (Join-Path $tests $file)}
Copy-Item (Join-Path $src 'scripts\patch-local-intelligence.mjs') $patcher
& $node $patcher $target $stagedServer;CmdOkay 'SOURCE_PATCH_FAILED'
foreach($js in @($stagedServer,(Join-Path $stagedInt 'rules.mjs'),(Join-Path $stagedInt 'memory.mjs'),$patcher)){
 & $node --check $js;CmdOkay "JS_SYNTAX_HOLD=$js"
}
Write-Host 'INSTALLING_PINNED_RULES_PACKAGE_TO_ISOLATED_STAGING_DIRECTORY'
& $npm install --prefix $stagedInt --ignore-scripts --no-audit --no-fund --save-exact;CmdOkay 'JSON_RULES_ENGINE_NPM_INSTALL_HOLD'
& $node --test (Join-Path $tests 'situational-case.mjs') (Join-Path $tests 'patcher-case.mjs');CmdOkay 'INTELLIGENCE_TESTS_HOLD'
if($InstallCognee){
 if($SkipCogneePip){
  if(-not(Test-Path -LiteralPath $python -PathType Leaf)){throw 'EXISTING_COGNEE_VENV_REQUIRED'}
  Write-Host 'COGNEE_PIP=SKIPPED_EXISTING_PYTHON_PACKAGES_REUSED'
 }else{
  Write-Host 'INSTALLING_COGNEE_PYTHON_CPU_EXTRAS_TO_DEDICATED_VENV'
  if(-not(Test-Path $python)){
   & py -3.12 -m venv (Join-Path $memoryRoot 'venv');CmdOkay 'PYTHON_312_VENV_HOLD'
  }
  & $python -m pip install --disable-pip-version-check -r (Join-Path $stagedPy 'requirements-local.txt')
  CmdOkay 'COGNEE_PIP_INSTALL_HOLD'
 }
 # Cognee import is performed with isolated paths and no model downloads.
 # Any Python traceback goes to this terminal BEFORE live files are changed.
 $env:FI_COGNEE_ROOT=$memoryRoot
 try{
  Write-Host 'COGNEE_IMPORT_DIAGNOSTIC=START NO_PIP NO_MODEL_DOWNLOAD'
  & $python -I (Join-Path $stagedPy 'probe_local.py')
  CmdOkay 'COGNEE_IMPORT_DIAGNOSTIC_HOLD'
 }finally{
  Remove-Item Env:FI_COGNEE_ROOT -ErrorAction SilentlyContinue
 }
}else{Write-Host 'COGNEE=ADAPTER_STAGED INSTALLATION_DEFERRED'}
$settings=@{enabled=[bool]$InstallCognee;writesEnabled=[bool]$EnableMemoryWrites;automaticIngestion=$false;dataset='fun_industrial_operator_memory'}
# Use UTF-8 without BOM; old PowerShell 5.1 Set-Content -Encoding UTF8 emits
# a BOM that JSON.parse does not accept without an explicit decoder.
$settingsJson=ConvertTo-Json -InputObject $settings -Depth 4
[IO.File]::WriteAllText((Join-Path $stagedInt 'settings.json'),$settingsJson,[Text.UTF8Encoding]::new($false))
try{
 # Even partial copy must trigger rollback; set before the first live write.
 $changed=$true
 Copy-Item -LiteralPath $stagedInt -Destination $modules -Recurse -ErrorAction Stop
 Copy-Item -LiteralPath $stagedPy -Destination $cogneeFiles -Recurse -ErrorAction Stop
 Copy-Item -LiteralPath $stagedServer -Destination $target -Force -ErrorAction Stop
 Write-Host "INTELLIGENCE_INSTALLED=STAGED BACKUP=$backup"
 Stop-Process -Id ([int]$original.ProcessId) -ErrorAction Stop;$oldStopped=$true
 for($i=0;$i -lt 40;$i++){
  if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Milliseconds 250
 }
 if(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue){throw '8789_PORT_RELEASE_HOLD'}
 $env:HOST='127.0.0.1';$env:PORT='8789'
 $env:REA_ALLOWED_TOOLS=($reaTools|ForEach-Object {$_.name}) -join ','
 $newUI=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logs 'intelligence.stdout.log') -RedirectStandardError (Join-Path $logs 'intelligence.stderr.log')
 $result=$null;$lastStatusError='none'
 for($i=0;$i -lt 55;$i++){
  Start-Sleep -Milliseconds 650
  $newUI.Refresh();if($newUI.HasExited){throw 'INTELLIGENCE_DASHBOARD_PROCESS_EXITED'}
  try{
   $result=Invoke-RestMethod "$base/api/intelligence/status" -TimeoutSec 5 -ErrorAction Stop
   if($result.rules.engine -eq 'json-rules-engine'){break}
   $lastStatusError='STATUS_RESPONSE_MISSING_EXPECTED_ENGINE'
  }catch{
   $lastStatusError=([string]$_.Exception.Message).Substring(0,[math]::Min(300,([string]$_.Exception.Message).Length))
  }
 }
 if(-not $result -or $result.rules.engine -ne 'json-rules-engine'){
  Write-Warning "INTELLIGENCE_STATUS_LAST_ERROR=$lastStatusError"
  Write-Warning "INTELLIGENCE_STDERR_LOG=$(Join-Path $logs 'intelligence.stderr.log')"
  throw 'INTELLIGENCE_STATUS_NOT_READY'
 }
 if($InstallCognee -and -not $result.memory.enabled){throw 'COGNEE_NOT_ENABLED_AFTER_INSTALL'}
 $sample='{"mode":"propose","risk_level":"low","source_trusted":true,"context_complete":true,"service_ready":true,"evidence_verified":true,"emergency_stop":false}'
 Write-Host 'INTELLIGENCE_STATUS=PASS MEMORY_CONFIGURATION_VERIFIED'
 $decision=Invoke-RestMethod "$base/api/intelligence/evaluate" -Method POST -ContentType 'application/json' -Body $sample -TimeoutSec 15
 if($decision.decision -ne 'PROPOSE_FOR_OPERATOR_REVIEW' -or $decision.executeAuthorized -ne $false){throw 'RULE_DECISION_TEST_HOLD'}
 Write-Host 'INTELLIGENCE_DETERMINISTIC_RULES=PASS NO_TOOL_EXECUTION'
 # REA's MCP child belongs to the old dashboard process. A 8789 restart
 # loses the in-memory MCP handshake even when the env allowlist is preserved.
 # Only restore REA catalog on the pre-existing /api/rea/start route.
 # Never invoke /api/start or /api/activate (they can affect compute/AI/VPN).
 Write-Host 'REA_READ_ONLY_CATALOG_RECONNECT=START'
 $reaRestored=$null
 try{
  $reaRestored=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120 -ErrorAction Stop
 }catch{
  $code=if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{'NO_HTTP_RESPONSE'}
  throw "REA_CATALOG_RECONNECT_HTTP_HOLD=$code"
 }
 if($reaRestored.state -ne 'ready'){throw "REA_CATALOG_RECONNECT_STATE_HOLD=$($reaRestored.state)"}
 Write-Host 'REA_READ_ONLY_CATALOG_RECONNECT=PASS TOOLS_CALL=NOT_PERFORMED'
 $afterTools=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 45).tools)
 $afterUnified=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 20
 if($afterTools.Count -ne 229 -or [int]$afterUnified.rea_enabled -ne 229){throw 'REA_REGRESSION_HOLD'}
 Gone "$base/api/autonomy/opportunities";Gone "$base/api/autonomy/international"
 Gone "$worker/api/opportunities";Gone "$worker/api/international"
 Write-Host "FUN_INTELLIGENCE=PASS JSON_RULES_ENGINE=7.3.1 COGNEE=$(if($InstallCognee){'INSTALLED'}else{'OPTIONAL'})"
 Write-Host "MEMORY_ENABLED=$($result.memory.enabled) WRITES_ENABLED=$($result.memory.writesEnabled) AUTO_INGESTION=FALSE"
 Write-Host "REA_TOOL_COUNT=$($afterTools.Count) REA_ENABLED=$($afterUnified.rea_enabled) SOURCING_RETIRED=TRUE"
 Write-Host "DASHBOARD=$base/ INTELLIGENCE_STATUS=$base/api/intelligence/status BACKUP=$backup"
 Write-Host 'COGNEE_FIRST_REMEMBER_CAN_DOWNLOAD_LARGE_LOCAL_MODELS; NO MEMORY SEED PERFORMED'
}catch{
 $reason=$_.Exception.Message
 Write-Warning "INTELLIGENCE_INSTALL=HOLD REASON=$reason"
 if($newUI){$newUI.Refresh();if(-not $newUI.HasExited){Stop-Process -Id $newUI.Id -Force -ErrorAction SilentlyContinue}}
 if($changed){
  Copy-Item (Join-Path $backup 'original-server.mjs') $target -Force
  Remove-Item $modules -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $cogneeFiles -Recurse -Force -ErrorAction SilentlyContinue
 }
 if($oldStopped){
  try{
   $restore=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logs 'intelligence-rollback.stdout.log') -RedirectStandardError (Join-Path $logs 'intelligence-rollback.stderr.log')
   Write-Warning "PREVIOUS_PLATFORM_RESTART_ATTEMPTED_PID=$($restore.Id)"
   $restoreOnline=$false
   for($i=0;$i -lt 30;$i++){
    Start-Sleep -Milliseconds 700
    $restore.Refresh()
    if($restore.HasExited){break}
    try{
     if((Invoke-RestMethod "$base/api/status" -TimeoutSec 4 -ErrorAction Stop).application -eq 'Fun Industrial Platform'){$restoreOnline=$true;break}
    }catch{}
   }
   if($restoreOnline){
    try{
     $restoreRea=Invoke-RestMethod "$base/api/rea/start" -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 120 -ErrorAction Stop
     if($restoreRea.state -eq 'ready'){
      $restoreTools=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools)
      if($restoreTools.Count -eq $reaTools.Count){Write-Warning 'PREVIOUS_PLATFORM_REA_CATALOG_RESTORED=PASS'}
      else{Write-Warning "PREVIOUS_PLATFORM_REA_SCOPE_RECHECK_REQUIRED=$($restoreTools.Count)"}
     }else{Write-Warning "PREVIOUS_PLATFORM_REA_RECOVERY_HOLD=$($restoreRea.state)"}
    }catch{Write-Warning "PREVIOUS_PLATFORM_REA_RECOVERY_HOLD=$($_.Exception.Message)"}
   }else{Write-Warning 'PREVIOUS_PLATFORM_STARTUP_HEALTH_UNCONFIRMED'}
  }catch{Write-Warning "MANUAL_RESTART_REQUIRED_BACKUP=$backup"}
 }
 throw "INTELLIGENCE_DEPLOY_HOLD=$reason BACKUP=$backup"
}
