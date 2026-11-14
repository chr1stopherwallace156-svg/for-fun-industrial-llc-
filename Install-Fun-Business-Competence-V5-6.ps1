# FIAL5.6 one guarded local activation: tests -> true old worker ->
# true business methodology artifacts -> existing schedule upgrade in place.
# Does not restart Qwen, Ollama, REA, dashboard or any protected process.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fial5-6-business-competence-one-step-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$OldRoot=Join-Path $HOME 'FunIndustrial-FIAL55-RealBusiness'
$OldBranch='feature/fial5-5-real-business-operations-20261114'
$OldScript=Join-Path $OldRoot 'Run-Fun-Real-Operations-V5-5.ps1'
$OldScriptBlob='243bbc241fb633a2fef07b8c3fe3a7371894b548'
$NewScript=Join-Path $Root 'Run-Fun-Business-Competence-V5-6.ps1'
$TaskName='FunIndustrial-Executive-Operator-V1'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
$NodeExe=(Get-Command node.exe -ErrorAction Stop).Source
$PSExe=(Get-Command powershell.exe -ErrorAction Stop).Source
function Hold([string]$reason){throw ('FIAL56_INSTALL_HOLD='+$reason)}
function SourceIdentity([string]$dir,[string]$branch){
 if(!(Test-Path -LiteralPath $dir -PathType Container)){Hold ('CHECKOUT_MISSING='+$dir)}
 $remote=(& git.exe -C $dir remote get-url origin|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $remote -cne $Origin){Hold ('SOURCE_ORIGIN_HOLD='+$dir)}
 $current=(& git.exe -C $dir branch --show-current|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $current -cne $branch){Hold ('SOURCE_BRANCH_HOLD='+$dir)}
 $changes=@(& git.exe -C $dir status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $changes.Count){Hold ('DIRTY_WORKTREE_REFUSED='+$dir)}
}
function PortIdentity([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
SourceIdentity $Root $Branch
SourceIdentity $OldRoot $OldBranch
$originalHash=(& git.exe -C $OldRoot hash-object -- $OldScript|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $originalHash -cne $OldScriptBlob){Hold 'PREVIOUS_REAL_OPERATIONS_RUNNER_HASH_DRIFT'}
$files=@(
 'src\competence\business-knowledge-v5-6.mjs',
 'src\competence\business-finance-v5-6.mjs',
 'src\competence\business-writing-v5-6.mjs',
 'src\competence\business-workflow-v5-6.mjs',
 'src\competence\business-operator-v5-6.mjs',
 'src\competence\optional-document-tools-v5-6.mjs',
 'src\competence\business-console-v5-6.js',
 'scripts\Run-Fun-Business-Competence-V5-6.mjs',
 'intelligence-checks\fial56-business-competence-case.mjs',
 'intelligence-checks\fial56-primary-business-dashboard-case.mjs')
foreach($rel in $files){
 $file=Join-Path $Root $rel
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('MISSING_SOURCE='+$rel)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold ('SOURCE_SYMLINK='+$rel)}
 & $NodeExe --check $file
 if($LASTEXITCODE -ne 0){Hold ('SOURCE_SYNTAX_INVALID='+$rel)}
}
$tests=@(
 'intelligence-checks\fial56-business-competence-case.mjs',
 'intelligence-checks\fial56-primary-business-dashboard-case.mjs',
 'intelligence-checks\fial55-real-operations-case.mjs',
 'intelligence-checks\fial55-primary-dashboard-case.mjs',
 'intelligence-checks\fial55-elektron-mail-case.mjs',
 'intelligence-checks\fial54-executive-operator-v1-case.mjs')
& $NodeExe --test ($tests|ForEach-Object {Join-Path $Root $_})
if($LASTEXITCODE -ne 0){Hold 'BUSINESS_COMPETENCE_TESTS_FAILED_SCHEDULER_UNCHANGED'}
Write-Host 'FIAL56_OFFLINE_AND_INTEGRATION_TESTS=PASS'
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($task.State -eq 'Disabled' -or $task.State -eq 'Running'){Hold 'EXISTING_SCHEDULE_DISABLED_OR_BUSY'}
$oldArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$OldScript+'"'
$newArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$NewScript+'"'
$actions=@($task.Actions)
if($actions.Count -ne 1 -or [string]$actions[0].Execute -ne $PSExe -or
 @($task.Triggers).Count -ne 4 -or
 [string]$task.Principal.LogonType -ne 'Interactive' -or
 [string]$task.Principal.RunLevel -ne 'Limited'){Hold 'TASK_OWNER_OR_TRIGGERS_UNVERIFIED'}
$runningOld=([string]$actions[0].Arguments -ceq $oldArgs -and
 [string]$actions[0].WorkingDirectory -eq $OldRoot)
$runningNew=([string]$actions[0].Arguments -ceq $newArgs -and
 [string]$actions[0].WorkingDirectory -eq $Root)
if(!$runningOld -and !$runningNew){Hold 'UNRECOGNIZED_TASK_ACTION_REFUSE_OVERWRITE'}
$protected=@(11434,8088,8789,8791,8796,8797,8798,8801,8802,8803,8804,8805,8806,8443)
$before=@{}
foreach($port in $protected){$before[$port]=PortIdentity $port}
$started=[DateTimeOffset]::UtcNow
& $PSExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $NewScript
if($LASTEXITCODE -ne 0){Hold 'FIRST_REAL_COMPETENCE_CYCLE_FAILED_NO_SCHEDULE_UPDATE'}
$receipt=Join-Path $Data 'BusinessCompetenceV56\last-cycle.json'
if(!(Test-Path -LiteralPath $receipt -PathType Leaf)){Hold 'FIRST_COMPETENCE_RECEIPT_MISSING'}
$record=Get-Content -LiteralPath $receipt -Raw|ConvertFrom-Json
$recordTime=[DateTimeOffset]::Parse([string]$record.cycle_utc)
if($record.version -cne 'fial5.6-business-operator-v1' -or
 $recordTime -lt $started.AddSeconds(-4) -or
 $record.external_execution -cne 'NOT_PERFORMED' -or
 $record.actions.mail_sent -ne 0 -or $record.actions.government_filings -ne 0 -or
 $record.actions.rea_executions -ne 0 -or $record.actions.code_mutations -ne 0 -or
 $record.actions.model_invocations -ne 0){Hold 'FIRST_COMPETENCE_RECEIPT_INVALID'}
foreach($port in $protected){
 if((PortIdentity $port) -cne $before[$port]){Hold ('PROTECTED_PORT_CHANGED_'+$port)}
}
Write-Host ('FIAL56_FIRST_REAL_CYCLE=PASS TRACKED='+$record.tracked_tasks+
 ' PACKETS_NEW='+$record.packets_created)
New-Item -ItemType Directory -Path (Join-Path $Data 'SchedulerBackups') -Force|Out-Null
$backup=Join-Path $Data ('SchedulerBackups\pre-fial56-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.xml')
$xml=Export-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath
Set-Content -LiteralPath $backup -Value $xml -Encoding UTF8 -NoNewline
if($runningOld){
 $updated=$false
 try{
  $newAction=New-ScheduledTaskAction -Execute $PSExe -Argument $newArgs -WorkingDirectory $Root
  Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $newAction -ErrorAction Stop|Out-Null
  $updated=$true
  $after=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -ErrorAction Stop
  if(@($after.Actions).Count -ne 1 -or
   [string]$after.Actions[0].Arguments -cne $newArgs -or
   [string]$after.Actions[0].WorkingDirectory -ne $Root -or
   @($after.Triggers).Count -ne 4){Hold 'UPGRADED_SCHEDULE_VERIFICATION_FAILED'}
  foreach($port in $protected){
   if((PortIdentity $port) -cne $before[$port]){Hold ('PROTECTED_PORT_CHANGED_'+$port)}
  }
 }catch{
  $why=$_.Exception.Message
  if($updated){
   $oldAction=New-ScheduledTaskAction -Execute $PSExe -Argument $oldArgs -WorkingDirectory $OldRoot
   Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $oldAction -ErrorAction Stop|Out-Null
   $restored=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -ErrorAction Stop
   if([string]$restored.Actions[0].Arguments -cne $oldArgs){Hold ('TASK_ROLLBACK_NOT_VERIFIED='+$why)}
   Write-Warning 'FIAL56_SCHEDULER_ROLLBACK=OLD_FIAL55_RESTORED'
  }
  Hold ('SCHEDULER_UPGRADE_FAILED='+$why)
 }
 Write-Host 'FIAL56_SCHEDULE=UPGRADED_IN_PLACE'
}else{Write-Host 'FIAL56_SCHEDULE=EXISTING_FIAL56_ADOPTED'}
Write-Host 'FIAL56_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host ('FIAL56_SCHEDULER_BACKUP='+$backup)
Write-Host 'FIAL56_DOC_PARSER=OPTIONAL_ON_DEMAND_NOT_AUTO_INSTALLED'
Write-Host 'FIAL56_VALE=OPTIONAL_ON_DEMAND_NOT_AUTO_INSTALLED'
Write-Host 'FIAL56_NO_MODEL_STARTS_NO_EXTERNAL_ACTIONS=TRUE'
Write-Host 'FIAL56_BUSINESS_COMPETENCE_SCHEDULER=ACTIVE_WHEN_LOGGED_ON'
