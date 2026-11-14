# FIAL5.5: one guarded upgrade of existing Task Scheduler FIAL5.4 action to
# grounded local-business execution. Private identity parameters never enter GitHub.
[CmdletBinding()]param(
 [Parameter(Mandatory=$true)][string]$ContactName,
 [Parameter(Mandatory=$true)][string]$Email,
 [Parameter(Mandatory=$true)][string]$Phone,
 [Parameter(Mandatory=$true)][string]$Website,
 [Parameter(Mandatory=$true)][string]$BusinessAddress,
 [Parameter(Mandatory=$true)][string]$City,
 [Parameter(Mandatory=$true)][string]$PostalCode,
 [Parameter(Mandatory=$true)][string]$LicenseFileReference
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fial5-5-real-business-operations-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$TaskName='FunIndustrial-Executive-Operator-V1'
$OldRoot=Join-Path $HOME 'FunIndustrial-FIAL54-Executive'
$OldScript=Join-Path $OldRoot 'Run-Fun-Executive-Operator-V1.ps1'
$NewScript=Join-Path $Root 'Run-Fun-Real-Operations-V5-5.ps1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Real-Operations-V5-5.mjs'
$Source=Join-Path $Root 'src\operator\real-operations-v5-5.mjs'
$Local=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
$NodeExe=(Get-Command node.exe -ErrorAction Stop).Source
$PSExe=(Get-Command powershell.exe -ErrorAction Stop).Source
function Hold([string]$reason){throw ('FIAL55_INSTALL_HOLD='+$reason)}
function SourceIdentity([string]$path,[string]$expectedBranch){
 if(!(Test-Path -LiteralPath $path -PathType Container)){Hold ('SOURCE_CHECKOUT_MISSING='+$path)}
 $url=(& git.exe -C $path remote get-url origin|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $url -cne $Origin){Hold ('SOURCE_ORIGIN_MISMATCH='+$path)}
 $b=(& git.exe -C $path branch --show-current|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $b -cne $expectedBranch){Hold ('SOURCE_BRANCH_MISMATCH='+$path)}
 $changes=@(& git.exe -C $path status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $changes.Count){Hold ('DIRTY_SOURCE_REFUSED='+$path)}
}
function PortOwners([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
SourceIdentity $Root $Branch
SourceIdentity $OldRoot 'feature/fial5-4-executive-operator-v1-20261114'
foreach($file in @($NewScript,$Worker,$Source,(Join-Path $Root 'src\operator\official-source-watch-v5-5.mjs'),
 (Join-Path $Root 'src\operator\elektron-gmail-v5-5.mjs'),
 (Join-Path $Root 'intelligence-checks\fial55-real-operations-case.mjs'),
 (Join-Path $Root 'intelligence-checks\fial55-elektron-mail-case.mjs'))){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold ('SYMLINK_FILE_REFUSED='+$file)}
 if($file.EndsWith('.mjs')){& $NodeExe --check $file;if($LASTEXITCODE -ne 0){Hold ('SYNTAX_HOLD='+$file)}}
}
& $NodeExe --test (Join-Path $Root 'intelligence-checks\fial55-real-operations-case.mjs') (Join-Path $Root 'intelligence-checks\fial55-elektron-mail-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'REAL_OPERATIONS_OFFLINE_TESTS_HOLD'}
Write-Host 'FIAL55_OFFLINE_TESTS=PASS'
$protected=@(11434,8088,8789,8791,8796,8797,8798,8801,8802,8803,8804,8805,8806,8443)
$before=@{}
foreach($port in $protected){$before[$port]=PortOwners $port}
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($task.State -eq 'Disabled' -or $task.State -eq 'Running'){Hold 'EXISTING_TASK_DISABLED_OR_RUNNING'}
$oldArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$OldScript+'"'
$newArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$NewScript+'"'
$actions=@($task.Actions)
if($actions.Count -ne 1 -or
 [string]$actions[0].Execute -ne $PSExe -or
 [string]$actions[0].Arguments -cne $oldArgs -or
 [string]$actions[0].WorkingDirectory -ne $OldRoot -or
 @($task.Triggers).Count -ne 4 -or
 [string]$task.Principal.LogonType -ne 'Interactive' -or
 [string]$task.Principal.RunLevel -ne 'Limited'){
 Hold 'EXISTING_FIAL54_TASK_IDENTITY_DRIFT_REFUSE_CHANGE'
}
New-Item -ItemType Directory -Path $Local -Force|Out-Null
$backupDir=Join-Path $Local 'SchedulerBackups';New-Item -ItemType Directory -Path $backupDir -Force|Out-Null
$xml=Export-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath
$backup=Join-Path $backupDir ('pre-fial55-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.xml')
Set-Content -LiteralPath $backup -Value $xml -Encoding UTF8 -NoNewline
# Business identity is private: transfer as STDIN, no GitHub file, no command argument.
$fields=[ordered]@{owner=$ContactName;email=$Email;phone=$Phone;
 website=$Website;business_address=$BusinessAddress;city=$City;zip=$PostalCode;
 file_reference=$LicenseFileReference}
$profileJson=$fields|ConvertTo-Json -Compress
$profileResult=($profileJson|& $NodeExe $Worker --set-local-profile-stdin |Out-String)
if($LASTEXITCODE -ne 0){Hold 'PRIVATE_PROFILE_REJECTED_NO_SCHEDULE_CHANGE'}
Write-Host ($profileResult.Trim())
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $NewScript
if($LASTEXITCODE -ne 0){Hold 'FIRST_LOCAL_WORK_CYCLE_FAILED_SCHEDULE_UNCHANGED'}
Write-Host 'FIAL55_FIRST_REAL_LOCAL_CYCLE=PASS'
$newAction=New-ScheduledTaskAction -Execute $PSExe -Argument $newArgs -WorkingDirectory $Root
$oldAction=New-ScheduledTaskAction -Execute $PSExe -Argument $oldArgs -WorkingDirectory $OldRoot
$taskRepointed=$false
try{
 Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $newAction -ErrorAction Stop|Out-Null
 $taskRepointed=$true
 $after=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -ErrorAction Stop
 if(@($after.Actions).Count -ne 1 -or
  [string]$after.Actions[0].Arguments -cne $newArgs -or
  [string]$after.Actions[0].WorkingDirectory -ne $Root -or
  @($after.Triggers).Count -ne 4){Hold 'REPOINTED_TASK_CONTRACT_MISMATCH'}
 foreach($port in $protected){
  if((PortOwners $port) -cne $before[$port]){Hold ('PROTECTED_PROCESS_CHANGED_PORT_'+$port)}
 }
 Write-Host 'FIAL55_EXISTING_SCHEDULE=UPGRADED_IN_PLACE_NO_SECOND_TASK'
 Write-Host 'FIAL55_FOUR_DAILY_TRIGGERS=PRESERVED'
 Write-Host ('FIAL55_SCHEDULER_XML_BACKUP='+$backup)
 Write-Host 'FIAL55_FUN_INDUSTRIAL=SOFTWARE_WORKSPACE'
 Write-Host 'FIAL55_BUSINESS_RECORD=ELEKTRON_OPERATOR_PROVIDED_PENDING_VERIFICATION'
 Write-Host 'FIAL55_EMAIL_OAUTH=NOT_GRANTED_NO_MAIL_SENT'
 Write-Host 'FIAL55_GOVERNMENT_FILINGS=NONE'
 Write-Host 'FIAL55_AUTOMATED_LOCAL_BUSINESS_EXECUTION=ACTIVE'
}catch{
 $why=$_.Exception.Message
 if($taskRepointed){
  try{
   Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $oldAction -ErrorAction Stop|Out-Null
   $restore=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -ErrorAction Stop
   if([string]$restore.Actions[0].Arguments -cne $oldArgs){Hold 'TASK_ROLLBACK_VERIFICATION_FAILED'}
   Write-Warning 'FIAL55_TASK_ROLLBACK=RESTORED_ORIGINAL_FIAL54'
  }catch{Hold ('TASK_ROLLBACK_FAILED_REVIEW='+$_.Exception.Message+' ORIGINAL='+$why)}
 }
 throw ('FIAL55_SCHEDULE_HOLD='+$why)
}
