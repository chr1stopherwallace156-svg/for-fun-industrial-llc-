# Wire existing Platform Control > Activate services to restart Autonomy V2 when unavailable.
# No REA tools, Aider jobs or arbitrary commands are executed by the new activator.
# The deployment itself briefly restarts the dashboard Node process on port 8789.
[CmdletBinding()]
param([string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation')
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$sourceRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceModule=Join-Path $sourceRoot 'src\autonomy-activation.mjs'
$testModule=Join-Path $sourceRoot 'test\autonomy-activation.test.mjs'
$server=Join-Path $Root 'src\server.mjs'
$ui=Join-Path $Root 'public\index.html'
$module=Join-Path $Root 'src\autonomy-activation.mjs'
$base='http://127.0.0.1:8789'
$node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($f in @($sourceModule,$testModule,$server,$ui)){if(-not(Test-Path -LiteralPath $f -PathType Leaf)){throw "REQUIRED_FILE_MISSING=$f"}}
& $node --check $sourceModule
if($LASTEXITCODE -ne 0){throw 'ACTIVATION_MODULE_SYNTAX_HOLD'}
& $node --test $testModule
if($LASTEXITCODE -ne 0){throw 'ACTIVATION_TESTS_HOLD'}
$listener=Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction Stop|Where-Object {$_.LocalAddress -in @('127.0.0.1','::1')}|Select-Object -First 1
if(-not $listener){throw 'UNIFIED_8789_NOT_LISTENING'}
$old=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction Stop
if(-not $old -or $old.Name -ne 'node.exe' -or $old.CommandLine -notmatch 'src[/\\]server\.mjs'){throw 'DASHBOARD_PROCESS_IDENTITY_HOLD'}
$before=Invoke-RestMethod "$base/api/status" -TimeoutSec 20
if($before.application -ne 'Fun Industrial Platform'){throw 'PLATFORM_IDENTITY_HOLD'}
$allowed=@()
try{$allowed=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 20).tools|ForEach-Object {$_.name})}catch{Write-Warning 'REA catalog unavailable before deployment; preserving stored settings'}
if($allowed.Count -gt 0){$env:REA_ALLOWED_TOOLS=$allowed -join ','}
$env:HOST='127.0.0.1';$env:PORT='8789'
$oldServer=[IO.File]::ReadAllText($server);$oldUi=[IO.File]::ReadAllText($ui)
if(-not $oldServer.Contains('FI_AUTONOMY_8789_PROXY_V1') -or -not $oldUi.Contains('FI_AUTONOMY_8789_VIEW_V1')){throw 'FIRST_DEPLOY_EXISTING_AUTONOMY_8789_INTEGRATION'}
$marker='FI_AUTONOMY_PLATFORM_ACTIVATION_V1'
if($oldServer.Contains($marker)){
 $response=Invoke-RestMethod "$base/api/status" -TimeoutSec 20
 if(@($response.services|Where-Object {$_.id -eq 'autonomy'}).Count -eq 1){Write-Host 'AUTONOMY_PLATFORM_ACTIVATION=ALREADY_INSTALLED';return}
 throw 'ACTIVATION_SOURCE_PRESENT_BUT_NOT_RUNNING'
}
if(Test-Path $module){throw "MODULE_CONFLICT_PRESERVED=$module"}
$anchorImport='import {openAiToolDefinitions,getPlatformTool} from "./platform-tools.mjs";'
$anchorEngine='const server=http.createServer(async(req,res)=>{try{'
$anchorStatus=' if(req.method==="GET"&&req.url==="/api/status")return json(res,200,await platform.status());'
$anchorActivation='  if(req.url==="/api/start"||req.url==="/api/activate")return json(res,200,await platform.start());'
$oldUiFragment=@'
try{await api(stop?'/api/stop':'/api/activate',{},120000);log('Platform '+which+' request completed');await refreshStatus(true);await refreshTools(true)}catch(e)
'@
$newUiFragment=@'
try{const result=await api(stop?'/api/stop':'/api/activate',{},120000);log('Platform '+which+' request completed');if(result.platform_error)alert('Another platform service failed: '+result.platform_error);if(!stop){const autonomy=result.autonomy;log('Autonomy '+(autonomy?.state||'unknown')+' / '+(autonomy?.action||'unverified'));if(autonomy?.state!=='running')alert('Autonomous workloads are not ready: '+(autonomy?.detail||'Inspect backend status'));}await refreshStatus(true);await refreshTools(true);if(!stop&&typeof refreshAutonomy==='function')await refreshAutonomy()}catch(e)
'@
foreach($anchor in @($anchorImport,$anchorEngine,$anchorStatus,$anchorActivation)){if(([regex]::Matches($oldServer,[regex]::Escape($anchor))).Count -ne 1){throw "SERVER_ANCHOR_MISMATCH=$($anchor.Substring(0,[Math]::Min(70,$anchor.Length)))"}}
if(([regex]::Matches($oldUi,[regex]::Escape($oldUiFragment))).Count -ne 1){throw 'UI_PLATFORM_BUTTON_ANCHOR_MISMATCH'}
$import=$anchorImport+[Environment]::NewLine+'import {createAutonomyActivator} from "./autonomy-activation.mjs";'
$engine='const autonomyActivator=createAutonomyActivator();'+[Environment]::NewLine+$anchorEngine
$status=@'
 // FI_AUTONOMY_PLATFORM_ACTIVATION_V1: include current worker readiness in platform controls.
 if(req.method==="GET"&&req.url==="/api/status"){const status=await platform.status(),worker=await autonomyActivator.status();return json(res,200,{...status,services:[...(status.services||[]),{id:"autonomy",name:"Autonomous Workers",state:worker.state,detail:worker.state==="running"?"Sidequest coordinator PID "+worker.pid:worker.detail}]});}
'@
$activate='  if(req.url==="/api/start"||req.url==="/api/activate"){let result={},platform_error=null;try{result=await platform.start()}catch(error){platform_error=String(error.message||error).slice(0,180)}const autonomy=await autonomyActivator.activate();return json(res,200,{...result,...(platform_error?{platform_error}:{}),autonomy});}'
$patchedServer=$oldServer.Replace($anchorImport,$import).Replace($anchorEngine,$engine).Replace($anchorStatus,$status).Replace($anchorActivation,$activate)
$patchedUi=$oldUi.Replace($oldUiFragment,$newUiFragment)
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\AutonomyLab\8789ActivationBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
Copy-Item $server (Join-Path $backup 'server.mjs') -ErrorAction Stop
Copy-Item $ui (Join-Path $backup 'index.html') -ErrorAction Stop
$newProc=$null;$restarted=$false
try{
 Copy-Item $sourceModule $module -ErrorAction Stop
 [IO.File]::WriteAllText($server,$patchedServer,[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText($ui,$patchedUi,[Text.UTF8Encoding]::new($false))
 & $node --check $server
 if($LASTEXITCODE -ne 0){throw 'PATCHED_SERVER_SYNTAX_HOLD'}
 $js=[regex]::Match($patchedUi,'(?is)<script(?:\s[^>]*)?>(.*?)</script>')
 if(-not $js.Success){throw 'INLINE_JS_NOT_FOUND'}
 $tmp=Join-Path $env:TEMP ('fi-activation-ui-'+[guid]::NewGuid().ToString('N')+'.mjs')
 try{[IO.File]::WriteAllText($tmp,$js.Groups[1].Value,[Text.UTF8Encoding]::new($false));& $node --check $tmp;if($LASTEXITCODE -ne 0){throw 'PATCHED_UI_SYNTAX_HOLD'}}finally{Remove-Item $tmp -ErrorAction SilentlyContinue -Force}
 Push-Location $Root
 try{& $node --test;if($LASTEXITCODE -ne 0){throw 'LIVE_REGRESSION_TESTS_HOLD'}}finally{Pop-Location}
 $logDir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
 New-Item -ItemType Directory -Path $logDir -Force|Out-Null
 Write-Host "RESTARTING_DASHBOARD_ONLY_PID=$($old.ProcessId)"
 Stop-Process -Id $old.ProcessId -ErrorAction Stop
 $restarted=$true
 for($i=0;$i -lt 60;$i++){if(-not(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 350}
 if(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue){throw 'PORT_8789_NOT_RELEASED'}
 $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
 $newProc=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -RedirectStandardOutput (Join-Path $logDir "activation-$stamp.stdout.log") -RedirectStandardError (Join-Path $logDir "activation-$stamp.stderr.log") -PassThru
 $ready=$false
 for($i=0;$i -lt 40;$i++){Start-Sleep -Milliseconds 900;$newProc.Refresh();if($newProc.HasExited){break};try{$s=Invoke-RestMethod "$base/api/status" -TimeoutSec 5;if($s.application -eq 'Fun Industrial Platform' -and @($s.services|Where-Object {$_.id -eq 'autonomy'}).Count -eq 1){$ready=$true;break}}catch{}}
 if(-not $ready){throw 'NEW_DASHBOARD_ACTIVATION_ROUTE_NOT_READY'}
 try{$rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120;Write-Host "REA_RECONNECTED=$($rea.state)"}catch{Write-Warning "REA_RECONNECT_UNAVAILABLE: $($_.Exception.Message)"}
 if($allowed.Count -eq 229){$enabled=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 40).tools);if($enabled.Count -ne 229){throw "REA_REGISTRY_RESTORE_HOLD=$($enabled.Count)"}}
 $page=(Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 15).Content
 if(-not $page.Contains('FI_AUTONOMY_8789_VIEW_V1') -or -not $page.Contains('Autonomy')){throw 'AUTONOMY_UI_NOT_SERVED'}
 $s=Invoke-RestMethod "$base/api/status" -TimeoutSec 10
 Write-Host "AUTONOMY_PLATFORM_ACTIVATION=WIRED DASHBOARD_PID=$($newProc.Id)"
 Write-Host "AUTONOMY_CURRENT_STATE=$(@($s.services|Where-Object {$_.id -eq 'autonomy'}|Select-Object -First 1).state)"
 Write-Host "BACKUP=$backup"
 Write-Host 'PRESS_ACTIVATE_ON_8789_TO_START_OR_VERIFY_THE_WORKERS'
}catch{
 $errorText=$_.Exception.Message
 Write-Warning "ACTIVATION_DEPLOY_FAILED=$errorText"
 if($newProc){$newProc.Refresh();if(-not $newProc.HasExited){Stop-Process -Id $newProc.Id -Force -ErrorAction SilentlyContinue}}
 Copy-Item (Join-Path $backup 'server.mjs') $server -Force
 Copy-Item (Join-Path $backup 'index.html') $ui -Force
 Remove-Item $module -ErrorAction SilentlyContinue -Force
 if($restarted){
  for($i=0;$i -lt 50;$i++){if(-not(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 300}
  if(-not(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue)){
   try{
    $recovery=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -RedirectStandardOutput (Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs\activation-rollback.stdout.log') -RedirectStandardError (Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs\activation-rollback.stderr.log') -PassThru
    Write-Warning "ORIGINAL_DASHBOARD_RESTART_ATTEMPTED PID=$($recovery.Id)"
   }catch{Write-Warning "MANUAL_DASHBOARD_RECOVERY_NEEDED_BACKUP=$backup"}
  }
 }
 throw "ACTIVATION_DEPLOY_ROLLED_BACK_OR_HELD=$errorText BACKUP=$backup"
}
