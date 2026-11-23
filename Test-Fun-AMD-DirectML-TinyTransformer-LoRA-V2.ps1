# Fun Industrial: DirectML miniature Qwen-like LoRA transformer V2 qualification.
# Reuses previously installed isolated torch-directml venv. No installs or downloads.
# Never touches working llama.cpp server 8088, dashboard 8802, or Elektron.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Fail([string]$Reason){throw ('FUN_DIRECTML_TINY_LORA_V2_HOLD='+$Reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$script=Join-Path $root 'scripts\Probe-Fun-AMD-DirectML-TinyTransformer-LoRA-V2.py'
$envRoot=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AMDDirectMLWeightProbeV1'
$envPy=Join-Path $envRoot 'venv\Scripts\python.exe'
$marker=Join-Path $envRoot 'isolated-directml-installed-v1.txt'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Fail 'WRONG_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Fail 'LOCAL_CHANGES_REQUIRE_REVIEW'}
if(!(Test-Path -LiteralPath $script -PathType Leaf)){Fail 'PROBE_SCRIPT_MISSING'}
if(!(Test-Path -LiteralPath $envPy -PathType Leaf) -or !(Test-Path -LiteralPath $marker -PathType Leaf)){Fail 'ISOLATED_DIRECTML_ENV_NOT_READY'}
foreach($p in @($script,$envPy,$marker)){
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Fail 'UNEXPECTED_REPARSE_POINT'}
}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
Write-Host 'FUN_DIRECTML_V2=MINI_TRANSFORMER_QV_LORA_TRAINING_TEST'
Write-Host 'FUN_DIRECTML_V2_ENV=EXISTING_ISOLATED_VENV'
Write-Host 'FUN_DIRECTML_V2_INSTALL_DOWNLOAD=NONE'
Write-Host 'FUN_DIRECTML_V2_QWEN_WEIGHT_CHANGES=NONE'
# Intentionally keep stdout JSON visible for diagnosis and reject nonzero.
& $envPy $script
if($LASTEXITCODE -ne 0){Fail 'TINY_TRANSFORMER_OPERATORS_OR_TRAINING_UNVERIFIED'}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
 if($before[$port] -cne $after){Fail ('PROTECTED_LISTENER_CHANGED_'+$port)}
}
Write-Host 'FUN_DIRECTML_V2=PASS_TINY_TRANSFORMER_LORA_ONLY'
Write-Host 'FUN_QWEN3_4B_TRAINING=NOT_YET_QUALIFIED'
Write-Host 'FUN_ACTIVE_8088_8802_AND_ELEKTRON=UNTOUCHED'
