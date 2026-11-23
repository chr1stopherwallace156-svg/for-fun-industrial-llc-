# Fun Industrial V10.5: verify end-to-end isolated Qwen -> deterministic math.
# Preflight by default; -Execute requires explicit approval and uses seven
# NEW V10 validation cases. No frozen test, no weights, no live Fun changes.
[CmdletBinding()]param([switch]$Execute,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$why){throw ('FUN_QWEN_V105_TOOLBRIDGE_HOLD='+$why)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$worker=Join-Path $root 'scripts\Run-Fun-Qwen-Math-Toolbridge-V105.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-v105-math-toolbridge-test.py'
$consent='I_APPROVE_ISOLATED_QWEN_V105_MATH_TOOLBRIDGE_EVALUATION'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'DIRTY_LOCAL_REPO_REQUIRES_REVIEW'}
foreach($path in @($worker,$tests)){
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('REQUIRED_SOURCE_MISSING_'+$path)}
 if((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'FILE_SYMLINK_REJECTED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
Write-Host 'FUN_QWEN_V105=ISOLATED_ORIGINAL_QWEN_TO_VERIFIED_MATH_INTEGRATION'
Write-Host 'FUN_QWEN_V105_CASES=SEVEN_NEW_SHA256_VERIFIED_V10_VALIDATION_CASES'
Write-Host 'FUN_QWEN_V105_BRIDGE=EXTERNAL_PYTHON_ORCHESTRATION_NOT_PRODUCTION_QWEN_TOOL_CALLS'
Write-Host 'FUN_QWEN_V105_FROZEN_TEST=UNOPENED'
Write-Host 'FUN_QWEN_V105_ORIGINAL_QWEN_SERVICES_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_QWEN_V105_NO_TRAINING_OR_DEPLOYMENT=TRUE'
Write-Host 'FUN_QWEN_V105_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V105_OFFLINE_TESTS=PASS'
if($Execute -and $Approval -cne $consent){Hold 'EXPLICIT_ISOLATED_QWEN_INFERENCE_APPROVAL_REQUIRED'}
$ports=@(11434,8088,8801,8802,8797,8798)
$prior=@{}
foreach($port in $ports){
 $prior[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
if($Execute){
 Write-Host 'FUN_QWEN_V105_OPERATOR_APPROVAL=VERIFIED_ISOLATED_SEVEN_CPU_INFERENCES'
 & $py -3.12 $worker --approve $Approval
}else{
 Write-Host 'FUN_QWEN_V105_OPERATOR_APPROVAL=NONE_PREFLIGHT_ONLY'
 & $py -3.12 $worker --preflight
}
if($LASTEXITCODE -ne 0){Hold 'ISOLATED_BRIDGE_FAILED_PRESERVE_ALL_EVIDENCE'}
foreach($port in $ports){
 $now=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
 if($prior[$port] -cne $now){Hold ('PROTECTED_LISTENER_CHANGED_'+$port)}
}
if($Execute){
 Write-Host 'FUN_QWEN_V105=ISOLATED_QWEN_MATH_BRIDGE_PASS_NOT_DEPLOYED'
}else{
 Write-Host 'FUN_QWEN_V105=READONLY_PREFLIGHT_PASS_NO_INFERENCE'
}
Write-Host 'FUN_QWEN_V105_LIVE_SYSTEMS_AND_ELEKTRON=UNTOUCHED'
