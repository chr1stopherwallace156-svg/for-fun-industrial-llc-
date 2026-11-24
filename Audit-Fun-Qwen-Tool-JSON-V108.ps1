# Fun Industrial V10.8: FORENSIC REPLAY ONLY of seven saved Qwen JSON requests.
# No model inference, retraining, service, REA, MCP, Elektron or file writes.
# Do not normalize/deploy any Qwen output; hypothetical single brace check only.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V108_READONLY_JSON_AUDIT_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$engine=Join-Path $root 'scripts\Audit-Fun-Qwen-Tool-JSON-V108.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-v108-trailing-brace-audit-test.py'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'DIRTY_LOCAL_REPO_REQUIRES_REVIEW'}
foreach($file in @($engine,$tests)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_SOURCE_MISSING_'+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REJECTED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V108=READONLY_EXISTING_REAL_QWEN_JSON_OUTPUT_FORENSICS'
Write-Host 'FUN_QWEN_V108_HISTORICAL_V107_DISPATCHES=ZERO_UNCHANGED'
Write-Host 'FUN_QWEN_V108_HYPOTHETICAL_ONE_BRACE_REMOVAL=ANALYSIS_ONLY'
Write-Host 'FUN_QWEN_V108_INPUTS=SHA_VERIFIED_ORIGINAL_V10_V101_V105_V107'
Write-Host 'FUN_QWEN_V108_FROZEN_TEST=UNOPENED'
Write-Host 'FUN_QWEN_V108_MODEL_INFERENCE_TRAINING_DATA_WRITES=NONE'
Write-Host 'FUN_QWEN_V108_LIVE_QWEN_MCP_REA_DASHBOARD_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_QWEN_V108_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_FORENSIC_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V108_OFFLINE_TESTS=PASS'
& $py -3.12 $engine
if($LASTEXITCODE -ne 0){Hold 'ORIGINAL_V107_REPORT_OR_REPLAY_UNVERIFIED'}
Write-Host 'FUN_QWEN_V108=READONLY_SAVED_JSON_FORENSICS_COMPLETE_NO_DEPLOYMENT'
