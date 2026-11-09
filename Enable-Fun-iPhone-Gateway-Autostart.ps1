# Enroll current user's private Fun Industrial HTTPS gateway in Windows Task Scheduler.
# Explicit opt-in: chosen password is typed twice and stored encrypted by
# user-scoped DPAPI (not in repo, env, logs, or plaintext config).
# Supports both gateway stopped and gateway already running. Never replaces a
# listening process or restarts other Fun Industrial/Elektron services.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Root=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceGateway"
$ConfigFile=Join-Path $Root "private-gateway.json"
$Auto=Join-Path $Root "autostart"
$PolicyFile=Join-Path $Auto "supervisor-policy.json"
$CredentialFile=Join-Path $Auto "gateway-password.dpapi"
$StatusFile=Join-Path $Auto "supervisor-status.json"
$TaskName="FunIndustrial-PrivateGateway-Autostart"
$SourceSupervisor=Join-Path $PSScriptRoot "Watch-Fun-iPhone-HTTPS.ps1"
$SourceLauncher=Join-Path $PSScriptRoot "Start-Fun-iPhone-HTTPS.ps1"
$SourceGateway=Join-Path $PSScriptRoot "src\gateway.mjs"
$SourceEntry=Join-Path $PSScriptRoot "src\voice\private-gateway-entry.mjs"
$SourceSelftest=Join-Path $PSScriptRoot "src\voice\private-gateway-selftest.mjs"
$PortStateSource=Join-Path $PSScriptRoot "src\voice\gateway-port-state.ps1"
$AutoSupervisor=Join-Path $Auto "Watch-Fun-iPhone-HTTPS.ps1"
$AutoLauncher=Join-Path $Auto "Start-Fun-iPhone-HTTPS.ps1"
$AutoPortState=Join-Path $Auto "gateway-port-state.ps1"
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$identity=[System.Security.Principal.WindowsIdentity]::GetCurrent()
$sid=$identity.User.Value
$name=$identity.Name
$created=$false;$registered=$false
function Hold([string]$reason){throw "FI_GATEWAY_AUTOSTART_SETUP_HOLD=$reason"}
function Listener([int]$port,[string]$ip){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Where-Object{$_.LocalAddress -eq $ip})
}
function Plain([System.Security.SecureString]$secret){
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
 try{return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
 finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
}
function ParsePowerShell([string]$file){
 $tokens=$null;$errors=$null
 [System.Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)|Out-Null
 if($errors.Count){Hold "POWERSHELL_SOURCE_PARSE_FAIL"}
}
if(Test-Path -LiteralPath $Auto){Hold "ALREADY_CONFIGURED_OR_PARTIAL_AUTOSTART_DIRECTORY_EXISTS"}
if(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue){
 Hold "TASK_ALREADY_REGISTERED_DO_NOT_REPLACE"
}
foreach($file in @($ConfigFile,$SourceSupervisor,$SourceLauncher,$SourceGateway,$SourceEntry,$SourceSelftest,$PortStateSource)){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){Hold "REQUIRED_FILE_NOT_FOUND"}
}
ParsePowerShell $SourceSupervisor
ParsePowerShell $SourceLauncher
ParsePowerShell $PortStateSource
. $PortStateSource
if(-not([IO.File]::ReadAllText($SourceLauncher)).Contains('param([switch]$UseStoredCredential)')){
 Hold "LAUNCHER_STORED_CREDENTIAL_MODE_MISSING"
}
& $Node --check $SourceGateway
if($LASTEXITCODE -ne 0){Hold "GATEWAY_MODULE_SYNTAX_FAILED"}
& $Node --check $SourceEntry
if($LASTEXITCODE -ne 0){Hold "GATEWAY_ENTRY_SYNTAX_FAILED"}
& $Node --check $SourceSelftest
if($LASTEXITCODE -ne 0){Hold "GATEWAY_SELFTEST_SYNTAX_FAILED"}
$cfg=Get-Content -LiteralPath $ConfigFile -Raw -ErrorAction Stop|ConvertFrom-Json
if($cfg.schema -ne "fun.voice.gateway.private.v1" -or
 $cfg.pcIp -ne "100.109.4.20" -or
 $cfg.iphonePeerIp -ne "100.109.87.100" -or
 [int]$cfg.port -ne 8443 -or
 $cfg.publicHost -ne "100.109.4.20:8443"){
 Hold "CONFIGURATION_OR_PEER_MISMATCH"
}
foreach($file in @($cfg.caPublicPem,$cfg.tlsCertificate,$cfg.tlsPrivateKey,$cfg.source)){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){Hold "PREPARED_CERTIFICATE_OR_GATEWAY_FILE_MISSING"}
}
# One snapshot avoids race/shape issues across two independent listener queries.
$portSnapshot=@(Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
$portState=Get-FunPrivateGatewayPortState -Listeners $portSnapshot -ExpectedIp $cfg.pcIp
$existingGateway=$portState.State -eq "existing"
$gp=$null
if($portState.State -eq "conflict"){
 Hold "GATEWAY_PORT_8443_CONFLICT_OR_WRONG_BIND"
}
if($existingGateway){
 $gp=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$portState.ListenerProcessId) -ErrorAction Stop
 if($gp.Name -ne "node.exe" -or $gp.CommandLine -notmatch 'gateway-entry\.mjs'){
  Hold "UNEXPECTED_PROCESS_OWNS_GATEWAY_PORT"
 }
}
# The dashboard is a RUNTIME prerequisite, not an ENROLLMENT prerequisite.
# A missing 8789 listener is safe: register the task and let the supervisor
# wait until Fun Industrial starts. Refuse unexpected listeners/bindings.
$dashboardSnapshot=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)
$dashboardLocal=@($dashboardSnapshot|Where-Object{$_.LocalAddress -eq "127.0.0.1"})
$dashboardReady=$false
if($dashboardSnapshot.Count -eq 0){
 Write-Host "FI_GATEWAY_DASHBOARD_PREFLIGHT=WAITING REASON=DASHBOARD_8789_NOT_LISTENING"
}elseif($dashboardSnapshot.Count -ne 1 -or $dashboardLocal.Count -ne 1){
 Hold "DASHBOARD_8789_UNEXPECTED_BIND_OR_CONFLICT"
}else{
 $dashboardProcess=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$dashboardLocal[0].OwningProcess) -ErrorAction Stop
 if(-not $dashboardProcess -or $dashboardProcess.Name -ne "node.exe" -or
    $dashboardProcess.CommandLine -notmatch 'src[/\\]server\.mjs'){
  Hold "DASHBOARD_8789_PROCESS_IDENTITY_HOLD"
 }
 try{$voice=Invoke-RestMethod "http://127.0.0.1:8789/api/voice/mobile/status" -TimeoutSec 10 -ErrorAction Stop}
 catch{$voice=$null}
 if($voice -and $voice.code -ne "FI_VOICE_MOBILE_UPLOAD_V1"){Hold "DASHBOARD_VOICE_ENDPOINT_UNEXPECTED"}
 if($voice -and $voice.enabled -eq $true){
  $dashboardReady=$true
  Write-Host "FI_GATEWAY_DASHBOARD_PREFLIGHT=PASS PORT=8789"
 }else{
  Write-Host "FI_GATEWAY_DASHBOARD_PREFLIGHT=WAITING REASON=VOICE_ENDPOINT_NOT_READY"
 }
}
# Password can never be retrieved from a running gateway. If it is already
# running, require its SAME password. If it is stopped, this password becomes
# the new password when the supervisor next starts the gateway.
Write-Host "FI_GATEWAY_AUTOSTART_ENROLL=EXPLICIT_PRIVATE_CREDENTIAL_STORAGE"
if($existingGateway){
 Write-Host "Gateway is running. Enter the SAME fiiphone password currently used in Safari."
 Write-Host "The gateway will NOT be restarted. Current-password match is not verifiable from the local PC."
}else{
 Write-Host "Gateway is STOPPED. Choose the fiiphone password to use from now on (24+ characters)."
 Write-Host "If the dashboard/NetBird prerequisites are ready, the supervisor can start the gateway automatically."
}
$a=Read-Host "fiiphone password for automatic gateway startup" -AsSecureString
$b=Read-Host "Confirm fiiphone startup password" -AsSecureString
if(-not $a -or -not $b){Hold "GATEWAY_PASSWORD_REQUIRED"}
$pa=Plain $a;$pb=Plain $b
try{
 if($pa.Length -lt 24 -or $pa.Length -gt 200 -or
    $pa.Contains([char]10) -or $pa.Contains([char]13)){Hold "GATEWAY_PASSWORD_FORMAT_HOLD"}
 if($pa -cne $pb){Hold "PASSWORD_CONFIRMATION_MISMATCH"}
}finally{$pa=$null;$pb=$null;$b=$null}
$encrypted=$a|ConvertFrom-SecureString -ErrorAction Stop
$a=$null
if($encrypted -notmatch '^[0-9a-fA-F]{100,}$'){Hold "CURRENT_USER_DPAPI_ENCRYPTION_FAILED"}
try{
 New-Item -ItemType Directory -Path $Auto -ErrorAction Stop|Out-Null
 $created=$true
 $aclArg=("*"+$sid+":(OI)(CI)F")
 & icacls.exe $Auto /inheritance:r /grant:r $aclArg "SYSTEM:(OI)(CI)F"|Out-Null
 if($LASTEXITCODE -ne 0){Hold "AUTOSTART_DIRECTORY_ACL_FAIL"}
 $subdir=Join-Path $Auto "src\voice"
 New-Item -ItemType Directory -Path $subdir -Force -ErrorAction Stop|Out-Null
 [IO.File]::WriteAllText($CredentialFile,$encrypted,[Text.UTF8Encoding]::new($false))
 $encrypted=$null
 & icacls.exe $CredentialFile /inheritance:r /grant:r ("*"+$sid+":F") "SYSTEM:F"|Out-Null
 if($LASTEXITCODE -ne 0){Hold "DPAPI_CREDENTIAL_ACL_FAIL"}
 Copy-Item -LiteralPath $SourceSupervisor -Destination $AutoSupervisor -ErrorAction Stop
 Copy-Item -LiteralPath $SourceLauncher -Destination $AutoLauncher -ErrorAction Stop
 Copy-Item -LiteralPath $PortStateSource -Destination $AutoPortState -ErrorAction Stop
 Copy-Item -LiteralPath $SourceGateway -Destination (Join-Path $Auto "src\gateway.mjs") -ErrorAction Stop
 Copy-Item -LiteralPath $SourceEntry -Destination (Join-Path $subdir "private-gateway-entry.mjs") -ErrorAction Stop
 Copy-Item -LiteralPath $SourceSelftest -Destination (Join-Path $subdir "private-gateway-selftest.mjs") -ErrorAction Stop
 $policy=[ordered]@{
  schema="fun.voice.gateway.autostart.v1";
  sid=$sid;pcIp=$cfg.pcIp;iphonePeerIp=$cfg.iphonePeerIp;
  gatewayPort=8443;dashboardPort=8789;credentialProtection="Windows-DPAPI-current-user";
  taskName=$TaskName;userLogonOnly=$true;firewallUnchanged=$true;
  credentialSavedUtc=[DateTime]::UtcNow.ToString("o")
 }
 [IO.File]::WriteAllText($PolicyFile,($policy|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
 # Verify the stored secret is decryptable only in the current Windows user context.
 $recovered=Get-Content -LiteralPath $CredentialFile -Raw -ErrorAction Stop
 $check=ConvertTo-SecureString -String $recovered.Trim() -ErrorAction Stop
 if(-not $check -or $check.Length -lt 24){Hold "DPAPI_CREDENTIAL_SELFTEST_FAIL"}
 $check=$null;$recovered=$null
 # Synchronous, read-only supervisor probe in the enrolling Windows account.
 # Check status writes and ownership BEFORE registering any scheduled task.
 $probeExe=(Get-Command powershell.exe -ErrorAction Stop).Source
 & $probeExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $AutoSupervisor -ProbeOnce
 if($LASTEXITCODE -ne 0){Hold ("SUPERVISOR_FOREGROUND_PROBE_FAILED_EXIT_"+$LASTEXITCODE)}
 if(-not(Test-Path -LiteralPath $StatusFile -PathType Leaf)){Hold "SUPERVISOR_PROBE_DID_NOT_WRITE_STATUS"}
 $probe=Get-Content -LiteralPath $StatusFile -Raw -ErrorAction Stop|ConvertFrom-Json
 if($probe.state -ne "probe" -or $probe.reason -notin @("PROBE_EXISTING_GATEWAY","PROBE_GATEWAY_STOPPED")){
  Hold "SUPERVISOR_PROBE_WRONG_STATUS"
 }
 if($existingGateway -and $probe.reason -ne "PROBE_EXISTING_GATEWAY"){
  Hold "SUPERVISOR_PROBE_EXISTING_GATEWAY_UNCONFIRMED"
 }
 Write-Host ("FI_GATEWAY_SUPERVISOR_FOREGROUND_PROBE=PASS REASON="+$probe.reason)
 # User-logon task, no elevated privilege and no stored Windows logon password.
 $action=New-ScheduledTaskAction -Execute ((Get-Command powershell.exe -ErrorAction Stop).Source) -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$AutoSupervisor+'"')
 $trigger=New-ScheduledTaskTrigger -AtLogOn -User $name
 $principal=New-ScheduledTaskPrincipal -UserId $name -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Fun Industrial iPhone-only private HTTPS gateway at user sign-in, DPAPI protected, no firewall changes." -ErrorAction Stop|Out-Null
 $registered=$true
 $task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
 if($task.State -eq "Disabled"){Hold "TASK_DISABLED"}
 # Try to start the interactive-logon task immediately. Over SSH there
 # may be no interactive desktop token: task registration can still be valid
 # for the NEXT desktop sign-in. Never erase DPAPI enrollment solely because
 # the supervisor cannot report "running" from this session.
 $taskStart="REQUESTED"
 try{Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop}
 catch{$taskStart="NOT_STARTED_FROM_CURRENT_SESSION"}
 $seen=$false;$status=$null
 for($i=0;$i -lt 20;$i++){
  Start-Sleep -Milliseconds 500
  if(Test-Path -LiteralPath $StatusFile -PathType Leaf){
   try{$status=Get-Content -LiteralPath $StatusFile -Raw|ConvertFrom-Json}catch{continue}
   if($status.state -in @("running","waiting","hold")){$seen=$true;break}
  }
 }
 if($seen -and $status.state -eq "hold"){Hold ("SUPERVISOR_REPORTED_"+$status.reason)}
 $scheduled=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
 if($scheduled.State -eq "Disabled"){Hold "TASK_BECAME_DISABLED"}
 $taskDetails=Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
 $lastResult=if($taskDetails){[int64]$taskDetails.LastTaskResult}else{0}
 # 0x41303 = not yet run; 0x41301 = currently running.
 if(-not $seen -and $lastResult -notin @(0,267011,267009)){
  Hold ("TASK_STARTUP_FAILED_RESULT_"+$lastResult)
 }
 $pendingSignIn=-not $seen
 if($pendingSignIn){
  Write-Warning ("FI_GATEWAY_AUTOSTART_PENDING_DESKTOP_SIGNIN TASK_STATE="+$scheduled.State+
   " TASK_START="+$taskStart+" LAST_TASK_RESULT="+$lastResult)
 }
 $afterSnapshot=@(Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
 $afterState=Get-FunPrivateGatewayPortState -Listeners $afterSnapshot -ExpectedIp $cfg.pcIp
 if($existingGateway){
  if($afterState.State -ne "existing" -or
     $afterState.ListenerProcessId -ne $portState.ListenerProcessId){
   Hold "EXISTING_GATEWAY_PROCESS_CHANGED"
  }
 }elseif($seen -and $status.state -eq "running"){
  if($afterState.State -ne "existing"){Hold "GATEWAY_AUTOSTART_LISTENER_NOT_PRESENT"}
 }elseif($seen -and $status.state -eq "waiting" -and $afterState.State -ne "stopped"){
  Hold "WAITING_STATE_WITH_UNEXPECTED_GATEWAY_LISTENER"
 }
 if($pendingSignIn){
  Write-Host "FI_GATEWAY_AUTOSTART_SETUP=PASS_REGISTERED_PENDING_SIGNIN TASK=$TaskName"
 }else{
  Write-Host "FI_GATEWAY_AUTOSTART_SETUP=PASS TASK=$TaskName"
 }
 Write-Host "FI_GATEWAY_CREDENTIAL_STORAGE=DPAPI_CURRENT_USER_ENCRYPTED NO_PLAINTEXT_FILE=TRUE"
 if($existingGateway -and $pendingSignIn){
  Write-Host "FI_GATEWAY_SUPERVISOR=PENDING_DESKTOP_SIGNIN CURRENT_GATEWAY_PRESERVED=TRUE PID=$($gp.ProcessId)"
 }elseif($existingGateway){
  Write-Host "FI_GATEWAY_SUPERVISOR=RUNNING CURRENT_GATEWAY_PRESERVED=TRUE PID=$($gp.ProcessId)"
 }elseif($pendingSignIn){
  Write-Host "FI_GATEWAY_SUPERVISOR=PENDING_DESKTOP_SIGNIN GATEWAY_RECOVERED=FALSE"
 }elseif($status.state -eq "running"){
  Write-Host "FI_GATEWAY_SUPERVISOR=RUNNING GATEWAY_RECOVERED=TRUE PID=$($afterState.ListenerProcessId)"
 }else{
  Write-Host "FI_GATEWAY_SUPERVISOR=WAITING DEPENDENCY=$($status.reason) GATEWAY_RECOVERED=FALSE"
 }
 Write-Host "FI_GATEWAY_TRIGGER=WINDOWS_USER_SIGNIN WATCH=EVERY_20_SECONDS"
 Write-Host "FI_GATEWAY_PRIVATE_ACCESS=100.109.4.20:8443 IPHONE_ONLY=100.109.87.100"
 Write-Host "FI_GATEWAY_AUTOSTART_NOTE=USE_THE_PASSWORD_JUST_ENROLLED_IF_GATEWAY_WAS_STOPPED"
 Write-Host "FI_GATEWAY_OTHER_SERVICES=NOT_RESTARTED"
}catch{
 $reason=$_.Exception.Message
 # Capture only nonsecret task state and supervisor status BEFORE rollback.
 # Do not log credentials, raw task arguments, environment variables, or keys.
 $statusCode="STATUS_NOT_WRITTEN"
 try{
  if(Test-Path -LiteralPath $StatusFile -PathType Leaf){
   $last=Get-Content -LiteralPath $StatusFile -Raw -ErrorAction Stop|ConvertFrom-Json
   $statusCode=[string]$last.state+":"+[string]$last.reason
  }
 }catch{$statusCode="STATUS_NOT_READABLE"}
 $taskState="TASK_NOT_FOUND";$lastResult="NONE"
 try{
  $current=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if($current){
   $taskState=[string]$current.State
   $taskInfo=Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
   if($taskInfo){$lastResult=[string]$taskInfo.LastTaskResult}
  }
 }catch{$taskState="TASK_DIAGNOSTIC_UNAVAILABLE"}
 Write-Warning ("FI_GATEWAY_AUTOSTART_DIAG STATUS="+$statusCode+" TASK_STATE="+$taskState+" LAST_TASK_RESULT="+$lastResult)
 if($registered){
  try{
   Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
   Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  }catch{}
 }
 if($created){
  Remove-Item -LiteralPath $Auto -Recurse -Force -ErrorAction SilentlyContinue
 }
 throw "FI_GATEWAY_AUTOSTART_SETUP_HOLD=$reason EXISTING_GATEWAY_UNCHANGED_EXPECTED"
}finally{$encrypted=$null;$a=$null;$b=$null;$pa=$null;$pb=$null}
