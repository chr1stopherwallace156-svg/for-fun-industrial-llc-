# Fun Industrial private gateway user-logon supervisor.
# Runs ONLY in the signed-in user's session. DPAPI-protected password is used
# by the existing launcher, never read or echoed by this supervisor.
# Does not run a VPN login, change firewall, touch Elektron or restart dashboard.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Auto=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceGateway\autostart"
$HomeDir=Split-Path $Auto -Parent
$Policy=Join-Path $Auto "supervisor-policy.json"
$Config=Join-Path $HomeDir "private-gateway.json"
$Launcher=Join-Path $Auto "Start-Fun-iPhone-HTTPS.ps1"
$Credential=Join-Path $Auto "gateway-password.dpapi"
$StatusFile=Join-Path $Auto "supervisor-status.json"
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
 while($true){
  $gateway=Listener 8443 $g.pcIp
  $anyPort=@(Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
  if($anyPort.Count){
   if($gateway.Count -ne 1 -or $anyPort.Count -ne 1){
    Status "hold" "PORT_CONFLICT_OR_WRONG_BIND"
   }else{
    $owner=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$gateway[0].OwningProcess) -ErrorAction SilentlyContinue
    if($owner -and $owner.Name -eq "node.exe" -and $owner.CommandLine -match 'gateway-entry\.mjs'){
     Status "running" "EXISTING_GATEWAY_PRESERVED"
    }else{Status "hold" "UNEXPECTED_PROCESS_ON_PRIVATE_PORT"}
   }
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
     "-File",('"'+$Launcher+'"'),"-UseStoredCredential") -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -ErrorAction Stop
    if($proc.ExitCode -ne 0){Status "hold" ("LAUNCH_EXIT_"+$proc.ExitCode)}
    elseif((Listener 8443 $g.pcIp).Count -eq 1){Status "running" "AUTOSTART_GATEWAY_PASS"}
    else{Status "hold" "LAUNCH_NO_LISTENER"}
   }catch{Status "hold" "LAUNCH_FAILED"}
  }
  Start-Sleep -Seconds 20
 }
}finally{
 if($ownsMutex){try{$mutex.ReleaseMutex()}catch{}}
 $mutex.Dispose()
}
