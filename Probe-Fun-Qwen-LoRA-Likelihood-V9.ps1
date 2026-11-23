# Fun Industrial V9: held-out likelihood probe for base, V5 and V8 Qwen3.
# Read-only preflight by default. Explicit execute requires operator approval.
# No model training, adapter deployment, live Qwen server restart, Elektron.
[CmdletBinding()]param([switch]$Execute,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V9_LIKELIHOOD_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$worker=Join-Path $root 'scripts\Probe-Fun-Qwen-LoRA-Likelihood-V9.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-v9-likelihood-test.py'
$consent='I_APPROVE_ISOLATED_QWEN_V9_LIKELIHOOD_EVALUATION'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($p in @($worker,$tests)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'FILE_SYMLINK_REFUSED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V9=REAL_PRETRAINED_QWEN_THREEWAY_LIKELIHOOD_PROBE'
Write-Host 'FUN_QWEN_V9_COMPARE=BASE_V5_V8_REFERENCE_TEXT_PERPLEXITY'
Write-Host 'FUN_QWEN_V9_WINDOWS_CPU_ONLY=TRUE'
Write-Host 'FUN_QWEN_V9_TRAINING=NONE'
Write-Host 'FUN_QWEN_V9_ORIGINAL_MODEL_V5_V8_V7_V71_V82_AND_ELEKTRON=PROTECTED'
Write-Host 'FUN_QWEN_V9_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V9_OFFLINE_TESTS=PASS'
if($Execute -and $Approval -cne $consent){Hold 'EXPLICIT_LIKELIHOOD_EVALUATION_APPROVAL_REQUIRED'}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
   ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object)-join ';')
}
if($Execute){
 Write-Host 'FUN_QWEN_V9_OPERATOR_APPROVAL=VERIFIED_ISOLATED_LIKELIHOOD'
 & $py -3.12 $worker --approve $Approval
}else{
 Write-Host 'FUN_QWEN_V9_OPERATOR_APPROVAL=NONE_PREFLIGHT_ONLY'
 & $py -3.12 $worker --preflight-only
}
if($LASTEXITCODE -ne 0){Hold 'V9_WORKER_FAILED_INSPECT_PRINTED_REASON_AND_LOCAL_LOGS'}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
   ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object)-join ';')
 if($before[$port] -cne $after){Hold ('PROTECTED_LISTENER_CHANGED_'+$port)}
}
if($Execute){
 Write-Host 'FUN_QWEN_V9=HELDOUT_LIKELIHOOD_COMPARISON_COMPLETE_NOT_DEPLOYED'
}else{
 Write-Host 'FUN_QWEN_V9=READONLY_PREFLIGHT_PASS_NO_INFERENCE'
}
Write-Host 'FUN_QWEN_V9_LIVE_SERVICES_AND_ELEKTRON=UNTOUCHED'
