# Fun Industrial V8.2 — recover verified Qwen LoRA .best file to a distinct
# proof folder and compare base/V5/V8. NEVER retrains or deploys Qwen.
# Default without -Execute = read-only preflight and offline tests.
[CmdletBinding()]param([switch]$Execute,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V82_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$worker=Join-Path $root 'scripts\Recover-Evaluate-Fun-Qwen-V82.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-recovery-eval-v82-test.py'
$consent='I_APPROVE_ISOLATED_QWEN_V82_RECOVERY_EVALUATION'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($p in @($worker,$tests)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'FILE_SYMLINK_REFUSED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V82=REAL_QWEN_V8_RECOVERY_THREEWAY_EVALUATION'
Write-Host 'FUN_QWEN_V82_NO_TRAINING_OR_MODEL_DEPLOYMENT=TRUE'
Write-Host 'FUN_QWEN_V82_SOURCE_INPUTS=READ_ONLY_V5_AND_RECOVERED_V8_BEST_TMP'
Write-Host 'FUN_QWEN_V82_INFERENCE=CPU_ONLY_SEQUENTIAL_BASE_V5_V8'
Write-Host 'FUN_QWEN_V82_PREVIOUS_V5_V6_V7_V71_AND_ELEKTRON=PRESERVED'
Write-Host 'FUN_QWEN_V82_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V82_OFFLINE_TESTS=PASS'
if($Execute -and $Approval -cne $consent){Hold 'EXPLICIT_RECOVERY_AND_EVALUATION_APPROVAL_REQUIRED'}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
}
if($Execute){
 Write-Host 'FUN_QWEN_V82_OPERATOR_APPROVAL=VERIFIED_RECOVERY_AND_SEQUENTIAL_INFERENCE'
 & $py -3.12 $worker --approve $Approval
}else{
 Write-Host 'FUN_QWEN_V82_OPERATOR_APPROVAL=NONE_PREFLIGHT_ONLY'
 & $py -3.12 $worker --preflight-only
}
if($LASTEXITCODE -ne 0){Hold 'RECOVERY_OR_EVALUATION_FAILED_INSPECT_PRINTED_REASON_AND_LOCAL_LOGS'}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
 if($before[$port] -cne $after){Hold ('PROTECTED_LISTENER_CHANGED_'+$port)}
}
if($Execute){
 Write-Host 'FUN_QWEN_V82=THREE_WAY_RECOVERY_COMPARISON_COMPLETE_NOT_DEPLOYED'
}else{
 Write-Host 'FUN_QWEN_V82=READONLY_PREFLIGHT_PASS_NO_INFERENCE'
}
Write-Host 'FUN_QWEN_V82_LIVE_SERVICES_AND_ELEKTRON=UNTOUCHED'
