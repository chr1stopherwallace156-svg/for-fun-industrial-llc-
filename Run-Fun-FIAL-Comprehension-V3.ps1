# FIAL3_INDEPENDENT_COMPREHENSION_AUDIT_V1
# Additive, operator-invoked local-only audit. No Qwen, new download, grant scans, or server restarts.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fun-ml-unified-dashboard-v3-20261113'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
function Hold([string]$reason){throw ('FIAL3_ACTIVATION_HOLD='+$reason)}
if((git.exe -C $Root remote get-url origin) -cne $Origin -or
 (git.exe -C $Root branch --show-current) -cne $Branch -or $LASTEXITCODE -ne 0){
 Hold 'REPOSITORY_IDENTITY_MISMATCH'
}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -gt 0 -or $LASTEXITCODE -ne 0){
 Hold 'SOURCE_WORKTREE_DIRTY'
}
$paths=@(
 'src\fial\comprehension-compiler-v3.mjs',
 'src\fial\comprehension-audit-v3.mjs',
 'src\fial\programs\grant-comprehension.fial',
 'scripts\Run-Fun-FIAL-Comprehension-V3.mjs',
 'intelligence-checks\fial-comprehension-v3-case.mjs'
)
$Node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($relative in $paths){
 $file=Join-Path $Root $relative
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('MISSING_SOURCE='+$relative)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_SOURCE_BLOCKED='+$relative)
 }
 if($relative.EndsWith('.mjs')){
  & $Node --check $file
  if($LASTEXITCODE -ne 0){Hold ('JAVASCRIPT_SYNTAX_FAILED='+$relative)}
 }
}
& $Node --test (Join-Path $Root 'intelligence-checks\fial-comprehension-v3-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'INDEPENDENT_COMPREHENSION_TESTS_FAILED'}
Write-Host 'FIAL3_COMPREHENSION_TESTS=PASS'
$runner=Join-Path $Root 'scripts\Run-Fun-FIAL-Comprehension-V3.mjs'
& $Node $runner --check
if($LASTEXITCODE -ne 0){Hold 'FIAL3_PROGRAM_REJECTED'}
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RealApplicationWorkerV1'
foreach($needed in @('last-run.json','fial\semantic-v2\last-run.json')){
 if(!(Test-Path -LiteralPath (Join-Path $Data $needed) -PathType Leaf)){
  Hold ('PREVIOUS_VERIFIED_REPORT_MISSING='+$needed)
 }
}
& $Node $runner --once
if($LASTEXITCODE -ne 0){Hold 'COMPREHENSION_LIVE_AUDIT_FAILED'}
$receiptPath=Join-Path $Data 'fial\semantic-v3\last-run.json'
if(!(Test-Path -LiteralPath $receiptPath -PathType Leaf)){Hold 'AUDIT_RECEIPT_MISSING'}
$result=Get-Content -LiteralPath $receiptPath -Raw|ConvertFrom-Json
if($result.version -cne 'fial-comprehension-audit-v0.3' -or
 $result.tool_actions -ne 0 -or $result.external_requests -ne 0 -or
 $result.applications_submitted -ne 0 -or $result.money_spent -ne 0 -or
 $result.verified_eligibilities -ne 0 -or $result.claims_proven_by_entailment -ne 0){
 Hold 'AUDIT_AUTHORITY_OR_STATUS_INVALID'
}
Write-Host 'FIAL3_REAL_COMPREHENSION_AUDIT=PASS'
Write-Host ('FIAL3_AUDIT_REPORT='+$receiptPath)
Write-Host 'FIAL3_PROTECTED_SERVICES=NOT_TOUCHED FIAL2_ORIGINAL_CASES=PRESERVED'
