# Diagnose Windows Task Scheduler launch in the *current user's*
# interactive logon identity WITHOUT storing a password, restarting a service,
# changing an existing task, opening ports or touching the live gateway.
# This transient task writes a nonsecret test result and is then removed.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$TaskName="FunIndustrial-TaskLaunch-Probe-"+[guid]::NewGuid().ToString("N").Substring(0,10)
$Temp=Join-Path $env:TEMP $TaskName
$ProbeScript=Join-Path $Temp "Task-Probe.ps1"
$ProbeResult=Join-Path $Temp "task-result.txt"
$registered=$false
$account=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$code='UNKNOWN'
Write-Host "FI_TASK_LAUNCH_DIAGNOSTIC=BEGIN CURRENT_USER_INTERACTIVE_LOGON_PROBE"
try{
 New-Item -ItemType Directory -Path $Temp -ErrorAction Stop|Out-Null
 $probeSource=@'
$ErrorActionPreference="Stop"
$dir=Split-Path -Parent $PSCommandPath
$marker=Join-Path $dir "task-result.txt"
try{
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
 $test=ConvertTo-SecureString "NON_SECRET_TASK_PROBE_STRING" -AsPlainText -Force
 $encrypted=$test|ConvertFrom-SecureString -ErrorAction Stop
 $opened=ConvertTo-SecureString -String $encrypted -ErrorAction Stop
 if($opened.Length -ne $test.Length){throw "DPAPI_TEST_FAILED"}
 [IO.File]::WriteAllText($marker,("PASS|IDENTITY=AVAILABLE|DPAPI=PASS"),[Text.UTF8Encoding]::new($false))
}catch{
 [IO.File]::WriteAllText($marker,("FAIL|TYPE="+$_.Exception.GetType().Name),[Text.UTF8Encoding]::new($false))
 exit 9
}
'@
 [IO.File]::WriteAllText($ProbeScript,$probeSource,[Text.UTF8Encoding]::new($false))
 $exe=Join-Path $PSHOME "powershell.exe"
 if(-not(Test-Path -LiteralPath $exe -PathType Leaf)){
  $exe=(Get-Command powershell.exe -ErrorAction Stop).Source
 }
 $action=New-ScheduledTaskAction -Execute $exe -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$ProbeScript+'"')
 $trigger=New-ScheduledTaskTrigger -AtLogOn -User $account
 $principal=New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::FromMinutes(2)) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Temporary nonsecret Fun Industrial Windows task activation probe" -ErrorAction Stop|Out-Null
 $registered=$true
 try{
  Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  $code="START_REQUEST_ACCEPTED"
 }catch{
  $code="START_REQUEST_REJECTED_"+$_.Exception.GetType().Name
 }
 for($i=0;$i -lt 30;$i++){
  if(Test-Path -LiteralPath $ProbeResult -PathType Leaf){break}
  Start-Sleep -Milliseconds 500
 }
 $task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
 $details=Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop
 $taskResult=[string]$details.LastTaskResult
 $taskState=[string]$task.State
 if(Test-Path -LiteralPath $ProbeResult -PathType Leaf){
  $result=(Get-Content -LiteralPath $ProbeResult -Raw).Trim()
  if($result -match '^PASS\|IDENTITY='){
   $report="FI_TASK_LAUNCH_PROBE=PASS TASK_STATE=$taskState LAST_TASK_RESULT=$taskResult STATUS=$result"
  }else{
   $report="FI_TASK_LAUNCH_PROBE=FAIL_TASK_CODE TASK_STATE=$taskState LAST_TASK_RESULT=$taskResult STATUS=$result"
  }
 }else{
  $report="FI_TASK_LAUNCH_PROBE=NO_RESULT TASK_STATE=$taskState LAST_TASK_RESULT=$taskResult START_STATE=$code"
 }
 Write-Host $report
 if($report -notmatch '^FI_TASK_LAUNCH_PROBE=PASS'){
  Write-Host "FI_TASK_PROBE_NOTE=Task did not execute successfully as current interactive user. Check whether Windows desktop sign-in is active."
 }
}catch{
 Write-Host ("FI_TASK_LAUNCH_PROBE=HOLD ERROR_TYPE="+$_.Exception.GetType().Name+" ERROR="+$_.Exception.Message)
}finally{
 if($registered){
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
 }
 Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
 Write-Host "FI_TASK_LAUNCH_PROBE_CLEANUP=ATTEMPTED PRIVATE_GATEWAY_UNCHANGED=TRUE"
}
