# Fun Industrial V10.3 — deterministic exact arithmetic proof verification.
# Does NOT run Qwen, train, install, deploy or edit ANY files.
# Reads SHA-verified V10 validation and V10.1 saved report; frozen test unopened.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V103_DETERMINISTIC_VERIFY_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$engine=Join-Path $root 'scripts\Verify-Fun-Qwen-Math-Answers-V103.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-v103-deterministic-proof-test.py'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($file in @($engine,$tests)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_SOURCE_MISSING_'+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REJECTED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1 | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V103=DETERMINISTIC_ARITHMETIC_PROOF_FIREWALL_OFFLINE'
Write-Host 'FUN_QWEN_V103_SCOPE=REBUILD_FROM_VERIFIED_INPUTS_NOT_MODEL_OUTPUTS'
Write-Host 'FUN_QWEN_V103_VALIDATION=V10_EXISTING_FROZEN_TEST_UNOPENED'
Write-Host 'FUN_QWEN_V103_PRODUCTION_DEPLOYMENT=NONE'
Write-Host 'FUN_QWEN_V103_MODEL_INFERENCE_TRAINING_AND_FILE_WRITES=NONE'
Write-Host 'FUN_QWEN_V103_FUN_SERVICES_AND_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_QWEN_V103_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_PROOF_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V103_OFFLINE_TESTS=PASS'
& $py -3.12 $engine
if($LASTEXITCODE -ne 0){Hold 'SOURCE_REPORT_OR_ARITHMETIC_VERIFICATION_FAILED'}
Write-Host 'FUN_QWEN_V103=READONLY_PROOF_CORRECTION_AUDIT_COMPLETE_NO_DEPLOYMENT'
