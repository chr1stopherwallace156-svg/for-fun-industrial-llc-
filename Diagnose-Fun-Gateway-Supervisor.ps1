# Isolated read-only test of the actual gateway supervisor in Task Scheduler.
# Synthetic config and dummy files; no passwords and no service changes.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$name="FunIndustrial-SupervisorInspect-"+[guid]::NewGuid().ToString("N").Substring(0,10)
$root=Join-Path $env:TEMP $name
$auto=Join-Path $root "autostart"
$report=Join-Path $root "report.txt"
$registered=$false
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
 $action=New-ScheduledTaskAction -Execute $exe -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$wrapperPath+'"')
 $trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
 $principal=New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::FromMinutes(2)) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -ErrorAction Stop|Out-Null
 $registered=$true
 Start-ScheduledTask -TaskName $name -ErrorAction Stop
 for($i=0;$i -lt 40;$i++){
  if(Test-Path -LiteralPath $report -PathType Leaf){break}
  Start-Sleep -Milliseconds 500
 }
 $info=Get-ScheduledTaskInfo -TaskName $name -ErrorAction Stop
 $rc=if(Test-Path $report){(Get-Content $report -Raw).Trim()}else{"MISSING"}
 $st=Get-Content (Join-Path $auto "supervisor-status.json") -Raw|ConvertFrom-Json
 $status=([string]$st.state+":"+ [string]$st.reason)
 $errorCode="NONE"
 $err=Join-Path $root "stderr.txt"
 if(Test-Path $err){
  $errText=Get-Content $err -Raw
  if($errText -match "FI_GATEWAY_[A-Z0-9_]+"){$errorCode=$Matches[0]}
  elseif($errText -match "Exception calling ""([A-Za-z]+)"""){$errorCode="DOTNET_"+$Matches[1]}
  elseif($errText.Trim()){$errorCode="ERROR_PRESENT"}
 }
 $healthyStatus=$status -in @("running:EXISTING_GATEWAY_PRESERVED","waiting:INSPECT_GATEWAY_STOPPED")
 $pass=$rc -eq "EXIT_0" -and $healthyStatus -and $errorCode -eq "NONE"
 Write-Host ("FI_GATEWAY_SUPERVISOR_SCHEDULED_INSPECT="+$(if($pass){"PASS"}else{"HOLD"})+
  " TASK_RESULT="+$info.LastTaskResult+" WRAPPER="+$rc+" STATUS="+$status+" ERROR="+$errorCode)
}catch{
 Write-Host ("FI_GATEWAY_SUPERVISOR_SCHEDULED_INSPECT=HOLD ERROR_TYPE="+$_.Exception.GetType().Name)
}finally{
 if($registered){Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue}
 Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
 Write-Host "FI_GATEWAY_INSPECT_CLEANUP=ATTEMPTED PASSWORD_NOT_USED=TRUE LIVE_SERVICES_UNCHANGED=TRUE"
}
