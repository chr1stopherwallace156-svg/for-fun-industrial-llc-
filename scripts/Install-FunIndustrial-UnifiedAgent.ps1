# Guarded deployment. Changes only the current dashboard, its HTML, and new isolated files.
[CmdletBinding()]
param([string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation',[int]$Port=8789)
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath($Root)
$source=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$server=Join-Path $Root 'src\server.mjs'
$ui=Join-Path $Root 'public\index.html'
$py='C:\Users\alxar\AppData\Local\Programs\Python\Python312\python.exe'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$npm=(Get-Command npm.cmd -ErrorAction Stop).Source
if(-not(Test-Path $server) -or -not(Test-Path $ui) -or -not(Test-Path $py)){throw 'PLATFORM_OR_PYTHON_NOT_FOUND'}
$files=@(
 @{from='src\unified-agent.mjs';to='src\unified-agent.mjs'},
 @{from='cognitive\__init__.py';to='cognitive\__init__.py'},
 @{from='cognitive\core.py';to='cognitive\core.py'},
 @{from='cognitive\cli.py';to='cognitive\cli.py'},
 @{from='test\unified-agent.test.mjs';to='test\unified-agent.test.mjs'}
)
foreach($file in $files){
 if(-not(Test-Path (Join-Path $source $file.from))){throw "SOURCE_MISSING=$($file.from)"}
 if(Test-Path (Join-Path $Root $file.to)){throw "TARGET_CONFLICT_PRESERVED=$($file.to)"}
}
$before=[IO.File]::ReadAllText($server)
if($before.Contains('createUnifiedAgent') -or $before.Contains('/api/unified/')){throw 'UNIFIED_ALREADY_INSTALLED'}
$imp='import {openAiToolDefinitions,getPlatformTool} from "./platform-tools.mjs";'
$construct='const platform=createPlatform(config),page=await readFile(path.join(root,"../public/index.html"));'
$route=' if(req.method==="GET"&&req.url==="/api/status")return json(res,200,await platform.status());'
foreach($anchor in @($imp,$construct,$route)){if(([regex]::Matches($before,[regex]::Escape($anchor))).Count -ne 1){throw "SERVER_ANCHOR_MISMATCH=$anchor"}}
$nl=[Environment]::NewLine
$patched=$before.Replace($imp,$imp+$nl+'import {createUnifiedAgent} from "./unified-agent.mjs";')
$patched=$patched.Replace($construct,$construct+$nl+'const unifiedAgent=createUnifiedAgent({root:path.resolve(root,".."),config,platform,openAiToolDefinitions});')
$patchRoute=' if(req.url.startsWith("/api/unified/")){if(!localRequest(req,res))return;if(req.url==="/api/unified/chat"&&!await requireVpnGate(res))return;return unifiedAgent(req,res);}'
$patched=$patched.Replace($route,$patchRoute+$nl+$route)
$mobile=[IO.File]::ReadAllText((Join-Path $source 'public\unified-control-center.html'))
foreach($signature in @('id="bottomNav"','id="memoryStatus"','/api/unified/chat','/api/unified/memory/propose')){if(-not $mobile.Contains($signature)){throw "MOBILE_SIGNATURE_MISSING=$signature"}}
$js=[regex]::Match($mobile,'(?is)<script(?:\s[^>]*)?>(.*?)</script>')
if(-not $js.Success){throw 'INLINE_JS_MISSING'}
$tmp=Join-Path $env:TEMP ('fi-unified-check-'+[guid]::NewGuid().ToString('N')+'.mjs')
try{[IO.File]::WriteAllText($tmp,$js.Groups[1].Value,[Text.UTF8Encoding]::new($false));& $node --check $tmp;if($LASTEXITCODE -ne 0){throw 'MOBILE_JS_SYNTAX_FAILED'}}finally{Remove-Item $tmp -Force -ErrorAction SilentlyContinue}
Push-Location $source
try{& $node --test 'test\unified-agent.test.mjs';if($LASTEXITCODE -ne 0){throw 'ROUTER_TESTS_FAILED'};& $py -m unittest discover -s tests -p test_cognitive_core.py -v;if($LASTEXITCODE -ne 0){throw 'COGNITIVE_TESTS_FAILED'}}finally{Pop-Location}
$l=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop|Select-Object -First 1
if(-not $l -or $l.LocalAddress -notin @('127.0.0.1','::1')){throw 'LOCAL_DASHBOARD_PORT_NOT_FOUND'}
$old=Get-CimInstance Win32_Process -Filter "ProcessId=$($l.OwningProcess)"
if(-not $old -or $old.Name -ne 'node.exe' -or $old.CommandLine -notmatch 'src[/\\]server\.mjs'){throw 'DASHBOARD_IDENTITY_MISMATCH'}
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\UnifiedBackups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
Copy-Item $server (Join-Path $backup 'server.mjs')
Copy-Item $ui (Join-Path $backup 'index.html')
$created=New-Object System.Collections.Generic.List[string]
function Restore-Source{
 Copy-Item (Join-Path $backup 'server.mjs') $server -Force
 Copy-Item (Join-Path $backup 'index.html') $ui -Force
 foreach($item in $created){Remove-Item $item -Force -ErrorAction SilentlyContinue}
}
try{
 foreach($f in $files){
  $dest=Join-Path $Root $f.to
  New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force|Out-Null
  Copy-Item (Join-Path $source $f.from) $dest
  $created.Add($dest)
 }
 [IO.File]::WriteAllText($server,$patched,[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText($ui,$mobile,[Text.UTF8Encoding]::new($false))
 & $node --check $server;if($LASTEXITCODE -ne 0){throw 'SERVER_SYNTAX_FAILED'}
 & $node --check (Join-Path $Root 'src\unified-agent.mjs');if($LASTEXITCODE -ne 0){throw 'ROUTER_SYNTAX_FAILED'}
 Push-Location $Root
 try{& $npm test;if($LASTEXITCODE -ne 0){throw 'REGRESSION_TESTS_FAILED'}}finally{Pop-Location}
}catch{Restore-Source;throw "PATCH_FAILED_RESTORED_BACKUP: $($_.Exception.Message)"}
Write-Host "UNIFIED_SOURCE_QUALIFIED BACKUP=$backup" -ForegroundColor Green
$env:HOST='127.0.0.1';$env:PORT=[string]$Port;$env:FI_COGNITIVE_PYTHON=$py
$envFile=Join-Path $Root '.env'
if(Test-Path $envFile){$line=Get-Content $envFile|Where-Object {$_ -match '^REA_ALLOWED_TOOLS='}|Select-Object -First 1;if($line){$env:REA_ALLOWED_TOOLS=$line.Substring('REA_ALLOWED_TOOLS='.Length)}}
$logdir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
New-Item -ItemType Directory -Path $logdir -Force|Out-Null
Write-Host "RESTART_ONLY_DASHBOARD_PID=$($old.ProcessId)"
Stop-Process -Id $old.ProcessId
for($i=0;$i -lt 30;$i++){if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 500}
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw 'DASHBOARD_PORT_BUSY'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$new=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logdir "unified-$stamp.out.log") -RedirectStandardError (Join-Path $logdir "unified-$stamp.err.log")
$base="http://127.0.0.1:$Port";$ready=$false
for($i=0;$i -lt 40;$i++){Start-Sleep -Seconds 1;if($new.HasExited){break};try{$s=Invoke-RestMethod "$base/api/status" -TimeoutSec 2;if($s.application -eq 'Fun Industrial Platform'){$ready=$true;break}}catch{}}
if(-not $ready){
 if(-not $new.HasExited){Stop-Process -Id $new.Id -ErrorAction SilentlyContinue}
 for($i=0;$i -lt 20;$i++){if(-not(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 500}
 Restore-Source
 if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw "NEW_DASHBOARD_FAILED_PORT_BUSY_SOURCE_RESTORED LOGS=$logdir"}
 $recovery=Start-Process -FilePath $node -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -PassThru
 throw "NEW_DASHBOARD_FAILED_RESTORED_OLD_PID=$($recovery.Id) LOGS=$logdir"
}
$rea=Invoke-RestMethod "$base/api/rea/start" -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120
$u=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 45
$n=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 30).tools).Count
$page=(Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 15).Content
if($u.state -ne 'ready' -or -not $page.Contains('id="memoryStatus"')){throw 'UNIFIED_POSTSTART_VERIFICATION_FAILED'}
Write-Host "UNIFIED_AGENT_READY=PASS REA_ENABLED=$n MODEL_AND_COMPUTE_UNTOUCHED" -ForegroundColor Green
if($n -ne 229){Write-Warning 'REA allowlist differs from 229; inspect before executing REA tools.'}
Write-Host "UNIFIED_INSTALLED PID=$($new.Id) BACKUP=$backup URL=$base/" -ForegroundColor Green
Write-Warning 'approved:true is not strong authentication; keep local forwarding private and access controlled.'
