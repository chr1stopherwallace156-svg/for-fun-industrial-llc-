# Execute retirement, full safety preview, and permanent sourcing-only cleanup.
# Download is NOT required; this script lives in the GitHub retirement branch.
[CmdletBinding()]
param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$here=Split-Path -Parent $MyInvocation.MyCommand.Path
$retire=Join-Path $here 'Retire-Sourcing.ps1'
$purge=Join-Path $here 'Purge-Sourcing-From-Computer.ps1'
$tests=Join-Path $here 'test\retire-sourcing.test.mjs'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$ps=(Get-Command powershell.exe -ErrorAction Stop).Source
foreach($p in @($retire,$purge,$tests)){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){throw "CLEANUP_PREREQUISITE_MISSING=$p"}
}
# Fail before ANY modification when a PowerShell source file is malformed.
foreach($p in @($retire,$purge)){
 $tokens=$null;$errors=$null
 $null=[System.Management.Automation.Language.Parser]::ParseFile($p,[ref]$tokens,[ref]$errors)
 if($errors -and $errors.Count -gt 0){throw "POWERSHELL_SYNTAX_HOLD=$p DETAIL=$($errors[0].Message)"}
}
Write-Host 'SOURCING_REMOVAL_PREFLIGHT=START'
& $node --test $tests
if($LASTEXITCODE -ne 0){throw 'SOURCING_REMOVAL_TESTS_FAILED'}
Write-Host 'SOURCING_REMOVAL_TESTS=PASS'
if($CheckOnly){
 Write-Host 'SOURCING_REMOVAL=CHECK_ONLY NOTHING_RETIRED_OR_DELETED'
 return
}
# The installer is safe when 8792 is genuinely stopped: it installs retired
# code before starting a worker. A foreign process on 8792 causes a HOLD.
& $ps -NoProfile -ExecutionPolicy Bypass -File $retire
if($LASTEXITCODE -ne 0){throw 'SOURCING_RETIREMENT_FAILED PURGE_NOT_STARTED'}
Write-Host 'SOURCING_REMOVAL_RETIREMENT=PASS'
& $ps -NoProfile -ExecutionPolicy Bypass -File $purge -PreviewOnly
if($LASTEXITCODE -ne 0){throw 'SOURCING_PURGE_PREVIEW_FAILED DELETION_NOT_STARTED'}
Write-Host 'SOURCING_REMOVAL_PURGE_PREVIEW=PASS'
& $ps -NoProfile -ExecutionPolicy Bypass -File $purge
if($LASTEXITCODE -ne 0){throw 'SOURCING_PURGE_FAILED OR_INCOMPLETE'}
Write-Host 'SOURCING_RETIREMENT_AND_LOCAL_DISK_PURGE=PASS'
