# Standalone Fun Industrial statistical research worker V2. No other services modified.
[CmdletBinding()]
param([switch]$InstallSchedule, [switch]$RunOnce)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$py=Get-Command py.exe -ErrorAction SilentlyContinue
if(-not $py){throw 'FUN_MATH_V2_HOLD=PY_LAUNCHER_MISSING'}
$root=Join-Path $env:LOCALAPPDATA 'FunIndustrial\MathResearchV2'
$engine=Join-Path $PSScriptRoot 'engine.py'
$source=Join-Path $PSScriptRoot 'source_v1.py'
if(-not (Test-Path -LiteralPath $engine -PathType Leaf) -or -not (Test-Path -LiteralPath $source -PathType Leaf)){
    throw 'FUN_MATH_V2_HOLD=RESEARCH_SOURCE_MISSING'
}
New-Item -ItemType Directory -Path $root -Force | Out-Null
Copy-Item -LiteralPath $engine -Destination (Join-Path $root 'engine.py') -Force
Copy-Item -LiteralPath $source -Destination (Join-Path $root 'source_v1.py') -Force
$installed=Join-Path $root 'engine.py'
$arguments='-3 "{0}" --out "{1}"' -f $installed, $root
if($InstallSchedule){
    $taskName='FunIndustrial-MathResearchV2-Daily'
    $action=New-ScheduledTaskAction -Execute $py.Source -Argument $arguments -WorkingDirectory $root
    $trigger=New-ScheduledTaskTrigger -Daily -At '07:00'
    $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
    Register-ScheduledTask -TaskName $taskName -TaskPath '\' -Action $action -Trigger $trigger -Settings $settings -Description 'Fun Industrial read-only math equation research V2' -Force | Out-Null
    Write-Host ('FUN_MATH_V2_SCHEDULE=INSTALLED TASK='+$taskName+' AT_LOCAL=07:00')
}
if($RunOnce){
    & $py.Source -3 $installed --out $root
    if($LASTEXITCODE -ne 0){throw ('FUN_MATH_V2_HOLD=RUN_FAILED_EXIT_'+$LASTEXITCODE)}
}
Write-Host ('FUN_MATH_V2_WORKER='+$installed)
Write-Host ('FUN_MATH_V2_REPORT='+(Join-Path $root 'latest_summary.md'))
Write-Host 'FUN_ONLY=TRUE ELEKTRON=UNTOUCHED V1_UNTOUCHED=TRUE SERVICES_UNTOUCHED=TRUE'
