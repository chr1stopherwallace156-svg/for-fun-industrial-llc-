# Fun Industrial V8.1: READ-ONLY stranded LoRA GGUF candidate inspection.
# No retraining, installs, model execution, service changes, file mutations.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V81_RECOVERY_AUDIT_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$worker=Join-Path $root 'scripts\Audit-Fun-Qwen-V8-Recovery-V81.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-v8-recovery-v81-test.py'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_REPO_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($p in @($worker,$tests)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REFUSED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V81=READONLY_STRANDED_TRAINED_CHECKPOINT_AUDIT'
Write-Host 'FUN_QWEN_V81_TARGETS=V8_BEST_VALIDATION_AND_FAILED_RENAME_TMP'
Write-Host 'FUN_QWEN_V81_RETRAINING=NONE'
Write-Host 'FUN_QWEN_V81_LOCAL_FILES_CHANGED=ZERO'
Write-Host 'FUN_QWEN_V81_LIVE_SERVICES_AND_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_QWEN_V81_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_UNIT_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V81_TESTS=PASS'
& $py -3.12 $worker
if($LASTEXITCODE -ne 0){Hold 'V8_RECOVERABLE_TRAINED_ADAPTER_NOT_YET_PROVEN'}
Write-Host 'FUN_QWEN_V81=RECOVERABLE_TRAINED_ADAPTER_FOUND_REQUIRES_SEPARATE_EVALUATION'
