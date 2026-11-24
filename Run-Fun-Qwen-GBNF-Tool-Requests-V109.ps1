# Fun Industrial V10.9 — isolated grammar-constrained Qwen tool request A/B.
# Exactly seven SAME V10.7 verified validation prompts, original model, CPU.
# Default read-only preflight; -Execute needs new explicit approval.
# No live Fun Industrial services, REA/MCP, Elektron, training or LoRA.
[CmdletBinding()]param([switch]$Execute,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V109_GBNF_REQUEST_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$worker=Join-Path $root 'scripts\Run-Fun-Qwen-GBNF-Tool-Requests-V109.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-v109-grammar-requests-test.py'
$grammar=Join-Path $root 'intelligence-checks\fun-qwen-v109-typed-request.gbnf'
$consent='I_APPROVE_ISOLATED_QWEN_V109_GBNF_TOOL_REQUEST_EVALUATION'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'DIRTY_LOCAL_REPO_REQUIRES_REVIEW'}
foreach($item in @($worker,$tests,$grammar)){
 if(!(Test-Path -LiteralPath $item -PathType Leaf)){Hold ('REQUIRED_FILE_NOT_FOUND_'+$item)}
 if((Get-Item -LiteralPath $item).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_NOT_ALLOWED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1 | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V109=PINNED_REAL_QWEN_GBNF_CONSTRAINED_TOOL_REQUEST_COMPARISON'
Write-Host 'FUN_QWEN_V109_SAME_SEVEN_V107_VALIDATION_QUESTIONS=TRUE'
Write-Host 'FUN_QWEN_V109_EXPERIMENTAL_CHANGE=GBNF_GRAMMAR_SAMPLER_ONLY'
Write-Host 'FUN_QWEN_V109_STRICT_HOST=UNCHANGED_V106_CONTRACT'
Write-Host 'FUN_QWEN_V109_MODEL=ORIGINAL_CPU_ONLY_NO_LORA'
Write-Host 'FUN_QWEN_V109_FROZEN_TEST=UNOPENED'
Write-Host 'FUN_QWEN_V109_LIVE_QWEN_REA_MCP_DASHBOARD_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_QWEN_V109_NO_TRAINING_INSTALLS_MODEL_EDITS_DEPLOYMENT=TRUE'
Write-Host 'FUN_QWEN_V109_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_GRAMMAR_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V109_OFFLINE_TESTS=PASS'
if($Execute -and $Approval -cne $consent){Hold 'EXPLICIT_ISOLATED_GBNF_INFERENCE_APPROVAL_REQUIRED'}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
}
if($Execute){
 Write-Host 'FUN_QWEN_V109_OPERATOR_APPROVAL=SEVEN_ISOLATED_GBNF_CPU_INFERENCES'
 & $py -3.12 $worker --approval $Approval
}else{
 Write-Host 'FUN_QWEN_V109_OPERATOR_APPROVAL=NONE_PREFLIGHT_ONLY'
 & $py -3.12 $worker --preflight
}
if($LASTEXITCODE -ne 0){Hold 'GBNF_TOOL_REQUEST_TRIAL_FAILED_PRESERVE_ALL_EVIDENCE'}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
 if($before[$port] -cne $after){Hold ('PROTECTED_LISTENER_CHANGED_'+$port)}
}
if($Execute){
 Write-Host 'FUN_QWEN_V109=CONSTRAINED_QWEN_TOOL_REQUESTS_MEASURED_NOT_DEPLOYED'
}else{
 Write-Host 'FUN_QWEN_V109=READONLY_PREFLIGHT_PASS_NO_MODEL_INFERENCE'
}
Write-Host 'FUN_QWEN_V109_LIVE_SYSTEMS_AND_ELEKTRON=UNTOUCHED'
