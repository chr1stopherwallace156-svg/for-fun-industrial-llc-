# Fun Industrial V7.1: reproducible direct-answer paired evaluation.
# Preserves previous V7 output; creates evaluation-v71 evidence only.
# No retraining, installs, model replacement or service start/stop.
[CmdletBinding()]param([switch]$Execute,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V71_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$engine=Join-Path $root 'scripts\Evaluate-Fun-Qwen-Real-LoRA-V7.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-paired-inference-v7-test.py'
$expected='I_APPROVE_ISOLATED_QWEN_BASE_ADAPTER_EVALUATION'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($file in @($engine,$tests)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING_'+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'FILE_SYMLINK_REJECTED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$pyVersion=(& $py -3.12 --version 2>&1 | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $pyVersion -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V71=NONTHINKING_PAIRED_INFERENCE_READONLY'
Write-Host 'FUN_QWEN_V71_PREVIOUS_V7_REPORT=PRESERVED'
Write-Host 'FUN_QWEN_V71_NEW_OUTPUT=EVALUATION_V71_NO_OVERWRITE'
Write-Host 'FUN_QWEN_V71_TRAINING=NONE'
Write-Host 'FUN_QWEN_V71_ACTIVE_MODEL_AND_SERVICES=UNTOUCHED'
Write-Host 'FUN_QWEN_V71_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'NONTHINKING_EVALUATION_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V71_OFFLINE_TESTS=PASS'
if(!$Execute){
 Write-Host 'FUN_QWEN_V71_EVALUATION=NOT_STARTED_APPROVAL_REQUIRED'
 return
}
if($Approval -cne $expected){Hold 'EXPLICIT_EVALUATION_APPROVAL_REQUIRED'}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
}
& $py -3.12 $engine --approve $Approval
if($LASTEXITCODE -ne 0){Hold 'EVALUATION_ENGINE_FAILED_CHECK_V71_LOCAL_LOGS'}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
 if($before[$port] -cne $after){Hold ('PROTECTED_LISTENER_CHANGED_'+$port)}
}
Write-Host 'FUN_QWEN_V71=PAIRED_DIRECT_ANSWERS_COMPLETE_NOT_DEPLOYED'
Write-Host 'FUN_QWEN_V71_FIBONACCI_IMPROVEMENT=NOT_PROVEN_BY_THREE_CASES'
Write-Host 'FUN_QWEN_V71_MODEL_AND_ELEKTRON=UNTOUCHED'
