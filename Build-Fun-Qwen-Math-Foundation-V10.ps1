# Fun Industrial V10: exact mathematical supervision and evaluation foundation.
# Default: offline 16-test + 392-case dry-run (NO FILES created).
# Explicit -Create / -Approval: versioned local dataset only, NEVER training.
[CmdletBinding()]param([switch]$Create,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V10_MATH_FOUNDATION_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$builder=Join-Path $root 'scripts\Build-Fun-Qwen-Math-Foundation-V10.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-math-foundation-v10-test.py'
$expected='I_APPROVE_ISOLATED_V10_CORRECTED_MATH_CURRICULUM_CREATION'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($p in @($builder,$tests)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_SOURCE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REJECTED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V10=EQUATION_VERIFIED_MATH_SUPERVISION'
Write-Host 'FUN_QWEN_V10_DATA=392_EXAMPLES_TRAIN_VALIDATION_TEST'
Write-Host 'FUN_QWEN_V10_LABELS=SET_VALUED_ARGMIN_AND_TIE_AWARE'
Write-Host 'FUN_QWEN_V10_EQUATIONS=PAIRWISE_DIFFERENCES_SET_ARGMIN_CONTRASTIVE_BRIER_NLL_AND_AFFINE_INVARIANCE'
Write-Host 'FUN_QWEN_V10_NATIVE_TRAINING=NOT_AUTHORIZED_OR_PERFORMED'
Write-Host 'FUN_QWEN_V10_GGUF_ADAPTERS_SERVICES_AND_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_QWEN_V10_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_MATH_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V10_OFFLINE_TESTS=PASS'
if($Create){
 if($Approval -cne $expected){Hold 'DATASET_CREATION_EXPLICIT_APPROVAL_REQUIRED'}
 Write-Host 'FUN_QWEN_V10_OPERATOR_APPROVAL=ISOLATED_DATASET_ONLY'
 & $py -3.12 $builder --write --approval $Approval
}else{
 Write-Host 'FUN_QWEN_V10_OPERATOR_APPROVAL=NONE_READONLY'
 & $py -3.12 $builder
}
if($LASTEXITCODE -ne 0){Hold 'V10_BUILDER_FAILED_KEEP_PREVIOUS_DATA_UNCHANGED'}
if($Create){
 Write-Host 'FUN_QWEN_V10=CORRECTED_DATASET_CREATED_READY_FOR_REVIEW_NOT_TRAINED'
}else{
 Write-Host 'FUN_QWEN_V10=OFFLINE_FORMULA_PROOFS_PASS_NO_MODEL_ACTIONS'
}
