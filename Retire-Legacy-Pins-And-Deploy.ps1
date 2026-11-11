# FUN_REMOVE_LEGACY_AUTOSTART_GATES_AND_DEPLOY_V1
# ONE-RUN authorized change: back up and retire ONLY the exact obsolete
# FunIndustrial-Dashboard8789-Autostart scheduled watchdog/policy, then deploy
# the original English, operator-approved Phase 5 8789 security audit.
# Never stops/reconfigures 8443, llama.cpp, compute, NetBird, REA or Ollama.
# The 8789 dashboard itself will briefly restart as part of the deployment.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Source=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Auto=Join-Path $env:LOCALAPPDATA 'FunIndustrial\DashboardAutostart'
$TaskName='FunIndustrial-Dashboard8789-Autostart'
$PolicyFile=Join-Path $Auto 'policy.json'
$Watcher=Join-Path $Auto 'Watch-Fun-Dashboard-8789.ps1'
$Deploy=Join-Path $Source 'Deploy-Fun-Security-Primary-8789.ps1'
$Backup=Join-Path $Auto ('retired-watchdog-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$CreatedBackup=$false
function Hold([string]$reason){throw ('FUN_PHASE5_ONE_RUN_HOLD='+$reason+' BACKUP='+$Backup)}
function CheckLeaf([string]$file){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING_'+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_FILE_'+$file)}
}
function LivePid(){
 $listeners=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)
 if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1'){Hold 'DASHBOARD_LISTENER_NOT_SINGLE_LOOPBACK'}
 $id=[int]$listeners[0].OwningProcess
 if($id -le 0){Hold 'DASHBOARD_OWNER_PID_INVALID'}
 $w=Get-CimInstance Win32_Process -Filter ("ProcessId="+$id) -ErrorAction Stop
 if(-not $w -or $w.Name -ne 'node.exe' -or [string]$w.CommandLine -notmatch 'src[/\\]server\.mjs'){
  Hold 'DASHBOARD_OWNER_NOT_VERIFIED'
 }
 return $id
}
function Hash([string]$file){return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash}
CheckLeaf $Deploy
$initialPid=LivePid
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$policyExists=Test-Path -LiteralPath $PolicyFile -PathType Leaf
$watchExists=Test-Path -LiteralPath $Watcher -PathType Leaf
if($task){
 $actions=@($task.Actions)
 if($actions.Count -ne 1 -or
  [string]$actions[0].Execute -notmatch '(?i)(^|[/\\])powershell\.exe$' -or
  [string]$actions[0].Arguments -notmatch ('(?i)'+[regex]::Escape($Watcher))){
  Hold 'SCHEDULED_TASK_ACTION_NOT_EXACT_LEGACY_WATCHER'
 }
 if($task.Principal.LogonType -ne 'Interactive'){Hold 'SCHEDULED_TASK_LOGON_MODE_UNEXPECTED'}
 $user=[Security.Principal.WindowsIdentity]::GetCurrent()
 $taskSid=''
 try{
  $principal=[string]$task.Principal.UserId
  if($principal -match '^S-\d+-\d+'){ $taskSid=$principal }
  else{$taskSid=([Security.Principal.NTAccount]::new($principal)).Translate([Security.Principal.SecurityIdentifier]).Value}
 }catch{}
 if($taskSid -ne $user.User.Value){Hold 'SCHEDULED_TASK_OWNER_NOT_CURRENT_USER'}
}
if($policyExists){CheckLeaf $PolicyFile}
if($watchExists){CheckLeaf $Watcher}
if(-not(Test-Path -LiteralPath $Auto -PathType Container)){
 New-Item -ItemType Directory -Path $Auto -ErrorAction Stop|Out-Null
}
if((Get-Item -LiteralPath $Auto).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'AUTOSTART_DIR_SYMLINK'}
New-Item -ItemType Directory -Path $Backup -ErrorAction Stop|Out-Null
$CreatedBackup=$true
if($policyExists){
 Copy-Item -LiteralPath $PolicyFile -Destination (Join-Path $Backup 'policy.original.json') -ErrorAction Stop
 if((Hash $PolicyFile) -ne (Hash (Join-Path $Backup 'policy.original.json'))){Hold 'POLICY_BACKUP_HASH_MISMATCH'}
}
if($watchExists){
 Copy-Item -LiteralPath $Watcher -Destination (Join-Path $Backup 'watcher.original.ps1') -ErrorAction Stop
 if((Hash $Watcher) -ne (Hash (Join-Path $Backup 'watcher.original.ps1'))){Hold 'WATCHER_BACKUP_HASH_MISMATCH'}
}
if($task){
 $taskXml=Export-ScheduledTask -TaskName $TaskName -ErrorAction Stop
 if([string]::IsNullOrWhiteSpace($taskXml)){Hold 'SCHEDULED_TASK_EXPORT_EMPTY'}
 [IO.File]::WriteAllText((Join-Path $Backup 'task.original.xml'),$taskXml,[Text.UTF8Encoding]::new($false))
 Write-Host "LEGACY_TASK_BACKUP=PASS TASK=$TaskName"
 # Stops only the verified scheduled PowerShell watchdog, never the Node 8789 server.
 if($task.State -eq 'Running'){Stop-ScheduledTask -TaskName $TaskName -ErrorAction Stop}
 $watchers=@(Get-CimInstance Win32_Process -ErrorAction Stop|Where-Object{
  $_.Name -in @('powershell.exe','pwsh.exe') -and
  [string]$_.CommandLine -match [regex]::Escape($Watcher)
 })
 for($i=0;$i -lt 30 -and $watchers.Count -gt 0;$i++){
  Start-Sleep -Milliseconds 300
  $watchers=@(Get-CimInstance Win32_Process -ErrorAction Stop|Where-Object{
   $_.Name -in @('powershell.exe','pwsh.exe') -and
   [string]$_.CommandLine -match [regex]::Escape($Watcher)
  })
 }
 if($watchers.Count){Hold 'LEGACY_WATCHDOG_PROCESS_STILL_RUNNING'}
 Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
 if(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue){Hold 'LEGACY_SCHEDULED_TASK_STILL_REGISTERED'}
 Write-Host 'LEGACY_AUTOSTART_SCHEDULED_TASK=REMOVED'
}
if($policyExists){
 Move-Item -LiteralPath $PolicyFile -Destination (Join-Path $Backup 'policy.retired.json') -ErrorAction Stop
 if(Test-Path -LiteralPath $PolicyFile -PathType Leaf){Hold 'LEGACY_POLICY_STILL_ACTIVE'}
 if((Hash (Join-Path $Backup 'policy.original.json')) -ne (Hash (Join-Path $Backup 'policy.retired.json'))){Hold 'RETIRED_POLICY_BACKUP_MISMATCH'}
 Write-Host 'LEGACY_SOURCE_AND_PID_PINS=RETIRED'
}
if((LivePid) -ne $initialPid){Hold 'PRIMARY_DASHBOARD_CHANGED_DURING_WATCHDOG_RETIREMENT'}
# Leave the watcher script in the private backup directory only; it has no
# scheduled task after retirement. Keeping original on disk is harmless but
# could invite an accidental manual re-run, so archive it.
if($watchExists){
 Move-Item -LiteralPath $Watcher -Destination (Join-Path $Backup 'watcher.retired.ps1') -ErrorAction Stop
 if((Hash (Join-Path $Backup 'watcher.original.ps1')) -ne (Hash (Join-Path $Backup 'watcher.retired.ps1'))){Hold 'RETIRED_WATCHER_BACKUP_MISMATCH'}
}
if(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue){Hold 'LEGACY_TASK_REAPPEARED'}
if(Test-Path -LiteralPath $PolicyFile -PathType Leaf){Hold 'LEGACY_POLICY_REAPPEARED'}
Write-Host "LEGACY_WATCHDOG_RETIREMENT=PASS DASHBOARD_PID=$initialPid"
Write-Host 'AUTOSTART_AT_SIGNIN=DISABLED_AFTER_THIS_CHANGE'
Write-Host 'PRESERVED_GATEWAY_LLAMA_COMPUTE_REA=NOT_MODIFIED'
Write-Host "LEGACY_RETIREMENT_BACKUP=$Backup"
Write-Host 'PHASE5_DEPLOYMENT=STARTING'
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -Apply
if($LASTEXITCODE -ne 0){Hold ('PHASE5_APPLY_FAILED_EXIT_'+$LASTEXITCODE)}
$state=Invoke-RestMethod -Uri 'http://127.0.0.1:8789/api/security/status' -TimeoutSec 15 -ErrorAction Stop
if($state.state -ne 'ready' -or [int]$state.port -ne 8789){Hold 'PHASE5_POST_DEPLOY_STATUS_NOT_READY'}
if(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue){Hold 'LEGACY_TASK_REAPPEARED_POST_DEPLOY'}
if(Test-Path -LiteralPath $PolicyFile -PathType Leaf){Hold 'LEGACY_POLICY_REAPPEARED_POST_DEPLOY'}
Write-Host 'FUN_PHASE5_ONE_RUN=PASS'
Write-Host 'PRIMARY_SECURITY_CHAT=ACTIVE_8789 AUTOSTART_POLICY=RETIRED'
Write-Host "PRESERVED_LEGACY_BACKUP=$Backup"
Write-Host 'IMPORTANT=8789_DASHBOARD_NO_LONGER_AUTOSTARTS_AT_WINDOWS_SIGNIN'
