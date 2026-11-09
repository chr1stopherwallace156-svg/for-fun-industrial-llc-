# Update an ALREADY-REGISTERED Fun Industrial iPhone gateway autostart.
# Does not stop/restart any process, create/remove tasks, or change NetBird/firewall.
# Operator explicitly resynchronizes the DPAPI startup credential with the
# already-working Safari fiiphone password (never sent to GitHub or logged).
[CmdletBinding()]param([switch]$SyncCredential)
$ErrorActionPreference="Stop"
$root=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceGateway"
$auto=Join-Path $root "autostart"
$taskName="FunIndustrial-PrivateGateway-Autostart"
$policyPath=Join-Path $auto "supervisor-policy.json"
$cfgPath=Join-Path $root "private-gateway.json"
$credential=Join-Path $auto "gateway-password.dpapi"
$files=@(
 @{source="Watch-Fun-iPhone-HTTPS.ps1";target="Watch-Fun-iPhone-HTTPS.ps1"},
 @{source="Start-Fun-iPhone-HTTPS.ps1";target="Start-Fun-iPhone-HTTPS.ps1"},
 @{source="src\voice\private-gateway-attest.mjs";target="private-gateway-attest.mjs"}
)
function Hold([string]$r){throw ("FI_GATEWAY_AUTOSTART_UPDATE_HOLD="+$r)}
function SecurePlain([Security.SecureString]$s){
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
 try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
 finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
}
$backup=$null
$a=$null;$b=$null;$plainA=$null;$plainB=$null;$encrypted=$null
$credentialChanged=$false
try{
 $task=Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
 if($task.State -ne "Running"){Hold "TASK_NOT_RUNNING"}
 $currentIdentity=[Security.Principal.WindowsIdentity]::GetCurrent()
 $policy=Get-Content -LiteralPath $policyPath -Raw -ErrorAction Stop|ConvertFrom-Json
 $cfg=Get-Content -LiteralPath $cfgPath -Raw -ErrorAction Stop|ConvertFrom-Json
 if($policy.schema -ne "fun.voice.gateway.autostart.v1" -or
    $policy.sid -ne $currentIdentity.User.Value -or
    $cfg.schema -ne "fun.voice.gateway.private.v1" -or
    $cfg.pcIp -ne "100.109.4.20" -or $cfg.iphonePeerIp -ne "100.109.87.100" -or
    [int]$cfg.port -ne 8443 -or $cfg.publicHost -ne "100.109.4.20:8443" -or
    $policy.pcIp -ne $cfg.pcIp -or $policy.iphonePeerIp -ne $cfg.iphonePeerIp -or
    [int]$policy.gatewayPort -ne 8443){Hold "POLICY_OR_IDENTITY_MISMATCH"}
 if(-not(Test-Path -LiteralPath $credential -PathType Leaf)){Hold "CREDENTIAL_MISSING"}
 $taskAction=@($task.Actions)
 if($taskAction.Count -ne 1){Hold "UNEXPECTED_TASK_ACTION_COUNT"}
 $expectedSupervisor=Join-Path $auto "Watch-Fun-iPhone-HTTPS.ps1"
 if([string]$taskAction[0].Execute -notmatch 'powershell(\.exe)?$' -or
    -not ([string]$taskAction[0].Arguments).Contains($expectedSupervisor)){
  Hold "TASK_ACTION_NOT_RECOGNIZED"
 }
 $port=@(Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
 if($port.Count -ne 1 -or $port[0].LocalAddress -ne "100.109.4.20"){
  Hold "LIVE_GATEWAY_PORT_NOT_EXACTLY_PRIVATE"
 }
 $owner=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$port[0].OwningProcess) -ErrorAction Stop
 if($owner.Name -ne "node.exe" -or $owner.CommandLine -notmatch 'gateway-entry\.mjs'){
  Hold "LIVE_GATEWAY_IDENTITY_NOT_CONFIRMED"
 }
 foreach($m in $files){
  $src=Join-Path $PSScriptRoot $m.source
  $dst=Join-Path $auto $m.target
  if(-not(Test-Path -LiteralPath $src -PathType Leaf) -or
     -not(Test-Path -LiteralPath $dst -PathType Leaf)){Hold "SOURCE_OR_INSTALLED_SCRIPT_MISSING"}
 }
 $watchSource=Join-Path $PSScriptRoot "Watch-Fun-iPhone-HTTPS.ps1"
 $launcherSource=Join-Path $PSScriptRoot "Start-Fun-iPhone-HTTPS.ps1"
 if(-not ([IO.File]::ReadAllText($watchSource)).Contains('NETBIRD_HOST_IP_UNAVAILABLE') -or
    -not ([IO.File]::ReadAllText($launcherSource)).Contains('FI_GATEWAY_AUTHORIZED_IPHONE_PEER_CONFIG_HOLD')){
  Hold "SOURCE_STARTUP_POLICY_NOT_UPDATED"
 }
 $psfiles=@($watchSource,$launcherSource)
 foreach($file in $psfiles){
  $tokens=$null;$errors=$null
  [System.Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)|Out-Null
  if($errors.Count){Hold "SOURCE_POWERSHELL_PARSE_ERROR"}
 }
 $node=(Get-Command node.exe -ErrorAction Stop).Source
 & $node --check (Join-Path $PSScriptRoot "src\voice\private-gateway-attest.mjs")
 if($LASTEXITCODE -ne 0){Hold "ATTEST_SCRIPT_SYNTAX_HOLD"}
 if($SyncCredential){
  Write-Host "FI_GATEWAY_CREDENTIAL_SYNC=EXPLICIT_EXISTING_SAFARI_PASSWORD"
  $a=Read-Host "Enter SAME fiiphone password currently working in iPhone Safari" -AsSecureString
  $b=Read-Host "Confirm existing Safari password" -AsSecureString
  $plainA=SecurePlain $a
  $plainB=SecurePlain $b
  if($plainA.Length -lt 24 -or $plainA.Length -gt 200 -or
     $plainA.Contains([char]10) -or $plainA.Contains([char]13) -or
     $plainA -cne $plainB){Hold "CREDENTIAL_FORMAT_OR_CONFIRMATION_HOLD"}
  $encrypted=$a|ConvertFrom-SecureString -ErrorAction Stop
  if($encrypted -notmatch '^[a-fA-F0-9]{100,}$'){Hold "DPAPI_ENCRYPTION_HOLD"}
  $plainA=$null;$plainB=$null;$a=$null;$b=$null
 }
 $backup=Join-Path $root ("autostart-backup-"+(Get-Date -Format 'yyyyMMdd-HHmmss')+"-"+[guid]::NewGuid().ToString("N").Substring(0,7))
 New-Item -ItemType Directory -Path $backup -ErrorAction Stop|Out-Null
 & icacls.exe $backup /inheritance:r /grant:r ("*"+$currentIdentity.User.Value+":(OI)(CI)F") "SYSTEM:(OI)(CI)F"|Out-Null
 if($LASTEXITCODE -ne 0){Hold "BACKUP_ACL_HOLD"}
 foreach($m in $files){
  Copy-Item -LiteralPath (Join-Path $auto $m.target) -Destination (Join-Path $backup $m.target) -ErrorAction Stop
 }
 # Keep a user-only encrypted backup in case the optional credential sync fails.
 if($SyncCredential){Copy-Item -LiteralPath $credential -Destination (Join-Path $backup "gateway-password.dpapi") -ErrorAction Stop}
 $written=@()
 try{
  foreach($m in $files){
   $src=Join-Path $PSScriptRoot $m.source
   $dst=Join-Path $auto $m.target
   Copy-Item -LiteralPath $src -Destination $dst -Force -ErrorAction Stop
   $written+= $m.target
   if((Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash -ne
      (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash){Hold "UPDATED_SOURCE_HASH_MISMATCH"}
  }
  if($SyncCredential){
   [IO.File]::WriteAllText($credential,$encrypted,[Text.UTF8Encoding]::new($false))
   $credentialChanged=$true
   $decrypted=ConvertTo-SecureString -String ([IO.File]::ReadAllText($credential).Trim()) -ErrorAction Stop
   if($decrypted.Length -lt 24){Hold "DPAPI_ROUNDTRIP_HOLD"}
   $decrypted=$null
  }
 }catch{
  foreach($m in $files){
   $prior=Join-Path $backup $m.target
   if(Test-Path -LiteralPath $prior -PathType Leaf){
    Copy-Item -LiteralPath $prior -Destination (Join-Path $auto $m.target) -Force -ErrorAction SilentlyContinue
   }
  }
  if($SyncCredential -and $credentialChanged){
   Copy-Item -LiteralPath (Join-Path $backup "gateway-password.dpapi") -Destination $credential -Force -ErrorAction SilentlyContinue
  }
  throw
 }
 $after=@(Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
 if($after.Count -ne 1 -or [int]$after[0].OwningProcess -ne [int]$port[0].OwningProcess){
  Hold "LIVE_GATEWAY_CHANGED_DURING_UPDATE"
 }
 Write-Host "FI_GATEWAY_AUTOSTART_INPLACE_UPDATE=PASS TASK_UNCHANGED=TRUE GATEWAY_PID_PRESERVED=$($owner.ProcessId)"
 Write-Host ("FI_GATEWAY_CREDENTIAL_SYNC="+$(if($SyncCredential){"DPAPI_CURRENT_USER_UPDATED_OPERATOR_ENTERED"}else{"UNCHANGED"}))
 Write-Host "FI_GATEWAY_AUTHORIZED_IPHONE=100.109.87.100 ACCESS_RULES_UNCHANGED=TRUE"
 Write-Host "FI_GATEWAY_AUTOSTART_NEW_CODE=NEXT_WINDOWS_SIGNIN RUNNING_SUPERVISOR_NOT_RESTARTED"
 Write-Host "FI_GATEWAY_DASHBOARD_AUTOSTART=NOT_CONFIGURED_BY_THIS_UPDATE"
 Write-Host "FI_GATEWAY_OTHER_SERVICES=NOT_RESTARTED"
 Write-Host ("FI_GATEWAY_AUTOSTART_BACKUP="+$backup)
}catch{
 if($_.Exception.Message -like "FI_GATEWAY_AUTOSTART_UPDATE_HOLD=*"){throw}
 throw ("FI_GATEWAY_AUTOSTART_UPDATE_HOLD="+$_.Exception.GetType().Name)
}finally{
 $a=$null;$b=$null;$plainA=$null;$plainB=$null;$encrypted=$null
}
