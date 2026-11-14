# FUN_INDUSTRIAL_SCIKIT_LEARN_V1 -- isolated Windows installer; no service restarts.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$Source = $PSScriptRoot
$Bridge = Join-Path $Source 'ml\scikit_learn_bridge.py'
$Tests = Join-Path $Source 'tests\test_scikit_learn_bridge.py'
$Base = Join-Path $env:LOCALAPPDATA 'FunIndustrial\MLScikitLearnV1'
$Venv = Join-Path $Base 'venv'
$Python = Join-Path $Venv 'Scripts\python.exe'
$Marker = Join-Path $Base 'installer-v1.json'
function Hold([string]$why) { throw "FUN_SCIKIT_LEARN_HOLD=$why" }
foreach ($file in @($Bridge, $Tests)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { Hold "SOURCE_MISSING_$file" }
  if ((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) { Hold 'SOURCE_SYMLINK_REFUSED' }
}
$Launcher = $null
$LauncherArgs = @()
if (Get-Command py.exe -ErrorAction SilentlyContinue) {
  $Launcher = (Get-Command py.exe).Source
  $LauncherArgs = @('-3.12')
} elseif (Get-Command python.exe -ErrorAction SilentlyContinue) {
  $Launcher = (Get-Command python.exe).Source
} else { Hold 'PYTHON_312_NOT_FOUND' }
& $Launcher @LauncherArgs -c 'import platform,sys; assert sys.version_info[:2] == (3,12) and platform.architecture()[0] == "64bit"'
if ($LASTEXITCODE -ne 0) { Hold 'REQUIRES_64BIT_PYTHON_312' }
if ($CheckOnly) {
  if (-not (Test-Path -LiteralPath $Marker -PathType Leaf) -or -not (Test-Path -LiteralPath $Python -PathType Leaf)) { Hold 'NOT_INSTALLED' }
  & $Python $Bridge health
  if ($LASTEXITCODE -ne 0) { Hold 'HEALTH_FAILED' }
  Write-Host 'FUN_SCIKIT_LEARN_CHECK_ONLY=PASS NO_CHANGES=TRUE'
  return
}
$NewVenv = $false
if (Test-Path -LiteralPath $Venv) {
  if (-not (Test-Path -LiteralPath $Marker -PathType Leaf)) { Hold 'EXISTING_UNMARKED_ENVIRONMENT_MANUAL_REVIEW' }
  if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) { Hold 'PREVIOUS_INSTALL_INCOMPLETE' }
} else {
  if (-not (Test-Path -LiteralPath $Base)) { New-Item -ItemType Directory -Path $Base -Force | Out-Null }
  if ((Get-Item -LiteralPath $Base).Attributes -band [IO.FileAttributes]::ReparsePoint) { Hold 'BASE_SYMLINK_REFUSED' }
  & $Launcher @LauncherArgs -m venv $Venv
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Python -PathType Leaf)) { Hold 'VENV_CREATION_FAILED' }
  $NewVenv = $true
}
$env:OMP_NUM_THREADS = '2'
$env:OPENBLAS_NUM_THREADS = '2'
$env:MKL_NUM_THREADS = '2'
$env:NUMEXPR_NUM_THREADS = '2'
if ($NewVenv) {
  & $Python -m pip install --disable-pip-version-check --only-binary=:all: 'scikit-learn==1.9.1'
  if ($LASTEXITCODE -ne 0) { Hold 'BINARY_PIP_INSTALL_FAILED' }
}
Push-Location $Source
try {
  & $Python -m unittest discover -s tests -p 'test_scikit_learn_bridge.py' -v
  if ($LASTEXITCODE -ne 0) { Hold 'OFFLINE_TESTS_FAILED' }
  $healthRaw = & $Python $Bridge health
  if ($LASTEXITCODE -ne 0) { Hold 'HEALTH_FAILED' }
  $health = ($healthRaw | Out-String | ConvertFrom-Json)
  if ($health.ok -ne $true -or $health.version -ne '1.9.1' -or $health.network_listener -ne $false -or $health.external_actions -ne 0) { Hold 'SCIKIT_LEARN_IDENTITY_MISMATCH' }
  & $Python $Bridge self-test
  if ($LASTEXITCODE -ne 0) { Hold 'MODEL_SMOKE_TEST_FAILED' }
} finally { Pop-Location }
if ($NewVenv) {
  $stamp = @{schema='fun.ml.scikit-learn.install.v1';version='1.9.1';python='3.12';bridge=$Bridge} | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($Marker,$stamp,[Text.UTF8Encoding]::new($false))
}
Write-Host 'FUN_SCIKIT_LEARN_INSTALL=PASS VERSION=1.9.1 MODE=ISOLATED_LOCAL_CLI'
Write-Host 'QWEN_DASHBOARD_REA_ELEKTRON=UNTOUCHED THREAD_LIMIT=2 EXTERNAL_ACTIONS=0'
Write-Host 'QWEN_AUTOMATIC_TOOL_REGISTRATION=NOT_INSTALLED'
Write-Host "FUN_SCIKIT_LEARN_PYTHON=$Python"
Write-Host "FUN_SCIKIT_LEARN_BRIDGE=$Bridge"

