# Fun Industrial: Isolated AMD DirectML neural-weight training probe, V1
# Defaults to read-only preflight.
# -InstallAndProbe requires an explicit operator-provided authorization phrase
# and installs a historically pinned torch-directml wheel into a NEW virtualenv.
# Does not install to global Python, load Qwen GGUF, restart services or touch Elektron.
[CmdletBinding()]
param(
  [switch]$InstallAndProbe,
  [string]$Approval=''
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$ExpectedBranch='feature/fun-fisre-live-8802-20261122'
$Root=$PSScriptRoot
$Probe=Join-Path $Root 'scripts\Probe-Fun-AMD-DirectML-WeightUpdate-V1.py'
$RuntimeRoot=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AMDDirectMLWeightProbeV1'
$Venv=Join-Path $RuntimeRoot 'venv'
$VenvPy=Join-Path $Venv 'Scripts\python.exe'
$Marker=Join-Path $RuntimeRoot 'isolated-directml-installed-v1.txt'
$ApprovalPhrase='I_APPROVE_ISOLATED_DIRECTML_INSTALL'
function Fail([string]$Code){throw ('FUN_DIRECTML_PROBE_HOLD='+$Code)}

if(!(Test-Path -LiteralPath $Probe -PathType Leaf)){Fail 'PROBE_SCRIPT_MISSING'}
if((Get-Item -LiteralPath $Probe).Attributes -band [IO.FileAttributes]::ReparsePoint){Fail 'PROBE_SCRIPT_IS_LINK'}
$branch=git -C $Root branch --show-current
if($LASTEXITCODE -ne 0 -or $branch -cne $ExpectedBranch){Fail 'WRONG_REPO_BRANCH'}
if(@(git -C $Root status --porcelain=v1 --untracked-files=all).Count){Fail 'LOCAL_CHANGES_REQUIRE_REVIEW'}
$Py=(Get-Command py.exe -ErrorAction Stop).Source
& $Py -3.12 -c 'import sys;assert sys.version_info[:2]==(3,12);print("PYTHON_312=PASS")'
if($LASTEXITCODE -ne 0){Fail 'PYTHON_312_UNAVAILABLE'}

$before=@{}
foreach($port in @(11434,8088,8801,8802,8797,8798)){
  $before[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
}
$drive=[IO.Path]::GetPathRoot($RuntimeRoot)
$disk=Get-CimInstance Win32_LogicalDisk | Where-Object {$_.DeviceID -eq $drive.TrimEnd('\')}
$freeDiskGiB=if($disk){[math]::Round($disk.FreeSpace / 1GB,2)}else{$null}
Write-Host 'FUN_AMD_GPU=RX_6600_FROM_OPERATOR_INSPECTION'
Write-Host 'FUN_DIRECTML_ENV=ISOLATED_APPDATA_ONLY'
Write-Host ('FUN_DIRECTML_DISK_FREE_GIB='+$freeDiskGiB)
Write-Host ('FUN_DIRECTML_ALREADY_INSTALLED='+$(Test-Path $Marker))
Write-Host 'FUN_QWEN_4B_WEIGHT_TRAINING=NOT_ATTEMPTED'

if(!$InstallAndProbe){
  Write-Host 'FUN_DIRECTML_INSTALL=NOT_REQUESTED'
  Write-Host ('FUN_DIRECTML_NEXT=RUN_WITH_-InstallAndProbe_-Approval_'+$ApprovalPhrase)
  return
}
if($Approval -cne $ApprovalPhrase){Fail 'EXPLICIT_ISOLATED_INSTALL_APPROVAL_REQUIRED'}
if(!$disk -or $disk.FreeSpace -lt 4GB){Fail 'INSUFFICIENT_DISK_FOR_SEPARATE_PYTHON_VENV'}
if((Test-Path -LiteralPath $Venv) -and !(Test-Path -LiteralPath $Marker)){
  Fail 'EXISTING_UNVERIFIED_VENV_REQUIRES_REVIEW'
}
if(!(Test-Path -LiteralPath $Marker)){
  if(Test-Path -LiteralPath $Venv){Fail 'PARTIAL_VENV_REQUIRES_REVIEW'}
  New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
  & $Py -3.12 -m venv $Venv
  if($LASTEXITCODE -ne 0){Fail 'VENV_CREATE_FAILED'}
  if(!(Test-Path -LiteralPath $VenvPy)){Fail 'VENV_PYTHON_MISSING'}
  # Installing torch-directml into this ISOLATED venv can download substantial
  # PyPI packages. It may select an older PyTorch required by torch-directml.
  # Existing global torch 2.15.0+cpu is never changed.
  & $VenvPy -m pip install --disable-pip-version-check 'torch-directml==0.2.5.dev240914'
  if($LASTEXITCODE -ne 0){Fail 'DIRECTML_DEPENDENCY_INSTALL_FAILED'}
  # Ensure a real isolated package import. This does not run GPU computations.
  & $VenvPy -c 'import torch,torch_directml;print("DIRECTML_ISOLATED_TORCH="+str(torch.__version__));print("DIRECTML_DEVICE_COUNT="+str(torch_directml.device_count()))'
  if($LASTEXITCODE -ne 0){Fail 'DIRECTML_IMPORT_FAILED'}
  [IO.File]::WriteAllText($Marker,'Fun Industrial: isolated torch-directml pinned environment, v1')
}
if(!(Test-Path -LiteralPath $VenvPy)){Fail 'VENV_PYTHON_MISSING_POST_INSTALL'}
if(!(Test-Path -LiteralPath $Probe)){Fail 'PROBE_SCRIPT_MISSING'}
# Small 8-parameter test on AMD/DirectML only; no Qwen weights.
& $VenvPy $Probe
if($LASTEXITCODE -ne 0){Fail 'DIRECTML_BACKEND_WEIGHT_UPDATE_NOT_QUALIFIED'}
foreach($port in $before.Keys){
  $after=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
  if($before[$port] -cne $after){Fail ('SERVICE_LISTENER_CHANGED_'+$port)}
}
Write-Host 'FUN_AMD_DIRECTML_NEURAL_WEIGHT_UPDATE=PASS_TINY_TEST_ONLY'
Write-Host 'FUN_QWEN_8088_AND_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_QWEN_4B_TRAINING=NOT_QUALIFIED'
