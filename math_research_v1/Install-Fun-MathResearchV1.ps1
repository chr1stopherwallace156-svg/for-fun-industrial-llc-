# Fun Industrial only. Installs a noninvasive daily Windows Scheduled Task.
[CmdletBinding()]
param([switch]$InstallSchedule,[switch]$RunOnce)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Runner=Join-Path $PSScriptRoot 'engine.py'
if(-not (Test-Path -LiteralPath $Runner -PathType Leaf)){throw 'FUN_MATH_HOLD=ENGINE_NOT_FOUND'}
$py=(Get-Command py.exe -ErrorAction SilentlyContinue)
if(-not $py){throw 'FUN_MATH_HOLD=PYTHON_LAUNCHER_NOT_FOUND'}
$target=Join-Path $env:LOCALAPPDATA 'FunIndustrial\MathResearchV1'
New-Item -ItemType Directory -Path $target -Force | Out-Null
$scriptTarget=Join-Path $target 'engine.py'
Copy-Item -LiteralPath $Runner -Destination $scriptTarget -Force
$arguments = '-3 "{0}" --out "{1}"' -f $scriptTarget,$target
if($InstallSchedule){
    $taskName='FunIndustrial-MathResearchV1-Daily'
    $trigger=New-ScheduledTaskTrigger -Daily -At '06:30'
    $action=New-ScheduledTaskAction -Execute $py.Source -Argument $arguments -WorkingDirectory $target
    $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
    Register-ScheduledTask -TaskName $taskName -TaskPath '\' -Action $action -Trigger $trigger -Settings $settings -Description 'Fun Industrial independent read-only lottery statistical audit' -Force | Out-Null
    Write-Host ('FUN_MATH_SCHEDULE=INSTALLED TASK='+$taskName+' AT_LOCAL=06:30')
}
if($RunOnce){
    & $py.Source -3 $scriptTarget --out $target
    if($LASTEXITCODE -ne 0){throw ('FUN_MATH_HOLD=RUN_FAILED_EXIT_'+$LASTEXITCODE)}
}
Write-Host ('FUN_MATH_WORKER='+$scriptTarget)
Write-Host ('FUN_MATH_REPORT='+ (Join-Path $target 'latest_summary.md'))
Write-Host 'FUN_ONLY=TRUE ELEKTRON=UNTOUCHED PROTECTED_PORTS=UNTOUCHED'