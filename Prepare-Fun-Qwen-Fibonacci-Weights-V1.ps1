# FUN_QWEN_FIBONACCI_WEIGHT_PREP_V1
# One-command guarded preparation for genuine LoRA weight adaptation.
# Executes offline standard-library tests, dataset build and hardware check only.
# Never trains, downloads a model, installs libraries, restarts Qwen or touches Elektron.
[CmdletBinding()]param([string]$BaseDir='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Expected='feature/fun-fisre-live-8802-20261122'
$Prepare=Join-Path $Root 'scripts\Build-Fun-Fibonacci-Weight-Curriculum-V1.py'
$Train=Join-Path $Root 'scripts\Train-Fun-Qwen-Fibonacci-LoRA-V1.py'
$Tests=Join-Path $Root 'intelligence-checks\fun-qwen-fibonacci-weights-v1-test.py'
$Curriculum=Join-Path $env:LOCALAPPDATA 'FunIndustrial\QwenFibonacciWeightsV1\curriculum'
function Fail([string]$code){throw ('FUN_QWEN_FIBONACCI_PREP_HOLD='+$code)}
foreach($file in @($Prepare,$Train,$Tests)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Fail ('MISSING_'+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Fail ('SYMLINK_'+$file)}
}
if((git -C $Root branch --show-current) -cne $Expected -or $LASTEXITCODE -ne 0){Fail 'REPO_BRANCH_CHANGED'}
if(@(git -C $Root status --porcelain=v1 --untracked-files=all).Count){Fail 'REPO_LOCAL_CHANGES_REQUIRE_REVIEW'}
$Py=(Get-Command py.exe -ErrorAction Stop).Source
$protected=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($p in $protected){
 $before[$p]=(@(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue|
   ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
& $Py -3.12 $Tests
if($LASTEXITCODE -ne 0){Fail 'OFFLINE_UNIT_TESTS_FAILED'}
Write-Host 'FUN_FIBONACCI_CURRICULUM_TESTS=PASS'
if(!(Test-Path -LiteralPath (Join-Path $Curriculum 'manifest.json') -PathType Leaf)){
 if(Test-Path -LiteralPath $Curriculum){Fail 'PARTIAL_CURRICULUM_DIRECTORY_MANUAL_REVIEW'}
 & $Py -3.12 $Prepare --output $Curriculum
 if($LASTEXITCODE -ne 0){Fail 'CURRICULUM_CREATION_FAILED'}
}else{Write-Host 'FUN_FIBONACCI_CURRICULUM=EXISTING_REQUIRE_VERIFICATION'}
$arguments=@('-3.12',$Train,'--check-only','--curriculum-dir',$Curriculum)
if($BaseDir.Trim().Length){$arguments+=@('--base-dir',$BaseDir)}
$preflightRaw=(& $Py @arguments|Out-String)
if($LASTEXITCODE -ne 0){Fail 'PREFLIGHT_FAILED'}
try{$status=$preflightRaw|ConvertFrom-Json}catch{Fail 'PREFLIGHT_JSON_INVALID'}
if($status.version -cne 'fun-qwen-fibonacci-qlora-v1' -or
 $status.active_model_unchanged -ne $true -or
 $status.gguf_not_trainable_directly -ne $true -or
 @($status.curriculum_rows.train).Count -eq 0){Fail 'PREFLIGHT_ATTESTATION_INVALID'}
foreach($p in $protected){
 $after=(@(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
 if($after -cne $before[$p]){Fail ('PROTECTED_LISTENER_CHANGED_'+$p)}
}
Write-Host 'FUN_FIBONACCI_WEIGHT_CURRICULUM=VERIFIED'
Write-Host ('FUN_FIBONACCI_TRAINING_PREFLIGHT='+$status.state)
Write-Host ('FUN_FIBONACCI_TRAINING_BLOCKERS='+(@($status.blocking_reasons)-join '|'))
Write-Host ('FUN_FIBONACCI_HOST_RAM_FREE_GIB='+$status.hardware.host_free_gib)
Write-Host ('FUN_FIBONACCI_CUDA_AVAILABLE='+$status.hardware.cuda)
Write-Host ('FUN_FIBONACCI_GPU_FREE_GIB='+$status.hardware.gpu_free_gib)
Write-Host ('FUN_FIBONACCI_BASE_CHECKPOINT='+$status.checkpoint.state)
Write-Host 'FUN_QWEN_WEIGHT_CHANGES=ZERO_TRAINING_NOT_STARTED'
Write-Host 'FUN_ACTIVE_8088_8802_8801_ELEKTRON=UNTOUCHED'
