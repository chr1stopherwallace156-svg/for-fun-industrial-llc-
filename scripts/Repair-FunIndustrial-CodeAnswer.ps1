# Guarded, targeted fix: do not send tool definitions for read-only code explanation.
# Installs only a surgical change in src/unified-agent.mjs.
[CmdletBinding()]
param(
  [string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation',
  [int]$Port=8789
)
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$Source=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$target=Join-Path $Root 'src\unified-agent.mjs'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$npm=(Get-Command npm.cmd -ErrorAction Stop).Source
if(-not(Test-Path -LiteralPath $target -PathType Leaf)){throw "UNIFIED_AGENT_FILE_MISSING=$target"}
if(-not(Test-Path -LiteralPath (Join-Path $Source 'test\code-answer-routing.test.mjs'))){throw 'REPAIR_TEST_MISSING_IN_CLONE'}
$old=[IO.File]::ReadAllText($target)
if($old.Contains('function constrainForReadOnlyCodeAnswer(') -or $old.Contains('const analysisRoute=constrainForReadOnlyCodeAnswer(')){throw 'REPAIR_ALREADY_PRESENT_OR_PARTIAL_CHANGE_HOLD'}
$helperAnchor='function fail(res,code,error,detail)'
$routeAnchor='      const recent=messages.slice(-4).map(m=>({role:m.role,content:m.content.slice(0,450)}));'
$contextAnchor='      let codeContext={context:"",files:[],estimated_tokens:0,inspected:0};'
foreach($anchor in @($helperAnchor,$routeAnchor,$contextAnchor)){
 if(([regex]::Matches($old,[regex]::Escape($anchor))).Count -ne 1){throw "REPAIR_ANCHOR_MISMATCH=$anchor"}
}
$helper=@'
// When local source already answers an explanation/review request, do not
// send unrelated tool definitions to Qwen. Explicit REA invocations are still
// eligible for proposal and require operator approval before execution.
function constrainForReadOnlyCodeAnswer(query,route,codeContext){
  if(!codeContext?.context||!Array.isArray(codeContext.files)||!codeContext.files.length)return route;
  if(!/\b(explain|describe|summari[sz]e|review|suggest|understand|how|why|what|analy[sz]e|inspect|walk through)\b/i.test(query))return route;
  if(/\b(?:use|invoke|call|execute|run|activate)\s+(?:the\s+|an?\s+)?(?:rea(?:\s+mcp)?\s+)?(?:tool|capability|function|command|tests?\b)/i.test(query)||/\brea__[a-z0-9_]+\b/i.test(query))return route;
  return {...route,tools:[],routes:[],strategy:"read-only-code-analysis-v1",approval_required:true};
}
'@
$nl=[Environment]::NewLine
$patched=$old.Replace($helperAnchor,$helper+$nl+$helperAnchor)
$routePatch=@'
      const analysisRoute=constrainForReadOnlyCodeAnswer(last.content,route,codeContext);
      route.tools=analysisRoute.tools;route.routes=analysisRoute.routes;route.strategy=analysisRoute.strategy;
'@
$patched=$patched.Replace($routeAnchor,$routePatch+$nl+$routeAnchor)
$oldNote='When suggesting edits, supply a reviewable proposed diff; do not claim files changed.'
$newNote='When asked to explain or review, answer directly from available source with no tool call; distinguish missing context. When suggesting edits, supply a reviewable proposed diff; do not claim files changed.'
if(-not $patched.Contains($oldNote)){throw 'EXPLANATION_PROMPT_ANCHOR_MISMATCH'}
$patched=$patched.Replace($oldNote,$newNote)
if(-not $patched.Contains('read-only-code-analysis-v1') -or -not $patched.Contains('route.tools=analysisRoute.tools')){throw 'REPAIR_OUTPUT_VALIDATION_FAILED'}
# Qualification before writing or restarting any active process.
Push-Location $Source
try{
 & $node --test 'test\code-answer-routing.test.mjs'
 if($LASTEXITCODE -ne 0){throw 'ISOLATED_READONLY_ROUTING_TESTS_FAILED'}
}finally{Pop-Location}
$listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop|Select-Object -First 1
if(-not $listener -or $listener.LocalAddress -notin @('127.0.0.1','::1')){throw 'LOCAL_DASHBOARD_LISTENER_NOT_FOUND'}
$oldProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
if(-not $oldProcess -or $oldProcess.Name -ne 'node.exe' -or $oldProcess.CommandLine -notmatch 'src[/\\]server\.mjs'){throw 'DASHBOARD_PROCESS_IDENTITY_MISMATCH'}
$backupDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\CodingBackups\answer-fix-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $backupDir -Force|Out-Null
$backup=Join-Path $backupDir 'unified-agent.mjs'
Copy-Item -LiteralPath $target -Destination $backup -ErrorAction Stop
function Restore-Source {
 Copy-Item -LiteralPath $backup -Destination $target -Force -ErrorAction Stop
}
try{
 [IO.File]::WriteAllText($target,$patched,[Text.UTF8Encoding]::new($false))
 & $node --check $target
 if($LASTEXITCODE -ne 0){throw 'PATCHED_ROUTER_JAVASCRIPT_SYNTAX_FAILED'}
 Push-Location $Root
 try{
  & $npm test
  if($LASTEXITCODE -ne 0){throw 'LOCAL_REGRESSION_TESTS_FAILED'}
 }finally{Pop-Location}
}catch{
 Restore-Source
 throw "SOURCE_QUALIFICATION_FAILED_RESTORED_BACKUP: $($_.Exception.Message)"
}
Write-Host "READONLY_CODE_ROUTING_SOURCE_QUALIFIED BACKUP=$backup" -ForegroundColor Green
# The previous dashboard restart creates a fresh REA adapter. Preserve the existing
# all-229 allowlist from .env without changing its contents.
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
$base="http://127.0.0.1:$Port"
function Restore-PreviousDashboard([string]$why) {
 if($new -and -not $new.HasExited){Stop-Process -Id $new.Id -ErrorAction SilentlyContinue}
 for($i=0;$i -lt 30;$i++){
  if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Milliseconds 500
 }
 if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){
  throw "REPAIR_STARTUP_HOLD_PORT_BUSY_SOURCE_NOT_RESTORED REASON=$why LOGS=$logDir"
 }
 Restore-Source
 $recovery=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru
 $recovered=$false
 for($i=0;$i -lt 30;$i++){
  Start-Sleep -Seconds 1
  if($recovery.HasExited){break}
  try{
   $status=Invoke-RestMethod "$base/api/status" -TimeoutSec 3
   if($status.application -eq 'Fun Industrial Platform'){$recovered=$true;break}
  }catch{}
 }
 if($recovered){
  try{$null=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120}
  catch{Write-Warning "RECOVERY_REA_START_FAILED=$($_.Exception.Message)"}
 }
 throw "READONLY_CODE_ROUTING_STARTUP_FAILED_SOURCE_RESTORED PREVIOUS_DASHBOARD_PID=$($recovery.Id) READY=$recovered REASON=$why"
}
Write-Host "RESTARTING_ONLY_DASHBOARD_PID=$($oldProcess.ProcessId)"
Stop-Process -Id $oldProcess.ProcessId -ErrorAction Stop
for($i=0;$i -lt 30;$i++){
 if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break}
 Start-Sleep -Milliseconds 500
}
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw 'PREVIOUS_DASHBOARD_PORT_STILL_BUSY'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$new=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir "code-answer-$stamp.out.log") -RedirectStandardError (Join-Path $logDir "code-answer-$stamp.err.log")
# REA must be activated before checking the unified endpoint.
try{
 $http=$false
 for($i=0;$i -lt 40;$i++){
  Start-Sleep -Seconds 1
  if($new.HasExited){break}
  try{
   $conn=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1
   if(-not $conn -or $conn.OwningProcess -ne $new.Id){continue}
   $status=Invoke-RestMethod "$base/api/status" -TimeoutSec 3
   if($status.application -eq 'Fun Industrial Platform'){$http=$true;break}
  }catch{}
 }
 if(-not $http){throw 'HTTP_READY_FAILED'}
 $rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120
 if($rea.state -ne 'ready'){throw "REA_NOT_READY=$($rea.state)"}
 $unified=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 45
 if($unified.state -ne 'ready'){throw "UNIFIED_NOT_READY=$($unified.state)"}
 $count=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 30).tools).Count
 if($count -ne 229){throw "REA_COUNT_CHANGED=$count EXPECTED=229"}
}catch{Restore-PreviousDashboard $_.Exception.Message}
Write-Host "READONLY_CODE_ROUTING_READY=PASS PID=$($new.Id) REA=$($rea.state) ENABLED=$count BACKUP=$backup" -ForegroundColor Green
Write-Host "LOCAL_URL=$base/"
Write-Warning 'Code explanations will no longer propose unrelated tools. Explicit REA requests remain review-gated. Keep your iPhone forward private.'
