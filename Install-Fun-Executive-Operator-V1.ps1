# FIAL5.4: one-time operator-authorized activation of 11-domain recurring assistant.
# All recurring actions: read existing local evidence and connected Gmail, write local
# planning packets, and update the private local work queue. No outbound actions.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fial5-4-executive-operator-v1-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$TaskName='FunIndustrial-Executive-Operator-V1'
$RunScript=Join-Path $Root 'Run-Fun-Executive-Operator-V1.ps1'
$NodeExe=(Get-Command node.exe -ErrorAction Stop).Source
function Hold([string]$reason){throw ('FIAL54_ACTIVATION_HOLD='+$reason)}
$remote=(& git.exe -C $Root remote get-url origin | Out-String).Trim()
$active=(& git.exe -C $Root branch --show-current | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $remote -cne $Origin -or $active -cne $Branch){Hold 'SOURCE_IDENTITY_OR_BRANCH_MISMATCH'}
$dirty=@(& git.exe -C $Root status --porcelain=v1 --untracked-files=all)
if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold 'SOURCE_WORKTREE_DIRTY_NO_UNREVIEWED_RUN'}
$files=@('src\operator\executive-ops-v1.mjs','src\operator\executive-mail-v1.mjs',
 'src\operator\executive-console-v1.mjs','src\operator\executive-console-client-v1.js',
 'scripts\Run-Fun-Executive-Operator-V1.mjs',
 'intelligence-checks\fial54-executive-operator-v1-case.mjs',
 'intelligence-checks\fial54-primary-console-v1-case.mjs',
 'Run-Fun-Executive-Operator-V1.ps1')
foreach($p in $files){
 $f=Join-Path $Root $p
 if(!(Test-Path -LiteralPath $f -PathType Leaf)){Hold ('MISSING_SOURCE='+$p)}
 if(((Get-Item -LiteralPath $f).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('REPARSE_SOURCE_REFUSED='+$p)
 }
 if($f.EndsWith('.mjs') -or $f.EndsWith('.js')){
  & $NodeExe --check $f
  if($LASTEXITCODE -ne 0){Hold ('SOURCE_SYNTAX_FAIL='+$p)}
 }
}
& $NodeExe --test (Join-Path $Root 'intelligence-checks\fial54-executive-operator-v1-case.mjs') (Join-Path $Root 'intelligence-checks\fial54-primary-console-v1-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'EXECUTIVE_TESTS_FAILED'}
Write-Host 'FIAL54_OFFLINE_QUALIFICATION=PASS'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RunScript
if($LASTEXITCODE -ne 0){Hold 'FIRST_REAL_CYCLE_FAILED_SCHEDULER_NOT_CHANGED'}
Write-Host 'FIAL54_FIRST_REAL_CYCLE=PASS'
$taskExe=(Get-Command powershell.exe -ErrorAction Stop).Source
$taskArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$RunScript+'"'
$existing=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if($null -ne $existing){
 if(@($existing.Actions).Count -ne 1 -or
  [string]$existing.Actions[0].Execute -cne $taskExe -or
  [string]$existing.Actions[0].Arguments -cne $taskArgs -or
  @($existing.Triggers).Count -ne 4){
  Hold 'EXISTING_TASK_IDENTITY_DIFFERS_REFUSE_REPLACE'
 }
 Write-Host 'FIAL54_SCHEDULE=ADOPTED_EXISTING'
}else{
 $triggers=@(
  (New-ScheduledTaskTrigger -Daily -At '01:00'),
  (New-ScheduledTaskTrigger -Daily -At '07:00'),
  (New-ScheduledTaskTrigger -Daily -At '13:00'),
  (New-ScheduledTaskTrigger -Daily -At '19:00')
 )
 $action=New-ScheduledTaskAction -Execute $taskExe -Argument $taskArgs -WorkingDirectory $Root
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 6) -MultipleInstances IgnoreNew
 $windowsUser=[Security.Principal.WindowsIdentity]::GetCurrent().Name
 $principal=New-ScheduledTaskPrincipal -UserId $windowsUser -LogonType Interactive -RunLevel Limited
 Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -ErrorAction Stop|Out-Null
 Write-Host 'FIAL54_SCHEDULE=INSTALLED_AT_01_07_13_19_LOCAL'
}
$confirmed=Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if($confirmed.State -eq 'Disabled'){Hold 'SCHEDULE_IS_DISABLED'}
Write-Host 'FIAL54_SCHEDULE=ACTIVE_WHEN_WINDOWS_USER_LOGGED_ON'
Write-Host 'FIAL54_PERSISTENT_OPERATIONS=ACTIVE ELEVEN_WORKSTREAMS'
Write-Host 'FIAL54_GMAIL=READ_ONLY_IF_CONNECTED'
Write-Host 'FIAL54_GRANTS=REUSES_PRIOR_GRANT_EVIDENCE_NO_DUPLICATE_WORKER'
Write-Host 'FIAL54_NO_EMAIL_SEND_NO_GOVERNMENT_FILING_NO_SPENDING_NO_REA=CONFIRMED'
Write-Host ('FIAL54_DATA='+[IO.Path]::Combine($env:LOCALAPPDATA,'FunIndustrial','ExecutiveOperatorV1'))
