# Install Optuna and Google OR-Tools in an isolated Fun Industrial environment.
# The live dashboard, compute, gateway, REA, memory, AI, voice, and Elektron
# services are never restarted or modified. No API listener is opened.
[CmdletBinding()]param()
$ErrorActionPreference = "Stop"
$Source = $PSScriptRoot
$Root = Join-Path $env:LOCALAPPDATA "FunIndustrial\OptimizationRuntime"
$Venv = Join-Path $Root "venv"
$Python = Join-Path $Venv "Scripts\python.exe"
$Requirements = Join-Path $Source "requirements-optimization.txt"
$Module = Join-Path $Source "fun_optimization\core.py"
$Entry = Join-Path $Source "fun_optimization\__main__.py"
$Tests = Join-Path $Source "tests\test_fun_optimization.py"
$ProtectedPorts = @(8789,8791,8088,8443)
function Hold([string]$code){throw "FUN_OPTIMIZATION_SETUP_HOLD=$code"}
function Listeners(){
 $snapshot=@{}
 foreach($port in $ProtectedPorts){
  $snapshot[[string]$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
   ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ",")
 }
 return $snapshot
}
foreach($path in @($Requirements,$Module,$Entry,$Tests)){
 if(-not(Test-Path -LiteralPath $path -PathType Leaf)){Hold "REQUIRED_SOURCE_MISSING"}
 if((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "SOURCE_SYMLINK_REJECTED"}
}
if(-not $env:LOCALAPPDATA){Hold "LOCALAPPDATA_MISSING"}
$before=Listeners
if(Test-Path -LiteralPath $Root){
 if((Get-Item -LiteralPath $Root).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "RUNTIME_DIR_SYMLINK_REJECTED"}
}
$available=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($Root)).AvailableFreeSpace
if($available -lt 750000000){Hold "DISK_SPACE_UNDER_750_MB"}
$pyLauncher=Get-Command py.exe -ErrorAction SilentlyContinue
if(-not $pyLauncher){Hold "PYTHON_LAUNCHER_MISSING"}
& $pyLauncher.Source -3.12 -c "import sys; assert sys.version_info[:2] == (3,12)"
if($LASTEXITCODE -ne 0){Hold "PYTHON_312_NOT_AVAILABLE"}
New-Item -Path $Root -ItemType Directory -Force -ErrorAction Stop|Out-Null
if(-not(Test-Path -LiteralPath $Python -PathType Leaf)){
 & $pyLauncher.Source -3.12 -m venv $Venv
 if($LASTEXITCODE -ne 0){Hold "ISOLATED_VENV_CREATION_FAILED"}
}
if((Get-Item -LiteralPath $Venv).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "VENV_SYMLINK_REJECTED"}
& $Python -c "import sys; assert sys.version_info[:2] == (3,12); print('FUN_OPTIMIZATION_PYTHON=3.12')"
if($LASTEXITCODE -ne 0){Hold "VENV_WRONG_PYTHON"}
& $Python -m pip install --disable-pip-version-check --no-input -r $Requirements
if($LASTEXITCODE -ne 0){Hold "OPTIMIZATION_DEPENDENCIES_FAILED"}
Push-Location $Source
try{
 & $Python -m unittest discover -s tests -p test_fun_optimization.py -v
 if($LASTEXITCODE -ne 0){Hold "OPTIMIZATION_TESTS_FAILED"}
 & $Python -m fun_optimization status
 if($LASTEXITCODE -ne 0){Hold "OPTIMIZATION_STATUS_FAILED"}
 & $Python -m fun_optimization demo
 if($LASTEXITCODE -ne 0){Hold "OPTIMIZATION_DEMO_FAILED"}
}finally{Pop-Location}
$after=Listeners
foreach($port in $ProtectedPorts){
 if($before[[string]$port] -ne $after[[string]$port]){
  Hold ("PROTECTED_SERVICE_LISTENER_CHANGED_"+$port)
 }
}
Write-Host "FUN_OPTIMIZATION_SETUP=PASS ENGINES=OPTUNA,GOOGLE_OR_TOOLS"
Write-Host "FUN_OPTIMIZATION_TESTS=PASS MODE=BOUNDED_OFFLINE_OPERATOR_ONLY"
Write-Host ("FUN_OPTIMIZATION_PYTHON="+$Python)
Write-Host ("FUN_OPTIMIZATION_SOURCE="+$Source)
Write-Host "FUN_OPTIMIZATION_SERVICES=UNCHANGED DASHBOARD=8789 COMPUTE=8791 LLAMA_CPP=8088 GATEWAY=8443"
Write-Host "FUN_OPTIMIZATION_REA_EXECUTION=NONE MEMORY_WRITES=NONE"
Write-Host "FUN_OPTIMIZATION_DASHBOARD_API=NOT_YET_ACTIVATED"
