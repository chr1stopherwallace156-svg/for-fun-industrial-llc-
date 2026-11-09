# Repair ONLY the iPhone Safari microphone JavaScript used by the live dashboard.
# No service restarts, REA execution, or voice recording transfers.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Root=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$Source=Join-Path $PSScriptRoot "src\voice\mobile-client.js"
$Destination=Join-Path $Root "src\voice\mobile-client.js"
$Server=Join-Path $Root "src\server.mjs"
$Case=Join-Path $PSScriptRoot "intelligence-checks\iphone-safari-pcm-case.mjs"
$ExistingCase=Join-Path $PSScriptRoot "intelligence-checks\iphone-voice-case.mjs"
$BackupDir=Join-Path $env:LOCALAPPDATA ("FunIndustrial\SafariVoiceRepairBackups\"+(Get-Date -Format "yyyyMMdd-HHmmss")+"-"+[guid]::NewGuid().ToString("N").Substring(0,8))
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Api="http://127.0.0.1:8789/api/voice/mobile/client.js"
$StatusApi="http://127.0.0.1:8789/api/voice/mobile/status"
function Fail([string]$name){throw "FI_SAFARI_PCM_REPAIR_HOLD=$name"}
function Check([string]$name){if($LASTEXITCODE -ne 0){Fail "$name EXIT=$LASTEXITCODE"}}
function PortPid([int]$port,[string]$bind=""){
 $ls=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
 if($bind){$ls=@($ls|Where-Object{$_.LocalAddress -eq $bind})}
 if($ls.Count -ne 1){Fail ("PORT_"+$port+"_LISTENER_EXPECTED_ONE_FOUND_"+$ls.Count)}
 return [int]$ls[0].OwningProcess
}
$required=@($Source,$Destination,$Server,$Case,$ExistingCase)
foreach($p in $required){if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Fail "MISSING_FILE=$p"}}
$srcText=[IO.File]::ReadAllText($Source)
$oldText=[IO.File]::ReadAllText($Destination)
$serverText=[IO.File]::ReadAllText($Server)
if(-not $srcText.Contains("FI_VOICE_MOBILE_CLIENT_V3_PCM_PLAYBACK")){Fail "SOURCE_VERSION_NOT_V3"}
if($oldText.Contains("FI_VOICE_MOBILE_CLIENT_V3_PCM_PLAYBACK")){Fail "ALREADY_DEPLOYED"}
if(-not $oldText.Contains("FI_VOICE_MOBILE_CLIENT_V2_PCM_SAFARI")){Fail "UNKNOWN_EXISTING_CLIENT_EXPECTED_V2"}
if(-not $serverText.Contains("FI_VOICE_MOBILE_DASHBOARD_V1") -or
 -not $serverText.Contains('path.join(root,"voice","mobile-client.js")') -or
 -not $serverText.Contains("FI_AUTO_COGNEE_CHAT_V1")){Fail "LIVE_SERVER_BASELINE_UNEXPECTED"}
$beforeDashboard=PortPid 8789 "127.0.0.1"
$beforeGateway=PortPid 8443 "100.109.4.20"
$status=Invoke-RestMethod -Uri $StatusApi -TimeoutSec 10 -ErrorAction Stop
if($status.enabled -ne $true -or $status.code -ne "FI_VOICE_MOBILE_UPLOAD_V1"){Fail "MOBILE_UPLOAD_NOT_READY"}
$beforeResponse=Invoke-WebRequest -Uri $Api -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
if($beforeResponse.StatusCode -ne 200 -or -not $beforeResponse.Content.Contains("FI_VOICE_MOBILE_CLIENT_V2_PCM_SAFARI")){Fail "LIVE_V2_CLIENT_NOT_CONFIRMED"}
& $Node --check $Source
Check "SOURCE_SYNTAX"
& $Node --test $Case $ExistingCase
Check "NODE_TESTS"
New-Item -ItemType Directory -Force -Path $BackupDir|Out-Null
$Original=Join-Path $BackupDir "original-mobile-client.js"
Copy-Item -LiteralPath $Destination -Destination $Original -ErrorAction Stop
$expectedHash=(Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
$changed=$false
try{
 $changed=$true
 Copy-Item -LiteralPath $Source -Destination $Destination -Force -ErrorAction Stop
 $actualHash=(Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash
 if($actualHash -ne $expectedHash){Fail "SOURCE_HASH_MISMATCH"}
 $live=Invoke-WebRequest -Uri $Api -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
 if($live.StatusCode -ne 200 -or -not $live.Content.Contains("FI_VOICE_MOBILE_CLIENT_V3_PCM_PLAYBACK")){Fail "LIVE_SCRIPT_V3_NOT_VISIBLE"}
 $afterDashboard=PortPid 8789 "127.0.0.1"
 $afterGateway=PortPid 8443 "100.109.4.20"
 if($afterDashboard -ne $beforeDashboard -or $afterGateway -ne $beforeGateway){Fail "LISTENER_PROCESS_CHANGED"}
 $afterStatus=Invoke-RestMethod -Uri $StatusApi -TimeoutSec 10 -ErrorAction Stop
 if($afterStatus.enabled -ne $true){Fail "VOICE_UPLOAD_STATUS_CHANGED"}
 Write-Host "FI_SAFARI_PCM_REPAIR=PASS CLIENT=V3_WEB_AUDIO_PLAYBACK ORIGINAL_BACKED_UP=TRUE"
 Write-Host "FI_SAFARI_PCM_LIVE_SCRIPT=PASS STATUS_HTTP=200 UPLOAD=ENABLED"
 Write-Host "FI_SAFARI_PCM_NO_RESTARTS=TRUE DASHBOARD_PID=$afterDashboard HTTPS_PID=$afterGateway"
 Write-Host "FI_SAFARI_PCM_BACKUP=$Original"
 Write-Host "FI_SAFARI_PCM_NEXT=REOPEN_HTTPS_DASHBOARD_IN_SAFARI_RECORD_PLAY_AND_UPLOAD"
}catch{
 $reason=$_.Exception.Message
 if($changed){
  Copy-Item -LiteralPath $Original -Destination $Destination -Force -ErrorAction SilentlyContinue
  Write-Warning "FI_SAFARI_PCM_ROLLBACK=RESTORED_ORIGINAL_CLIENT"
 }
 throw "FI_SAFARI_PCM_REPAIR_HOLD=$reason BACKUP=$Original"
}
