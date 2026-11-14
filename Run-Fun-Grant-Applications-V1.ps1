# Run one real grants cycle. Safe for Windows Task Scheduler and manual Termius calls.
# Only official public source GET and LOCAL draft/evidence writes; no form submissions.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$TaskName='FunIndustrial-GrantApplications-V1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Grant-Applications-V1.mjs'
$Storage=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RealApplicationWorkerV1'
function Hold([string]$why){throw ('FUN_REAL_GRANT_WORKER_HOLD='+$why)}
if(!(Test-Path -LiteralPath $Worker -PathType Leaf)){Hold 'WORKER_SOURCE_MISSING'}
if((Get-Item -LiteralPath $Worker).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'WORKER_SYMLINK_REFUSED'}
$node=(Get-Command node.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $Storage -Force|Out-Null
$mutex=[System.Threading.Mutex]::new($false,'Local\FunIndustrial-GrantApplications-V1')
$own=$false
try{
 try{$own=$mutex.WaitOne(0)}
 catch [System.Threading.AbandonedMutexException]{
  $own=$true
  Write-Host 'FUN_GRANTS_WORKER=ABANDONED_LOCK_RECOVERED_AFTER_PREVIOUS_EXIT'
 }
 if(!$own){Write-Host 'FUN_GRANTS_WORKER=ALREADY_RUNNING NO_DUPLICATE';return}
 $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
 $logdir=Join-Path $Storage 'logs'
 New-Item -ItemType Directory -Path $logdir -Force|Out-Null
 $log=Join-Path $logdir ('grants-'+$stamp+'.log')
 Write-Host 'FUN_GRANTS_WORKER=START ONCE ONLY'
 Write-Host ('FUN_GRANTS_LOG='+$log)
 Push-Location $Root
 try{
  & $node $Worker --once *>&1|Tee-Object -FilePath $log
  $exit=$LASTEXITCODE
 }finally{Pop-Location}
 if($exit -ne 0){Hold ('LIVE_CYCLE_FAILED_LOG='+$log)}
 $reportFile=Join-Path $Storage 'last-run.json'
 if(!(Test-Path -LiteralPath $reportFile)){Hold 'LIVE_REPORT_MISSING'}
 $report=Get-Content -LiteralPath $reportFile -Raw -ErrorAction Stop|ConvertFrom-Json
 if($report.version -cne 'fun-real-application-worker-v1' -or
    $report.submitted_applications -ne 0 -or $report.approved_spending -ne 0 -or
    $report.state -cne 'REAL_SOURCE_SCANNED_DRAFTS_PREPARED'){Hold 'AUTHORITY_REPORT_INVALID'}
 $missionFile=Join-Path $Storage 'last-mission-v2.json'
 if(!(Test-Path -LiteralPath $missionFile -PathType Leaf)){Hold 'MISSION_REPORT_MISSING'}
 $mission=Get-Content -LiteralPath $missionFile -Raw -ErrorAction Stop|ConvertFrom-Json
 if($mission.version -cne 'fun-industrial-mission-controller-v2' -or
   $mission.source_sha256 -cne $report.source_sha256 -or
   $mission.applications_submitted -ne 0 -or
   $mission.rea_actions -ne 0 -or
   $mission.external_emails -ne 0 -or $mission.spending -ne 0 -or
   $mission.state -cne 'INDEPENDENT_RESEARCH_ACTIONS_COMPLETED_REVIEW_REQUIRED'){
   Hold 'MISSION_AUTHORITY_OR_EVIDENCE_INVALID'
 }
 Write-Host 'FUN_MISSION_V2=PASS EVIDENCE_MATCHED DECISIONS_RECORDED'
 Write-Host ('FUN_MISSION_DECISIONS='+[int]$mission.decisions_made+' NEW_BRIEFS='+[int]$mission.new_local_briefs)
 Write-Host ('FUN_MISSION_REPORT='+$missionFile)
 Write-Host 'FUN_GRANTS_WORKER=PASS ACTUAL_SOURCE_AND_FILES_CONFIRMED'
 Write-Host ('FUN_GRANTS_REPORT='+$reportFile)
 Write-Host ('FUN_GRANTS_EDITABLE_DRAFTS='+[int]$report.new_editable_drafts)
 Write-Host 'FUN_GRANTS_APPLIED_TO_AGENCIES=0 REVIEW_REQUIRED=TRUE'
}finally{
 if($own){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
