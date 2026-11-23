# Fun Industrial AMD DirectML Qwen-style one-block geometry LoRA probe V3.
# REUSES isolated DirectML environment; installs nothing, downloads no models.
# -QwenLayer opts in to one bounded full-dimension single-block test
# after a separate successful scaled test. Not production Qwen training.
[CmdletBinding()]param([switch]$QwenLayer)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_DIRECTML_QWEN_GEOMETRY_V3_HOLD='+$reason)}
$root=$PSScriptRoot
$expectedBranch='feature/fun-fisre-live-8802-20261122'
$script=Join-Path $root 'scripts\Probe-Fun-AMD-DirectML-QwenGeometry-LoRA-V3.py'
$isolation=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AMDDirectMLWeightProbeV1'
$py=Join-Path $isolation 'venv\Scripts\python.exe'
$marker=Join-Path $isolation 'isolated-directml-installed-v1.txt'
if((git -C $root branch --show-current) -cne $expectedBranch -or $LASTEXITCODE -ne 0){Hold 'WRONG_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($p in @($script,$py,$marker)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('MISSING_REQUIRED_FILE_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'UNEXPECTED_LINK'}
}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue|
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
Write-Host 'FUN_DIRECTML_V3=START'
Write-Host 'FUN_DIRECTML_V3_GPU=ISOLATED_AMD_RX_6600_DIRECTML'
Write-Host 'FUN_DIRECTML_V3_DEPENDENCY_INSTALL=NONE'
Write-Host 'FUN_DIRECTML_V3_NEW_QWEN_MODEL_DOWNLOAD=NONE'
Write-Host 'FUN_DIRECTML_V3_LIVE_MODEL_CHANGES=NONE'
Write-Host 'FUN_DIRECTML_V3_PROFILE=SCALED'
& $py $script --profile scaled
if($LASTEXITCODE -ne 0){Hold 'SCALED_GPU_BLOCK_FAILED'}
Write-Host 'FUN_DIRECTML_V3_SCALED=PASS'
if($QwenLayer){
 Write-Host 'FUN_DIRECTML_V3_PROFILE=QWEN3_4B_SINGLE_LAYER_DIMENSIONS'
 Write-Host 'FUN_DIRECTML_V3_LARGE_LAYER=EXPLICIT_OPT_IN'
 & $py $script --profile qwen3-4b-layer
 if($LASTEXITCODE -ne 0){Hold 'QWEN_GEOMETRY_SINGLE_LAYER_FAILED'}
 Write-Host 'FUN_DIRECTML_V3_QWEN_GEOMETRY=PASS_SINGLE_SYNTHETIC_LAYER_ONLY'
}else{
 Write-Host 'FUN_DIRECTML_V3_QWEN_GEOMETRY=NOT_RUN_USE_QwenLayer_TO_OPT_IN'
}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue|
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
 if($before[$port] -cne $after){Hold ('PROTECTED_LISTENER_CHANGED_'+$port)}
}
Write-Host 'FUN_QWEN_4B_LORA_TRAINING=NOT_QUALIFIED'
Write-Host 'FUN_ACTIVE_8088_8802_AND_ELEKTRON=UNTOUCHED'
