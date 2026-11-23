# Fun Industrial V10.2 — purely read-only regrade of existing V10.1 report.
# Zero inference, downloads, training, service changes or model-file edits.
# Print grade corrections, preserve V10 original baseline and frozen test.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V102_MATH_AUDIT_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$engine=Join-Path $root 'scripts\Audit-Fun-Qwen-Math-Baseline-V102.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-v102-baseline-proof-audit-test.py'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_REPO_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($file in @($engine,$tests)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_SOURCE_MISSING_'+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REJECTED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1 | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V102=ACTUAL_SAVED_QWEN_MATH_BASELINE_PROOF_AUDIT'
Write-Host 'FUN_QWEN_V102_PRIOR_STRICT_SCORE=0_14_FORMAT_REJECTION'
Write-Host 'FUN_QWEN_V102_PRIOR_WINNER_FIELD_SCORE=14_14'
Write-Host 'FUN_QWEN_V102_SCOPE=SEPARATE_DECISIONS_PROOFS_AND_FORMAT'
Write-Host 'FUN_QWEN_V102_FROZEN_TEST=NEVER_OPENED'
Write-Host 'FUN_QWEN_V102_INFERENCE_TRAINING_AND_DEPLOYMENT=NONE'
Write-Host 'FUN_QWEN_V102_LIVE_QWEN_AND_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_QWEN_V102_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V102_OFFLINE_TESTS=PASS'
& $py -3.12 $engine
if($LASTEXITCODE -ne 0){Hold 'V101_SAVED_REPORT_REGRADING_NOT_VERIFIED'}
Write-Host 'FUN_QWEN_V102=READONLY_ARITHMETIC_AND_FORMAT_AUDIT_COMPLETE'
