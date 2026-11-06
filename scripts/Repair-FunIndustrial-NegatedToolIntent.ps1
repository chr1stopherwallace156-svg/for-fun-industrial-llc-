# Fun Industrial targeted repair: negated execution is not tool invocation.
# PowerShell 5.1 compatible: ASCII-only, no unrelated process changes.
[CmdletBinding()]
param([string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation',[int]$Port=8789)
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$Source=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node=(Get-Command node.exe -ErrorAction Stop).Source
$npm=(Get-Command npm.cmd -ErrorAction Stop).Source
$target=Join-Path $Root 'src\unified-agent.mjs'
$testFile=Join-Path $Root 'test\code-answer-routing.test.mjs'
$sourceTest=Join-Path $Source 'test\code-answer-routing.test.mjs'
foreach($f in @($target,$sourceTest)){
 if(-not(Test-Path -LiteralPath $f -PathType Leaf)){throw "REQUIRED_FILE_MISSING=$f"}
}
if(Test-Path -LiteralPath $testFile){throw "EXISTING_TEST_PRESERVED=$testFile"}
$old=[IO.File]::ReadAllText($target)
$oldGuard=@'
  if(/\b(?:use|invoke|call|execute|run|activate)\s+(?:the\s+|an?\s+)?(?:rea(?:\s+mcp)?\s+)?(?:tool|capability|function|command|tests?\b)/i.test(query)||/\brea__[a-z0-9_]+\b/i.test(query))return route;
'@
$newGuard=@'
  // A negative instruction must not activate tools. Denial wins if ambiguous.
  const noToolExecution=/\b(?:do\s+not|don't|dont|never|without)\s+(?:(?:please|ever|try\s+to|need\s+to|attempt\s+to|any|the)\s+){0,3}(?:use|using|invoke|invoking|call|calling|execute|executing|run|running|activate|activating)\b/i.test(query)
    ||/\bno\s+(?:rea\s+)?(?:tool\s+calls?|tool\s+execution)\b/i.test(query);
  const affirmativeToolRequest=/\b(?:use|invoke|call|execute|run|activate)\s+(?:the\s+|an?\s+)?(?:rea(?:\s+mcp)?\s+)?(?:tools?|capability|function|commands?|tests?\b)/i.test(query)
    ||/\brea__[a-z0-9_]+\b/i.test(query);
  if(affirmativeToolRequest&&!noToolExecution)return route;
'@
if($old.Contains('const noToolExecution=') -or $old.Contains('const affirmativeToolRequest=')){throw 'NEGATION_FIX_ALREADY_INSTALLED_OR_CONFLICT_HOLD'}
if(([regex]::Matches($old,[regex]::Escape($oldGuard))).Count -ne 1){throw 'NEGATION_FIX_SOURCE_ANCHOR_MISMATCH'}
if(-not $old.Contains('const analysisRoute=constrainForReadOnlyCodeAnswer(last.content,route,codeContext);')){throw 'READONLY_ROUTING_BASELINE_MISSING'}
if(-not $old.Contains('code_source_complete:codeContext.source_span_complete===true')){throw 'COMPLETE_SOURCE_BASELINE_MISSING'}
$patched=$old.Replace($oldGuard,$newGuard)
if($patched -ceq $old){throw 'PATCH_NO_CHANGE'}
# Qualify candidate implementation before touching the live system.
Push-Location $Source
try{
 & $node --test 'test\code-answer-routing.test.mjs' 'test\function-span.test.mjs' 'test\code-context.test.mjs'
 if($LASTEXITCODE -ne 0){throw 'CANDIDATE_TESTS_FAILED'}
}finally{Pop-Location}
$listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop|Select-Object -First 1
if(-not $listener -or $listener.LocalAddress -notin @('127.0.0.1','::1')){throw 'LOOPBACK_LISTENER_NOT_FOUND'}
$oldProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
if(-not $oldProcess -or $oldProcess.Name -ne 'node.exe' -or $oldProcess.CommandLine -notmatch 'src[/\\]server\.mjs'){throw 'DASHBOARD_PROCESS_IDENTITY_HOLD'}
$base="http://127.0.0.1:$Port"
$baseline=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 45
if($baseline.state -ne 'ready' -or $baseline.rea_enabled -ne 229){throw "BASELINE_NOT_READY=$($baseline.state) REA=$($baseline.rea_enabled)"}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\CodingBackups\no-tool-negation-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
Copy-Item -LiteralPath $target -Destination (Join-Path $backup 'unified-agent.mjs')
$addedTest=$false
function Restore-Patch {
 Copy-Item -LiteralPath (Join-Path $backup 'unified-agent.mjs') -Destination $target -Force
 if($addedTest){Remove-Item -LiteralPath $testFile -Force -ErrorAction SilentlyContinue}
}
try{
 [IO.File]::WriteAllText($target,$patched,[Text.UTF8Encoding]::new($false))
 Copy-Item -LiteralPath $sourceTest -Destination $testFile
 $addedTest=$true
 & $node --check $target
 if($LASTEXITCODE -ne 0){throw 'PATCHED_JAVASCRIPT_INVALID'}
 Push-Location $Root
 try{
  & $npm test
  if($LASTEXITCODE -ne 0){throw 'ACTIVE_REGRESSION_FAILED'}
 }finally{Pop-Location}
}catch{
 Restore-Patch
 throw "SOURCE_QUALIFICATION_FAILED_RESTORED=$($_.Exception.Message)"
}
Write-Host "NEGATION_ROUTING_SOURCE_QUALIFIED BACKUP=$backup" -ForegroundColor Green
$env:HOST='127.0.0.1'
$env:PORT=[string]$Port
$env:FI_COGNITIVE_PYTHON='C:\Users\alxar\AppData\Local\Programs\Python\Python312\python.exe'
$envFile=Join-Path $Root '.env'
if(Test-Path -LiteralPath $envFile){
 $line=Get-Content -LiteralPath $envFile|Where-Object {$_ -match '^REA_ALLOWED_TOOLS='}|Select-Object -First 1
 if($line){$env:REA_ALLOWED_TOOLS=$line.Substring('REA_ALLOWED_TOOLS='.Length)}
}
$logDir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
New-Item -ItemType Directory -Path $logDir -Force|Out-Null
function Recover-PreviousDashboard([string]$reason) {
 if($new -and -not $new.HasExited){Stop-Process -Id $new.Id -ErrorAction SilentlyContinue}
 for($i=0;$i -lt 30;$i++){
  if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Milliseconds 500
 }
 if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){
  throw "ROLLBACK_PORT_BUSY_NO_SOURCE_MUTATION_KEEP_BACKUP=$backup REASON=$reason"
 }
 Restore-Patch
 $prior=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru
 $ready=$false
 for($i=0;$i -lt 30;$i++){
  Start-Sleep -Seconds 1
  if($prior.HasExited){break}
  try{$s=Invoke-RestMethod "$base/api/status" -TimeoutSec 3;if($s.application -eq 'Fun Industrial Platform'){$ready=$true;break}}catch{}
 }
 if($ready){
  try{$null=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120}
  catch{Write-Warning "ROLLBACK_REA_NOT_READY=$($_.Exception.Message)"}
 }
 throw "NEGATION_FIX_ACTIVATION_FAILED_RESTORED OLD_PID=$($prior.Id) READY=$ready REASON=$reason"
}
Write-Host "RESTART_ONLY_DASHBOARD_PID=$($oldProcess.ProcessId)"
Stop-Process -Id $oldProcess.ProcessId -ErrorAction Stop
for($i=0;$i -lt 30;$i++){
 if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break}
 Start-Sleep -Milliseconds 500
}
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw 'DASHBOARD_PORT_BUSY_AFTER_STOP'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$new=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir "negation-$stamp.out.log") -RedirectStandardError (Join-Path $logDir "negation-$stamp.err.log")
try{
 $httpReady=$false
 for($i=0;$i -lt 40;$i++){
  Start-Sleep -Seconds 1
  if($new.HasExited){break}
  try{
   $owner=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1
   if(-not $owner -or $owner.OwningProcess -ne $new.Id){continue}
   $s=Invoke-RestMethod "$base/api/status" -TimeoutSec 3
   if($s.application -eq 'Fun Industrial Platform'){$httpReady=$true;break}
  }catch{}
 }
 if(-not $httpReady){throw 'HTTP_STATUS_NOT_READY'}
 $rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120
 if($rea.state -ne 'ready'){throw "REA_START_FAILED=$($rea.state)"}
 $unified=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 45
 if($unified.state -ne 'ready' -or $unified.rea_enabled -ne 229){throw "UNIFIED_NOT_READY=$($unified.state) REA=$($unified.rea_enabled)"}
}catch{Recover-PreviousDashboard ($_.Exception.Message)}
Write-Host "NEGATION_ROUTING_READY=PASS PID=$($new.Id) REA=$($rea.state) ENABLED=$($unified.rea_enabled) BACKUP=$backup" -ForegroundColor Green
Write-Host "LOCAL_URL=$base/"
Write-Warning 'Explicit REA execution stays approval-gated. Keep iPhone forwarding private.'
