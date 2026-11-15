# FIAL5.10 reviewed first live issuer GET then in-place 4-cycle task update.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$OldRoot=Join-Path $HOME 'FunIndustrial-FIAL59-FleetIntel'
$Branch='feature/fial5-10-verified-procurement-20261114'
$OldBranch='feature/fial5-9-fleet-opportunity-evidence-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$OldBlob='0e36713ca95f8fbb5e9bf48b0f120779bdcd430d'
$OldScript=Join-Path $OldRoot 'Run-Fun-Fleet-Opportunity-V5-9.ps1'
$Runner=Join-Path $Root 'Run-Fun-Procurement-V5-10.ps1'
$TaskName='FunIndustrial-Executive-Operator-V1'
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$reason){throw ('FIAL510_INSTALL_HOLD='+$reason)}
function Source([string]$dir,[string]$expected){
 if(!(Test-Path -LiteralPath $dir -PathType Container)){Hold 'SOURCE_MISSING'}
 $url=(& git.exe -C $dir remote get-url origin|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $url -cne $Origin){Hold 'SOURCE_ORIGIN_MISMATCH'}
 $branch=(& git.exe -C $dir branch --show-current|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $branch -cne $expected){Hold 'SOURCE_BRANCH_MISMATCH'}
 $dirty=@(& git.exe -C $dir status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold 'SOURCE_DIRTY'}
}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
Source $Root $Branch
Source $OldRoot $OldBranch
$sha=(& git.exe -C $OldRoot hash-object --path=Run-Fun-Fleet-Opportunity-V5-9.ps1 -- $OldScript|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $sha -cne $OldBlob){Hold 'PRIOR_RUNNER_HASH_DRIFT'}
$modules=@('src\procurement\procurement-catalog-v5-10.mjs',
 'src\procurement\procurement-engine-v5-10.mjs',
 'src\procurement\procurement-console-v5-10.js',
 'scripts\Run-Fun-Procurement-V5-10.mjs',
 'intelligence-checks\fial510-procurement-case.mjs',
 'intelligence-checks\fial510-dashboard-case.mjs',
 'scripts\Run-Fun-ML-Dashboard8802.mjs')
foreach($rel in $modules){
 $f=Join-Path $Root $rel
 if(!(Test-Path -LiteralPath $f -PathType Leaf)){Hold ('MODULE_MISSING='+$rel)}
 if(((Get-Item -LiteralPath $f).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'UNTRUSTED_LINK'}
 & $Node --check $f
 if($LASTEXITCODE -ne 0){Hold ('JS_PARSE_FAILED='+$rel)}
}
& $Node --test (Join-Path $Root 'intelligence-checks\fial510-procurement-case.mjs') (Join-Path $Root 'intelligence-checks\fial510-dashboard-case.mjs') (Join-Path $Root 'intelligence-checks\fial59-fleet-evidence-case.mjs') (Join-Path $Root 'intelligence-checks\fial59-dashboard-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'PROCUREMENT_TEST_FAILED'}
Write-Host 'FIAL510_OFFLINE_TESTS=PASS'
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($task.State -eq 'Disabled' -or $task.State -eq 'Running'){Hold 'EXECUTIVE_TASK_DISABLED_OR_BUSY'}
$actions=@($task.Actions)
$oldArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$OldScript+'"'
$newArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$Runner+'"'
if($actions.Count -ne 1 -or [string]$actions[0].Execute -cne $Shell -or
 @($task.Triggers).Count -ne 4 -or
 [string]$task.Principal.LogonType -cne 'Interactive' -or
 [string]$task.Principal.RunLevel -cne 'Limited'){Hold 'TASK_IDENTITY_PRIVILEGE_OR_TRIGGER_MISMATCH'}
$old=([string]$actions[0].Arguments -ceq $oldArgs -and
 [string]$actions[0].WorkingDirectory -ceq $OldRoot)
$new=([string]$actions[0].Arguments -ceq $newArgs -and
 [string]$actions[0].WorkingDirectory -ceq $Root)
if(!$old -and !$new){Hold 'UNKNOWN_TASK_ACTION_WILL_NOT_REPLACE'}
$ports=@(11434,8088,8791,8789,8796,8797,8798,8801,8802,8803,8804,8805,8806,8443)
$before=@{}
foreach($p in $ports){$before[$p]=Snapshot $p}
$started=[DateTimeOffset]::UtcNow
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Runner
if($LASTEXITCODE -ne 0){Hold 'FIRST_REAL_PROCUREMENT_CYCLE_FAILED_NO_SCHEDULE_CHANGE'}
$evidence=Join-Path $Data 'ProcurementV510\last-procurement-cycle-v1.json'
if(!(Test-Path -LiteralPath $evidence)){Hold 'OFFICIAL_EVIDENCE_MISSING'}
$r=Get-Content -LiteralPath $evidence -Raw|ConvertFrom-Json
if($r.version -cne 'fial5.10-published-procurement-v1' -or
 [DateTimeOffset]::Parse([string]$r.as_of_utc) -lt $started.AddSeconds(-4) -or
 $r.counts.verified_current_published_notices -gt 1 -or
 $r.counts.verified_fit_for_elektron -ne 0 -or
 $r.boundaries.actual_rfps_submitted -ne 0 -or
 $r.boundaries.rea_calls -ne 0 -or $r.boundaries.emails_sent -ne 0 -or
 $r.boundaries.model_calls -ne 0){Hold 'OFFICIAL_EVIDENCE_OR_AUTHORITY_INVALID'}
foreach($p in $ports){
 if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_PROCESS_CHANGED_PORT_'+$p)}
}
Write-Host ('FIAL510_FIRST_LIVE_OFFICIAL_NOTICE_CHECK=PASS SOURCES='+$r.counts.official_source_checks+
 ' HOLDS='+$r.counts.official_source_holds+
 ' PUBLISHED_NOTICE='+$r.counts.verified_current_published_notices)
$backups=Join-Path $Data 'SchedulerBackups'
New-Item -ItemType Directory -Path $backups -Force|Out-Null
$backup=Join-Path $backups ('pre-fial510-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.xml')
Set-Content -LiteralPath $backup -Value (Export-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath) -Encoding UTF8 -NoNewline
if($old){
 $changed=$false
 try{
  $newAction=New-ScheduledTaskAction -Execute $Shell -Argument $newArgs -WorkingDirectory $Root
  Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $newAction -ErrorAction Stop|Out-Null
  $changed=$true
  $updated=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath
  if(@($updated.Triggers).Count -ne 4 -or
   [string]$updated.Actions[0].Arguments -cne $newArgs -or
   [string]$updated.Actions[0].WorkingDirectory -cne $Root){Hold 'UPDATED_SCHEDULE_IDENTITY_MISMATCH'}
  foreach($p in $ports){if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_PORT_DRIFT='+$p)}}
 }catch{
  $why=$_.Exception.Message
  if($changed){
   $restore=New-ScheduledTaskAction -Execute $Shell -Argument $oldArgs -WorkingDirectory $OldRoot
   Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $restore -ErrorAction Stop|Out-Null
   $after=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath
   if([string]$after.Actions[0].Arguments -cne $oldArgs){Hold 'SCHEDULE_ROLLBACK_NOT_VERIFIED'}
   Write-Warning 'FIAL510_PREVIOUS_FIAL59_SCHEDULE_RESTORED=PASS'
  }
  Hold ('SCHEDULE_UPGRADE_ABORTED='+$why)
 }
 Write-Host 'FIAL510_SCHEDULE=UPGRADED_IN_PLACE'
}else{Write-Host 'FIAL510_SCHEDULE=ALREADY_REGISTERED'}
Write-Host 'FIAL510_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host ('FIAL510_SCHEDULER_BACKUP='+$backup)
Write-Host 'FIAL510_NO_GMAIL_NO_VENDOR_REGISTRATION_REQUIRED=TRUE'
