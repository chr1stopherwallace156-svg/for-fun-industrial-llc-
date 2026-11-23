# Fun Industrial V5: REAL pretrained Qwen GGUF native LoRA training experiment.
# Default: read-only preflight. -Execute+Approval opts into downloading and
# compiling a PINNED third-party research C++ training fork, then bounded CPU
# LoRA training. Does not replace any live server or copy over a model file.
[CmdletBinding()]
param([switch]$Execute,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_REAL_QWEN_LORA_V5_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$source=Join-Path $root 'scripts\Run-Fun-Qwen-GGUF-Native-LoRA-V5.py'
$expectedApproval='I_APPROVE_ISOLATED_REAL_QWEN_LORA_TRAINING'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_GIT_CHANGES_REQUIRE_REVIEW'}
if(!(Test-Path -LiteralPath $source -PathType Leaf)){Hold 'V5_PYTHON_TRAINER_MISSING'}
if((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'TRAINER_SOURCE_LINK_REFUSED'}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_NOT_FOUND'}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
   ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
$live=@(Get-NetTCPConnection -LocalPort 8088 -State Listen -ErrorAction SilentlyContinue)
if($live.Count -ne 1){Hold 'QWEN_8088_NOT_UNIQUELY_LIVE'}
$liveProcess=Get-CimInstance Win32_Process -Filter ('ProcessId='+$live[0].OwningProcess)
if(!$liveProcess -or $liveProcess.Name -notlike '*llama-server*'){Hold 'LIVE_QWEN_PROCESS_NOT_VERIFIED'}
if($Execute -and $Approval -cne $expectedApproval){Hold 'EXPLICIT_EXTERNAL_SOURCE_BUILD_TRAINING_APPROVAL_REQUIRED'}
Write-Host 'FUN_REAL_QWEN_V5=GUARDED_NATIVE_GGUF_LORA'
Write-Host 'FUN_REAL_QWEN_V5_SOURCE=LL4nc33_LLAMA_TQ_TAG_V2026_10_31_PINNED'
Write-Host 'FUN_REAL_QWEN_V5_MODEL=EXISTING_OFFICIAL_QWEN3_4B_Q4_K_M_SHA256_PINNED'
Write-Host 'FUN_REAL_QWEN_V5_BACKEND=CPU_ONLY_NOT_AMD_GPU'
Write-Host 'FUN_REAL_QWEN_V5_RESOURCE_POLICY=ADAPTIVE_HOST_RAM_AND_COMMIT_KILL_GATES'
Write-Host 'FUN_REAL_QWEN_V5_SCOPE=SMALL_REAL_WEIGHTS_TWO_WINDOWS'
Write-Host 'FUN_REAL_QWEN_V5_LIVE_MODEL_REPLACEMENT=NEVER'
Write-Host 'FUN_REAL_QWEN_V5_ISOLATED_EXTERNAL_COMPILE=' + $Execute
if($Execute){
 Write-Host 'FUN_REAL_QWEN_V5_EXTERNAL_GIT_CLONE_AND_CPP_BUILD=OPERATOR_AUTHORIZED'
 & $py -3.12 $source --approve $Approval
}else{
 Write-Host 'FUN_REAL_QWEN_V5_EXTERNAL_SOURCE_AND_BUILD=NOT_REQUESTED'
 & $py -3.12 $source --check-only
}
$code=$LASTEXITCODE
if($code -ne 0){Hold ('NATIVE_TRAINER_RETURNED_'+$code+'_CHECK_PRINTED_HOLD_AND_LOCAL_LOGS')}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
   ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
 if($before[$port] -cne $after){Hold ('PROTECTED_LIVE_LISTENER_CHANGED_'+$port)}
}
if($Execute){Write-Host 'FUN_REAL_QWEN_V5_TRAINING_ATTEMPT=COMPLETED_CANDIDATE_REQUIRES_EVALUATION'}
else{Write-Host 'FUN_REAL_QWEN_V5_TRAINING_ATTEMPT=NOT_STARTED_READONLY_PREFLIGHT'}
Write-Host 'FUN_REAL_QWEN_V5_LIVE_QWEN_8088_AND_ELEKTRON=UNTOUCHED'
