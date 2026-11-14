# FIAL v0.1 — first independent custom-language live qualification on Fun Industrial.
# Tests bytecode/interpreter and then runs on existing verified California grant evidence.
# No changes to current scheduled task, Qwen, REA, Shopify, Elektron or any service ports.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fun-ml-unified-dashboard-v3-20261113'
$ExpectedRepo='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
function Hold([string]$reason){throw ('FIAL_ACTIVATION_HOLD='+$reason)}
if((git.exe -C $Root remote get-url origin) -cne $ExpectedRepo -or
   (git.exe -C $Root branch --show-current) -cne $Branch -or $LASTEXITCODE -ne 0){
 Hold 'SOURCE_IDENTITY_MISMATCH'
}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -gt 0 -or $LASTEXITCODE -ne 0){
 Hold 'LOCAL_CHANGES_REVIEW_REQUIRED'
}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Paths=@(
 'src\fial\compiler-v1.mjs',
 'src\fial\interpreter-v1.mjs',
 'src\fial\programs\grant-research.fial',
 'scripts\Run-Fun-FIAL-V1.mjs',
 'intelligence-checks\fial-v1-case.mjs'
)
foreach($name in $Paths){
 $p=Join-Path $Root $name
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('SOURCE_MISSING='+$name)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){
  Hold ('SYMLINK_SOURCE_UNTRUSTED='+$name)
 }
 if($p.EndsWith('.mjs')){
  & $Node --check $p
  if($LASTEXITCODE -ne 0){Hold ('SOURCE_PARSE_FAILED='+$name)}
 }
}
$Tests=Join-Path $Root 'intelligence-checks\fial-v1-case.mjs'
& $Node --test $Tests
if($LASTEXITCODE -ne 0){Hold 'FIAL_LANGUAGE_TEST_FAILURE'}
Write-Host 'FIAL_LANGUAGE_TESTS=PASS'
$Runner=Join-Path $Root 'scripts\Run-Fun-FIAL-V1.mjs'
& $Node $Runner --check
if($LASTEXITCODE -ne 0){Hold 'FIAL_COMPILER_HOLD'}
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RealApplicationWorkerV1'
if(!(Test-Path -LiteralPath (Join-Path $Data 'last-run.json'))){Hold 'LIVE_GRANT_REPORT_MISSING'}
if(!(Test-Path -LiteralPath (Join-Path $Data 'business-profile.json'))){Hold 'VERIFIED_PROFILE_FILE_MISSING'}
& $Node $Runner --once
if($LASTEXITCODE -ne 0){Hold 'FIAL_REAL_GRANT_INTERPRETATION_FAILED'}
$Result=Join-Path $Data 'fial\last-run.json'
if(!(Test-Path -LiteralPath $Result -PathType Leaf)){Hold 'FIAL_RESULT_MISSING'}
$Receipt=Get-Content -LiteralPath $Result -Raw|ConvertFrom-Json
if($Receipt.runtime -cne 'fial-runtime-v0.1' -or
 $Receipt.applications_submitted -ne 0 -or $Receipt.emails_sent -ne 0 -or
 $Receipt.rea_actions -ne 0 -or $Receipt.purchases -ne 0){
 Hold 'FIAL_AUTHORITY_ATTESTATION_FAILED'
}
Write-Host 'FIAL_CUSTOM_LANGUAGE_V1=PASS VERIFIED_SOURCE_EXECUTED_SQLITE_PERSISTED'
Write-Host ('FIAL_LANGUAGE_REPORT='+$Result)
Write-Host 'FIAL_EXTERNAL_ACTIONS=NONE EXISTING_SERVICES=UNTOUCHED'
