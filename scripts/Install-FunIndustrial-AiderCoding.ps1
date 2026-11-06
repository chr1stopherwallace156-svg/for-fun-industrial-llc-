# Fun Industrial on-demand Aider integration - guarded, reversible Windows installer.
# PowerShell 5.1 ASCII-only entrypoint. Leaves model, compute and REA executable intact.
[CmdletBinding()]
param([string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation',[int]$Port=8789)
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$Source=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node=(Get-Command node.exe -ErrorAction Stop).Source
$npm=(Get-Command npm.cmd -ErrorAction Stop).Source
$aider=Join-Path $env:LOCALAPPDATA 'FunIndustrial\CodingAgent\venv\Scripts\aider.exe'
$agent=Join-Path $Root 'src\unified-agent.mjs'
$coding=Join-Path $Root 'src\coding-agent.mjs'
$ui=Join-Path $Root 'public\index.html'
$testFile=Join-Path $Root 'test\coding-agent.test.mjs'
$srcCoding=Join-Path $Source 'src\coding-agent.mjs'
$srcUi=Join-Path $Source 'public\unified-control-center.html'
$srcTest=Join-Path $Source 'test\coding-agent.test.mjs'
$srcAgent=Join-Path $Source 'src\unified-agent.mjs'
foreach($file in @($agent,$ui,$srcCoding,$srcUi,$srcTest,$srcAgent,$aider)){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw "REQUIRED_FILE_MISSING=$file"}
}
foreach($file in @($coding,$testFile)){
 if(Test-Path -LiteralPath $file){throw "CODING_MODULE_ALREADY_PRESENT_OR_CONFLICT_HOLD=$file"}
}
$oldAgent=[IO.File]::ReadAllText($agent)
$oldUi=[IO.File]::ReadAllText($ui)
if(-not $oldAgent.Contains('export function constrainForReadOnlyCodeAnswer(')){throw 'READONLY_ROUTING_BASELINE_NOT_QUALIFIED'}
if(-not $oldAgent.Contains('code_source_complete:codeContext.source_span_complete===true')){throw 'FUNCTION_SOURCE_BASELINE_NOT_QUALIFIED'}
if($oldAgent.Contains('createCodingAgent') -or $oldUi.Contains('offerIsolatedCoding(')){throw 'CODING_MODULE_ALREADY_INSTALLED_HOLD'}
function Replace-Once([string]$s,[string]$anchor,[string]$replacement,[string]$label){
 if(([regex]::Matches($s,[regex]::Escape($anchor))).Count -ne 1){throw "ANCHOR_MISMATCH=$label"}
 return $s.Replace($anchor,$replacement)
}
$nl=[Environment]::NewLine
$import='import {buildCodeContext,isCodingRequest} from "./code-context.mjs";'
$patchedAgent=Replace-Once $oldAgent $import ($import+$nl+'import {createCodingAgent} from "./coding-agent.mjs";') 'AGENT_IMPORT'
$cat='  async function catalog(){const rea=await platform.reaTools();return {local:openAiToolDefinitions([]),rea};}'
$inst='  const coding=createCodingAgent({root,modelPort:Number(process.env.LLAMA_CPP_PORT||8088)});'
$patchedAgent=Replace-Once $patchedAgent $cat ($cat+$nl+$inst) 'CODING_CONSTRUCTOR'
$endpoint='      const endpoint=req.url.split("?")[0];'
$route='      if(endpoint.startsWith("/api/unified/coding/")){const data=req.method==="POST"?await bodyOf(req):{};return coding(req,res,endpoint,data);}'
$patchedAgent=Replace-Once $patchedAgent $endpoint ($endpoint+$nl+$route) 'CODING_ROUTE'
$sourceUi=[IO.File]::ReadAllText($srcUi)
$start=$sourceUi.IndexOf('// Aider coding is part of the same chat.')
$end=$sourceUi.IndexOf('async function submitChat(){',$start)
if($start -lt 0 -or $end -le $start){throw 'CODING_UI_HELPER_MISSING'}
$helper=$sourceUi.Substring($start,$end-$start)
$patchedUi=Replace-Once $oldUi 'async function submitChat(){' ($helper+'async function submitChat(){') 'CODING_UI_HELPER'
$show='  showWebSources(result.web_results);showMemoryUsed(result.memories_used);showCodeSources(result.code_files,result.code_focus_symbol,result.code_source_complete);'
$patchedUi=Replace-Once $patchedUi $show ($show+$nl+'  offerIsolatedCoding(content,result.code_files);') 'CODING_UI_WIRING'
# Verify Aider is installed and supports the exact CLI contract before ANY live edit.
$helpText=(& $aider --help 2>&1|Out-String)
if($LASTEXITCODE -ne 0){throw 'AIDER_HELP_FAILED'}
foreach($switch in @('--message-file','--no-auto-commits','--no-auto-test','--no-auto-lint','--no-suggest-shell-commands','--env-file','--config')){
 if(-not $helpText.Contains($switch)){throw "AIDER_VERSION_UNSUPPORTED=$switch"}
}
Write-Host 'AIDER_CLI_PREFLIGHT=PASS'
# Qualify candidate with independent node tests, no network/model execution.
Push-Location $Source
try{
 & $node --check $srcCoding
 if($LASTEXITCODE -ne 0){throw 'CODING_SOURCE_SYNTAX_FAILED'}
 & $node --check $srcAgent
 if($LASTEXITCODE -ne 0){throw 'UNIFIED_SOURCE_SYNTAX_FAILED'}
 & $node --test 'test\coding-agent.test.mjs' 'test\code-answer-routing.test.mjs' 'test\function-span.test.mjs'
 if($LASTEXITCODE -ne 0){throw 'ISOLATED_CODING_TESTS_FAILED'}
}finally{Pop-Location}
$inline=[regex]::Match($patchedUi,'(?is)<script(?:\s[^>]*)?>(.*?)</script>')
if(-not $inline.Success){throw 'UI_SCRIPT_NOT_FOUND'}
$tmp=Join-Path $env:TEMP ('fi-aider-ui-check-'+[guid]::NewGuid().ToString('N')+'.mjs')
try{
 [IO.File]::WriteAllText($tmp,$inline.Groups[1].Value,[Text.UTF8Encoding]::new($false))
 & $node --check $tmp
 if($LASTEXITCODE -ne 0){throw 'CODING_MOBILE_SCRIPT_SYNTAX_FAILED'}
}finally{Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue}
$listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop|Select-Object -First 1
if(-not $listener -or $listener.LocalAddress -notin @('127.0.0.1','::1')){throw 'LOOPBACK_DASHBOARD_NOT_FOUND'}
$oldProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
if(-not $oldProcess -or $oldProcess.Name -ne 'node.exe' -or $oldProcess.CommandLine -notmatch 'src[/\\]server\.mjs'){throw 'DASHBOARD_PROCESS_IDENTITY_MISMATCH'}
$base="http://127.0.0.1:$Port"
$before=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 45
if($before.state -ne 'ready' -or $before.rea_enabled -ne 229){throw "BASELINE_UNQUALIFIED_STATE=$($before.state)_REA=$($before.rea_enabled)"}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\CodingBackups\aider-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
Copy-Item -LiteralPath $agent -Destination (Join-Path $backup 'unified-agent.mjs')
Copy-Item -LiteralPath $ui -Destination (Join-Path $backup 'index.html')
$createdCoding=$false;$createdTest=$false
function Restore-Source {
 Copy-Item -LiteralPath (Join-Path $backup 'unified-agent.mjs') -Destination $agent -Force
 Copy-Item -LiteralPath (Join-Path $backup 'index.html') -Destination $ui -Force
 if($createdCoding){Remove-Item -LiteralPath $coding -Force -ErrorAction SilentlyContinue}
 if($createdTest){Remove-Item -LiteralPath $testFile -Force -ErrorAction SilentlyContinue}
}
try{
 Copy-Item -LiteralPath $srcCoding -Destination $coding
 $createdCoding=$true
 Copy-Item -LiteralPath $srcTest -Destination $testFile
 $createdTest=$true
 [IO.File]::WriteAllText($agent,$patchedAgent,[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText($ui,$patchedUi,[Text.UTF8Encoding]::new($false))
 & $node --check $agent
 if($LASTEXITCODE -ne 0){throw 'ACTIVE_UNIFIED_SYNTAX_FAILED'}
 & $node --check $coding
 if($LASTEXITCODE -ne 0){throw 'ACTIVE_CODING_SYNTAX_FAILED'}
 Push-Location $Root
 try{
  & $npm test
  if($LASTEXITCODE -ne 0){throw 'ACTIVE_REGRESSION_FAILED'}
 }finally{Pop-Location}
}catch{
 Restore-Source
 throw "CODING_SOURCE_QUALIFICATION_FAILED_RESTORED=$($_.Exception.Message)"
}
Write-Host "AIDER_CODING_SOURCE_QUALIFIED BACKUP=$backup" -ForegroundColor Green
$env:HOST='127.0.0.1'
$env:PORT=[string]$Port
$env:FI_COGNITIVE_PYTHON='C:\Users\alxar\AppData\Local\Programs\Python\Python312\python.exe'
$envFile=Join-Path $Root '.env'
if(Test-Path -LiteralPath $envFile){
 $allow=Get-Content -LiteralPath $envFile|Where-Object {$_ -match '^REA_ALLOWED_TOOLS='}|Select-Object -Last 1
 if($allow){$env:REA_ALLOWED_TOOLS=$allow.Substring('REA_ALLOWED_TOOLS='.Length)}
}
$logDir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
New-Item -ItemType Directory -Path $logDir -Force|Out-Null
function Recover-PreviousDashboard([string]$reason){
 if($new -and -not $new.HasExited){Stop-Process -Id $new.Id -ErrorAction SilentlyContinue}
 for($i=0;$i -lt 30;$i++){if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 500}
 if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw "ROLLBACK_PORT_BUSY_BACKUP=$backup REASON=$reason"}
 Restore-Source
 $recovery=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru
 $recovered=$false
 for($i=0;$i -lt 30;$i++){
  Start-Sleep -Seconds 1
  if($recovery.HasExited){break}
  try{$s=Invoke-RestMethod "$base/api/status" -TimeoutSec 3;if($s.application -eq 'Fun Industrial Platform'){$recovered=$true;break}}catch{}
 }
 if($recovered){try{$null=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120}catch{Write-Warning "RECOVERY_REA_FAILED=$($_.Exception.Message)"}}
 throw "AIDER_CODING_ACTIVATION_FAILED_SOURCE_RESTORED PID=$($recovery.Id) READY=$recovered REASON=$reason"
}
Write-Host "RESTART_ONLY_DASHBOARD_PID=$($oldProcess.ProcessId)"
Stop-Process -Id $oldProcess.ProcessId -ErrorAction Stop
for($i=0;$i -lt 30;$i++){if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 500}
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw 'DASHBOARD_PORT_BUSY_AFTER_STOP'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$new=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir "aider-$stamp.out.log") -RedirectStandardError (Join-Path $logDir "aider-$stamp.err.log")
try{
 $ready=$false
 for($i=0;$i -lt 40;$i++){
  Start-Sleep -Seconds 1
  if($new.HasExited){break}
  try{
   $owner=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1
   if(-not $owner -or $owner.OwningProcess -ne $new.Id){continue}
   $s=Invoke-RestMethod "$base/api/status" -TimeoutSec 3
   if($s.application -eq 'Fun Industrial Platform'){$ready=$true;break}
  }catch{}
 }
 if(-not $ready){throw 'HTTP_DASHBOARD_NOT_READY'}
 $rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120
 if($rea.state -ne 'ready'){throw "REA_NOT_READY=$($rea.state)"}
 $unified=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 45
 if($unified.state -ne 'ready' -or $unified.rea_enabled -ne 229){throw "UNIFIED_NOT_READY=$($unified.state)_REA=$($unified.rea_enabled)"}
 $codingStatus=Invoke-RestMethod "$base/api/unified/coding/status" -TimeoutSec 20
 if($codingStatus.provider -ne 'Aider' -or $codingStatus.installed -ne $true){throw 'AIDER_STATUS_NOT_INSTALLED'}
 $page=(Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 15).Content
 if(-not $page.Contains('offerIsolatedCoding(content,result.code_files);')){throw 'UNIFIED_CODING_UI_NOT_SERVED'}
}catch{Recover-PreviousDashboard ($_.Exception.Message)}
Write-Host "AIDER_CODING_READY=PASS PID=$($new.Id) REA=$($rea.state) ENABLED=$($unified.rea_enabled) AIDER_INSTALLED=$($codingStatus.installed) MODEL_READY=$($codingStatus.model_ready) BACKUP=$backup" -ForegroundColor Green
Write-Host "LOCAL_URL=$base/"
Write-Warning 'Isolated Git clone is NOT an OS sandbox. Never approve test execution for untrusted source.'
