# Fun Industrial V10.1 — measure exact tie-aware math baseline on original
# Qwen3-4B with 14 balanced validation cases (frozen test NEVER opened).
# No training, LoRA load, model installation or modification, service changes.
# Default no -Execute is READ-ONLY preflight; execute requires new consent.
[CmdletBinding()]param([switch]$Execute,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V101_MATH_BASELINE_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$engine=Join-Path $root 'scripts\Evaluate-Fun-Qwen-Math-Baseline-V101.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-v101-math-baseline-test.py'
$expected='I_APPROVE_ISOLATED_QWEN_V101_BASELINE_EVALUATION'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($p in @($engine,$tests)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_SOURCE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'FILE_SYMLINK_REFUSED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V101=ORIGINAL_QWEN_TIE_AWARE_MATH_BASELINE'
Write-Host 'FUN_QWEN_V101_DATASET=V10_VALIDATION_ONLY_FROZEN_TEST_UNOPENED'
Write-Host 'FUN_QWEN_V101_CASES=14_BALANCED_SEVEN_WINNER_PATTERNS'
Write-Host 'FUN_QWEN_V101_SCORING=EXACT_SET_TIE_MINIMUM_ARITHMETIC_PROOF'
Write-Host 'FUN_QWEN_V101_NATIVE_TRAINING_OR_ADAPTER_DEPLOYMENT=NONE'
Write-Host 'FUN_QWEN_V101_ACTIVE_FUN_SYSTEM_AND_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_QWEN_V101_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V101_TESTS=PASS'
if($Execute -and $Approval -cne $expected){Hold 'BASELINE_INFERENCE_NEW_APPROVAL_REQUIRED'}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
}
if($Execute){
 Write-Host 'FUN_QWEN_V101_OPERATOR_APPROVAL=VERIFIED_ISOLATED_CPU_BASELINE'
 & $py -3.12 $engine --approval $Approval
}else{
 Write-Host 'FUN_QWEN_V101_OPERATOR_APPROVAL=NONE_PREFLIGHT_ONLY'
 & $py -3.12 $engine --preflight
}
if($LASTEXITCODE -ne 0){Hold 'EVALUATION_OR_PREFLIGHT_FAILED_PRESERVE_LOCAL_LOGS'}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
 if($before[$port] -cne $after){Hold ('PROTECTED_LISTENER_CHANGED_'+$port)}
}
if($Execute){
 Write-Host 'FUN_QWEN_V101=EXACT_MATH_BASELINE_SCORED_NOT_TRAINED'
}else{
 Write-Host 'FUN_QWEN_V101=READONLY_PREFLIGHT_PASS_NO_MODEL_RUN'
}
Write-Host 'FUN_QWEN_V101_QWEN_LIVE_AND_ELEKTRON=UNTOUCHED'
