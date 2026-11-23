# Fun Industrial V10.7 genuine isolated Qwen-generated math tool request trial.
# Default preflight; -Execute requires new explicit approval. Existing Qwen
# baseline GGUF only, seven independent validation examples, CPU sequential.
# No live Fun/REA/MCP/Elektron, no training, installs or frozen test access.
[CmdletBinding()]param([switch]$Execute,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V107_TOOL_REQUEST_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$worker=Join-Path $root 'scripts\Evaluate-Fun-Qwen-Tool-Requests-V107.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-v107-real-tool-requests-test.py'
$consent='I_APPROVE_ISOLATED_QWEN_V107_TOOL_REQUEST_EXPERIMENT'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'DIRTY_LOCAL_REPO_REQUIRES_REVIEW'}
foreach($item in @($worker,$tests)){
 if(!(Test-Path -LiteralPath $item -PathType Leaf)){Hold ('REQUIRED_FILE_NOT_FOUND_'+$item)}
 if((Get-Item -LiteralPath $item).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_NOT_ALLOWED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1 | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V107=ISOLATED_REAL_QWEN_JSON_TOOL_REQUEST_EXPERIMENT'
Write-Host 'FUN_QWEN_V107_CASES=7_NEW_SHA256_VERIFIED_VALIDATION_PATTERNS'
Write-Host 'FUN_QWEN_V107_ORIGINAL_GGUF=PINNED_CPU_ONLY_4_THREADS'
Write-Host 'FUN_QWEN_V107_MODEL_GENERATED_JSON=STRICT_V106_HOST_CONTRACT_OR_REJECT'
Write-Host 'FUN_QWEN_V107_FROZEN_TEST=UNOPENED'
Write-Host 'FUN_QWEN_V107_ACTUAL_NATIVE_TOOL_CALL_PROTOCOL=NOT_CLAIMED'
Write-Host 'FUN_QWEN_V107_TRAINING_INSTALLS_MODEL_EDITS_LIVE_DEPLOYMENT=NONE'
Write-Host 'FUN_QWEN_V107_LIVE_FUN_QWEN_REA_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_QWEN_V107_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V107_OFFLINE_TESTS=PASS'
if($Execute -and $Approval -cne $consent){Hold 'EXPLICIT_ISOLATED_CPU_INFERENCE_APPROVAL_REQUIRED'}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
}
if($Execute){
 Write-Host 'FUN_QWEN_V107_OPERATOR_APPROVAL=SEVEN_ISOLATED_CPU_QWEN_TOOL_REQUESTS'
 & $py -3.12 $worker --approval $Approval
}else{
 Write-Host 'FUN_QWEN_V107_OPERATOR_APPROVAL=NONE_PREFLIGHT_ONLY'
 & $py -3.12 $worker --preflight
}
if($LASTEXITCODE -ne 0){Hold 'ISOLATED_REQUEST_RUN_FAILED_PRESERVE_ALL_EVIDENCE'}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
 if($before[$port] -cne $after){Hold ('PROTECTED_LISTENER_CHANGED_'+$port)}
}
if($Execute){
 Write-Host 'FUN_QWEN_V107=REAL_MODEL_TOOL_REQUESTS_MEASURED_NOT_DEPLOYED'
}else{
 Write-Host 'FUN_QWEN_V107=READONLY_PREFLIGHT_PASS_NO_INFERENCE'
}
Write-Host 'FUN_QWEN_V107_FUN_SERVICES_AND_ELEKTRON=UNTOUCHED'
