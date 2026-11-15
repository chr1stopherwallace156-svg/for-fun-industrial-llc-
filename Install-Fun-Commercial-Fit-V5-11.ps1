# FIAL5.11: review source identity and first real public source cycle
# before upgrading exactly the current FIAL5.10 four-trigger Windows task.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$OldRoot=Join-Path $HOME 'FunIndustrial-FIAL510-Procurement'
$Branch='feature/fial5-11-commercial-fit-qualification-20261114'
$OldBranch='feature/fial5-10-verified-procurement-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$OldBlob='72155fa2761c3a29166ac410fb655ba09721ff3c'
$OldRunner=Join-Path $OldRoot 'Run-Fun-Procurement-V5-10.ps1'
$NewRunner=Join-Path $Root 'Run-Fun-Commercial-Fit-V5-11.ps1'
$TaskName='FunIndustrial-Executive-Operator-V1'
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$why){throw ('FIAL511_INSTALL_HOLD='+$why)}
function Source([string]$dir,[string]$branch){
 if(!(Test-Path -LiteralPath $dir -PathType Container)){Hold 'CHECKOUT_MISSING'}
 if(((& git.exe -C $dir remote get-url origin|Out-String).Trim()) -cne $Origin -or $LASTEXITCODE -ne 0){
  Hold 'SOURCE_REMOTE_MISMATCH'
 }
 if(((& git.exe -C $dir branch --show-current|Out-String).Trim()) -cne $branch -or $LASTEXITCODE -ne 0){
  Hold 'SOURCE_BRANCH_MISMATCH'
 }
 $dirty=@(& git.exe -C $dir status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold 'SOURCE_DIRTY'}
}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
 ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
Source $Root $Branch
Source $OldRoot $OldBranch
$actual=(& git.exe -C $OldRoot hash-object --path=Run-Fun-Procurement-V5-10.ps1 -- $OldRunner|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $actual -cne $OldBlob){Hold 'PRIOR_EXECUTIVE_RUNNER_HASH_DRIFT'}
$files=@('src\fit\commercial-fit-catalog-v5-11.mjs',
 'src\fit\commercial-fit-engine-v5-11.mjs','src\fit\commercial-fit-console-v5-11.js',
 'src\fit\commercial-fit-qwen-v5-11.mjs','src\fial\grounded-chat-v5-2.mjs',
 'scripts\Run-Fun-Commercial-Fit-V5-11.mjs',
 'intelligence-checks\fial511-commercial-fit-case.mjs',
 'intelligence-checks\fial511-dashboard-case.mjs','intelligence-checks\fial511-qwen-context-case.mjs',
 'scripts\Run-Fun-ML-Dashboard8802.mjs')
foreach($rel in $files){
 $file=Join-Path $Root $rel
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_CODE_MISSING='+$rel)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'LINKED_SOURCE_REFUSED'}
 & $Node --check $file
 if($LASTEXITCODE -ne 0){Hold ('SOURCE_PARSE_FAILED='+$rel)}
}
& $Node --test (Join-Path $Root 'intelligence-checks\fial511-commercial-fit-case.mjs') (Join-Path $Root 'intelligence-checks\fial511-dashboard-case.mjs') (Join-Path $Root 'intelligence-checks\fial511-qwen-context-case.mjs') (Join-Path $Root 'intelligence-checks\fial510-procurement-case.mjs') (Join-Path $Root 'intelligence-checks\fial510-dashboard-case.mjs') (Join-Path $Root 'intelligence-checks\fial59-fleet-evidence-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'COMMERCIAL_FIT_REGRESSION_HOLD'}
Write-Host 'FIAL511_OFFLINE_TESTS=PASS'
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($task.State -eq 'Disabled' -or $task.State -eq 'Running'){Hold 'EXECUTIVE_TASK_NOT_IDLE'}
$actions=@($task.Actions)
$oldArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$OldRunner+'"'
$newArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$NewRunner+'"'
if($actions.Count -ne 1 -or [string]$actions[0].Execute -cne $Shell -or
 @($task.Triggers).Count -ne 4 -or
 [string]$task.Principal.LogonType -cne 'Interactive' -or
 [string]$task.Principal.RunLevel -cne 'Limited'){
 Hold 'TASK_IDENTITY_OR_FOUR_TRIGGER_MISMATCH'
}
$old=([string]$actions[0].Arguments -ceq $oldArgs -and
 [string]$actions[0].WorkingDirectory -ceq $OldRoot)
$new=([string]$actions[0].Arguments -ceq $newArgs -and
 [string]$actions[0].WorkingDirectory -ceq $Root)
if(!$old -and !$new){Hold 'UNKNOWN_TASK_ACTION_WILL_NOT_REPLACE'}
$ports=@(11434,8088,8791,8789,8796,8797,8798,8801,8802,8803,8804,8805,8806,8443)
$before=@{}
foreach($p in $ports){$before[$p]=Snapshot $p}
$started=[DateTimeOffset]::UtcNow
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $NewRunner
if($LASTEXITCODE -ne 0){Hold 'FIRST_REAL_FIT_CHECK_FAILED_SCHEDULE_UNCHANGED'}
$evidence=Join-Path $Data 'CommercialFitV511\last-fit-cycle-v1.json'
if(!(Test-Path -LiteralPath $evidence -PathType Leaf)){Hold 'FIRST_FIT_RECEIPT_MISSING'}
$r=Get-Content -LiteralPath $evidence -Raw|ConvertFrom-Json
if($r.version -cne 'fial5.11-commercial-fit-v1' -or
 [DateTimeOffset]::Parse([string]$r.as_of_utc) -lt $started.AddSeconds(-4) -or
 $r.counts.directly_qualified_bids -ne 0 -or
 $r.counts.contracts_awarded -ne 0 -or
 $r.boundaries.bids_submitted -ne 0 -or
 $r.boundaries.rea_calls -ne 0 -or
 $r.boundaries.emails_sent -ne 0 -or
 $r.boundaries.model_calls -ne 0){
 Hold 'FIRST_FIT_RECEIPT_AUTHORITY_INVALID'
}
foreach($p in $ports){
 if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_PROCESS_CHANGED_PORT_'+$p)}
}
Write-Host ('FIAL511_FIRST_LIVE_SOURCE_CYCLE=PASS SOURCES='+$r.counts.offical_source_count+
 ' DOCUMENTS='+$r.counts.source_docs_retrieved+
 ' HOLDS='+$r.counts.official_source_holds+' VERIFIED_DIRECT_BIDS=0')
$backups=Join-Path $Data 'SchedulerBackups'
New-Item -ItemType Directory -Path $backups -Force|Out-Null
$backup=Join-Path $backups ('pre-fial511-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.xml')
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
   [string]$updated.Actions[0].WorkingDirectory -cne $Root){Hold 'UPDATED_TASK_MISMATCH'}
  foreach($p in $ports){if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_PORT_CHANGED_AFTER_SCHEDULE_'+$p)}}
 }catch{
  $why=$_.Exception.Message
  if($changed){
   $restore=New-ScheduledTaskAction -Execute $Shell -Argument $oldArgs -WorkingDirectory $OldRoot
   Set-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath -Action $restore -ErrorAction Stop|Out-Null
   $restored=Get-ScheduledTask -TaskName $TaskName -TaskPath $task.TaskPath
   if([string]$restored.Actions[0].Arguments -cne $oldArgs){Hold 'SCHEDULE_ROLLBACK_NOT_VERIFIED'}
   Write-Warning 'FIAL511_PREVIOUS_FIAL510_SCHEDULE_RESTORED=PASS'
  }
  Hold ('SCHEDULE_UPGRADE_ABORTED='+$why)
 }
 Write-Host 'FIAL511_SCHEDULE=UPGRADED_IN_PLACE'
}else{Write-Host 'FIAL511_SCHEDULE=ALREADY_REGISTERED'}
Write-Host 'FIAL511_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host ('FIAL511_SCHEDULE_BACKUP='+$backup)
Write-Host 'FIAL511_NO_GMAIL_NO_VENDORS_CONTACTED=TRUE'
