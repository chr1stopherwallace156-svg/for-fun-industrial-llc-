# FIAL5.11: review source identity and first real public source cycle
# before upgrading exactly the current FIAL5.10 four-trigger Windows task.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$OldRoot=Join-Path $HOME 'FunIndustrial-FIAL512-BidReadiness'
$Branch='feature/fial5-13-verified-fleet-buyer-20261114'
$OldBranch='feature/fial5-12-bid-readiness-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$OldBlob='cbe72f3debbb68ce4eea19ba4b7fc0bb95d08fb5'
$OldRunner=Join-Path $OldRoot 'Run-Fun-Bid-Readiness-V5-12.ps1'
$NewRunner=Join-Path $Root 'Run-Fun-Buyer-V5-13.ps1'
$TaskName='FunIndustrial-Executive-Operator-V1'
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1'
function Hold([string]$why){throw ('FIAL513_INSTALL_HOLD='+$why)}
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
$actual=(& git.exe -C $OldRoot hash-object --path=Run-Fun-Bid-Readiness-V5-12.ps1 -- $OldRunner|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $actual -cne $OldBlob){Hold 'PRIOR_EXECUTIVE_RUNNER_HASH_DRIFT'}
$files=@('src\fit\commercial-fit-catalog-v5-11.mjs',
 'src\fit\commercial-fit-engine-v5-11.mjs','src\fit\commercial-fit-console-v5-11.js',
 'src\fit\commercial-fit-qwen-v5-11.mjs','src\fial\grounded-chat-v5-2.mjs',
 'scripts\Run-Fun-Commercial-Fit-V5-11.mjs',
 'src\bid-readiness\readiness-catalog-v5-12.mjs',
 'src\bid-readiness\readiness-engine-v5-12.mjs',
 'src\bid-readiness\readiness-qwen-v5-12.mjs',
 'src\fial\grounded-chat-v5-2.mjs',
 'src\bid-readiness\readiness-console-v5-12.js',
 'scripts\Run-Fun-Bid-Readiness-V5-12.mjs',
 'src\buyers\buyer-catalog-v5-13.mjs',
 'src\buyers\buyer-engine-v5-13.mjs',
 'src\buyers\buyer-console-v5-13.js',
 'src\buyers\buyer-qwen-v5-13.mjs',
 'scripts\Run-Fun-Buyer-V5-13.mjs',
 'intelligence-checks\fial513-buyer-evidence-case.mjs',
 'intelligence-checks\fial513-dashboard-case.mjs',
 'intelligence-checks\fial513-qwen-context-case.mjs',
 'intelligence-checks\fial512-bid-readiness-case.mjs',
 'intelligence-checks\fial512-dashboard-case.mjs',
 'intelligence-checks\fial512-qwen-context-case.mjs',
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
& $Node --test (Join-Path $Root 'intelligence-checks\fial513-buyer-evidence-case.mjs') (Join-Path $Root 'intelligence-checks\fial513-dashboard-case.mjs') (Join-Path $Root 'intelligence-checks\fial513-qwen-context-case.mjs') (Join-Path $Root 'intelligence-checks\fial512-bid-readiness-case.mjs') (Join-Path $Root 'intelligence-checks\fial512-dashboard-case.mjs') (Join-Path $Root 'intelligence-checks\fial512-qwen-context-case.mjs') (Join-Path $Root 'intelligence-checks\fial511-commercial-fit-case.mjs') (Join-Path $Root 'intelligence-checks\fial511-dashboard-case.mjs') (Join-Path $Root 'intelligence-checks\fial511-qwen-context-case.mjs') (Join-Path $Root 'intelligence-checks\fial510-procurement-case.mjs') (Join-Path $Root 'intelligence-checks\fial510-dashboard-case.mjs') (Join-Path $Root 'intelligence-checks\fial59-fleet-evidence-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'COMMERCIAL_FIT_REGRESSION_HOLD'}
Write-Host 'FIAL513_OFFLINE_TESTS=PASS'
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
$evidence=Join-Path $Data 'FleetBuyerV513\last-buyer-cycle-v1.json'
if(!(Test-Path -LiteralPath $evidence -PathType Leaf)){Hold 'FIRST_FIT_RECEIPT_MISSING'}
$r=Get-Content -LiteralPath $evidence -Raw|ConvertFrom-Json
if($r.version -cne 'fial5.13-verified-fleet-buyer-v1' -or
 [DateTimeOffset]::Parse([string]$r.as_of_utc) -lt $started.AddSeconds(-4) -or
 $r.buyer.id -cne 'bakersfield-city-school-district' -or
 $r.counts.verified_open_repair_bids -ne 0 -or
 $r.counts.verified_service_orders -ne 0 -or
 $r.counts.verified_revenue_usd -ne 0 -or
 $r.boundaries.emails_sent -ne 0 -or
 $r.boundaries.phone_calls_placed -ne 0 -or
 $r.boundaries.site_visits -ne 0 -or
 $r.boundaries.vendor_accounts_created -ne 0 -or
 $r.boundaries.rea_calls -ne 0 -or
 $r.boundaries.model_calls -ne 0){
 Hold 'FIRST_BUYER_RECEIPT_AUTHORITY_INVALID'
}
foreach($p in $ports){
 if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_PROCESS_CHANGED_PORT_'+$p)}
}
Write-Host ('FIAL513_FIRST_LIVE_BUYER_EVIDENCE=PASS SOURCES='+$r.counts.official_sources+
 ' RETRIEVED='+$r.counts.documents_retrieved+' HOLDS='+$r.counts.source_holds+
 ' VERIFIED_BUYER_PATHWAY='+$(if($r.counts.source_holds -eq 0){'1'}else{'SOURCE_DEPENDENT'}))
$backups=Join-Path $Data 'SchedulerBackups'
New-Item -ItemType Directory -Path $backups -Force|Out-Null
$backup=Join-Path $backups ('pre-fial513-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.xml')
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
   Write-Warning 'FIAL513_PREVIOUS_FIAL512_SCHEDULE_RESTORED=PASS'
  }
  Hold ('SCHEDULE_UPGRADE_ABORTED='+$why)
 }
 Write-Host 'FIAL513_SCHEDULE=UPGRADED_IN_PLACE'
}else{Write-Host 'FIAL513_SCHEDULE=ALREADY_REGISTERED'}
Write-Host 'FIAL513_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host ('FIAL513_SCHEDULE_BACKUP='+$backup)
Write-Host 'FIAL513_NO_EMAIL_CALL_SITE_VISIT_OR_PURCHASE_ORDERS=TRUE'
