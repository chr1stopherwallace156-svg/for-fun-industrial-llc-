# Fun Industrial V10.6: stand-alone typed math tool contract validation.
# All examples are explicitly synthetic proposals, NOT actual Qwen tool calls.
# Tests a host-held trust boundary. No network, model inference, training,
# files created/edited, MCP registration, live dashboard/REA or Elektron.
[CmdletBinding()]param([long]$E3=236,[long]$E5=230,[long]$E8=235,[string]$SourceId='OperatorDemoV106')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$reason){throw ('FUN_MATH_V106_TOOL_CONTRACT_HOLD='+$reason)}
$root=$PSScriptRoot
$branch='feature/fun-fisre-live-8802-20261122'
$script=Join-Path $root 'scripts\Fun-Math-Tool-Contract-V106.py'
$tests=Join-Path $root 'intelligence-checks\fun-math-v106-tool-contract-test.py'
if((git -C $root branch --show-current) -cne $branch -or $LASTEXITCODE -ne 0){Hold 'WRONG_GIT_BRANCH'}
if(@(git -C $root status --porcelain=v1 --untracked-files=all).Count){Hold 'LOCAL_REPO_CHANGES_REQUIRE_REVIEW'}
foreach($path in @($script,$tests)){
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('SOURCE_NOT_FOUND_'+$path)}
 if((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REJECTED'}
}
$py=(Get-Command py.exe -ErrorAction Stop).Source
$version=(& $py -3.12 --version 2>&1|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.12\.'){Hold 'PYTHON_312_REQUIRED'}
foreach($number in @($E3,$E5,$E8)){
 if($number -lt 0 -or $number -gt 1000000000){Hold 'HOST_NUMBERS_OUT_OF_BOUNDS'}
}
if($SourceId -cnotmatch '^[A-Za-z][A-Za-z0-9_-]{0,63}$'){Hold 'INVALID_HOST_SOURCE_ID'}
Write-Host 'FUN_MATH_V106=ISOLATED_TYPED_MATH_PROPOSAL_CONTRACT'
Write-Host 'FUN_MATH_V106_INPUT_AUTHORITY=HOST_SUPPLIED_NOT_MODEL_GENERATED'
Write-Host 'FUN_MATH_V106_PROPOSAL_TYPE=SYNTHETIC_FIXTURE_NOT_QWEN'
Write-Host 'FUN_MATH_V106_ALLOWLIST=VERIFY_WINDOW_MATH_ONLY'
Write-Host 'FUN_MATH_V106_LIVE_QWEN_MCP_REA_DASHBOARD_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_MATH_V106_INFERENCE_TRAINING_DEPLOYMENT_OR_FILE_WRITES=NONE'
Write-Host 'FUN_MATH_V106_OFFLINE_TESTS=START'
& $py -3.12 $tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_CONTRACT_TESTS_FAILED'}
Write-Host 'FUN_MATH_V106_OFFLINE_TESTS=PASS'
& $py -3.12 $script --source-id $SourceId --e3 $E3 --e5 $E5 --e8 $E8
if($LASTEXITCODE -ne 0){Hold 'HOST_AUTHORIZED_MATH_PROPOSAL_DISPATCH_FAILED'}
Write-Host 'FUN_MATH_V106=HOST_AUTHORIZED_MATH_TOOL_CONTRACT_PASS_NOT_DEPLOYED'
