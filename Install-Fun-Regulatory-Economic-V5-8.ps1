# FIAL5.8 guarded in-place scheduler upgrade; reuses the existing
# four daily cycles, makes a first *real* public-data refresh before changing.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='repair/fial58-2026-amendment-data-integrity-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$OldRoot=Join-Path $HOME 'FunIndustrial-FIAL58-RegulatoryIntelligence'
$OldBranch='feature/fial5-8-regulatory-economic-intelligence-20261114'
$OldScript=Join-Path $OldRoot 'Run-Fun-Regulatory-Economic-V5-8.ps1'
$OldBlob='fa2ebe4a46654ab299520bbb1ae3901526a5b92a'
$NewScript=Join-Path $Root 'Run-Fun-Regulatory-Economic-V5-8.ps1'
$TaskName='FunIndustrial-Executive-Operator-V1'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
function Hold([string]$reason){throw ('FIAL58_INSTALL_HOLD='+$reason)}
function SourceIdentity([string]$path,[string]$expected){
 if(!(Test-Path -LiteralPath $path -PathType Container)){Hold ('CHECKOUT_MISSING='+$path)}
 $url=(& git.exe -C $path remote get-url origin|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $url -cne $Origin){Hold ('ORIGIN_NOT_REVIEWED='+$path)}
 $branch=(& git.exe -C $path branch --show-current|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $branch -cne $expected){Hold ('BRANCH_NOT_REVIEWED='+$path)}
 $changes=@(& git.exe -C $path status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $changes.Count){Hold ('DIRTY_CHECKOUT_REFUSED='+$path)}
}
function PortOwners([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object)-join ';')
}
SourceIdentity $Root $Branch
SourceIdentity $OldRoot $OldBranch
$oldHash=(& git.exe -C $OldRoot hash-object --path=Run-Fun-Regulatory-Economic-V5-8.ps1 -- $OldScript|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $oldHash -cne $OldBlob){Hold 'OLD_SCHEDULED_RUNNER_BLOB_DRIFT'}
$files=@(
 'src\regulatory\rule-catalog-v5-8.mjs',
 'src\regulatory\intelligence-engine-v5-8.mjs',
 'src\regulatory\regulatory-console-v5-8.js',
 'src\regulatory\regulatory-qwen-v5-8.mjs',
 'scripts\Run-Fun-Regulatory-Economic-V5-8.mjs',
 'intelligence-checks\fial58-regulatory-intelligence-case.mjs',
 'intelligence-checks\fial58-regulatory-dashboard-case.mjs')
foreach($rel in $files){
 $path=Join-Path $Root $rel
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('MISSING_SOURCE='+$rel)}
 if(((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'SYMLINK_SOURCE_REFUSED'}
 & $Node --check $path
 if($LASTEXITCODE -ne 0){Hold ('JS_PARSE_FAILED='+$rel)}
}
& $Node --test (Join-Path $Root 'intelligence-checks\fial58-regulatory-intelligence-case.mjs') (Join-Path $Root 'intelligence-checks\fial58-regulatory-dashboard-case.mjs') (Join-Path $Root 'intelligence-checks\fial57-outcomes-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'REGULATORY_INTELLIGENCE_TEST_FAILED'}
Write-Host 'FIAL58_OFFLINE_TESTS=PASS'
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($task.State -eq 'Disabled' -or $task.State -eq 'Running'){Hold 'EXISTING_TASK_DISABLED_OR_IN_PROGRESS'}
$oldArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$OldScript+'"'
$newArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$NewScript+'"'
$actions=@($task.Actions)
if($actions.Count -ne 1 -or [string]$actions[0].Execute -ne $Shell -or
 @($task.Triggers).Count -ne 4 -or
 [string]$task.Principal.LogonType -ne 'Interactive' -or
 [string]$task.Principal.RunLevel -ne 'Limited'){Hold 'SCHEDULE_IDENTITY_OR_PRIVILEGE_MISMATCH'}
$old=([string]$actions[0].Arguments -ceq $oldArgs -and
 [string]$actions[0].WorkingDirectory -eq $OldRoot)
$new=([string]$actions[0].Arguments -ceq $newArgs -and
 [string]$actions[0].WorkingDirectory -eq $Root)
if(!$old -and !$new){Hold 'UNKNOWN_SCHEDULE_ACTION_REFUSE_REPLACE'}
$ports=@(11434,8088,8789,8791,8796,8797,8798,8801,8802,8803,8804,8805,8806,8443)
$before=@{}
foreach($p in $ports){$before[$p]=PortOwners $p}
$started=[DateTimeOffset]::UtcNow
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $NewScript
if($LASTEXITCODE -ne 0){Hold 'FIRST_REAL_INTELLIGENCE_CYCLE_FAILED'}
$receipt=Join-Path $Data 'RegulatoryEconomicV58\last-intelligence-v1.json'
if(!(Test-Path -LiteralPath $receipt -PathType Leaf)){Hold 'FIRST_PUBLIC_EVIDENCE_RECEIPT_MISSING'}
$last=Get-Content -LiteralPath $receipt -Raw|ConvertFrom-Json
if($last.version -cne 'fial5.8-regulatory-economic-v1' -or
 [DateTimeOffset]::Parse([string]$last.as_of_utc) -lt $started.AddSeconds(-4) -or
 $last.boundaries.emails_sent -ne 0 -or
 $last.boundaries.automatic_filing -ne 0 -or
 $last.boundaries.model_calls -ne 0 -or
 $last.boundaries.verified_individual_due_dates -ne 0){Hold 'FIRST_PUBLIC_EVIDENCE_INVALID'}
foreach($p in $ports){if((PortOwners $p) -cne $before[$p]){Hold ('PROTECTED_SERVICE_CHANGED_PORT_'+$p)}}
if($last.source_catalog_version -cne 'fial5.8.1-regulatory-catalog-2026-amendment-v1' -or
 $last.authority_update -cne 'ACF_2026_FINAL_AMENDMENT_SUPERSEDES_2027_PURCHASE_RULE'){
 Hold 'APPROVED_2026_AMENDMENT_NOT_ACTIVE'
}
$acf=@($last.rule_watch|Where-Object {$_.id -eq 'acf-state-local-purchasing'})
if($acf.Count -ne 1 -or $acf[0].effective -cne '2030-01-01' -or
 $acf[0].supersedes -cne '2027-01-01'){
 Hold 'OUTDATED_2027_MILESTONE_NOT_REPLACED'
}
Write-Host ('FIAL58_FIRST_REAL_CYCLE=PASS SOURCES='+$last.counts.monitored+
 ' FETCHED='+$last.counts.refreshed+
 ' HOLDS='+$last.counts.source_holds+
 ' BLS_SERIES='+$last.counts.economic_series)
$backupDir=Join-Path $Data 'SchedulerBackups'
New-Item -ItemType Directory -Path $backupDir -Force|Out-Null
$backup=Join-Path $backupDir ('pre-fial58-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.xml')
Set-Content -LiteralPath $backup -Value (Export-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath) -Encoding UTF8 -NoNewline
if($old){
 $changed=$false
 try{
  $next=New-ScheduledTaskAction -Execute $Shell -Argument $newArgs -WorkingDirectory $Root
  Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $next -ErrorAction Stop|Out-Null
  $changed=$true
  $reloaded=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -ErrorAction Stop
  if(@($reloaded.Actions).Count -ne 1 -or [string]$reloaded.Actions[0].Arguments -cne $newArgs -or
   [string]$reloaded.Actions[0].WorkingDirectory -ne $Root -or
   @($reloaded.Triggers).Count -ne 4){Hold 'UPDATED_SCHEDULE_INVALID'}
  foreach($p in $ports){if((PortOwners $p) -cne $before[$p]){Hold ('PROTECTED_SERVICE_CHANGED_PORT_'+$p)}}
 }catch{
  $why=$_.Exception.Message
  if($changed){
   $oldAction=New-ScheduledTaskAction -Execute $Shell -Argument $oldArgs -WorkingDirectory $OldRoot
   Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $oldAction -ErrorAction Stop|Out-Null
   $restored=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -ErrorAction Stop
   if([string]$restored.Actions[0].Arguments -cne $oldArgs){Hold ('ROLLBACK_NOT_VERIFIED='+$why)}
   Write-Warning 'FIAL58_RESTORED_PREVIOUS_FIAL57_TASK=PASS'
  }
  Hold ('SCHEDULER_CHANGE_ABORTED='+$why)
 }
 Write-Host 'FIAL58_SCHEDULE=UPGRADED_IN_PLACE'
}else{Write-Host 'FIAL58_SCHEDULE=EXISTING_FIAL58_ADOPTED'}
Write-Host 'FIAL58_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host ('FIAL58_SCHEDULER_BACKUP='+$backup)
Write-Host 'FIAL58_NO_GMAIL_OAUTH_REQUIRED=TRUE'
Write-Host 'FIAL58_REGULATORY_MONITOR=ACTIVE_WHEN_LOGGED_ON'
