# FIAL5.7 guarded task upgrade. No outgoing message and no new task created.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fial5-7-verifiable-business-outcomes-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$PriorRoot=Join-Path $HOME 'FunIndustrial-FIAL56-BusinessCompetence'
$PriorBranch='feature/fial5-6-business-competence-one-step-20261114'
$PriorRunner=Join-Path $PriorRoot 'Run-Fun-Business-Competence-V5-6.ps1'
$PriorBlob='0a95e6d84f20a3e08a8af30575fe1ed61f4c8aa4'
$CurrentRunner=Join-Path $Root 'Run-Fun-Verified-Outcomes-V5-7.ps1'
$TaskName='FunIndustrial-Executive-Operator-V1'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$PowerShellExe=(Get-Command powershell.exe -ErrorAction Stop).Source
function Hold([string]$why){throw ('FIAL57_INSTALL_HOLD='+$why)}
function CheckSource([string]$dir,[string]$expected){
 if(!(Test-Path -LiteralPath $dir -PathType Container)){Hold ('MISSING_CHECKOUT='+$dir)}
 $origin=(& git.exe -C $dir remote get-url origin|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $origin -cne $Origin){Hold ('SOURCE_ORIGIN_HOLD='+$dir)}
 $actual=(& git.exe -C $dir branch --show-current|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $actual -cne $expected){Hold ('SOURCE_BRANCH_HOLD='+$dir)}
 $dirty=@(& git.exe -C $dir status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold ('DIRTY_SOURCE_HOLD='+$dir)}
}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
 ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
CheckSource $Root $Branch
CheckSource $PriorRoot $PriorBranch
$hash=(& git.exe -C $PriorRoot hash-object --path=Run-Fun-Business-Competence-V5-6.ps1 -- $PriorRunner|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $hash -cne $PriorBlob){Hold 'REVIEWED_PREVIOUS_RUNNER_HASH_DRIFT'}
$files=@(
 'src\outcomes\outcome-engine-v5-7.mjs',
 'src\outcomes\elektron-send-v5-7.mjs',
 'src\outcomes\outcome-console-v5-7.js',
 'scripts\Run-Fun-Outcome-V5-7.mjs',
 'intelligence-checks\fial57-outcomes-case.mjs',
 'intelligence-checks\fial57-dashboard-case.mjs',
 'Run-Fun-Verified-Outcomes-V5-7.ps1')
foreach($rel in $files){
 $file=Join-Path $Root $rel
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('MISSING_FILE='+$rel)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_FILE_HOLD='+$rel)
 }
 if($file.EndsWith('.mjs') -or $file.EndsWith('.js')){
  & $Node --check $file
  if($LASTEXITCODE -ne 0){Hold ('JS_SYNTAX_INVALID='+$rel)}
 }
}
& $Node --test (Join-Path $Root 'intelligence-checks\fial57-outcomes-case.mjs') (Join-Path $Root 'intelligence-checks\fial57-dashboard-case.mjs') (Join-Path $Root 'intelligence-checks\fial56-business-competence-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED_NO_SCHEDULE_CHANGE'}
Write-Host 'FIAL57_TESTS=PASS'
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($task.State -eq 'Disabled' -or $task.State -eq 'Running'){Hold 'EXISTING_TASK_DISABLED_OR_RUNNING'}
$beforeArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$PriorRunner+'"'
$afterArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$CurrentRunner+'"'
$actions=@($task.Actions)
if($actions.Count -ne 1 -or [string]$actions[0].Execute -ne $PowerShellExe -or
 @($task.Triggers).Count -ne 4 -or
 [string]$task.Principal.LogonType -ne 'Interactive' -or
 [string]$task.Principal.RunLevel -ne 'Limited'){Hold 'TASK_IDENTITY_OR_PRIVILEGE_CHANGED'}
$matchesBefore=([string]$actions[0].Arguments -ceq $beforeArgs -and
 [string]$actions[0].WorkingDirectory -eq $PriorRoot)
$matchesAfter=([string]$actions[0].Arguments -ceq $afterArgs -and
 [string]$actions[0].WorkingDirectory -eq $Root)
if(!$matchesBefore -and !$matchesAfter){Hold 'UNKNOWN_TASK_ACTION_WILL_NOT_REPLACE'}
$protected=@(11434,8088,8789,8791,8796,8797,8798,8801,8802,8803,8804,8805,8806,8443)
$ports=@{}
foreach($port in $protected){$ports[$port]=Snapshot $port}
$start=[DateTimeOffset]::UtcNow
& $PowerShellExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $CurrentRunner
if($LASTEXITCODE -ne 0){Hold 'FIRST_REAL_OBSERVATION_FAILED_SCHEDULE_UNCHANGED'}
$receipt=Join-Path $Data 'OutcomeV57\verified-outcomes-v1.json'
if(!(Test-Path -LiteralPath $receipt -PathType Leaf)){Hold 'FIRST_RECEIPT_MISSING'}
$last=Get-Content -LiteralPath $receipt -Raw|ConvertFrom-Json
if($last.version -cne 'fial5.7-verified-outcomes-v1' -or
 [DateTimeOffset]::Parse([string]$last.last_observed_utc) -lt $start.AddSeconds(-4) -or
 $last.external_form_submissions -ne 0 -or $last.purchases -ne 0 -or
 $last.rea_calls -ne 0 -or $last.send_attempts -gt 1){Hold 'FIRST_OUTCOME_RECEIPT_INVALID'}
foreach($port in $protected){
 if((Snapshot $port) -cne $ports[$port]){Hold ('PROTECTED_PROCESS_DRIFT_'+$port)}
}
Write-Host ('FIAL57_FIRST_REAL_OBSERVATION=PASS OUTCOME='+$last.state+
 ' REPLY_CANDIDATES='+@($last.reply_candidates).Count)
$backupDir=Join-Path $Data 'SchedulerBackups'
New-Item -ItemType Directory -Path $backupDir -Force|Out-Null
$backup=Join-Path $backupDir ('pre-fial57-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.xml')
$xml=Export-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath
Set-Content -LiteralPath $backup -Value $xml -Encoding UTF8 -NoNewline
if($matchesBefore){
 $modified=$false
 try{
  $next=New-ScheduledTaskAction -Execute $PowerShellExe -Argument $afterArgs -WorkingDirectory $Root
  Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $next -ErrorAction Stop|Out-Null
  $modified=$true
  $current=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath
  if(@($current.Actions).Count -ne 1 -or
   [string]$current.Actions[0].Arguments -cne $afterArgs -or
   [string]$current.Actions[0].WorkingDirectory -ne $Root -or
   @($current.Triggers).Count -ne 4){Hold 'NEW_TASK_ACTION_NOT_VERIFIED'}
  foreach($port in $protected){
   if((Snapshot $port) -cne $ports[$port]){Hold ('PROTECTED_PROCESS_DRIFT_'+$port)}
  }
 }catch{
  $why=$_.Exception.Message
  if($modified){
   $old=New-ScheduledTaskAction -Execute $PowerShellExe -Argument $beforeArgs -WorkingDirectory $PriorRoot
   Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $old -ErrorAction Stop|Out-Null
   $restored=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath
   if([string]$restored.Actions[0].Arguments -cne $beforeArgs){Hold ('SCHEDULER_ROLLBACK_FAILED='+$why)}
   Write-Warning 'FIAL57_ROLLBACK_RESTORED_FIAL56=PASS'
  }
  Hold ('TASK_UPGRADE_FAILED='+$why)
 }
 Write-Host 'FIAL57_SCHEDULE=UPGRADED_IN_PLACE'
}else{Write-Host 'FIAL57_SCHEDULE=EXISTING_FIAL57_ADOPTED'}
Write-Host 'FIAL57_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host ('FIAL57_TASK_BACKUP='+$backup)
Write-Host 'FIAL57_NO_AUTOMATIC_EMAIL_SENDING=TRUE'
Write-Host 'FIAL57_OUTCOME_TRACKING_SCHEDULER=ACTIVE_WHEN_LOGGED_ON'
