# FUN_MATH_RESEARCH_V3_STANDALONE_WORKER - no dashboard or other service changes.
[CmdletBinding()]param([switch]$RunOnce,[switch]$InstallSchedule)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Py=(Get-Command py.exe -ErrorAction SilentlyContinue)
if(!$Py){throw 'FUN_MATH_V3_HOLD=PYTHON_LAUNCHER_MISSING'}
$target=Join-Path $env:LOCALAPPDATA 'FunIndustrial\MathResearchV3'
$files=@('engine.py','engine_v2.py','source_v1.py')
foreach($name in $files){
 $source=Join-Path $PSScriptRoot $name
 if(!(Test-Path -LiteralPath $source -PathType Leaf)){throw ('FUN_MATH_V3_HOLD=FILE_MISSING_'+$name)}
 if(((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'FUN_MATH_V3_HOLD=UNREVIEWED_SYMLINK'}
}
New-Item -ItemType Directory -Path $target -Force | Out-Null
$protocol=Join-Path $target 'v3_frozen_future_protocol.json'
# Once a formula is registered, silently replacing the algorithm would destroy
# the meaning of its future-only likelihood-ratio sequence.
if(Test-Path -LiteralPath $protocol -PathType Leaf){
 foreach($name in $files){
  $existing=Join-Path $target $name
  if(!(Test-Path -LiteralPath $existing -PathType Leaf) -or
      (Get-FileHash -LiteralPath $existing -Algorithm SHA256).Hash -cne
      (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash){
   throw ('FUN_MATH_V3_HOLD=FROZEN_PROTOCOL_SOURCE_CHANGE_'+$name)
  }
 }
}
foreach($name in $files){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $target $name) -Force}
$entry=Join-Path $target 'engine.py'
if($RunOnce){
 & $Py.Source -3 $entry --out $target
 if($LASTEXITCODE -ne 0){throw ('FUN_MATH_V3_HOLD=RESEARCH_FAILED_EXIT_'+$LASTEXITCODE)}
}
if($InstallSchedule){
 $taskName='FunIndustrial-MathResearchV3-Daily'
 $args='-3 "{0}" --out "{1}"' -f $entry,$target
 $action=New-ScheduledTaskAction -Execute $Py.Source -Argument $args -WorkingDirectory $target
 $trigger=New-ScheduledTaskTrigger -Daily -At '07:30'
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 25)
 Register-ScheduledTask -TaskName $taskName -TaskPath '\' -Action $action -Trigger $trigger -Settings $settings -Description 'Fun Industrial read-only mathematical V3 future evidence research' -Force | Out-Null
 Write-Host 'FUN_MATH_V3_SCHEDULE=INSTALLED TASK=FunIndustrial-MathResearchV3-Daily AT_LOCAL=07:30'
}
Write-Host ('FUN_MATH_V3_WORKER='+$entry)
Write-Host ('FUN_MATH_V3_REPORT='+(Join-Path $target 'latest_summary.md'))
Write-Host 'FUN_ONLY=TRUE ELEKTRON_UNTOUCHED=TRUE QWEN_REA_DASHBOARD_UNTOUCHED=TRUE'