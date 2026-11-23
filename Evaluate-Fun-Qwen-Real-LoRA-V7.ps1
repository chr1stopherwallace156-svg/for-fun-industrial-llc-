# Fun Industrial V7: two-way base vs actual trained GGUF LoRA inference evidence
# Explicit approval; no model download, training, installing or live server changes.
[CmdletBinding()]param([switch]$Execute,[string]$Approval='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_QWEN_V7_PAIRED_EVALUATION_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$engine=Join-Path $root 'scripts\Evaluate-Fun-Qwen-Real-LoRA-V7.py'
$tests=Join-Path $root 'intelligence-checks\fun-qwen-paired-inference-v7-test.py'
$expected='I_APPROVE_ISOLATED_QWEN_BASE_ADAPTER_EVALUATION'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($p in @($engine,$tests)){
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REFUSED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_MISSING'}
$ports=@(11434,8088,8801,8802,8797,8798)
$before=@{}
foreach($port in $ports){
 $before[$port]=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
   ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
}
Write-Host 'FUN_QWEN_V7=PAIRED_BASE_VS_TRAINED_LORA'
Write-Host 'FUN_QWEN_V7_SCOPE=ISOLATED_SEQUENTIAL_CPU_INFERENCE_ONLY'
Write-Host 'FUN_QWEN_V7_EXTERNAL_DOWNLOADS=ZERO'
Write-Host 'FUN_QWEN_V7_TRAINING=NONE'
Write-Host 'FUN_QWEN_V7_LIVE_SERVICES=NOT_TOUCHED'
Write-Host 'FUN_QWEN_V7_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED'}
Write-Host 'FUN_QWEN_V7_OFFLINE_TESTS=PASS'
if(!$Execute){
 Write-Host 'FUN_QWEN_V7_EVALUATION=NOT_STARTED_EXPLICIT_EXECUTE_REQUIRED'
 return
}
if($Approval -cne $expected){Hold 'EXPLICIT_EVALUATION_APPROVAL_REQUIRED'}
& $py -3.12 $engine --approve $Approval
if($LASTEXITCODE -ne 0){Hold 'EVALUATION_ENGINE_HOLD_READ_LOCAL_LOGS'}
foreach($port in $ports){
 $after=(@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
   ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
 if($before[$port] -cne $after){Hold ('LIVE_LISTENER_CHANGED_'+$port)}
}
Write-Host 'FUN_QWEN_V7=PAIRED_INFERENCE_COMPLETE_NOT_DEPLOYED'
Write-Host 'FUN_QWEN_V7_MODEL_AND_LIVE_SERVICES=UNCHANGED'
