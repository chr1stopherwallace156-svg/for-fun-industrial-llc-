# Fun Industrial V10.4: offline deterministic math engine demo.
# Strictly standalone; does NOT train or run Qwen, deploy to Fun, read
# frozen validation tests, change services, or touch Elektron.
[CmdletBinding()]param([long]$E3=236,[long]$E5=230,[long]$E8=235,[string]$ModelClaim='')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_MATH_V104_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$engine=Join-Path $root 'scripts\Verified-Fun-Math-Decision-V104.py'
$tests=Join-Path $root 'intelligence-checks\fun-math-v104-verifier-test.py'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($file in @($engine,$tests)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_SOURCE_MISSING_'+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REFUSED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
foreach($number in @($E3,$E5,$E8)){
 if($number -lt 0 -or $number -gt 1000000000){Hold 'WINDOW_ERROR_OUT_OF_BOUNDS'}
}
Write-Host 'FUN_MATH_V104=STANDALONE_VERIFIED_WINDOW_MATH'
Write-Host 'FUN_MATH_V104_SCOPE=OPERATOR_SUPPLIED_NUMBERS_NOT_QWEN_GENERATED_INPUTS'
Write-Host 'FUN_MATH_V104_INFERENCE_TRAINING_DEPLOYMENT_AND_FILE_WRITES=ZERO'
Write-Host 'FUN_MATH_V104_LIVE_QWEN_AND_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_MATH_V104_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_MATH_UNIT_TESTS_FAILED'}
Write-Host 'FUN_MATH_V104_TESTS=PASS'
$argsList=@($engine,'--e3',[string]$E3,'--e5',[string]$E5,'--e8',[string]$E8,'--self-check')
if($ModelClaim -cne ''){$argsList+=@('--model-claim',$ModelClaim)}
& $py -3.12 @argsList
if($LASTEXITCODE -ne 0){Hold 'TYPED_MATH_OR_MODEL_CLAIM_INVALID'}
Write-Host 'FUN_MATH_V104=STANDALONE_VERIFIED_MATH_PASS_NOT_INTEGRATED'
