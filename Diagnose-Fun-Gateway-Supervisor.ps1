# Isolated read-only test of the actual gateway supervisor in Task Scheduler.
# Synthetic config and dummy files; no passwords and no service changes.
[CmdletBinding()]param([switch]$NoScheduler)
$ErrorActionPreference="Stop"
$name="FunIndustrial-SupervisorInspect-"+[guid]::NewGuid().ToString("N").Substring(0,10)
$root=Join-Path $env:TEMP $name
$auto=Join-Path $root "autostart"
$report=Join-Path $root "report.txt"
$registered=$false
$stage="SETUP"
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
Write-Host "FI_GATEWAY_SUPERVISOR_INSPECT=START NO_PASSWORD=TRUE SERVICE_CHANGES=NONE"
try {
 New-Item -ItemType Directory -Path $auto -Force -ErrorAction Stop|Out-Null
 Copy-Item (Join-Path $PSScriptRoot "Watch-Fun-iPhone-HTTPS.ps1") (Join-Path $auto "Watch-Fun-iPhone-HTTPS.ps1") -ErrorAction Stop
 Copy-Item (Join-Path $PSScriptRoot "src\voice\gateway-port-state.ps1") (Join-Path $auto "gateway-port-state.ps1") -ErrorAction Stop
 $cfg=[ordered]@{schema="fun.voice.gateway.private.v1";pcIp="100.109.4.20";port=8443;publicHost="100.109.4.20:8443";iphonePeerIp="100.109.87.100"}
 $policy=[ordered]@{schema="fun.voice.gateway.autostart.v1";sid=$identity.User.Value;pcIp="100.109.4.20";iphonePeerIp="100.109.87.100";gatewayPort=8443}
 [IO.File]::WriteAllText((Join-Path $root "private-gateway.json"),($cfg|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText((Join-Path $auto "supervisor-policy.json"),($policy|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText((Join-Path $auto "gateway-password.dpapi"),"SYNTHETIC_NO_SECRET",[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText((Join-Path $auto "Start-Fun-iPhone-HTTPS.ps1"),"#SYNTHETIC_NEVER_EXECUTED",[Text.UTF8Encoding]::new($false))
 $probe=[ordered]@{state="probe";reason="SYNTHETIC_PREEXISTING_FILE"}
 [IO.File]::WriteAllText((Join-Path $auto "supervisor-status.json"),($probe|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 if($NoScheduler){
  # CI can validate real Windows status overwrites without requiring Task
  # Scheduler access on the hosted runner. This mode remains isolated.
  $ps=(Get-Command powershell.exe -ErrorAction Stop).Source
  $supervisor=Join-Path $auto "Watch-Fun-iPhone-HTTPS.ps1"
  $messages=@(& $ps -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $supervisor -InspectOnce -DiagnosticBase $root 2>&1)
  $code=$LASTEXITCODE
  $st=Get-Content -LiteralPath (Join-Path $auto "supervisor-status.json") -Raw -ErrorAction Stop|ConvertFrom-Json
  $state=[string]$st.state+":"+[string]$st.reason
  $good=$code -eq 0 -and $state -in @("waiting:INSPECT_GATEWAY_PRESENT","waiting:INSPECT_GATEWAY_STOPPED")
  Write-Host ("FI_GATEWAY_SUPERVISOR_FOREGROUND_INSPECT="+$(if($good){"PASS"}else{"HOLD"})+
   " EXIT="+$code+" STATUS="+$state+" LIVE_SERVICES_UNCHANGED=TRUE")
  return
 }
 $stage="GENERATE_WRAPPER"
 $wrapper=@'
$ErrorActionPreference="Stop"
$root=$PSScriptRoot
$exe=Join-Path $PSHOME "powershell.exe"
$script=Join-Path $root "autostart\Watch-Fun-iPhone-HTTPS.ps1"
try{
 # Direct child invocation gives a reliable LASTEXITCODE. The prior diagnostic
 # saw an empty ExitCode property on a Start-Process wrapper (EXIT_).
 & $exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $script -InspectOnce -DiagnosticBase $root 1> (Join-Path $root "stdout.txt") 2> (Join-Path $root "stderr.txt")
 $code=$LASTEXITCODE
 [IO.File]::WriteAllText((Join-Path $root "report.txt"),("EXIT_"+$code))
 if($code -ne 0){exit 8}
 exit 0
}catch{
 [IO.File]::WriteAllText((Join-Path $root "report.txt"),("WRAPPER_"+$_.Exception.GetType().Name))
 exit 9
}
'@
 $wrapperPath=Join-Path $root "wrapper.ps1"
 [IO.File]::WriteAllText($wrapperPath,$wrapper,[Text.UTF8Encoding]::new($false))
 $exe=Join-Path $PSHOME "powershell.exe"
 $stage="CREATE_TASK_ACTION"
 $action=New-ScheduledTaskAction -Execute $exe -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$wrapperPath+'"')
 $trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
 $principal=New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::FromMinutes(2)) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 $stage="REGISTER_TASK"
 Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -ErrorAction Stop|Out-Null
 $registered=$true
 $stage="START_TASK"
 Start-ScheduledTask -TaskName $name -ErrorAction Stop
 $stage="WAIT_REPORT"
 for($i=0;$i -lt 40;$i++){
  if(Test-Path -LiteralPath $report -PathType Leaf){break}
  Start-Sleep -Milliseconds 500
 }
 $stage="READ_TASK_INFO"
 $info=Get-ScheduledTaskInfo -TaskName $name -ErrorAction Stop
 $stage="READ_WRAPPER_REPORT"
 $rc=if(Test-Path $report){(Get-Content $report -Raw).Trim()}else{"MISSING"}
 $stage="READ_SUPERVISOR_STATUS"
 $st=Get-Content (Join-Path $auto "supervisor-status.json") -Raw|ConvertFrom-Json
 $status=([string]$st.state+":"+ [string]$st.reason)
 $stage="READ_STDERR"
 $errorCode="NONE"
 $err=Join-Path $root "stderr.txt"
 if(Test-Path $err -PathType Leaf){
  $errText=[IO.File]::ReadAllText($err)
  if(-not [string]::IsNullOrWhiteSpace($errText)){
   if($errText -match "FI_GATEWAY_[A-Z0-9_]+"){$errorCode=$Matches[0]}
   elseif($errText -match "Exception calling ""([A-Za-z]+)"""){$errorCode="DOTNET_"+$Matches[1]}
   else{$errorCode="ERROR_PRESENT"}
  }
 }
 $stage="ASSESS_HEALTH"
 $healthyStatus=$status -in @("waiting:INSPECT_GATEWAY_PRESENT","waiting:INSPECT_GATEWAY_STOPPED")
 $pass=$rc -eq "EXIT_0" -and $healthyStatus -and $errorCode -eq "NONE"
 Write-Host ("FI_GATEWAY_SUPERVISOR_SCHEDULED_INSPECT="+$(if($pass){"PASS"}else{"HOLD"})+
  " TASK_RESULT="+$info.LastTaskResult+" WRAPPER="+$rc+" STATUS="+$status+" ERROR="+$errorCode)
}catch{
 # Synthetic-only diagnostic: identify exact failing code path without echoing
 # usernames, file paths, credentials, environment variables or raw exceptions.
 $kind=$_.Exception.GetType().Name
 $id=if($_.FullyQualifiedErrorId){($_.FullyQualifiedErrorId -split ',')[0]}else{"UNAVAILABLE"}
 if($id -notmatch '^[A-Za-z0-9_.-]{1,100}$'){$id="UNAVAILABLE"}
 $h=if($_.Exception.HResult){$_.Exception.HResult}else{0}
 Write-Host ("FI_GATEWAY_SUPERVISOR_SCHEDULED_INSPECT=HOLD STAGE="+$stage+
  " ERROR_TYPE="+$kind+" ERROR_ID="+$id+" HRESULT="+$h)
}finally{
 if($registered){Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue}
 Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
 Write-Host "FI_GATEWAY_INSPECT_CLEANUP=ATTEMPTED PASSWORD_NOT_USED=TRUE LIVE_SERVICES_UNCHANGED=TRUE"
}
