# Guarded Fun Industrial security integration into the existing 8789 chat.
# Default STAGE ONLY. -Apply authorizes a restart of ONLY the 8789 Node dashboard.
# 8443 gateway, external llama.cpp, Python API, Ollama, and NetBird are never restarted.
[CmdletBinding()]param([switch]$Apply)
$ErrorActionPreference='Stop'
$Src=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Python=Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
$Base='http://127.0.0.1:8789'
$Server=Join-Path $Live 'src\server.mjs'
$Html=Join-Path $Live 'public\index.html'
$Tools=Join-Path $Live 'src\platform-tools.mjs'
$LiveSec=Join-Path $Live 'src\security'
$Pin='a622d627fccb3934f23886b0360d8de4b92f82df42ff25a3d4f9e5b9b5488b9b'
$Baseline=Join-Path $env:LOCALAPPDATA 'FunIndustrial\SecurityIntegrityV1\candidate-baseline.json'
$Auto=Join-Path $env:LOCALAPPDATA 'FunIndustrial\DashboardAutostart'
$PolicyFile=Join-Path $Auto 'policy.json'
$TaskName='FunIndustrial-Dashboard8789-Autostart'
$Work=Join-Path $env:LOCALAPPDATA ('FunIndustrial\SecurityPrimary8789\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$Patch=Join-Path $Src 'scripts\patch-security-primary-8789.mjs'
$Mods=@('local-scan.mjs','defensive-audit.mjs','security-chat-client.js')
$PrePorts=@{};$PreAllowed=@();$PreCatalogue=0;$Policy=$null;$PolicyChanged=$false
$ExistingMods=@{};$Changed=$false;$OldStopped=$false;$NextProcess=$null;$OldPid=0
function Hold([string]$x){throw ('FUN_SECURITY_PRIMARY_HOLD='+$x)}
function Snap([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ',')
}
function Pid8789(){
 $p=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)
 if($p.Count -ne 1 -or $p[0].LocalAddress -ne '127.0.0.1' -or [int]$p[0].OwningProcess -le 0){Hold 'PORT_8789_LISTENER_IDENTITY'}
 $w=Get-CimInstance Win32_Process -Filter ("ProcessId="+$p[0].OwningProcess) -ErrorAction Stop
 if(-not $w -or $w.Name -ne 'node.exe' -or [string]$w.CommandLine -notmatch 'src[/\\]server\.mjs'){Hold 'PORT_8789_OWNER_NOT_RECOGNIZED'}
 return [int]$p[0].OwningProcess
}
function Api([string]$path,[int]$timeout=15){
 return Invoke-RestMethod -Uri ($Base+$path) -TimeoutSec $timeout -ErrorAction Stop
}
function CheckFile([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('MISSING_FILE_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_FILE_'+$p)}
}
function CheckDir([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Container)){Hold ('MISSING_DIR_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_DIR_'+$p)}
}
function StartDashboard([string]$name){
 $env:HOST='127.0.0.1';$env:PORT='8789';$env:COMPUTE_PORT='8791';$env:LOCAL_FIRST_MODE='true'
 $env:FUN_VOICE_HOME=Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceLab'
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$script:MemoryBudget
 $env:REA_ALLOWED_TOOLS=($script:PreAllowed -join ',')
 return Start-Process -FilePath $Node -ArgumentList 'src/server.mjs' -WorkingDirectory $Live -PassThru -RedirectStandardOutput ($name+'.stdout.log') -RedirectStandardError ($name+'.stderr.log')
}
function WaitReady([int]$id,[int]$tries=80){
 for($i=0;$i -lt $tries;$i++){
  Start-Sleep -Milliseconds 450
  try{
   if((Pid8789) -ne $id){continue}
   $x=Api '/api/security/status' 5
   $v=Api '/api/voice/mobile/status' 5
   $m=Api '/api/ai/automatic-memory/status' 5
   $a=Api '/api/ai/status' 5
   if($x.state -eq 'ready' -and [int]$x.port -eq 8789 -and $v.code -eq 'FI_VOICE_MOBILE_UPLOAD_V1' -and $v.enabled -eq $true -and $m.mode -eq 'automatic_contextual_read_only' -and $m.enabledByDefault -eq $true -and $a.state -eq 'ready'){return $true}
  }catch{}
 }
 return $false
}
foreach($p in @($Live,(Join-Path $Live 'src'),(Join-Path $Live 'public'),$Src)){CheckDir $p}
foreach($p in @($Server,$Html,$Tools,$Patch,$Python,$Baseline,(Join-Path $Src 'src\security\integrity_monitor.py'),(Join-Path $Src 'intelligence-checks\security-primary-8789-case.mjs'))){CheckFile $p}
foreach($name in $Mods){CheckFile (Join-Path $Src ('src\security\'+$name))}
if((Get-FileHash -LiteralPath $Baseline -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Pin){Hold 'BASELINE_PIN_MISMATCH'}
& $Python (Join-Path $Src 'src\security\integrity_monitor.py') verify --baseline $Baseline --expected-sha $Pin
if($LASTEXITCODE -ne 0){Hold 'PRE_DEPLOY_204_FILE_BASELINE_CHANGED'}
$original=[IO.File]::ReadAllText($Server)
foreach($marker in @('FI_AUTO_COGNEE_CHAT_V1','FI_VOICE_MOBILE_DASHBOARD_V1','FI_SOURCING_RETIRED_V1')){
 if(-not $original.Contains($marker)){Hold ('PROTECTED_LIVE_MARKER_MISSING_'+$marker)}
}
if($original.Contains('FI_SECURITY_PRIMARY_8789_V1')){Hold 'SECURITY_ALREADY_DEPLOYED'}
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$hasPolicy=Test-Path -LiteralPath $PolicyFile -PathType Leaf
if([bool]$task -ne [bool]$hasPolicy){Hold 'AUTOSTART_POLICY_TASK_MISMATCH'}
if($hasPolicy){
 CheckFile $PolicyFile
 $Policy=Get-Content -LiteralPath $PolicyFile -Raw -ErrorAction Stop|ConvertFrom-Json
 if($Policy.schema -ne 'fun.dashboard.autostart.v1' -or $Policy.deployedRoot -ne $Live -or $Policy.serverSha256 -ne (Get-FileHash $Server).Hash -or $Policy.htmlSha256 -ne (Get-FileHash $Html).Hash){Hold 'AUTOSTART_SOURCE_PIN_MISMATCH'}
}
$OldPid=Pid8789
$v=Api '/api/voice/mobile/status'
$m=Api '/api/ai/automatic-memory/status'
$a=Api '/api/ai/status'
$rea=Api '/api/rea/tools' 45
$cat=Api '/api/rea/catalog' 45
$PreAllowed=@($rea.tools|ForEach-Object {[string]$_.name})
$PreCatalogue=@($cat.tools).Count
$script:MemoryBudget=[int]$m.recallBudgetMs
if($v.enabled -ne $true -or $v.code -ne 'FI_VOICE_MOBILE_UPLOAD_V1' -or $m.mode -ne 'automatic_contextual_read_only' -or $m.enabledByDefault -ne $true -or $a.state -ne 'ready' -or $PreCatalogue -ne 229 -or $MemoryBudget -lt 12000 -or $MemoryBudget -gt 180000){Hold 'LIVE_SERVICE_PREFLIGHT_HOLD'}
if(@($PreAllowed|Sort-Object -Unique).Count -ne $PreAllowed.Count){Hold 'REA_ALLOWLIST_DUPLICATE'}
foreach($port in @(8088,8791,8443,4479,8794)){$PrePorts[$port]=Snap $port}
if(-not $PrePorts[8088] -or -not $PrePorts[8791]){Hold 'REQUIRED_INDEPENDENT_RUNTIME_MISSING'}
if(Test-Path -LiteralPath $LiveSec){CheckDir $LiveSec}
foreach($name in $Mods){
 $dest=Join-Path $LiveSec $name
 $ExistingMods[$name]=Test-Path -LiteralPath $dest -PathType Leaf
 if($ExistingMods[$name]){
  CheckFile $dest
  if((Get-FileHash $dest).Hash -ne (Get-FileHash (Join-Path $Src ('src\security\'+$name))).Hash){Hold ('SECURITY_MODULE_ALREADY_PRESENT_BUT_DIFFERENT_'+$name)}
 }
}
& $Node --check $Patch
if($LASTEXITCODE -ne 0){Hold 'PATCHER_NODE_SYNTAX'}
& $Node --check (Join-Path $Src 'src\security\defensive-audit.mjs')
if($LASTEXITCODE -ne 0){Hold 'AUDIT_NODE_SYNTAX'}
& $Node --check (Join-Path $Src 'src\security\security-chat-client.js')
if($LASTEXITCODE -ne 0){Hold 'CLIENT_NODE_SYNTAX'}
& $Node --test (Join-Path $Src 'intelligence-checks\security-primary-8789-case.mjs') (Join-Path $Src 'intelligence-checks\security-chat-phase4-case.mjs') (Join-Path $Src 'intelligence-checks\local-security-scan-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'LOCAL_TESTS_HOLD'}
New-Item -ItemType Directory -Path $Work -Force -ErrorAction Stop|Out-Null
Copy-Item $Server (Join-Path $Work 'server.original.mjs')
Copy-Item $Html (Join-Path $Work 'index.original.html')
Copy-Item $Tools (Join-Path $Work 'tools.original.mjs')
if($Policy){Copy-Item $PolicyFile (Join-Path $Work 'policy.original.json')}
$StageServer=Join-Path $Work 'server.staged.mjs'
$StageHtml=Join-Path $Work 'index.staged.html'
$StageTools=Join-Path $Work 'tools.staged.mjs'
& $Node $Patch $Server $Html $Tools $StageServer $StageHtml $StageTools
if($LASTEXITCODE -ne 0){Hold 'STAGING_PATCH_FAILED'}
& $Node --check $StageServer
if($LASTEXITCODE -ne 0){Hold 'STAGED_SERVER_SYNTAX'}
& $Node --check $StageTools
if($LASTEXITCODE -ne 0){Hold 'STAGED_TOOLS_SYNTAX'}
if(-not ([IO.File]::ReadAllText($StageHtml)).Contains('/api/security/client.js')){Hold 'STAGED_CHAT_CLIENT_MISSING'}
Write-Host "FUN_SECURITY_PRIMARY_STAGE=PASS PORT=8789 BASELINE=UNCHANGED REA_CATALOGUE=$PreCatalogue"
Write-Host "FUN_SECURITY_BACKUP=$Work"
if(-not $Apply){Write-Host 'FUN_SECURITY_PRIMARY_DEPLOY=NOT_PERFORMED USE_-Apply_TO_AUTHORIZE_8789_RESTART';exit 0}
try{
 $Changed=$true
 if(-not(Test-Path -LiteralPath $LiveSec)){New-Item -ItemType Directory $LiveSec -ErrorAction Stop|Out-Null}
 foreach($name in $Mods){
  if(-not $ExistingMods[$name]){Copy-Item (Join-Path $Src ('src\security\'+$name)) (Join-Path $LiveSec $name) -ErrorAction Stop}
 }
 Copy-Item $StageServer $Server -Force
 Copy-Item $StageHtml $Html -Force
 Copy-Item $StageTools $Tools -Force
 & $Node --check $Server
 if($LASTEXITCODE -ne 0){Hold 'LIVE_SERVER_SYNTAX'}
 & $Node --check $Tools
 if($LASTEXITCODE -ne 0){Hold 'LIVE_TOOLS_SYNTAX'}
 if((Pid8789) -ne $OldPid){Hold 'DASHBOARD_PID_CHANGED_BEFORE_RESTART'}
 Stop-Process -Id $OldPid -ErrorAction Stop
 $OldStopped=$true
 for($i=0;$i -lt 50;$i++){if(-not(Snap 8789)){break};Start-Sleep -Milliseconds 200}
 if(Snap 8789){Hold 'OLD_8789_PORT_NOT_RELEASED'}
 $NextProcess=StartDashboard (Join-Path $Work 'deployed')
 if(-not(WaitReady ([int]$NextProcess.Id))){Hold 'DEPLOYED_DASHBOARD_HEALTH_HOLD'}
 $page=(Invoke-WebRequest -Uri ($Base+'/') -UseBasicParsing -TimeoutSec 15).Content
 if(-not $page.Contains('/api/security/client.js')){Hold 'LIVE_SECURITY_CHAT_BUTTON_SCRIPT_NOT_SERVED'}
 $js=(Invoke-WebRequest -Uri ($Base+'/api/security/client.js') -UseBasicParsing -TimeoutSec 15).Content
 if(-not $js.Contains('FI_SECURITY_PRIMARY_CLIENT_V1')){Hold 'SECURITY_CLIENT_NOT_IDENTIFIED'}
 $names=@((Api '/api/ai/tools' 45).tools|ForEach-Object {$_.function.name})
 if($names -cnotcontains 'fi_security_local_audit'){Hold 'SECURITY_TOOL_NOT_REGISTERED'}
 # An unauthenticated tool-call must be refused without performing an audit.
 $denied=$false
 try{
  Invoke-WebRequest -Uri ($Base+'/api/ai/tool-call') -Method POST -UseBasicParsing -Body '{"name":"fi_security_local_audit","arguments":{}}' -ContentType 'application/json' -TimeoutSec 12 | Out-Null
 }catch{
  try{$denied=[int]$_.Exception.Response.StatusCode -eq 403}catch{}
 }
 if(-not $denied){Hold 'SECURITY_APPROVAL_HEADER_NOT_ENFORCED'}
 $result=Invoke-RestMethod -Uri ($Base+'/api/ai/tool-call') -Method POST -Headers @{'x-fi-security-approval'='operator-reviewed'} -Body '{"name":"fi_security_local_audit","arguments":{}}' -ContentType 'application/json' -TimeoutSec 90
 if($result.result.event -ne 'FUN_ENGLISH_LOCAL_SECURITY_AUDIT_V2' -or $result.result.state -ne 'completed' -or $result.result.constraints.rea_tools_executed -ne 0){Hold 'SECURITY_AUDIT_POSTFLIGHT_HOLD'}
 foreach($port in @(8088,8791,8443,4479,8794)){
  if((Snap $port) -ne $PrePorts[$port]){Hold ('PROTECTED_PORT_OWNER_CHANGED_'+$port)}
 }
 $reaAfter=@()
 try{$reaAfter=@((Api '/api/rea/catalog' 45).tools)}catch{}
 if($reaAfter.Count -ne $PreCatalogue){
  try{
   Invoke-RestMethod -Uri ($Base+'/api/rea/start') -Method POST -Body '{}' -ContentType 'application/json' -TimeoutSec 120 | Out-Null
   $reaAfter=@((Api '/api/rea/catalog' 45).tools)
  }catch{Hold 'REA_REINITIALIZATION_HOLD'}
 }
 if($reaAfter.Count -ne $PreCatalogue){Hold 'REA_229_CATALOGUE_REGRESSION'}
 $reaAllowedAfter=@((Api '/api/rea/tools' 45).tools|ForEach-Object {[string]$_.name})
 if(($reaAllowedAfter -join ',') -ne ($PreAllowed -join ',')){Hold 'REA_PERMISSION_REGRESSION'}
 if($Policy){
  $Policy.serverSha256=(Get-FileHash $Server -Algorithm SHA256).Hash
  $Policy.htmlSha256=(Get-FileHash $Html -Algorithm SHA256).Hash
  $Policy.verifiedExistingPid=[int]$NextProcess.Id
  $Policy.verifiedExistingStartUtcTicks=[int64]$NextProcess.StartTime.ToUniversalTime().Ticks
  $Policy.capturedUtc=[DateTime]::UtcNow.ToString('o')
  $candidate=Join-Path $Auto ('policy.security-8789-'+[guid]::NewGuid().ToString('N')+'.tmp')
  [IO.File]::WriteAllText($candidate,($Policy|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $candidate -Destination $PolicyFile -Force
  $PolicyChanged=$true
 }
 Write-Host 'FUN_SECURITY_PRIMARY_8789_DEPLOY=PASS'
 Write-Host "FUN_SECURITY_DASHBOARD_PID=$($NextProcess.Id) SECURITY_CHAT_ACTIVE=TRUE"
 Write-Host "FUN_SECURITY_AUDIT=$($result.result.state) SOURCE_FILES=$($result.result.source.files_inspected)"
 Write-Host 'FUN_SECURITY_GATEWAY_8443=UNCHANGED LLAMA_8088=UNCHANGED COMPUTE_8791=UNCHANGED'
 Write-Host 'FUN_SECURITY_REA_CATALOGUE_AND_ALLOWLIST=UNCHANGED'
 Write-Host "FUN_SECURITY_BACKUP=$Work"
 Write-Host 'FUN_SECURITY_BASELINE_204=EXPECTED_DRIFT_REVIEW_BEFORE_NEW_PIN'
}catch{
 $reason=$_.Exception.Message
 Write-Warning "FUN_SECURITY_PRIMARY=HOLD REASON=$reason BACKUP=$Work"
 if($NextProcess){
  try{$NextProcess.Refresh();if(-not $NextProcess.HasExited){Stop-Process -Id $NextProcess.Id -ErrorAction SilentlyContinue}}catch{}
 }
 if($Changed){
  Copy-Item (Join-Path $Work 'server.original.mjs') $Server -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $Work 'index.original.html') $Html -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $Work 'tools.original.mjs') $Tools -Force -ErrorAction SilentlyContinue
  foreach($name in $Mods){
   if(-not $ExistingMods[$name]){
    $dest=Join-Path $LiveSec $name
    if(Test-Path -LiteralPath $dest){
     if((Get-FileHash $dest).Hash -eq (Get-FileHash (Join-Path $Src ('src\security\'+$name))).Hash){Remove-Item -LiteralPath $dest -Force -ErrorAction SilentlyContinue}
    }
   }
  }
 }
 if($PolicyChanged){Copy-Item (Join-Path $Work 'policy.original.json') $PolicyFile -Force -ErrorAction SilentlyContinue}
 if($OldStopped){
  try{
   for($i=0;$i -lt 40;$i++){if(-not(Snap 8789)){break};Start-Sleep -Milliseconds 300}
   if(-not(Snap 8789)){
    $restored=StartDashboard (Join-Path $Work 'rollback')
    Write-Warning "FUN_SECURITY_DASHBOARD_ROLLBACK_STARTED_PID=$($restored.Id) VERIFY_VOICE_AND_MEMORY"
   }else{Write-Warning 'FUN_SECURITY_ROLLBACK_8789_OCCUPIED_MANUAL_REVIEW_REQUIRED'}
  }catch{Write-Warning "FUN_SECURITY_MANUAL_RECOVERY_REQUIRED_BACKUP=$Work"}
 }
 throw ('FUN_SECURITY_PRIMARY_DEPLOYMENT_HOLD='+$reason+' BACKUP='+$Work)
}
