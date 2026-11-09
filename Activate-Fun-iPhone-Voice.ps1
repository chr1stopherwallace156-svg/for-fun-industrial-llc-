# Activate Fun Industrial iPhone Safari voice recording in its existing dashboard.
# Only the dashboard Node process on 8789 is replaced. Other services are preserved.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$R=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$V=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab"
$SRC=$PSScriptRoot;$B="http://127.0.0.1:8789";$Node=(Get-Command node.exe -ErrorAction Stop).Source
$S=Join-Path $R "src\server.mjs";$H=Join-Path $R "public\index.html"
$T=Join-Path $R "src\voice";$TM=Join-Path $T "mobile-upload.mjs";$TC=Join-Path $T "mobile-client.js"
$SM=Join-Path $SRC "src\voice\mobile-upload.mjs";$SC=Join-Path $SRC "src\voice\mobile-client.js"
$Panel=Join-Path $SRC "src\voice\mobile-panel.html";$Patch=Join-Path $SRC "scripts\patch-iphone-voice-dashboard.mjs"
$Test=Join-Path $SRC "intelligence-checks\iphone-voice-case.mjs";$Probe=Join-Path $SRC "scripts\check-iphone-voice-live.mjs"
$Recovery=Join-Path $SRC "Recover-Fun-Compute.ps1";$Flag=Join-Path $V "mobile-upload.enabled"
$Backup=Join-Path $env:LOCALAPPDATA ("FunIndustrial\VoiceMobileDeployBackups\"+(Get-Date -Format "yyyyMMdd-HHmmss")+"-"+[guid]::NewGuid().ToString("N").Substring(0,8))
$changed=$false;$stopped=$false;$createdFlag=$false;$newNode=$null;$stage="preflight";$oldTools=@()
function Check([string]$where){if($LASTEXITCODE -ne 0){throw "FI_VOICE_COMMAND_HOLD=$where EXIT=$LASTEXITCODE"}}
function Listener(){
 $list=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue|Where-Object{$_.LocalAddress -eq "127.0.0.1"})
 if($list.Count -ne 1){throw "FI_VOICE_DASHBOARD_LISTENER_HOLD"}
 $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$($list[0].OwningProcess)" -ErrorAction Stop
 if(-not $proc -or $proc.Name -ne "node.exe" -or $proc.CommandLine -notmatch "src[/\\]server\.mjs"){throw "FI_VOICE_DASHBOARD_IDENTITY_HOLD"}
 return $proc
}
function ComputeReady(){
 try{$h=Invoke-RestMethod "http://127.0.0.1:8791/health" -TimeoutSec 6 -ErrorAction Stop;return $h.state -eq "running"}catch{return $false}
}
function RecoverCompute(){
 if(ComputeReady){return}
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Recovery
 Check "COMPUTE_RECOVERY"
 if(-not (ComputeReady)){throw "FI_VOICE_COMPUTE_RECOVERY_HOLD"}
 Write-Host "FI_VOICE_COMPUTE_RECOVERY=PASS"
}
function StartUI([string]$out,[string]$err){
 $env:HOST="127.0.0.1";$env:PORT="8789";$env:COMPUTE_PORT="8791";$env:FUN_VOICE_HOME=$V
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$MemoryBudget
 $env:REA_ALLOWED_TOOLS=($oldTools|ForEach-Object{$_.name}) -join ","
 return Start-Process -FilePath $Node -ArgumentList "src/server.mjs" -WorkingDirectory $R -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
}
function WaitUI([System.Diagnostics.Process]$p,[bool]$voice){
 for($i=0;$i -lt 80;$i++){
  Start-Sleep -Milliseconds 500;$p.Refresh();if($p.HasExited){return $false}
  try{
   $m=Invoke-RestMethod "$B/api/ai/automatic-memory/status" -TimeoutSec 4 -ErrorAction Stop
   if($m.mode -ne "automatic_contextual_read_only" -or $m.enabledByDefault -ne $true){continue}
   if($voice){$v=Invoke-RestMethod "$B/api/voice/mobile/status" -TimeoutSec 4 -ErrorAction Stop;if($v.code -ne "FI_VOICE_MOBILE_UPLOAD_V1"){continue}}
   if([int](Listener).ProcessId -eq $p.Id){return $true}
  }catch{}
 }
 return $false
}
foreach($p in @($S,$H,$SM,$SC,$Panel,$Patch,$Test,$Probe,$Recovery,(Join-Path $V "venv\Scripts\python.exe"),(Join-Path $env:USERPROFILE "FunIndustrial-VoiceLab-Source\voice_lab\analyzer.py"))){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){throw "FI_VOICE_REQUIRED_FILE_HOLD=$p"}
}
foreach($p in @($TM,$TC,$Flag)){if(Test-Path -LiteralPath $p){throw "FI_VOICE_EXISTING_DEPLOYMENT_HOLD=$p"}}
$txt=[IO.File]::ReadAllText($S);$html=[IO.File]::ReadAllText($H)
if(-not $txt.Contains("FI_AUTO_COGNEE_CHAT_V1") -or -not $txt.Contains("FI_SOURCING_RETIRED_V1") -or $txt.Contains("FI_VOICE_MOBILE_DASHBOARD_V1")){throw "FI_VOICE_SERVER_BASELINE_HOLD"}
if($html.Contains("FI_VOICE_MOBILE_PANEL_V1")){throw "FI_VOICE_UI_ALREADY_PATCHED_HOLD"}
if(-not($html -match '(?is)<body(?:\s[^>]*)?>') -or -not($html -match '(?is)</body\s*>')){throw "FI_VOICE_UI_BODY_ANCHOR_HOLD"}
Write-Host "FI_VOICE_UI_COMPATIBILITY=PASS MODE=ADDITIVE BODY_ANCHOR=FOUND CHAT_INPUT_NOT_REQUIRED"
$old=Listener
$m=Invoke-RestMethod "$B/api/ai/automatic-memory/status" -TimeoutSec 15 -ErrorAction Stop
if($m.mode -ne "automatic_contextual_read_only" -or $m.enabledByDefault -ne $true -or $m.memoryAvailable -ne $true){throw "FI_VOICE_AUTOMATIC_MEMORY_PRECHECK_HOLD"}
$MemoryBudget=[int]$m.recallBudgetMs
if($MemoryBudget -lt 12000 -or $MemoryBudget -gt 180000){throw "FI_VOICE_MEMORY_BUDGET_HOLD"}
if(-not (ComputeReady)){throw "FI_VOICE_COMPUTE_PRECHECK_HOLD"}
$ai=Invoke-RestMethod "$B/api/ai/status" -TimeoutSec 15 -ErrorAction Stop
if($ai.state -ne "ready"){throw "FI_VOICE_AI_PRECHECK_HOLD"}
$oldTools=@((Invoke-RestMethod "$B/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools)
$unified=Invoke-RestMethod "$B/api/unified/status" -TimeoutSec 15 -ErrorAction Stop
if($oldTools.Count -ne 229 -or [int]$unified.rea_enabled -ne 229){throw "FI_VOICE_REA_PRECHECK_HOLD"}
$before=Invoke-RestMethod "$B/api/status" -TimeoutSec 15 -ErrorAction Stop
$oldAuto=@($before.services|Where-Object{$_.id -eq "autonomy"}|Select-Object -First 1)
& $Node --check $SM;Check "MODULE_SYNTAX"
& $Node --check $SC;Check "CLIENT_SYNTAX"
& $Node --check $Patch;Check "PATCHER_SYNTAX"
& $Node --test $Test;Check "TESTS"
New-Item -ItemType Directory -Path $Backup -Force|Out-Null
$OldS=Join-Path $Backup "original-server.mjs";$OldH=Join-Path $Backup "original-dashboard.html"
$StageS=Join-Path $Backup "staged-server.mjs";$StageH=Join-Path $Backup "staged-dashboard.html"
Copy-Item -LiteralPath $S -Destination $OldS;Copy-Item -LiteralPath $H -Destination $OldH
& $Node $Patch $S $H $StageS $StageH $Panel;Check "STAGING"
& $Node --check $StageS;Check "STAGED_SYNTAX"
if(-not([IO.File]::ReadAllText($StageS)).Contains("FI_AUTO_COGNEE_CHAT_V1") -or -not([IO.File]::ReadAllText($StageH)).Contains("FI_VOICE_MOBILE_PANEL_V1")){throw "FI_VOICE_STAGING_HOLD"}
Write-Host "FI_VOICE_PREFLIGHT=PASS VOICELAB=installed MEMORY=automatic REA=229 COMPUTE=8791 BACKUP=$Backup"
try{
 $stage="install_files";$changed=$true
 New-Item -ItemType Directory -Path $T -Force|Out-Null
 Copy-Item -LiteralPath $SM -Destination $TM
 Copy-Item -LiteralPath $SC -Destination $TC
 Copy-Item -LiteralPath $StageS -Destination $S -Force
 Copy-Item -LiteralPath $StageH -Destination $H -Force
 if((Get-FileHash $S).Hash -ne (Get-FileHash $StageS).Hash -or (Get-FileHash $H).Hash -ne (Get-FileHash $StageH).Hash){throw "FI_VOICE_FILE_HASH_HOLD"}
 $stage="restart_dashboard"
 Stop-Process -Id ([int]$old.ProcessId) -ErrorAction Stop;$stopped=$true
 for($i=0;$i -lt 45;$i++){if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 250}
 if(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue){throw "FI_VOICE_PORT_STILL_LISTENING"}
 $newNode=StartUI (Join-Path $Backup "voice.stdout.log") (Join-Path $Backup "voice.stderr.log")
 if(-not(WaitUI $newNode $true)){throw "FI_VOICE_DASHBOARD_STARTUP_HOLD"}
 Write-Host "FI_VOICE_STAGE=dashboard_ready"
 $stage="recover_compute";RecoverCompute
 $stage="rea_catalogue"
 $ra=Invoke-RestMethod "$B/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 120 -ErrorAction Stop
 if($ra.state -ne "ready"){throw "FI_VOICE_REA_START_HOLD"}
 $nowTools=@((Invoke-RestMethod "$B/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools)
 $nowUnified=Invoke-RestMethod "$B/api/unified/status" -TimeoutSec 15 -ErrorAction Stop
 if($nowTools.Count -ne 229 -or [int]$nowUnified.rea_enabled -ne 229){throw "FI_VOICE_REA_REGRESSION_HOLD"}
 if((Compare-Object @($oldTools|ForEach-Object{$_.name}|Sort-Object) @($nowTools|ForEach-Object{$_.name}|Sort-Object)).Count){throw "FI_VOICE_REA_NAMES_CHANGED"}
 $newMemory=Invoke-RestMethod "$B/api/ai/automatic-memory/status" -TimeoutSec 15 -ErrorAction Stop
 if($newMemory.mode -ne $m.mode -or [int]$newMemory.recallBudgetMs -ne $MemoryBudget){throw "FI_VOICE_MEMORY_CHANGED"}
 $after=Invoke-RestMethod "$B/api/status" -TimeoutSec 15 -ErrorAction Stop
 $newAuto=@($after.services|Where-Object{$_.id -eq "autonomy"}|Select-Object -First 1)
 if($oldAuto.Count -and $oldAuto[0].state -eq "running" -and (!$newAuto.Count -or $newAuto[0].state -ne "running")){throw "FI_VOICE_AUTONOMY_CHANGED"}
 $stage="enable_mobile_upload"
 New-Item -ItemType Directory -Path $V -Force|Out-Null
 [IO.File]::WriteAllText($Flag,("FI_VOICE_MOBILE_RECORDING_ENABLED_V1"+[char]10),[Text.UTF8Encoding]::new($false))
 $createdFlag=$true
 $v=Invoke-RestMethod "$B/api/voice/mobile/status" -TimeoutSec 10 -ErrorAction Stop
 if($v.enabled -ne $true){throw "FI_VOICE_ENABLE_FLAG_NOT_ACTIVE"}
 $stage="read_only_validate"
 & $Node $Probe;Check "LIVE_VALIDATION"
 Write-Host "FI_VOICE_DASHBOARD_DEPLOY=PASS PANEL=VISIBLE MOBILE_UPLOAD=ENABLED AUTOMATIC_ANALYSIS=FALSE"
 Write-Host "FI_VOICE_PRESERVED=PASS REA=229 MEMORY=$($newMemory.mode) COMPUTE=8791 LLAMA_CPP=ready"
 Write-Host "FI_VOICE_IPHONE_ACCESS=REQUIRES_AUTHENTICATED_TRUSTED_HTTPS_GATEWAY"
 Write-Host "FI_VOICE_BACKUP=$Backup"
}catch{
 $reason=$_.Exception.Message
 Write-Warning "FI_VOICE_DASHBOARD_DEPLOY=HOLD STAGE=$stage REASON=$reason"
 if($newNode){$newNode.Refresh();if(-not $newNode.HasExited){Stop-Process -Id $newNode.Id -Force -ErrorAction SilentlyContinue}}
 if($createdFlag){Remove-Item -LiteralPath $Flag -Force -ErrorAction SilentlyContinue}
 if($changed){
  Copy-Item -LiteralPath $OldS -Destination $S -Force
  Copy-Item -LiteralPath $OldH -Destination $H -Force
  Remove-Item -LiteralPath $TM,$TC -Force -ErrorAction SilentlyContinue
  Write-Warning "FI_VOICE_ROLLBACK_FILES=RESTORED"
 }
 if($stopped){
  try{
   $restore=StartUI (Join-Path $Backup "rollback.stdout.log") (Join-Path $Backup "rollback.stderr.log")
   if(WaitUI $restore $false){
    Write-Warning "FI_VOICE_PREVIOUS_DASHBOARD=RESTORED PID=$($restore.Id)"
    try{RecoverCompute}catch{Write-Warning "FI_VOICE_ROLLBACK_COMPUTE_HOLD=$($_.Exception.Message)"}
    try{
     $rr=Invoke-RestMethod "$B/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 120 -ErrorAction Stop
     $count=@((Invoke-RestMethod "$B/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools).Count
     Write-Warning "FI_VOICE_PREVIOUS_REA=$($rr.state) COUNT=$count"
    }catch{Write-Warning "FI_VOICE_ROLLBACK_REA_HOLD=$($_.Exception.Message)"}
   }else{Write-Warning "FI_VOICE_ROLLBACK_DASHBOARD_UNCONFIRMED"}
  }catch{Write-Warning "FI_VOICE_ROLLBACK_RESTART_HOLD=$($_.Exception.Message)"}
 }
 throw "FI_VOICE_DASHBOARD_DEPLOY_HOLD=$reason BACKUP=$Backup"
}
