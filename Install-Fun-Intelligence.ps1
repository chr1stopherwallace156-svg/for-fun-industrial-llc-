# Fun Industrial situational engine (json-rules-engine) + keyless local Cognee.
# Additive changes only. Leaves retired sourcing, REA, Sidequest and llama.cpp untouched.
[CmdletBinding()]
param(
 [switch]$InstallCognee,
 [switch]$EnableMemoryWrites,
 [string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation'
)
$ErrorActionPreference='Stop'
$src=[IO.Path]::GetFullPath($PSScriptRoot)
$Root=[IO.Path]::GetFullPath($Root)
if($Root -ne (Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation')){throw 'WRONG_PLATFORM_ROOT_HOLD'}
if($EnableMemoryWrites -and -not $InstallCognee){throw 'ENABLE_MEMORY_WRITES_REQUIRES_COGNEE_INSTALL'}
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
 (Join-Path $src 'cognee\requirements-local.txt'),
 (Join-Path $src 'scripts\patch-local-intelligence.mjs'),
 (Join-Path $src 'test\intelligence.test.mjs'),
 (Join-Path $src 'test\intelligence-patcher.test.mjs')
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
foreach($file in @('memory_bridge.py','requirements-local.txt')){Copy-Item (Join-Path $src "cognee\$file") (Join-Path $stagedPy $file)}
foreach($file in @('intelligence.test.mjs','intelligence-patcher.test.mjs')){Copy-Item (Join-Path $src "test\$file") (Join-Path $tests $file)}
Copy-Item (Join-Path $src 'scripts\patch-local-intelligence.mjs') $patcher
& $node $patcher $target $stagedServer;CmdOkay 'SOURCE_PATCH_FAILED'
foreach($js in @($stagedServer,(Join-Path $stagedInt 'rules.mjs'),(Join-Path $stagedInt 'memory.mjs'),$patcher)){
 & $node --check $js;CmdOkay "JS_SYNTAX_HOLD=$js"
}
Write-Host 'INSTALLING_PINNED_RULES_PACKAGE_TO_ISOLATED_STAGING_DIRECTORY'
& $npm install --prefix $stagedInt --ignore-scripts --no-audit --no-fund --save-exact;CmdOkay 'JSON_RULES_ENGINE_NPM_INSTALL_HOLD'
& $node --test (Join-Path $tests 'intelligence.test.mjs') (Join-Path $tests 'intelligence-patcher.test.mjs');CmdOkay 'INTELLIGENCE_TESTS_HOLD'
if($InstallCognee){
 Write-Host 'INSTALLING_COGNEE_PYTHON_CPU_EXTRAS_TO_DEDICATED_VENV'
 if(-not(Test-Path $python)){
  & py -3.12 -m venv (Join-Path $memoryRoot 'venv');CmdOkay 'PYTHON_312_VENV_HOLD'
 }
 & $python -m pip install --disable-pip-version-check -r (Join-Path $stagedPy 'requirements-local.txt')
 CmdOkay 'COGNEE_PIP_INSTALL_HOLD'
 & $python -c 'import cognee;print("COGNEE_PYTHON_IMPORT=PASS")'
 CmdOkay 'COGNEE_IMPORT_HOLD'
}else{Write-Host 'COGNEE=ADAPTER_STAGED INSTALLATION_DEFERRED'}
$settings=@{enabled=[bool]$InstallCognee;writesEnabled=[bool]$EnableMemoryWrites;automaticIngestion=$false;dataset='fun_industrial_operator_memory'}
$settings|ConvertTo-Json -Depth 4|Set-Content (Join-Path $stagedInt 'settings.json') -Encoding UTF8
try{
 Copy-Item -LiteralPath $stagedInt -Destination $modules -Recurse -ErrorAction Stop
 Copy-Item -LiteralPath $stagedPy -Destination $cogneeFiles -Recurse -ErrorAction Stop
 Copy-Item -LiteralPath $stagedServer -Destination $target -Force -ErrorAction Stop
 $changed=$true
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
 $result=$null
 for($i=0;$i -lt 55;$i++){
  Start-Sleep -Milliseconds 650
  $newUI.Refresh();if($newUI.HasExited){throw 'INTELLIGENCE_DASHBOARD_PROCESS_EXITED'}
  try{$result=Invoke-RestMethod "$base/api/intelligence/status" -TimeoutSec 3;if($result.rules.engine -eq 'json-rules-engine'){break}}catch{}
 }
 if(-not $result -or $result.rules.engine -ne 'json-rules-engine'){throw 'INTELLIGENCE_STATUS_NOT_READY'}
 if($InstallCognee -and -not $result.memory.enabled){throw 'COGNEE_NOT_ENABLED_AFTER_INSTALL'}
 $sample='{"mode":"propose","risk_level":"low","source_trusted":true,"context_complete":true,"service_ready":true,"evidence_verified":true,"emergency_stop":false}'
 $decision=Invoke-RestMethod "$base/api/intelligence/evaluate" -Method POST -ContentType 'application/json' -Body $sample -TimeoutSec 15
 if($decision.decision -ne 'PROPOSE_FOR_OPERATOR_REVIEW' -or $decision.executeAuthorized -ne $false){throw 'RULE_DECISION_TEST_HOLD'}
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
  }catch{Write-Warning "MANUAL_RESTART_REQUIRED_BACKUP=$backup"}
 }
 throw "INTELLIGENCE_DEPLOY_HOLD=$reason BACKUP=$backup"
}
