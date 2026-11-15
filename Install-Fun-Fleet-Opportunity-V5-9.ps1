# FIAL5.9: in-place four-trigger upgrade after verified first local fleet cycle.
# Never installs a new task, starts a model, modifies unrelated services or
# authorizes an external action. Leaves the FIAL581 checkout as rollback.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$OldRoot=Join-Path $HOME 'FunIndustrial-FIAL581-DataIntegrity'
$Branch='feature/fial5-9-fleet-opportunity-evidence-20261114'
$OldBranch='repair/fial58-2026-amendment-data-integrity-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$OldBlob='fa2ebe4a46654ab299520bbb1ae3901526a5b92a'
$OldScript=Join-Path $OldRoot 'Run-Fun-Regulatory-Economic-V5-8.ps1'
$Runner=Join-Path $Root 'Run-Fun-Fleet-Opportunity-V5-9.ps1'
$TaskName='FunIndustrial-Executive-Operator-V1'
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$reason){throw ('FIAL59_INSTALL_HOLD='+$reason)}
function Source([string]$dir,[string]$expected){
 if(!(Test-Path -LiteralPath $dir -PathType Container)){Hold 'SOURCE_CHECKOUT_MISSING'}
 if(((& git.exe -C $dir remote get-url origin|Out-String).Trim()) -cne $Origin -or
    $LASTEXITCODE -ne 0){Hold 'SOURCE_ORIGIN_MISMATCH'}
 if(((& git.exe -C $dir branch --show-current|Out-String).Trim()) -cne $expected -or
    $LASTEXITCODE -ne 0){Hold 'SOURCE_BRANCH_MISMATCH'}
 if(@(& git.exe -C $dir status --porcelain=v1 --untracked-files=all).Count -or
    $LASTEXITCODE -ne 0){Hold 'SOURCE_DIRTY'}
}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
Source $Root $Branch
Source $OldRoot $OldBranch
$hash=(& git.exe -C $OldRoot hash-object --path=Run-Fun-Regulatory-Economic-V5-8.ps1 -- $OldScript|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $hash -cne $OldBlob){Hold 'PREVIOUS_FIAL581_RUNNER_HASH_DRIFT'}
$files=@(
 'src\fleet\fleet-sources-v5-9.mjs','src\fleet\fleet-engine-v5-9.mjs',
 'src\fleet\fleet-console-v5-9.js','src\fleet\fleet-qwen-v5-9.mjs',
 'scripts\Run-Fun-Fleet-Opportunity-V5-9.mjs',
 'intelligence-checks\fial59-fleet-evidence-case.mjs',
 'intelligence-checks\fial59-dashboard-case.mjs','intelligence-checks\fial59-qwen-context-case.mjs',
 'scripts\Run-Fun-ML-Dashboard8802.mjs')
foreach($relative in $files){
 $file=Join-Path $Root $relative
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('MISSING_SOURCE='+$relative)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold 'SOURCE_SYMLINK_REFUSED'
 }
 & $Node --check $file
 if($LASTEXITCODE -ne 0){Hold ('JS_PARSE_FAILED='+$relative)}
}
& $Node --test (Join-Path $Root 'intelligence-checks\fial59-fleet-evidence-case.mjs') (Join-Path $Root 'intelligence-checks\fial59-dashboard-case.mjs') (Join-Path $Root 'intelligence-checks\fial59-qwen-context-case.mjs') (Join-Path $Root 'intelligence-checks\fial58-regulatory-intelligence-case.mjs') (Join-Path $Root 'intelligence-checks\fial58-regulatory-dashboard-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'FLEET_REGRESSION_TEST_HOLD'}
Write-Host 'FIAL59_OFFLINE_TESTS=PASS'
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($task.State -eq 'Disabled' -or $task.State -eq 'Running'){Hold 'TASK_NOT_SAFE_TO_UPGRADE'}
$actions=@($task.Actions)
$oldArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$OldScript+'"'
$newArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$Runner+'"'
if($actions.Count -ne 1 -or [string]$actions[0].Execute -ne $Shell -or
 @($task.Triggers).Count -ne 4 -or
 [string]$task.Principal.LogonType -ne 'Interactive' -or
 [string]$task.Principal.RunLevel -ne 'Limited'){
 Hold 'TASK_IDENTITY_PRIVILEGE_OR_TRIGGER_MISMATCH'
}
$old=([string]$actions[0].Arguments -ceq $oldArgs -and
 [string]$actions[0].WorkingDirectory -ceq $OldRoot)
$new=([string]$actions[0].Arguments -ceq $newArgs -and
 [string]$actions[0].WorkingDirectory -ceq $Root)
if(!$old -and !$new){Hold 'UNKNOWN_TASK_ACTION_WILL_NOT_REPLACE'}
$ports=@(11434,8088,8791,8789,8796,8797,8798,8801,8802,8803,8804,8805,8806,8443)
$before=@{}
foreach($port in $ports){$before[$port]=Snapshot $port}
$started=[DateTimeOffset]::UtcNow
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Runner
if($LASTEXITCODE -ne 0){Hold 'FIRST_REAL_FLEET_CYCLE_FAILED_NO_SCHEDULE_CHANGE'}
$receipt=Join-Path $Data 'FleetOpportunityV59\last-fleet-cycle-v1.json'
if(!(Test-Path -LiteralPath $receipt -PathType Leaf)){Hold 'FIRST_FLEET_RECEIPT_MISSING'}
$r=Get-Content -LiteralPath $receipt -Raw|ConvertFrom-Json
if($r.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
 [DateTimeOffset]::Parse([string]$r.last_cycle_utc) -lt $started.AddSeconds(-4) -or
 $r.counts.verified_open_rfps -ne 0 -or $r.counts.awarded_contracts -ne 0 -or
 $r.boundaries.emails_sent -ne 0 -or $r.boundaries.filed_forms -ne 0 -or
 $r.boundaries.model_calls -ne 0 -or $r.boundaries.rea_calls -ne 0){
 Hold 'FLEET_EVIDENCE_OR_AUTHORITY_INVALID'
}
foreach($port in $ports){
 if((Snapshot $port) -cne $before[$port]){Hold ('PROTECTED_PROCESS_CHANGED_PORT_'+$port)}
}
Write-Host ('FIAL59_FIRST_REAL_FLEET_OBSERVATION=PASS SOURCES='+$r.counts.official_sources+
 ' CHECKED='+$r.counts.checked+' HELD='+$r.counts.held+
 ' RESEARCH_PROSPECTS='+$r.counts.named_prospects)
$backupDir=Join-Path $Data 'SchedulerBackups'
New-Item -ItemType Directory -Path $backupDir -Force|Out-Null
$backup=Join-Path $backupDir ('pre-fial59-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.xml')
Set-Content -LiteralPath $backup -Value (Export-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath) -Encoding UTF8 -NoNewline
if($old){
 $changed=$false
 try{
  $action=New-ScheduledTaskAction -Execute $Shell -Argument $newArgs -WorkingDirectory $Root
  Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $action -ErrorAction Stop|Out-Null
  $changed=$true
  $updated=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -ErrorAction Stop
  if(@($updated.Triggers).Count -ne 4 -or
   [string]$updated.Actions[0].Arguments -cne $newArgs -or
   [string]$updated.Actions[0].WorkingDirectory -cne $Root){Hold 'UPDATED_TASK_MISMATCH'}
  foreach($port in $ports){if((Snapshot $port) -cne $before[$port]){Hold ('PROTECTED_PORT_CHANGED_AFTER_SCHEDULE_'+$port)}}
 }catch{
  $why=$_.Exception.Message
  if($changed){
   $restore=New-ScheduledTaskAction -Execute $Shell -Argument $oldArgs -WorkingDirectory $OldRoot
   Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $restore -ErrorAction Stop|Out-Null
   $check=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath
   if([string]$check.Actions[0].Arguments -cne $oldArgs){Hold 'SCHEDULE_ROLLBACK_NOT_CONFIRMED'}
   Write-Warning 'FIAL59_PREVIOUS_FIAL581_SCHEDULE_RESTORED=PASS'
  }
  Hold ('UPGRADE_ABORTED='+$why)
 }
 Write-Host 'FIAL59_SCHEDULE=UPGRADED_IN_PLACE'
}else{Write-Host 'FIAL59_SCHEDULE=ALREADY_REGISTERED'}
Write-Host 'FIAL59_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host ('FIAL59_SCHEDULE_BACKUP='+$backup)
Write-Host 'FIAL59_NO_GMAIL_OAUTH_REQUIRED=TRUE'
