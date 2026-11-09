# Activate Fun Industrial's local iPhone voice -> offline STT -> llama.cpp chat.
# Explicit manual asks only; no autonomous REA execution, Cognee writes, or
# voice cloning. Only dashboard Node 8789 is restarted, with backup/rollback.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$R=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$VoiceLab=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab"
$ConvHome=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceConversation"
$Models=Join-Path $ConvHome "models"
$Venv=Join-Path $ConvHome "venv"
$Py=Join-Path $Venv "Scripts\python.exe"
$Boot=Join-Path $VoiceLab "venv\Scripts\python.exe"
$Flag=Join-Path $ConvHome "conversation.enabled"
$Transcript=Join-Path $ConvHome "transcribe.py"
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$B="http://127.0.0.1:8789"
$S=Join-Path $R "src\server.mjs"
$H=Join-Path $R "public\index.html"
$LiveVoice=Join-Path $R "src\voice"
$SttSource=Join-Path $PSScriptRoot "src\voice\transcribe.py"
$ModuleSource=Join-Path $PSScriptRoot "src\voice\conversation.mjs"
$ClientSource=Join-Path $PSScriptRoot "src\voice\conversation-client.js"
$ModuleLive=Join-Path $LiveVoice "conversation.mjs"
$ClientLive=Join-Path $LiveVoice "conversation-client.js"
$Patcher=Join-Path $PSScriptRoot "scripts\patch-iphone-conversation.mjs"
$Tests=Join-Path $PSScriptRoot "intelligence-checks\iphone-conversation-case.mjs"
$Backup=Join-Path $env:LOCALAPPDATA ("FunIndustrial\VoiceConversationDeployBackups\"+(Get-Date -Format "yyyyMMdd-HHmmss")+"-"+[guid]::NewGuid().ToString("N").Substring(0,8))
$changed=$false;$stopped=$false;$started=$null;$oldUi=$null
$stage="preflight";$oldTools=@();$memoryBudget=0
function Fail([string]$reason){throw "FI_VOICE_CONVERSATION_HOLD STAGE=$stage REASON=$reason"}
function Check([string]$name){if($LASTEXITCODE -ne 0){Fail ("$name EXIT="+$LASTEXITCODE)}}
# Windows PowerShell 5.1 can treat harmless pip/Whisper progress on stderr
# as a fatal NativeCommandError. Keep exit codes authoritative.
function RunNative([string]$exe,[string]$phase,[string[]]$items){
 $oldPreference=$ErrorActionPreference
 $nativeExit=$null
 try{
  $ErrorActionPreference="Continue"
  & $exe @items
  $nativeExit=$LASTEXITCODE
 }finally{$ErrorActionPreference=$oldPreference}
 if($nativeExit -ne 0){Fail ("$phase EXIT="+$nativeExit)}
}
function PortPid([int]$port,[string]$ip){
 $listeners=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Where-Object{$_.LocalAddress -eq $ip})
 if($listeners.Count -ne 1){Fail ("PORT_"+$port+"_EXPECTED_ONE_FOUND_"+$listeners.Count)}
 return [int]$listeners[0].OwningProcess
}
function CurrentUI(){
 $id=PortPid 8789 "127.0.0.1"
 $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction Stop
 if(!$proc -or $proc.Name -ne "node.exe" -or $proc.CommandLine -notmatch 'src[/\\]server\.mjs'){
  Fail "DASHBOARD_PROCESS_IDENTITY_CHANGED"
 }
 return $proc
}
function ComputeHealthy(){
 try{$result=Invoke-RestMethod "http://127.0.0.1:8791/health" -TimeoutSec 8 -ErrorAction Stop
  return $result.state -eq "running"}catch{return $false}
}
function StartDashboard([string]$out,[string]$err){
 $env:HOST="127.0.0.1";$env:PORT="8789";$env:COMPUTE_PORT="8791"
 $env:FUN_VOICE_HOME=$VoiceLab
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$memoryBudget
 $env:REA_ALLOWED_TOOLS=($oldTools|ForEach-Object{$_.name}) -join ","
 return Start-Process -FilePath $Node -ArgumentList "src/server.mjs" -WorkingDirectory $R -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
}
function WaitDashboard([System.Diagnostics.Process]$p,[bool]$newVersion){
 for($i=0;$i -lt 60;$i++){
  Start-Sleep -Milliseconds 400
  $p.Refresh();if($p.HasExited){return $false}
  try{
   if((CurrentUI).ProcessId -ne $p.Id){continue}
   $m=Invoke-RestMethod "$B/api/ai/automatic-memory/status" -TimeoutSec 4 -ErrorAction Stop
   $v=Invoke-RestMethod "$B/api/voice/mobile/status" -TimeoutSec 4 -ErrorAction Stop
   if($m.mode -ne "automatic_contextual_read_only" -or $v.enabled -ne $true){continue}
   if($newVersion){
    $c=Invoke-RestMethod "$B/api/voice/conversation/status" -TimeoutSec 4 -ErrorAction Stop
    if($c.enabled -ne $true -or $c.schema -ne "fun.voice.conversation.v1"){continue}
   }
   return $true
  }catch{}
 }
 return $false
}
foreach($f in @($S,$H,$Boot,$SttSource,$ModuleSource,$ClientSource,$Patcher,$Tests,
 (Join-Path $LiveVoice "mobile-client.js"),
 (Join-Path $LiveVoice "mobile-upload.mjs"))){
 if(-not(Test-Path -LiteralPath $f -PathType Leaf)){Fail "REQUIRED_FILE_MISSING=$f"}
}
foreach($f in @($ModuleLive,$ClientLive,$Flag)){
 if(Test-Path -LiteralPath $f){Fail "ALREADY_CONFIGURED_OR_CONFLICT=$f"}
}
$serverText=[IO.File]::ReadAllText($S)
$htmlText=[IO.File]::ReadAllText($H)
if(-not $serverText.Contains("FI_VOICE_MOBILE_DASHBOARD_V1") -or
 -not $serverText.Contains("FI_AUTO_COGNEE_CHAT_V1") -or
 -not $serverText.Contains("FI_SOURCING_RETIRED_V1") -or
 $serverText.Contains("FI_VOICE_CONVERSATION_DASHBOARD_V1") -or
 -not $htmlText.Contains("FI_VOICE_MOBILE_PANEL_V1") -or
 -not $htmlText.Contains('src="/api/voice/mobile/client.js"') -or
 -not([IO.File]::ReadAllText((Join-Path $LiveVoice "mobile-client.js"))).Contains("FI_VOICE_MOBILE_CLIENT_V3_PCM_PLAYBACK")){
 Fail "LIVE_DASHBOARD_BASELINE_HOLD"
}
$oldUi=CurrentUI
$oldGateway=PortPid 8443 "100.109.4.20"
$oldCompute=PortPid 8791 "127.0.0.1"
$oldLlama=PortPid 8088 "127.0.0.1"
if(-not(ComputeHealthy)){Fail "COMPUTE_NOT_RUNNING"}
$ai=Invoke-RestMethod "$B/api/ai/status" -TimeoutSec 10 -ErrorAction Stop
if($ai.state -ne "ready"){Fail "LOCAL_LLAMA_CPP_NOT_READY"}
$m=Invoke-RestMethod "$B/api/ai/automatic-memory/status" -TimeoutSec 12 -ErrorAction Stop
if($m.mode -ne "automatic_contextual_read_only" -or $m.enabledByDefault -ne $true){
 Fail "MEMORY_BASELINE_UNEXPECTED"
}
$memoryBudget=[int]$m.recallBudgetMs
if($memoryBudget -lt 12000 -or $memoryBudget -gt 180000){Fail "MEMORY_BUDGET_UNEXPECTED"}
$oldTools=@((Invoke-RestMethod "$B/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools)
if($oldTools.Count -ne 229){Fail "REA_CATALOGUE_EXPECTED_229_FOUND_$($oldTools.Count)"}
$mobile=Invoke-RestMethod "$B/api/voice/mobile/status" -TimeoutSec 8 -ErrorAction Stop
if($mobile.code -ne "FI_VOICE_MOBILE_UPLOAD_V1" -or $mobile.enabled -ne $true){
 Fail "IPHONE_AUDIO_UPLOAD_NOT_READY"
}
& $Node --check $ModuleSource;Check "CONVERSATION_SERVER_JS_SYNTAX"
& $Node --check $ClientSource;Check "CONVERSATION_BROWSER_JS_SYNTAX"
& $Node --check $Patcher;Check "PATCHER_SYNTAX"
& $Node --test $Tests;Check "CONVERSATION_REGRESSION"
Write-Host "FI_VOICE_CONVERSATION_PREFLIGHT=PASS REA=229 MEMORY=READ_ONLY LLAMA_CPP=READY HTTPS_PID=$oldGateway"
# The model and packages are installed BEFORE the dashboard is changed.
$stage="offline_stt_setup"
if(Test-Path -LiteralPath $ConvHome){
 if(Test-Path -LiteralPath $Flag){Fail "CONVERSATION_ALREADY_ENABLED"}
 if(Test-Path -LiteralPath $Transcript){Fail "STT_HOME_ALREADY_HAS_TRANSCRIBER_REFUSE_OVERWRITE"}
}
New-Item -ItemType Directory -Path $ConvHome,$Models -Force|Out-Null
if(-not(Test-Path -LiteralPath $Py -PathType Leaf)){
 RunNative $Boot "CREATE_SEPARATE_STT_VENV" @("-m","venv",$Venv)
}
RunNative $Py "INSTALL_LOCAL_CPU_STT" @("-m","pip","install","--disable-pip-version-check","--no-input","faster-whisper==1.2.1")
# This one-time step downloads the tiny.en model into a bounded local folder.
# All transcript requests later use the installed directory with offline mode.
$env:HF_HUB_DISABLE_TELEMETRY="1";$env:HF_HUB_DISABLE_PROGRESS_BARS="1"
$env:HF_HUB_OFFLINE="0"
RunNative $Py "DOWNLOAD_STT_MODEL" @("-c",'from faster_whisper.utils import download_model;import sys;download_model("tiny.en",output_dir=sys.argv[1]);print("FI_STT_MODEL_DOWNLOADED=PASS")',$Models)
foreach($file in @("model.bin","config.json","tokenizer.json")){
 if(-not(Test-Path -LiteralPath (Join-Path $Models $file) -PathType Leaf)){
  Fail "STT_MODEL_FILE_MISSING=$file"
 }
}
$env:HF_HUB_OFFLINE="1"
RunNative $Py "STT_OFFLINE_MODEL_LOAD" @("-c",'import sys;from faster_whisper import WhisperModel;WhisperModel(sys.argv[1],device="cpu",compute_type="int8",local_files_only=True);print("FI_STT_OFFLINE_MODEL_LOAD=PASS")',$Models)
Copy-Item -LiteralPath $SttSource -Destination $Transcript -ErrorAction Stop
RunNative $Py "STT_PYTHON_SYNTAX" @("-m","py_compile",$Transcript)
Write-Host "FI_VOICE_STT_PREPARED=PASS MODEL=tiny.en LOCAL_ONLY=TRUE PYTHON_ISOLATED=TRUE"
$stage="stage_dashboard"
New-Item -ItemType Directory -Path $Backup -Force|Out-Null
$OldServer=Join-Path $Backup "original-server.mjs"
$OldHtml=Join-Path $Backup "original-dashboard.html"
$NewServer=Join-Path $Backup "staged-server.mjs"
$NewHtml=Join-Path $Backup "staged-dashboard.html"
Copy-Item -LiteralPath $S -Destination $OldServer -ErrorAction Stop
Copy-Item -LiteralPath $H -Destination $OldHtml -ErrorAction Stop
& $Node $Patcher $S $H $NewServer $NewHtml
Check "STAGE_ADDITIVE_ROUTES"
& $Node --check $NewServer;Check "STAGED_DASHBOARD_SYNTAX"
if(-not([IO.File]::ReadAllText($NewServer)).Contains("FI_AUTO_COGNEE_CHAT_V1") -or
 -not([IO.File]::ReadAllText($NewHtml)).Contains("FI_VOICE_CONVERSATION_UI_V1")){
 Fail "STAGING_PRESERVATION_HOLD"
}
Write-Host "FI_VOICE_CONVERSATION_STAGED=PASS BACKUP=$Backup"
try{
 $stage="install_staged_files"
 $changed=$true
 Copy-Item -LiteralPath $ModuleSource -Destination $ModuleLive -ErrorAction Stop
 Copy-Item -LiteralPath $ClientSource -Destination $ClientLive -ErrorAction Stop
 Copy-Item -LiteralPath $NewServer -Destination $S -Force -ErrorAction Stop
 Copy-Item -LiteralPath $NewHtml -Destination $H -Force -ErrorAction Stop
 if((Get-FileHash $S).Hash -ne (Get-FileHash $NewServer).Hash -or
    (Get-FileHash $H).Hash -ne (Get-FileHash $NewHtml).Hash){Fail "STAGED_HASH_MISMATCH"}
 [IO.File]::WriteAllText($Flag,("FI_FUN_VOICE_CONVERSATION_ENABLED_V1"+[char]10),[Text.UTF8Encoding]::new($false))
 $stage="restart_only_dashboard"
 Stop-Process -Id ([int]$oldUi.ProcessId) -ErrorAction Stop
 $stopped=$true
 for($i=0;$i -lt 50;$i++){
  if(-not(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)){break}
  Start-Sleep -Milliseconds 200
 }
 if(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue){Fail "DASHBOARD_PORT_NOT_RELEASED"}
 $started=StartDashboard (Join-Path $Backup "conversation.stdout.log") (Join-Path $Backup "conversation.stderr.log")
 if(-not(WaitDashboard $started $true)){Fail "NEW_DASHBOARD_NOT_READY"}
 $stage="preservation_requalification"
 if((PortPid 8443 "100.109.4.20") -ne $oldGateway -or
 (PortPid 8791 "127.0.0.1") -ne $oldCompute -or
 (PortPid 8088 "127.0.0.1") -ne $oldLlama){Fail "PROTECTED_PROCESS_CHANGED"}
 if(-not(ComputeHealthy)){Fail "COMPUTE_HEALTH_CHANGED"}
 $aiAfter=Invoke-RestMethod "$B/api/ai/status" -TimeoutSec 10 -ErrorAction Stop
 if($aiAfter.state -ne "ready"){Fail "LLAMA_CPP_HEALTH_CHANGED"}
 $memAfter=Invoke-RestMethod "$B/api/ai/automatic-memory/status" -TimeoutSec 12 -ErrorAction Stop
 if($memAfter.mode -ne $m.mode -or
    [int]$memAfter.recallBudgetMs -ne $memoryBudget){Fail "MEMORY_CHANGED"}
 # Only starts the pre-existing REA catalogue process; never calls a tool.
 $reaReady=Invoke-RestMethod "$B/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 110 -ErrorAction Stop
 if($reaReady.state -ne "ready"){Fail "REA_CATALOGUE_INITIALIZE_HOLD"}
 $afterTools=@((Invoke-RestMethod "$B/api/rea/tools" -TimeoutSec 45 -ErrorAction Stop).tools)
 if($afterTools.Count -ne 229 -or
  (Compare-Object @($oldTools|ForEach-Object{$_.name}|Sort-Object) @($afterTools|ForEach-Object{$_.name}|Sort-Object)).Count){
  Fail "REA_CATALOGUE_CHANGED"
 }
 $page=(Invoke-WebRequest "$B/" -UseBasicParsing -TimeoutSec 10).Content
 $client=(Invoke-WebRequest "$B/api/voice/conversation/client.js" -UseBasicParsing -TimeoutSec 10).Content
 if(-not $page.Contains("FI_VOICE_CONVERSATION_UI_V1") -or
    -not $client.Contains("FI_VOICE_CONVERSATION_CLIENT_V1")){Fail "IPHONE_CONVERSATION_UI_NOT_LIVE"}
 Write-Host "FI_VOICE_CONVERSATION_ACTIVATE=PASS STT=OFFLINE_CPU LOCAL_AI=LLAMA_CPP"
 Write-Host "FI_VOICE_CONVERSATION_PRESERVED=PASS HTTPS_PID=$oldGateway COMPUTE_PID=$oldCompute LLAMA_PID=$oldLlama REA=229 MEMORY=$($memAfter.mode)"
 Write-Host "FI_VOICE_CONVERSATION_DASHBOARD_PID=$($started.Id)"
 Write-Host "FI_VOICE_CONVERSATION_OPERATOR=MANUAL_ONLY TOOLS_EXECUTED=0 MEMORY_WRITES=0"
 Write-Host "FI_VOICE_CONVERSATION_BACKUP=$Backup"
 Write-Host "FI_VOICE_CONVERSATION_NEXT=REOPEN_IPHONE_SAFARI_UPLOAD_RECORDING_THEN_ASK"
}catch{
 $reason=$_.Exception.Message
 Write-Warning "FI_VOICE_CONVERSATION_ACTIVATE=HOLD STAGE=$stage REASON=$reason"
 if($started){$started.Refresh();if(-not $started.HasExited){Stop-Process -Id $started.Id -Force -ErrorAction SilentlyContinue}}
 if($changed){
  Copy-Item -LiteralPath $OldServer -Destination $S -Force
  Copy-Item -LiteralPath $OldHtml -Destination $H -Force
  Remove-Item -LiteralPath $ModuleLive,$ClientLive,$Flag -Force -ErrorAction SilentlyContinue
  Write-Warning "FI_VOICE_CONVERSATION_ROLLBACK_FILES=RESTORED"
 }
 if($stopped){
  try{
   $restored=StartDashboard (Join-Path $Backup "rollback.stdout.log") (Join-Path $Backup "rollback.stderr.log")
   if(WaitDashboard $restored $false){
    Write-Warning "FI_VOICE_PREVIOUS_DASHBOARD=RESTORED PID=$($restored.Id)"
    try{Invoke-RestMethod "$B/api/rea/start" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 110|Out-Null}catch{}
   }else{Write-Warning "FI_VOICE_ROLLBACK_DASHBOARD_NOT_VERIFIED"}
  }catch{Write-Warning "FI_VOICE_ROLLBACK_RESTART_FAILED=$($_.Exception.Message)"}
 }
 throw "FI_VOICE_CONVERSATION_ACTIVATION_HOLD=$reason BACKUP=$Backup"
}
