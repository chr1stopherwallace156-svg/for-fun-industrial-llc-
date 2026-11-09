# Fun Industrial private gateway user-logon supervisor.
# Runs ONLY in the signed-in user's session. DPAPI-protected password is used
# by the existing launcher, never read or echoed by this supervisor.
# Does not run a VPN login, change firewall, touch Elektron or restart dashboard.
[CmdletBinding()]param([switch]$ProbeOnce)
$ErrorActionPreference="Stop"
$Auto=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceGateway\autostart"
$HomeDir=Split-Path $Auto -Parent
$Policy=Join-Path $Auto "supervisor-policy.json"
$Config=Join-Path $HomeDir "private-gateway.json"
$Launcher=Join-Path $Auto "Start-Fun-iPhone-HTTPS.ps1"
$Credential=Join-Path $Auto "gateway-password.dpapi"
$StatusFile=Join-Path $Auto "supervisor-status.json"
$PortStateSource=Join-Path $Auto "gateway-port-state.ps1"
if(-not(Test-Path -LiteralPath $PortStateSource -PathType Leaf)){throw "FI_GATEWAY_PORT_CLASSIFIER_MISSING"}
. $PortStateSource
$mutex=[System.Threading.Mutex]::new($false,"Local\FunIndustrial-PrivateGateway-Supervisor-v1")
$ownsMutex=$false
function Status([string]$state,[string]$code){
 $log=[ordered]@{schema="fun.voice.gateway.supervisor.status.v1";
  state=$state;reason=$code;checkedUtc=[DateTime]::UtcNow.ToString("o")}
 $tmp=Join-Path $Auto ("status-"+[guid]::NewGuid().ToString("N")+".tmp")
 try{
  [IO.File]::WriteAllText($tmp,($log|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tmp -Destination $StatusFile -Force -ErrorAction Stop
 }catch{Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue}
}
function Listener([int]$port,[string]$ip){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Where-Object{$_.LocalAddress -eq $ip})
}
function DashboardReady(){
 $localListeners=Listener 8789 "127.0.0.1"
 if($localListeners.Count -ne 1){return $false}
 try{
  $v=Invoke-RestMethod "http://127.0.0.1:8789/api/voice/mobile/status" -TimeoutSec 5
  return $v.enabled -eq $true -and $v.code -eq "FI_VOICE_MOBILE_UPLOAD_V1"
 }catch{return $false}
}
function NetBirdReady([string]$ip,[string]$peer){
 if(-not(Get-NetIPAddress -IPAddress $ip -AddressFamily IPv4 -ErrorAction SilentlyContinue)){return $false}
 $nb=Get-Command netbird.exe -ErrorAction SilentlyContinue
 $exe=if($nb){$nb.Source}else{"C:\Program Files\NetBird\netbird.exe"}
 if(-not(Test-Path -LiteralPath $exe -PathType Leaf)){return $false}
 try{
  $current=(& $exe status --ipv4 2>$null|Out-String).Trim()
  if($current -ne $ip){return $false}
  $rows=@((& $exe status --table --filter-by-status connected 2>$null|Out-String) -split "\r?\n"|
   Where-Object{$_ -match ('^\s*\S+\s+'+[regex]::Escape($peer)+'\s+Connected\b')})
  return $rows.Count -eq 1
 }catch{return $false}
}
try{
 try{$ownsMutex=$mutex.WaitOne(0)}catch [System.Threading.AbandonedMutexException]{$ownsMutex=$true}
 if(-not $ownsMutex){exit 0}
 foreach($file in @($Policy,$Config,$Launcher,$Credential)){
  if(-not(Test-Path -LiteralPath $file -PathType Leaf)){Status "hold" "CONFIGURATION_MISSING";exit 3}
 }
 $p=Get-Content -LiteralPath $Policy -Raw|ConvertFrom-Json
 $g=Get-Content -LiteralPath $Config -Raw|ConvertFrom-Json
 $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 if($p.schema -ne "fun.voice.gateway.autostart.v1" -or
    $p.sid -ne $sid -or
    $g.schema -ne "fun.voice.gateway.private.v1" -or
    $p.pcIp -ne $g.pcIp -or
    $p.iphonePeerIp -ne $g.iphonePeerIp -or
    [int]$p.gatewayPort -ne 8443 -or
    [int]$g.port -ne 8443 -or
    $g.publicHost -ne ($g.pcIp+":8443") -or
    $g.pcIp -ne "100.109.4.20" -or
    $g.iphonePeerIp -ne "100.109.87.100"){
  Status "hold" "POLICY_OR_IDENTITY_MISMATCH";exit 3
 }
 $powerShell=(Get-Command powershell.exe -ErrorAction Stop).Source
 if($ProbeOnce){
  # The installer runs this synchronously using the caller's Windows identity
  # BEFORE scheduling anything. It verifies policy, process ownership and
  # status-file writes without touching gateway, password, dashboard or VPN.
  $snap=@(Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
  $probeState=Get-FunPrivateGatewayPortState -Listeners $snap -ExpectedIp $g.pcIp
  if($probeState.State -eq "conflict"){
   Status "hold" "PROBE_PRIVATE_PORT_CONFLICT"
   throw "FI_GATEWAY_SUPERVISOR_PROBE_PORT_CONFLICT"
  }
  if($probeState.State -eq "existing"){
   $owner=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$probeState.ListenerProcessId) -ErrorAction Stop
   if(-not $owner -or $owner.Name -ne "node.exe" -or
      $owner.CommandLine -notmatch 'gateway-entry\.mjs'){
    Status "hold" "PROBE_GATEWAY_PROCESS_MISMATCH"
    throw "FI_GATEWAY_SUPERVISOR_PROBE_IDENTITY_HOLD"
   }
  }
  $reason=if($probeState.State -eq "existing"){"PROBE_EXISTING_GATEWAY"}else{"PROBE_GATEWAY_STOPPED"}
  Status "probe" $reason
  if(-not(Test-Path -LiteralPath $StatusFile -PathType Leaf)){
   throw "FI_GATEWAY_SUPERVISOR_PROBE_STATUS_WRITE_HOLD"
  }
  $written=Get-Content -LiteralPath $StatusFile -Raw -ErrorAction Stop|ConvertFrom-Json
  if($written.state -ne "probe" -or $written.reason -ne $reason){
   throw "FI_GATEWAY_SUPERVISOR_PROBE_STATUS_MISMATCH"
  }
  Write-Host "FI_GATEWAY_SUPERVISOR_PROBE=PASS STATE=$reason GATEWAY_PROCESS_UNCHANGED=TRUE"
  exit 0
 }
 while($true){
  # Classify a single port snapshot (do not race separate queries).
  $snapshot=@(Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
  $state=Get-FunPrivateGatewayPortState -Listeners $snapshot -ExpectedIp $g.pcIp
  if($state.State -eq "conflict"){
   Status "hold" "PORT_CONFLICT_OR_WRONG_BIND"
  }elseif($state.State -eq "existing"){
   $owner=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$state.ListenerProcessId) -ErrorAction SilentlyContinue
   if($owner -and $owner.Name -eq "node.exe" -and $owner.CommandLine -match 'gateway-entry\.mjs'){
    Status "running" "EXISTING_GATEWAY_PRESERVED"
   }else{Status "hold" "UNEXPECTED_PROCESS_ON_PRIVATE_PORT"}
  }elseif(-not(DashboardReady)){
   Status "waiting" "DASHBOARD_8789_UNAVAILABLE"
  }elseif(-not(NetBirdReady $g.pcIp $g.iphonePeerIp)){
   Status "waiting" "NETBIRD_IPHONE_PEER_UNAVAILABLE"
  }else{
   Status "starting" "PRIVATE_GATEWAY_LAUNCH"
   # Launch one short-lived PowerShell; actual gateway stays in a separate
   # Node process and is not stopped when supervisor or Termius exits.
   # Log only non-secret output from existing launcher.
   $out=Join-Path $Auto "latest-start.stdout.log"
   $err=Join-Path $Auto "latest-start.stderr.log"
   try{
    $proc=Start-Process -FilePath $powerShell -ArgumentList @(
     "-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass",
     "-File",('"'+$Launcher+'"'),"-UseStoredCredential") -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -ErrorAction Stop
    # Process.WaitForExit waits only for this short-lived PowerShell launcher,
    # unlike Start-Process -Wait (which may wait for its long-lived Node child).
    if(-not $proc.WaitForExit(60000)){
     Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
     Status "hold" "LAUNCHER_TIMEOUT"
    }elseif($proc.ExitCode -ne 0){Status "hold" ("LAUNCH_EXIT_"+$proc.ExitCode)}
    elseif((Get-FunPrivateGatewayPortState -Listeners @(Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue) -ExpectedIp $g.pcIp).State -eq "existing"){Status "running" "AUTOSTART_GATEWAY_PASS"}
    else{Status "hold" "LAUNCH_NO_LISTENER"}
   }catch{Status "hold" "LAUNCH_FAILED"}
  }
  Start-Sleep -Seconds 20
 }
}finally{
 if($ownsMutex){try{$mutex.ReleaseMutex()}catch{}}
 $mutex.Dispose()
}
