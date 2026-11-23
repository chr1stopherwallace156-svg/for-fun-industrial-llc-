# FUN_REVIEWED_OPTIMIZATION_ENV_V1
# Operator-invoked package provisioning for fixed Optuna and OR-Tools worker.
# Installs only into user-local separate virtual environment on this PC.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ApprovedOptimizationV1'
$venv=Join-Path $root '.venv'
$python=Join-Path $venv 'Scripts\python.exe'
if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){throw 'FUN_OPT_ENV_LOCALAPPDATA_REQUIRED'}
$launcher=(Get-Command py.exe -ErrorAction Stop).Source
& $launcher -3.12 -c 'import sys;sys.exit(0 if sys.version_info[:2]==(3,12) else 1)'
if($LASTEXITCODE -ne 0){throw 'FUN_OPT_ENV_PYTHON_312_REQUIRED'}
New-Item -ItemType Directory -Path $root -Force|Out-Null
if(!(Test-Path -LiteralPath $python -PathType Leaf)){
 & $launcher -3.12 -m venv $venv
 if($LASTEXITCODE -ne 0){throw 'FUN_OPT_ENV_VENV_CREATION_FAILED'}
}
if(!(Test-Path -LiteralPath $python -PathType Leaf)){throw 'FUN_OPT_ENV_PYTHON_NOT_FOUND'}
# PowerShell 5.1 strips embedded Python double quotes in native argv.
# Probe imports with Python code that has NO string literals, and reuse the
# already-installed packages instead of downloading them on each activation.
& $python -c 'import optuna,ortools;from ortools.constraint_solver import pywrapcp' 2>$null
if($LASTEXITCODE -eq 0){
 Write-Host 'FUN_OPT_ENV_PACKAGES=ALREADY_INSTALLED'
}else{
 Write-Host 'FUN_OPT_ENV_PACKAGES=INSTALLING_IN_ISOLATED_VENV_ONLY'
 & $python -m pip install --disable-pip-version-check --no-cache-dir --only-binary=:all: 'optuna>=4,<5' 'ortools>=9,<10'
 if($LASTEXITCODE -ne 0){throw 'FUN_OPT_ENV_APPROVED_PACKAGE_INSTALL_FAILED'}
 & $python -c 'import optuna,ortools;from ortools.constraint_solver import pywrapcp'
 if($LASTEXITCODE -ne 0){throw 'FUN_OPT_ENV_IMPORT_FAILED'}
}
& $python -m pip show optuna ortools | Select-String -Pattern '^(Name|Version):'
if($LASTEXITCODE -ne 0){throw 'FUN_OPT_ENV_PACKAGE_METADATA_FAILED'}
$worker=Join-Path $PSScriptRoot 'scripts\Run-Fun-Approved-Optimization-V1.py'
if(!(Test-Path -LiteralPath $worker -PathType Leaf)){throw 'FUN_OPT_ENV_WORKER_MISSING'}
& $python $worker --status
if($LASTEXITCODE -ne 0){throw 'FUN_OPT_ENV_WORKER_STATUS_FAILED'}
Write-Host 'FUN_REVIEWED_OPTIMIZATION_ENV=READY'
Write-Host ('FUN_REVIEWED_OPTIMIZATION_PYTHON='+$python)
Write-Host 'FUN_REVIEWED_OPTIMIZATION_MODEL_DOWNLOADS=ZERO'
Write-Host 'FUN_REVIEWED_OPTIMIZATION_SERVICE_RESTARTS=ZERO'
