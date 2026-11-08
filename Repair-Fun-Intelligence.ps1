# Diagnose existing Cognee 1.6.7 import, then resume install without pip downloads.
# Leaves Fun Industrial 8789 and 8792 untouched until the probe passes.
[CmdletBinding()]
param([switch]$ProbeOnly)
$ErrorActionPreference='Stop'
$src=[IO.Path]::GetFullPath($PSScriptRoot)
$root=Join-Path $env:LOCALAPPDATA 'FunIndustrial\CognitiveMemory'
$python=Join-Path $root 'venv\Scripts\python.exe'
$probe=Join-Path $src 'cognee\probe_local.py'
$installer=Join-Path $src 'Install-Fun-Intelligence.ps1'
$pwsh=(Get-Command powershell.exe -ErrorAction Stop).Source
foreach($item in @($python,$probe,$installer)){
 if(-not(Test-Path -LiteralPath $item -PathType Leaf)){throw "EXISTING_COGNEE_PREREQUISITE_MISSING=$item"}
}
$env:FI_COGNEE_ROOT=$root
try{
 Write-Host 'COGNEE_IMPORT_ONLY_PROBE=START NO_PIP NO_MODEL_DOWNLOAD'
 & $python -I $probe
 $exitCode=$LASTEXITCODE
}finally{
 Remove-Item Env:FI_COGNEE_ROOT -ErrorAction SilentlyContinue
}
if($exitCode -ne 0){
 Write-Warning 'COGNEE_IMPORT_PROBE=HOLD: inspect Python traceback above.'
 throw 'COGNEE_IMPORT_NOT_READY; EXISTING_VENV_PRESERVED; LIVE_APP_UNTOUCHED'
}
if($ProbeOnly){
 Write-Host 'COGNEE_IMPORT_ONLY_PROBE=PASS NO_PLATFORM_CHANGE'
 return
}
& $pwsh -NoProfile -ExecutionPolicy Bypass -File $installer -InstallCognee -EnableMemoryWrites -SkipCogneePip
if($LASTEXITCODE -ne 0){throw 'INTELLIGENCE_INSTALL_HOLD_EXISTING_VENV_PRESERVED'}
Write-Host 'COGNEE_REPAIR_AND_FUN_INTELLIGENCE_INSTALL=PASS'
