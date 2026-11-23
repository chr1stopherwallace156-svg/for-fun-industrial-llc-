# Fun Industrial V6: strict READ-ONLY verification of the V5 real Qwen LoRA.
# No training, installs, model loading, inference, subprocess restarts or edits.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_REAL_QWEN_LORA_AUDIT_V6_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$audit=Join-Path $root 'scripts\Audit-Fun-Qwen-Real-LoRA-V6.py'
$tests=Join-Path $root 'intelligence-checks\fun-real-qwen-lora-audit-v6-test.py'
$folder=Join-Path $env:LOCALAPPDATA 'FunIndustrial\QwenActualGGUFLoRAV5'
$adapter=Join-Path $folder 'candidate\qwen-fibonacci-smoke.lora.gguf'
$receipt=Join-Path $folder 'receipt.json'
$log=Join-Path $folder 'training.log'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_REPO_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_CHANGES_REQUIRE_REVIEW'}
foreach($item in @($audit,$tests,$adapter,$receipt,$log)){
 if(!(Test-Path -LiteralPath $item -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING_'+$item)}
 if((Get-Item -LiteralPath $item).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REJECTED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_MISSING'}
Write-Host 'FUN_QWEN_V6_AUDIT=ACTUAL_TRAINED_ADAPTER_READONLY'
Write-Host 'FUN_QWEN_V6_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'AUDIT_UNIT_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V6_TESTS=PASS'
& $py -3.12 $audit --adapter $adapter --training-log $log --receipt $receipt
if($LASTEXITCODE -ne 0){Hold 'ACTUAL_ADAPTER_TENSOR_AUDIT_NOT_VERIFIED'}
Write-Host 'FUN_QWEN_V6=PASS_LEARNED_LORA_B_WEIGHTS_UNDEPLOYED'
Write-Host 'FUN_QWEN_V6_INFERENCE_IMPROVEMENT=NOT_YET_EVALUATED'
Write-Host 'FUN_QWEN_V6_MODEL_AND_LIVE_SERVICES=UNCHANGED'
