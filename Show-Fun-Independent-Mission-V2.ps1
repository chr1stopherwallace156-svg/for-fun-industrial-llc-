# Read-only evidence view for Fun Industrial's independently scheduled grant research.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Store=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RealApplicationWorkerV1'
$Mission=Join-Path $Store 'last-mission-v2.json'
$Scan=Join-Path $Store 'last-run.json'
$TaskName='FunIndustrial-GrantApplications-V1'
if(!(Test-Path -LiteralPath $Mission -PathType Leaf)){throw 'FUN_MISSION_STATUS_HOLD=NO_V2_LIVE_MISSION_YET'}
if(!(Test-Path -LiteralPath $Scan -PathType Leaf)){throw 'FUN_MISSION_STATUS_HOLD=NO_LIVE_SCAN'}
$m=Get-Content -LiteralPath $Mission -Raw|ConvertFrom-Json
$s=Get-Content -LiteralPath $Scan -Raw|ConvertFrom-Json
if($m.version -cne 'fun-industrial-mission-controller-v2' -or
 $m.source_sha256 -cne $s.source_sha256){throw 'FUN_MISSION_STATUS_HOLD=UNMATCHED_EVIDENCE'}
Write-Host '=== FUN INDUSTRIAL | INDEPENDENT BUSINESS MISSION ==='
Write-Host ('GOAL='+[string]$m.goal)
Write-Host ('LAST_MISSION_UTC='+[string]$m.cycle_utc)
Write-Host ('RECORDS_REVIEWED='+[string]$s.records_scanned+' OPEN_BUSINESS='+[string]$s.open_business_opportunities+' RELEVANT='+[string]$s.relevant_candidates)
Write-Host ('MISSION_DECISIONS='+[int]$m.decisions_made+' NEW_RESEARCH_BRIEFS='+[int]$m.new_local_briefs)
Write-Host ('OFFICIAL_PAGES_READ='+[int]$m.official_pages_read+' ATTEMPTS='+[int]$m.official_page_attempts)
if($null -ne $m.next_priority){Write-Host ('NEXT_SELF_CHOSEN_PRIORITY='+[string]$m.next_priority.title+' REASON='+[string]$m.next_priority.reason)}
foreach($a in @($m.actions)){Write-Host ('PREPARED='+[string]$a.title+' FILE='+[string]$a.path)}
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if($null -ne $task){
 $info=Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
 Write-Host ('SCHEDULE='+[string]$task.State)
 if($null -ne $info){
  Write-Host ('LAST_SCHEDULED_RUN='+[string]$info.LastRunTime+' NEXT_SCHEDULED_RUN='+[string]$info.NextRunTime)
  Write-Host ('LAST_SCHEDULE_RESULT='+[string]$info.LastTaskResult)
 }
}else{Write-Host 'SCHEDULE=MISSING'}
Write-Host 'SUBMISSIONS=0 REA_TOOL_EXECUTIONS=0 EXPENDITURES=0'
Write-Host ('MISSION_STORAGE='+$Store)
