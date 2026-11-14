# FIAL 5.4 live execution audit. Read only by default; -RunScheduledCycle
# requests one already-authorized bounded LOCAL worker run through Task Scheduler.
# Never modifies the scheduled task, sends mail, submits filings or restarts services.
[CmdletBinding()]param([switch]$RunScheduledCycle)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fial54-execution-audit-v1-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$WorkerRoot=Join-Path $HOME 'FunIndustrial-FIAL54-Executive'
$WorkerBranch='feature/fial5-4-executive-operator-v1-20261114'
$Worker=Join-Path $WorkerRoot 'Run-Fun-Executive-Operator-V1.ps1'
$TaskName='FunIndustrial-Executive-Operator-V1'
$GrantTaskName='FunIndustrial-GrantApplications-V1'
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
$Receipt=Join-Path $Data 'last-cycle-v1.json'
$AuditScript=Join-Path $Root 'scripts\Audit-Fun-Executive-State.mjs'
function Hold([string]$reason){throw ('FIAL54_AUDIT_HOLD='+$reason)}
function VerifySource([string]$folder,[string]$branch){
 if(!(Test-Path -LiteralPath $folder -PathType Container)){Hold ('SOURCE_MISSING='+$folder)}
 $origin=(& git.exe -C $folder remote get-url origin | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $origin -cne $Origin){Hold ('SOURCE_ORIGIN_MISMATCH='+$folder)}
 $active=(& git.exe -C $folder branch --show-current | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $active -cne $branch){Hold ('SOURCE_BRANCH_MISMATCH='+$folder)}
 if(@(& git.exe -C $folder status --porcelain=v1 --untracked-files=all).Count){Hold ('SOURCE_WORKTREE_DIRTY='+$folder)}
}
function ListenerIdentity([int]$port){
 return (@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue|
  ForEach-Object { "$($_.LocalAddress):$($_.OwningProcess)" }|Sort-Object)-join ';')
}
function StatusRead([string]$uri,[string]$name){
 try{
  $value=Invoke-RestMethod -Uri $uri -TimeoutSec 9 -ErrorAction Stop
  Write-Host ($name+'=REACHABLE')
  return $value
 }catch{
  Write-Warning ($name+'=UNAVAILABLE '+$_.Exception.Message)
  return $null
 }
}
function CurrentReceipt {
 if(!(Test-Path -LiteralPath $Receipt -PathType Leaf)){Hold 'EXECUTIVE_RECEIPT_MISSING'}
 try{return Get-Content -LiteralPath $Receipt -Raw -ErrorAction Stop|ConvertFrom-Json -ErrorAction Stop}
 catch{Hold 'EXECUTIVE_RECEIPT_UNREADABLE'}
}
VerifySource $Root $Branch
VerifySource $WorkerRoot $WorkerBranch
foreach($p in @($Worker,$AuditScript)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('SCRIPT_MISSING='+$p)}
 if(((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SCRIPT_REPARSE_REFUSED='+$p)
 }
}
$NodeExecutable=(Get-Command node.exe -ErrorAction Stop).Source
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($task.State -eq 'Disabled'){Hold 'EXECUTIVE_TASK_DISABLED'}
$actions=@($task.Actions);$triggers=@($task.Triggers)
$expectedExe=(Get-Command powershell.exe -ErrorAction Stop).Source
$expectedArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$Worker+'"'
if($actions.Count -ne 1 -or
 [string]$actions[0].Execute -cne $expectedExe -or
 [string]$actions[0].Arguments -cne $expectedArgs -or
 [string]$actions[0].WorkingDirectory -cne $WorkerRoot){Hold 'EXECUTIVE_TASK_ACTION_IDENTITY_HOLD'}
if($triggers.Count -ne 4){Hold 'EXECUTIVE_TASK_TRIGGER_COUNT_HOLD'}
$triggerTimes=@($triggers|ForEach-Object {$_.StartBoundary.Substring(11,5)}|Sort-Object)
if(($triggerTimes -join ',') -cne '01:00,07:00,13:00,19:00' -or
 @($triggers|Where-Object {$_.Enabled -ne $true}).Count -ne 0){Hold 'EXECUTIVE_TASK_TRIGGER_TIMES_HOLD'}
if([string]$task.Principal.LogonType -ne 'Interactive' -or
 [string]$task.Principal.RunLevel -ne 'Limited'){Hold 'EXECUTIVE_TASK_PRIVILEGE_HOLD'}
Write-Host 'FIAL54_SCHEDULE_IDENTITY=PASS TRIGGERS=01:00,07:00,13:00,19:00 LOCAL'
$before=CurrentReceipt
$beforeTime=[DateTimeOffset]::Parse([string]$before.cycle_utc)
$taskBefore=Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop
Write-Host ('FIAL54_SCHEDULER_PRIOR_LAST_RUN='+$taskBefore.LastRunTime.ToString('o'))
Write-Host ('FIAL54_SCHEDULER_PRIOR_RESULT='+$taskBefore.LastTaskResult)
$protectedPorts=@(11434,8088,8789,8791,8796,8797,8798,8801,8802,8803,8804,8805,8806,8443)
$beforePorts=@{}
foreach($p in $protectedPorts){$beforePorts[$p]=ListenerIdentity $p}
$taskWasRun=$false
if($RunScheduledCycle){
 if($task.State -eq 'Running'){Hold 'EXECUTIVE_TASK_ALREADY_RUNNING_NO_RESTART'}
 $requestTime=Get-Date
 Write-Host 'FIAL54_ONE_CONTROLLED_SCHEDULED_CYCLE=REQUESTED'
 Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
 $taskWasRun=$true
 $finished=$false
 for($i=0;$i -lt 120;$i++){
  Start-Sleep -Milliseconds 400
  try{
   $taskState=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
   $info=Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop
   $after=CurrentReceipt
   $cycleDate=[DateTimeOffset]::Parse([string]$after.cycle_utc)
   $startValid=$info.LastRunTime -ge $requestTime.AddSeconds(-4)
   $newReceipt=$cycleDate -gt $beforeTime
   if($startValid -and $taskState.State -ne 'Running' -and $info.LastTaskResult -eq 0 -and $newReceipt){
    $finished=$true;break
   }
  }catch{}
 }
 if(!$finished){
  $info=Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
  Write-Warning ('FIAL54_LAST_SCHEDULER_RESULT='+$info.LastTaskResult)
  Hold 'SCHEDULED_TASK_RUN_NOT_PROVEN_REVIEW_LOCAL_LOGS'
 }
 Write-Host 'FIAL54_ON_DEMAND_SCHEDULER_EXECUTION=PASS_NEW_RECEIPT'
}else{
 Write-Host 'FIAL54_ON_DEMAND_SCHEDULER_EXECUTION=NOT_REQUESTED'
}
& $NodeExecutable $AuditScript --json | Out-String | ForEach-Object {$auditText=$_}
if($LASTEXITCODE -ne 0){Hold 'LOCAL_EVIDENCE_AUDIT_FAILED'}
try{$audit=$auditText|ConvertFrom-Json -ErrorAction Stop}
catch{Hold 'LOCAL_EVIDENCE_AUDIT_JSON_INVALID'}
if($audit.version -cne 'fial54-execution-audit-v1'){Hold 'LOCAL_AUDIT_VERSION_MISMATCH'}
Write-Host ('FIAL54_AUDIT_LEDGER='+$audit.ledger_status)
Write-Host ('FIAL54_AUDIT_LAST_CYCLE_UTC='+$audit.cycle_utc)
Write-Host ('FIAL54_AUDIT_ITEM_CLASSES='+($audit.source_classes|ConvertTo-Json -Compress))
Write-Host ('FIAL54_AUDIT_NEW_OR_CHANGED='+$audit.new_or_changed+' PACKETS_THIS_CYCLE='+$audit.created_this_cycle)
Write-Host ('FIAL54_AUDIT_MAIL='+$audit.mail_state)
Write-Host ('FIAL54_AUDIT_GRANTS='+$audit.grants.state+' SOURCE='+$audit.grants.source_sha256)
Write-Host ('FIAL54_AUDIT_COMPANIES_VERIFIED='+$audit.companies_with_verifiable_registration)
foreach($warn in @($audit.warnings)){Write-Warning ('FIAL54_EXPECTATION_GAP='+$warn)}
foreach($err in @($audit.errors)){Write-Warning ('FIAL54_LEDGER_ERROR='+$err)}
if($audit.ledger_status -cne 'VALID_LOCAL_CYCLE'){Hold 'EXECUTIVE_LOCAL_LEDGER_NOT_TRUSTWORTHY'}
$grant=Get-ScheduledTask -TaskName $GrantTaskName -ErrorAction SilentlyContinue
if($null -eq $grant){Write-Warning 'FIAL54_GRANTS_SCHEDULE=NOT_FOUND'}
else{
 $gInfo=Get-ScheduledTaskInfo -TaskName $GrantTaskName -ErrorAction SilentlyContinue
 Write-Host ('FIAL54_GRANTS_TASK='+$grant.State+' LAST_RUN='+$gInfo.LastRunTime.ToString('o')+' LAST_RESULT='+$gInfo.LastTaskResult)
}
$dashboard=StatusRead 'http://127.0.0.1:8802/api/operator/status' 'FIAL54_EXECUTIVE_DASHBOARD'
if($dashboard){
 if($dashboard.version -cne 'fial5.4-executive-operator-v1' -or
  $dashboard.active_items -ne $audit.item_count){Hold 'EXECUTIVE_DASHBOARD_LEDGER_OUT_OF_SYNC'}
}
foreach($p in $protectedPorts){
 if((ListenerIdentity $p) -cne $beforePorts[$p]){Hold ('PROTECTED_SERVICE_OWNER_CHANGED_PORT_'+$p)}
}
Write-Host 'FIAL54_PROTECTED_SERVICES=UNCHANGED'
Write-Host 'FIAL54_SCHEDULED_LOCAL_WORKER='+$(if($taskWasRun){'VERIFIED_ON_DEMAND'}else{'CONFIGURATION_ONLY'})
Write-Host 'FIAL54_FUTURE_CLOCK_TRIGGER=NOT_YET_PROVEN_BY_THIS_COMMAND'
Write-Host 'FIAL54_EXTERNAL_EMAILS_FILINGS_PAYMENTS_REA=NOT_PERFORMED'
Write-Host 'FIAL54_FULL_EXECUTIVE_ASSISTANT_EXPECTATION=NOT_YET_MET'
Write-Host 'FIAL54_EXECUTION_AUDIT=COMPLETE'
