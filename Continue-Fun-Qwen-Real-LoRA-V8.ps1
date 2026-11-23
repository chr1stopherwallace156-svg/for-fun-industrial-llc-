# Fun Industrial V8: bounded REAL Qwen LoRA continuation, copied checkpoint only.
# Default performs offline tests and preflight. Execution requires new approval.
# Never replaces live model, restarts port 8088 or modifies Elektron.
[CmdletBinding()]param([switch]$Execute,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V8_CONTINUATION_HOLD='+$reason)}
$root=$PSScriptRoot
$expectedBranch='feature/fun-fisre-live-8802-20261122'
$worker=Join-Path $root 'scripts\Continue-Fun-Qwen-Real-LoRA-V8.py'
$tests=Join-Path $root 'intelligence-checks\fun-real-qwen-lora-resume-v8-test.py'
$consent='I_APPROVE_ISOLATED_QWEN_LORA_V8_CONTINUATION'
if((git -C $root branch --show-current) -cne $expectedBranch -or $LASTEXITCODE -ne 0){Hold 'WRONG_REPO_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($p in @($worker,$tests)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REJECTED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_MISSING'}
Write-Host 'FUN_QWEN_V8=REAL_PRETRAINED_QWEN_ADAPTER_RESUME'
Write-Host 'FUN_QWEN_V8_BACKEND=PINNED_GGUF_NATIVE_CPU_ONLY'
Write-Host 'FUN_QWEN_V8_DATASET=SAME_VERIFIED_30_TRAINING_EXAMPLES'
Write-Host 'FUN_QWEN_V8_RESUME=V5_COPIED_ADAPTER_OPTIMIZER_AND_POSITION'
Write-Host 'FUN_QWEN_V8_TRAINING_WINDOWS=UP_TO_16_ADDITIONAL'
Write-Host 'FUN_QWEN_V8_PROTECTED=V5_V6_V7_V71_AND_QWEN_8088_ELEKTRON'
Write-Host 'FUN_QWEN_V8_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V8_TESTS=PASS'
if($Execute -and $Approval -cne $consent){Hold 'NEW_TRAINING_APPROVAL_REQUIRED'}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object)-join ';')
}
if($Execute){
 Write-Host 'FUN_QWEN_V8_OPERATOR_APPROVAL=VERIFIED_NEW_TRAINING'
 & $py -3.12 $worker --approve $Approval
}else{
 Write-Host 'FUN_QWEN_V8_OPERATOR_APPROVAL=NOT_REQUESTED_PREFLIGHT_ONLY'
 & $py -3.12 $worker --check-only
}
if($LASTEXITCODE -ne 0){Hold 'TRAINING_OR_PREFLIGHT_FAILED_INSPECT_PRINTED_REASON_AND_LOCAL_LOG'}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object)-join ';')
 if($before[$port] -cne $after){Hold ('PROTECTED_LISTENER_CHANGED_'+$port)}
}
if($Execute){
 Write-Host 'FUN_QWEN_V8=REAL_LORA_CONTINUED_CANDIDATE_REQUIRES_BEHAVIORAL_EVALUATION'
}else{
 Write-Host 'FUN_QWEN_V8=VERIFIED_PREFLIGHT_ONLY_NO_TRAINING'
}
Write-Host 'FUN_QWEN_V8_LIVE_SYSTEM_AND_ELEKTRON=UNTOUCHED'
