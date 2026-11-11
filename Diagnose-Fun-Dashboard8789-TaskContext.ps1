# FI_DASHBOARD_TASK_CONTEXT_FORENSIC_V1
# READ ONLY. No policy writes, no task registration/stops/starts and no listener changes.
# Compares the actual running watchdog process owner and task principal with
# the policy owner while confirming the failed-policy rollback.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Auto=Join-Path $env:LOCALAPPDATA 'FunIndustrial\DashboardAutostart'
$PolicyPath=Join-Path $Auto 'policy.json'
$StatusPath=Join-Path $Auto 'status.json'
$TaskName='FunIndustrial-Dashboard8789-Autostart'
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Server=Join-Path $Live 'src\server.mjs'
$Html=Join-Path $Live 'public\index.html'
function Hold([string]$reason){throw ('FUN_DASHBOARD_CONTEXT_HOLD='+$reason)}
foreach($file in @($PolicyPath,$StatusPath,$Server,$Html)){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){Hold 'REQUIRED_FILE_MISSING'}
 if((Get-Item -LiteralPath $file -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'REQUIRED_FILE_SYMLINK'}
}
$originalPolicyHash=(Get-FileHash -LiteralPath $PolicyPath -Algorithm SHA256).Hash
$policy=Get-Content -LiteralPath $PolicyPath -Raw -ErrorAction Stop|ConvertFrom-Json
$status=Get-Content -LiteralPath $StatusPath -Raw -ErrorAction Stop|ConvertFrom-Json
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$info=Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop
$interactiveSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$policySid=[string]$policy.sid
$taskSid=''
try {
 $userId=[string]$task.Principal.UserId
 if($userId -match '^S-\d+-\d+'){ $taskSid=$userId }
 else{$taskSid=([Security.Principal.NTAccount]::new($userId)).Translate([Security.Principal.SecurityIdentifier]).Value}
} catch {}
$watchers=@(Get-CimInstance Win32_Process -ErrorAction Stop |
 Where-Object {
  $_.Name -in @('powershell.exe','pwsh.exe') -and
  [string]$_.CommandLine -match 'Watch-Fun-Dashboard-8789\.ps1'
})
# Do not print full process arguments, identity strings, or raw policies.
Write-Host "CURRENT_USER_MATCH_POLICY=$($interactiveSid -eq $policySid)"
Write-Host "TASK_PRINCIPAL_MATCH_POLICY=$($taskSid -ne '' -and $taskSid -eq $policySid)"
Write-Host "TASK_PRINCIPAL_RESOLVED=$($taskSid -ne '')"
Write-Host "TASK_STATE=$($task.State) TASK_LOGON_TYPE=$($task.Principal.LogonType) TASK_RUN_LEVEL=$($task.Principal.RunLevel)"
Write-Host "TASK_LAST_RESULT_HEX=$('0x{0:X}' -f [int]$info.LastTaskResult)"
Write-Host "WATCHER_PROCESS_COUNT=$($watchers.Count)"
$ownerChecks=@()
foreach($w in $watchers){
 $ownerSid=''
 try{
  $ownership=Invoke-CimMethod -InputObject $w -MethodName GetOwnerSid -ErrorAction Stop
  if([int]$ownership.ReturnValue -eq 0){$ownerSid=[string]$ownership.Sid}
 }catch{}
 $same=$ownerSid -ne '' -and $ownerSid -eq $policySid
 $ownerChecks+=($same)
 Write-Host "WATCHER_PID=$($w.ProcessId) WATCHER_OWNER_RESOLVED=$($ownerSid -ne '') WATCHER_OWNER_MATCH_POLICY=$same"
}
$listener=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)
$listenerCorrect=$listener.Count -eq 1 -and $listener[0].LocalAddress -eq '127.0.0.1'
Write-Host "DASHBOARD_LISTENER_VALID=$listenerCorrect"
if($listenerCorrect){
 $pinMatch=([int]$policy.verifiedExistingPid -eq [int]$listener[0].OwningProcess)
 Write-Host "RUNNING_DASHBOARD_PID=$([int]$listener[0].OwningProcess) POLICY_PID_MATCH=$pinMatch"
}
Write-Host "STATUS=$($status.state):$($status.reason) STATUS_UTC=$($status.checkedUtc)"
$backupDir=Join-Path $Auto 'reconcile-backup-20261110-222428-5373b15c'
$backupPath=Join-Path $backupDir 'policy.original.json'
if(Test-Path -LiteralPath $backupPath -PathType Leaf){
 $match=((Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash -eq $originalPolicyHash)
 Write-Host "POLICY_RESTORED_FROM_FAILED_RECONCILIATION=$match"
}else{Write-Host 'POLICY_RESTORED_FROM_FAILED_RECONCILIATION=BACKUP_UNAVAILABLE'}
$paths=@(
 @{key='SUPERVISOR_POLICY';path=$PolicyPath},
 @{key='DEPLOYED_SERVER';path=$Server},
 @{key='DASHBOARD_HTML';path=$Html},
 @{key='DASHBOARD_ENV';path=(Join-Path $Live '.env')},
 @{key='VOICE_MARKER';path=(Join-Path ([string]$policy.voiceHome) 'mobile-upload.enabled')}
)
foreach($entry in $paths){
 $readable=$false;$denyEntries=-1
 try{
  if(Test-Path -LiteralPath $entry.path -PathType Leaf){
   $acl=Get-Acl -LiteralPath $entry.path -ErrorAction Stop
   $denyEntries=@($acl.Access|Where-Object {$_.AccessControlType -eq 'Deny'}).Count
   # Check interactive access only; scheduled-token access is NOT inferred.
   $readable=$true
  }
 }catch{}
 Write-Host "$($entry.key)_ACL_READABLE_INTERACTIVE=$readable DENY_ENTRIES=$denyEntries"
}
if((Get-FileHash -LiteralPath $PolicyPath -Algorithm SHA256).Hash -ne $originalPolicyHash){
 Hold 'POLICY_CHANGED_DURING_CONTEXT_INSPECTION'
}
if($watchers.Count -eq 0){
 Write-Host 'WATCHER_PROCESS_VISIBILITY=UNKNOWN_READ_ONLY_CANNOT_CONFIRM_OWNER'
}elseif($ownerChecks -contains $false){
 Write-Host 'WATCHER_OWNER_MISMATCH_OR_UNVERIFIABLE=TRUE'
}
Write-Host 'FUN_DASHBOARD_TASK_CONTEXT=READ_ONLY_COMPLETE'
