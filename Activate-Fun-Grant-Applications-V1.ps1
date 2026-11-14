# One operator-authorized setup: offline tests -> one actual scan/draft cycle -> recurring 6-hour Windows schedule.
# Runs only while Windows can execute tasks for the signed-in user. No password/account secrets stored.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fun-ml-unified-dashboard-v3-20261113'
$Repo='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$RunScript=Join-Path $Root 'Run-Fun-Grant-Applications-V1.ps1'
$Worker=Join-Path $Root 'scripts\Run-Fun-Grant-Applications-V1.mjs'
$Module=Join-Path $Root 'src\applications\opportunity-worker-v1.mjs'
$MissionModule=Join-Path $Root 'src\applications\mission-controller-v2.mjs'
$MissionTests=Join-Path $Root 'intelligence-checks\mission-controller-v2-case.mjs'
$Tests=Join-Path $Root 'intelligence-checks\opportunity-worker-v1-case.mjs'
$TaskName='FunIndustrial-GrantApplications-V1'
$User=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
function Hold([string]$reason){throw ('FUN_GRANTS_ACTIVATION_HOLD='+$reason)}
if((git.exe -C $Root remote get-url origin) -cne $Repo -or
   (git.exe -C $Root branch --show-current) -cne $Branch -or $LASTEXITCODE -ne 0){
 Hold 'GIT_SOURCE_IDENTITY_INVALID'
}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -gt 0 -or $LASTEXITCODE -ne 0){
 Hold 'LOCAL_CHANGES_REVIEW_REQUIRED'
}
foreach($path in @($RunScript,$Worker,$Module,$MissionModule,$Tests,$MissionTests)){
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('SOURCE_MISSING='+$path)}
 if((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SOURCE_SYMLINK_REFUSED='+$path)}
}
$node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($file in @($Worker,$Module,$MissionModule,$Tests,$MissionTests)){
 & $node --check $file
 if($LASTEXITCODE -ne 0){Hold ('JS_PARSE_HOLD='+$file)}
}
& $node --test $Tests $MissionTests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_GRANTS_WORKER_TESTS_FAILED'}
Write-Host 'FUN_GRANTS_OFFLINE_QUALIFICATION=PASS'
Write-Host 'FUN_GRANTS_FIRST_REAL_CYCLE=START'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RunScript
if($LASTEXITCODE -ne 0){Hold 'REAL_CYCLE_NOT_VERIFIED_SCHEDULE_NOT_CREATED'}
Write-Host 'FUN_GRANTS_FIRST_REAL_CYCLE=PASS'
$missionFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RealApplicationWorkerV1\last-mission-v2.json'
if(!(Test-Path -LiteralPath $missionFile -PathType Leaf)){Hold 'MISSION_LEDGER_NOT_PERSISTED'}
$lastMission=Get-Content -LiteralPath $missionFile -Raw | ConvertFrom-Json
if($lastMission.version -cne 'fun-industrial-mission-controller-v2' -or
  $lastMission.applications_submitted -ne 0 -or $lastMission.rea_actions -ne 0){Hold 'MISSION_V2_ATTESTATION_INVALID'}
Write-Host ('FUN_MISSION_V2=VERIFIED REAL_DECISIONS='+[int]$lastMission.decisions_made+' NEW_BRIEFS='+[int]$lastMission.new_local_briefs)
# Schedule 00:00, 06:00, 12:00 and 18:00 (local PC time). No service or model kept running.
$exe=(Get-Command powershell.exe -ErrorAction Stop).Source
$arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$RunScript+'"'
$existing=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if($null -ne $existing){
 if(@($existing.Actions).Count -ne 1 -or [string]$existing.Actions[0].Execute -cne $exe -or
  [string]$existing.Actions[0].Arguments -cne $arguments){
  Hold 'SCHEDULE_ALREADY_EXISTS_DIFFERENT_ACTION_REFUSED'
 }
 Write-Host 'FUN_GRANTS_SCHEDULE=ADOPTED_EXISTING_NO_REPLACEMENT'
}else{
 $triggers=@(
  (New-ScheduledTaskTrigger -Daily -At '00:00'),
  (New-ScheduledTaskTrigger -Daily -At '06:00'),
  (New-ScheduledTaskTrigger -Daily -At '12:00'),
  (New-ScheduledTaskTrigger -Daily -At '18:00')
 )
 $action=New-ScheduledTaskAction -Execute $exe -Argument $arguments -WorkingDirectory $Root
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -MultipleInstances IgnoreNew
 $principal=New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
 Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -ErrorAction Stop|Out-Null
 Write-Host 'FUN_GRANTS_SCHEDULE=INSTALLED FOUR_DAILY_TRIGGERS'
}
$check=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($check.State -eq 'Disabled'){Hold 'SCHEDULE_DISABLED'}
Write-Host ('FUN_GRANTS_SCHEDULE_ACCOUNT='+$User)
Write-Host 'FUN_GRANTS_RUN_FREQUENCY=EVERY_6_HOURS_WHEN_WINDOWS_USER_SIGNED_IN'
Write-Host 'FUN_GRANTS_SCHEDULE_BACKGROUND_AGENT=NO_HEAVY_RESIDENT_MODEL'
Write-Host 'FUN_GRANTS_APPLICATION_SUBMISSIONS=0'
Write-Host ('FUN_GRANTS_RESEARCH_FOLDER='+[IO.Path]::Combine($env:LOCALAPPDATA,'FunIndustrial','RealApplicationWorkerV1'))
Write-Host 'FUN_GRANTS_AUTONOMOUS_PILOT=ACTIVE LIVE_CYCLE_AND_WINDOWS_SCHEDULE_CONFIRMED'
Write-Host 'FUN_MISSION_V2=ACTIVE GOAL_DIRECTED_RESEARCH_AND_LOCAL_ACTIONS_NO_EXTERNAL_APPLICATIONS'
