# Fun Industrial V4.3 - optional-to-legacy, required-to-integrated private iPhone HTTPS step.
# Starts only the preconfigured, peer-restricted HTTPS gateway when missing.
# Does not change NetBird, Windows Firewall, dashboard, REA approvals, or Elektron.
# A running gateway is never restarted/replaced; only attested and adopted.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$GatewayHome=Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceGateway'
$ConfigPath=Join-Path $GatewayHome 'private-gateway.json'
$Launcher=Join-Path $PSScriptRoot 'Start-Fun-iPhone-HTTPS.ps1'
$PortHelper=Join-Path $PSScriptRoot 'src\voice\gateway-port-state.ps1'
$Attestor=Join-Path $PSScriptRoot 'src\voice\private-gateway-attest.mjs'
$PasswordPath=Join-Path $GatewayHome 'autostart\gateway-password.dpapi'
$PolicyPath=Join-Path $GatewayHome 'autostart\supervisor-policy.json'
function GatewayHold([string]$r){throw ('FUN_PRIVATE_HTTPS_HOLD='+$r)}
function RequiredFile([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){GatewayHold ('REQUIRED_FILE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){
  GatewayHold ('REPARSE_FILE_REFUSED_'+$p)
 }
}
foreach($p in @($ConfigPath,$PortHelper,$Attestor,$Launcher)){RequiredFile $p}
. $PortHelper
$Config=Get-Content -LiteralPath $ConfigPath -Raw -ErrorAction Stop|ConvertFrom-Json
if($Config.schema -cne 'fun.voice.gateway.private.v1' -or
 $Config.pcIp -cne '100.109.4.20' -or
 $Config.iphonePeerIp -cne '100.109.87.100' -or
 [int]$Config.port -ne 8443 -or
 $Config.publicHost -cne '100.109.4.20:8443'){
 GatewayHold 'PRIVATE_GATEWAY_CONFIG_OR_IPHONE_PEER_CHANGED'
}
foreach($p in @($Config.caPublicPem,$Config.tlsCertificate,$Config.tlsPrivateKey)){
 RequiredFile ([string]$p)
}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
RequiredFile $Node
function Snapshot(){
 $listeners=@(Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
 return Get-FunPrivateGatewayPortState -Listeners $listeners -ExpectedIp $Config.pcIp
}
function NetBirdReady(){
 if(-not(Get-NetIPAddress -IPAddress $Config.pcIp -AddressFamily IPv4 -ErrorAction SilentlyContinue)){return $false}
 $nb=Get-Command netbird.exe -ErrorAction SilentlyContinue
 $exe=if($nb){$nb.Source}else{'C:\Program Files\NetBird\netbird.exe'}
 if(-not(Test-Path -LiteralPath $exe -PathType Leaf)){return $false}
 try{
  $ip=(& $exe status --ipv4 2>$null|Out-String).Trim()
  return $ip -ceq $Config.pcIp
 }catch{return $false}
}
function VerifyVoice(){
 try{
  $v=Invoke-RestMethod -Uri 'http://127.0.0.1:8789/api/voice/mobile/status' -TimeoutSec 8 -ErrorAction Stop
  return $v.code -ceq 'FI_VOICE_MOBILE_UPLOAD_V1' -and $v.enabled -eq $true
 }catch{return $false}
}
function VerifyAttestation(){
 $response=@()
 try{
  $response=@(& $Node $Attestor $ConfigPath 2>$null)
  if($LASTEXITCODE -ne 0){return $false}
 }catch{return $false}
 return @($response|Where-Object{$_ -ceq 'FI_GATEWAY_PRIVATE_ATTEST=PASS TLS_PIN=EXACT LOCAL_ACCESS_DENIED=403'}).Count -eq 1
}
function ConfirmGatewayOwner([int]$processId){
 $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$processId) -ErrorAction Stop
 if(-not $proc -or $proc.Name -cne 'node.exe'){GatewayHold 'GATEWAY_OWNER_NOT_NODE'}
 # A visible non-gateway command line cannot be overridden by a passing HTTP response.
 if(-not [string]::IsNullOrWhiteSpace([string]$proc.CommandLine) -and
  $proc.CommandLine -notmatch 'gateway-entry\.mjs'){
  GatewayHold 'GATEWAY_OWNER_COMMAND_MISMATCH'
 }
 if(-not(VerifyAttestation)){GatewayHold 'GATEWAY_TLS_PIN_OR_LOCAL_DENIAL_FAILED'}
 return $processId
}
$before=Snapshot
if($before.State -eq 'conflict'){GatewayHold 'PORT_8443_CONFLICT_OR_NONPRIVATE_BIND'}
if(-not(NetBirdReady)){GatewayHold 'NETBIRD_PRIVATE_IP_NOT_READY_NO_NETWORK_CHANGES'}
if(-not(VerifyVoice)){GatewayHold 'ORIGINAL_8789_VOICE_UPLOAD_NOT_READY'}
if($before.State -eq 'existing'){
 $verified=ConfirmGatewayOwner ([int]$before.ListenerProcessId)
 Write-Host ('FUN_ADOPTED_PRIVATE_HTTPS_8443=PID_'+$verified)
}elseif($CheckOnly){
 Write-Host 'FUN_PRIVATE_HTTPS_CHECK_ONLY=READY_TO_START NO_CHANGES'
 return
}else{
 # An absent credential is not permission to store one. Interactively ask
 # for a new 24+ character password; use encrypted DPAPI only when enrolled.
 $hasCredential=Test-Path -LiteralPath $PasswordPath -PathType Leaf
 $hasPolicy=Test-Path -LiteralPath $PolicyPath -PathType Leaf
 if($hasCredential -ne $hasPolicy){GatewayHold 'PARTIAL_ENCRYPTED_CREDENTIAL_CONFIGURATION'}
 if((Snapshot).State -ne 'stopped'){GatewayHold 'GATEWAY_PORT_CHANGED_BEFORE_START'}
 if($hasCredential){
  RequiredFile $PasswordPath
  RequiredFile $PolicyPath
  Write-Host 'FUN_PRIVATE_HTTPS_CREDENTIAL=ENROLLED_DPAPI'
  & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Launcher -UseStoredCredential
 }else{
  Write-Host 'FUN_PRIVATE_HTTPS_CREDENTIAL=INTERACTIVE_SECURE_PASSWORD_NOT_STORED'
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Launcher
 }
 if($LASTEXITCODE -ne 0){GatewayHold 'PRIVATE_GATEWAY_START_FAILED_NO_AUTOMATIC_RETRY'}
 $after=Snapshot
 if($after.State -ne 'existing'){GatewayHold 'PRIVATE_GATEWAY_LISTENER_NOT_READY'}
 $verified=ConfirmGatewayOwner ([int]$after.ListenerProcessId)
 Write-Host ('FUN_STARTED_PRIVATE_HTTPS_8443=PID_'+$verified)
}
$stable=Snapshot
if($stable.State -ne 'existing' -or [int]$stable.ListenerProcessId -ne [int]$verified){
 GatewayHold 'PRIVATE_GATEWAY_LISTENER_CHANGED'
}
Write-Host 'FUN_PRIVATE_HTTPS=PASS TLS_PIN=EXACT PEER_IP_ONLY=TRUE'
Write-Host 'FUN_IPHONE_SAFARI=https://100.109.4.20:8443/'
Write-Host 'FUN_IPHONE_HTTPS_BACKEND=127.0.0.1:8789 VOICE_ENABLED=TRUE'
Write-Host 'FUN_PRIVATE_HTTPS_IPHONE_REAL_DEVICE_CHECK=NOT_PERFORMED'
