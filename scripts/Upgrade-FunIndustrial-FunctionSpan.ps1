# Guarded function-span evidence upgrade. No model, compute, DDGS, NetBird, or Ollama restart.
[CmdletBinding()]
param([string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation',[int]$Port=8789)
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$Source=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node=(Get-Command node.exe -ErrorAction Stop).Source
$npm=(Get-Command npm.cmd -ErrorAction Stop).Source
$codeFile=Join-Path $Root 'src\code-context.mjs'
$agentFile=Join-Path $Root 'src\unified-agent.mjs'
$uiFile=Join-Path $Root 'public\index.html'
$testFile=Join-Path $Root 'test\function-span.test.mjs'
$srcCode=Join-Path $Source 'src\code-context.mjs'
$baselineCode=Join-Path $Source 'scripts\baselines\code-context-before-function-span.mjs'
$srcTest=Join-Path $Source 'test\function-span.test.mjs'
foreach($f in @($codeFile,$agentFile,$uiFile,$srcCode,$baselineCode,$srcTest)){
 if(-not(Test-Path -LiteralPath $f -PathType Leaf)){throw "FILE_MISSING=$f"}
}
if(Test-Path -LiteralPath $testFile){throw 'PREEXISTING_FUNCTION_TEST_HOLD'}
$oldCode=[IO.File]::ReadAllText($codeFile)
$oldAgent=[IO.File]::ReadAllText($agentFile)
$oldUi=[IO.File]::ReadAllText($uiFile)
$baseline=[IO.File]::ReadAllText($baselineCode)
$canonOld=[regex]::Replace($oldCode,'\r\n?',[string][char]10)
$canonBase=[regex]::Replace($baseline,'\r\n?',[string][char]10)
if($canonOld -cne $canonBase){throw 'CODE_CONTEXT_BASELINE_DRIFT_HOLD_NO_OVERWRITE'}
if($oldAgent.Contains('code_source_complete:') -or $oldUi.Contains('showCodeSources(files,focus,complete)')){throw 'FUNCTION_SPAN_ALREADY_PRESENT_OR_PARTIAL_HOLD'}
function Replace-Once([string]$body,[string]$needle,[string]$replacement,[string]$reason){
 if(([regex]::Matches($body,[regex]::Escape($needle))).Count -ne 1){throw "ANCHOR_MISMATCH_$reason"}
 return $body.Replace($needle,$replacement)
}
$patchedAgent=Replace-Once $oldAgent 'maxChars:800,maxFiles:140' 'maxChars:2300,maxFiles:140' 'CONTEXT_BUDGET'
$oldNote='When asked to explain or review, answer directly from available source with no tool call; distinguish missing context.'
$newNote='When asked to explain or review, describe only demonstrated code paths with exact line evidence and no tool call. If the source span is INCOMPLETE, state which logic is unverified instead of guessing.'
$patchedAgent=Replace-Once $patchedAgent $oldNote $newNote 'EXPLANATION_EVIDENCE'
$oldResponse='code_files:codeContext.files,code_context_tokens_estimate:codeContext.estimated_tokens,model:outcome.model'
$newResponse='code_files:codeContext.files,code_context_tokens_estimate:codeContext.estimated_tokens,code_focus_symbol:codeContext.focus_symbol||null,code_source_complete:codeContext.source_span_complete===true,model:outcome.model'
$patchedAgent=Replace-Once $patchedAgent $oldResponse $newResponse 'SOURCE_COMPLETENESS'
$patchedUi=Replace-Once $oldUi 'function showCodeSources(files){' 'function showCodeSources(files,focus,complete){' 'UI_SIGNATURE'
$uiLine=" const h=document.createElement('h3');h.textContent='Local source examined (read-only)';card.append(h);"
$uiMessage=" if(focus){const note=document.createElement('div');note.className='subtle';note.textContent='Function '+String(focus).slice(0,100)+' · '+(complete?'complete source span':'incomplete — verify before relying on analysis');card.append(note);}"
$patchedUi=Replace-Once $patchedUi $uiLine ($uiLine+[Environment]::NewLine+$uiMessage) 'UI_COMPLETENESS'
$patchedUi=Replace-Once $patchedUi 'showCodeSources(result.code_files);' 'showCodeSources(result.code_files,result.code_focus_symbol,result.code_source_complete);' 'UI_RECEIPT'
Push-Location $Source
try{
 & $node --test 'test\function-span.test.mjs' 'test\code-context.test.mjs' 'test\code-answer-routing.test.mjs'
 if($LASTEXITCODE -ne 0){throw 'ISOLATED_FUNCTION_SPAN_TESTS_FAILED'}
}finally{Pop-Location}
$inline=[regex]::Match($patchedUi,'(?is)<script(?:\s[^>]*)?>(.*?)</script>')
if(-not $inline.Success){throw 'UI_SCRIPT_NOT_FOUND'}
$tmp=Join-Path $env:TEMP ('fi-function-script-'+[guid]::NewGuid().ToString('N')+'.mjs')
try{[IO.File]::WriteAllText($tmp,$inline.Groups[1].Value,[Text.UTF8Encoding]::new($false));& $node --check $tmp;if($LASTEXITCODE -ne 0){throw 'UI_SYNTAX_HOLD'}}finally{Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue}
$listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop|Select-Object -First 1
if(-not $listener -or $listener.LocalAddress -notin @('127.0.0.1','::1')){throw 'LOOPBACK_DASHBOARD_NOT_FOUND'}
$oldProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
if(-not $oldProcess -or $oldProcess.Name -ne 'node.exe' -or $oldProcess.CommandLine -notmatch 'src[/\\]server\.mjs'){throw 'DASHBOARD_IDENTITY_MISMATCH'}
$base="http://127.0.0.1:$Port"
$pre=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 45
if($pre.state -ne 'ready' -or $pre.rea_enabled -ne 229){throw "PREEXISTING_DASHBOARD_NOT_READY_STATE=$($pre.state)_REA=$($pre.rea_enabled)"}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\CodingBackups\function-span-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
Copy-Item -LiteralPath $codeFile -Destination (Join-Path $backup 'code-context.mjs')
Copy-Item -LiteralPath $agentFile -Destination (Join-Path $backup 'unified-agent.mjs')
Copy-Item -LiteralPath $uiFile -Destination (Join-Path $backup 'index.html')
$testInstalled=$false
function Restore-Source {
 Copy-Item -LiteralPath (Join-Path $backup 'code-context.mjs') -Destination $codeFile -Force
 Copy-Item -LiteralPath (Join-Path $backup 'unified-agent.mjs') -Destination $agentFile -Force
 Copy-Item -LiteralPath (Join-Path $backup 'index.html') -Destination $uiFile -Force
 if($testInstalled){Remove-Item -LiteralPath $testFile -Force -ErrorAction SilentlyContinue}
}
try{
 Copy-Item -LiteralPath $srcCode -Destination $codeFile -Force
 [IO.File]::WriteAllText($agentFile,$patchedAgent,[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText($uiFile,$patchedUi,[Text.UTF8Encoding]::new($false))
 Copy-Item -LiteralPath $srcTest -Destination $testFile
 $testInstalled=$true
 foreach($f in @($codeFile,$agentFile)){& $node --check $f;if($LASTEXITCODE -ne 0){throw "JAVASCRIPT_SYNTAX_FAILED=$f"}}
 Push-Location $Root
 try{& $npm test;if($LASTEXITCODE -ne 0){throw 'ACTIVE_REGRESSION_TESTS_FAILED'}}finally{Pop-Location}
}catch{Restore-Source;throw "FUNCTION_SPAN_SOURCE_HOLD_RESTORED: $($_.Exception.Message)"}
Write-Host "FUNCTION_SPAN_SOURCE_QUALIFIED BACKUP=$backup" -ForegroundColor Green
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
function Restore-PreviousDashboard([string]$why){
 if($new -and -not $new.HasExited){Stop-Process -Id $new.Id -ErrorAction SilentlyContinue}
 for($i=0;$i -lt 30;$i++){if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 500}
 if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw "ROLLBACK_PORT_BUSY_KEEP_BACKUP=$backup REASON=$why"}
 Restore-Source
 $recovery=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru
 $recovered=$false
 for($i=0;$i -lt 30;$i++){
  Start-Sleep -Seconds 1
  if($recovery.HasExited){break}
  try{$s=Invoke-RestMethod "$base/api/status" -TimeoutSec 3;if($s.application -eq 'Fun Industrial Platform'){$recovered=$true;break}}catch{}
 }
 if($recovered){try{$null=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120}catch{Write-Warning "ROLLBACK_REA_HOLD=$($_.Exception.Message)"}}
 throw "FUNCTION_SPAN_ACTIVATION_FAILED_RESTORED PREVIOUS_PID=$($recovery.Id) READY=$recovered REASON=$why"
}
Write-Host "RESTART_ONLY_DASHBOARD_PID=$($oldProcess.ProcessId)"
Stop-Process -Id $oldProcess.ProcessId -ErrorAction Stop
for($i=0;$i -lt 30;$i++){if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 500}
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw 'DASHBOARD_PORT_BUSY_AFTER_STOP'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$new=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir "function-span-$stamp.out.log") -RedirectStandardError (Join-Path $logDir "function-span-$stamp.err.log")
try{
 $healthy=$false
 for($i=0;$i -lt 40;$i++){
  Start-Sleep -Seconds 1
  if($new.HasExited){break}
  try{
   $listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1
   if(-not $listener -or $listener.OwningProcess -ne $new.Id){continue}
   $s=Invoke-RestMethod "$base/api/status" -TimeoutSec 3
   if($s.application -eq 'Fun Industrial Platform'){$healthy=$true;break}
  }catch{}
 }
 if(-not $healthy){throw 'DASHBOARD_HTTP_NOT_READY'}
 $rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120
 if($rea.state -ne 'ready'){throw "REA_NOT_READY=$($rea.state)"}
 $status=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 45
 if($status.state -ne 'ready' -or $status.rea_enabled -ne 229){throw "UNIFIED_NOT_READY=$($status.state)_REA=$($status.rea_enabled)"}
 $page=(Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 15).Content
 if(-not $page.Contains('showCodeSources(files,focus,complete)')){throw 'FUNCTION_SPAN_UI_NOT_SERVED'}
}catch{Restore-PreviousDashboard ($_.Exception.Message)}
Write-Host "FUNCTION_SPAN_READY=PASS PID=$($new.Id) REA=$($rea.state) ENABLED=$($status.rea_enabled) BACKUP=$backup" -ForegroundColor Green
Write-Host "LOCAL_URL=$base/"
Write-Warning 'Source inspection is heuristic and read-only. Do not treat it as formal proof; keep forwarding private.'
