# One explicitly initiated FIAL v0.2 qualification. No restart, no background process, no scheduling changes.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fun-ml-unified-dashboard-v3-20261113'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
function Hold([string]$why){throw ('FIAL2_ACTIVATION_HOLD='+$why)}
if((git.exe -C $Root remote get-url origin) -cne $Origin -or
 (git.exe -C $Root branch --show-current) -cne $Branch -or $LASTEXITCODE -ne 0){
 Hold 'GIT_SOURCE_IDENTITY_INVALID'
}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -gt 0 -or $LASTEXITCODE -ne 0){
 Hold 'LOCAL_CHANGES_REVIEW_REQUIRED'
}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Files=@(
 'src\fial\semantic-compiler-v2.mjs',
 'src\fial\semantic-engine-v2.mjs',
 'src\fial\programs\grant-understanding.fial',
 'scripts\Run-Fun-FIAL-Semantic-V2.mjs',
 'intelligence-checks\fial-semantic-v2-case.mjs'
)
foreach($item in $Files){
 $file=Join-Path $Root $item
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('FILE_MISSING='+$item)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){
  Hold ('FILE_LINK_REJECTED='+$item)
 }
 if($item.EndsWith('.mjs')){
  & $Node --check $file
  if($LASTEXITCODE -ne 0){Hold ('JS_PARSE_HOLD='+$item)}
 }
}
$Tests=Join-Path $Root 'intelligence-checks\fial-semantic-v2-case.mjs'
& $Node --test $Tests
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_QUALIFICATION_FAILED'}
Write-Host 'FIAL2_SEMANTIC_OFFLINE_TESTS=PASS'
$Runner=Join-Path $Root 'scripts\Run-Fun-FIAL-Semantic-V2.mjs'
& $Node $Runner --check
if($LASTEXITCODE -ne 0){Hold 'SEMANTIC_COMPILER_REJECTED_SOURCE'}
$Data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RealApplicationWorkerV1'
if(!(Test-Path -LiteralPath (Join-Path $Data 'last-run.json') -PathType Leaf)){
 Hold 'VERIFIED_GRANT_REPORT_MISSING'
}
if(!(Test-Path -LiteralPath (Join-Path $Data 'business-profile.json') -PathType Leaf)){
 Hold 'BUSINESS_PROFILE_MISSING'
}
& $Node $Runner --once
if($LASTEXITCODE -ne 0){Hold 'LIVE_GOVERNMENT_EVIDENCE_REVIEW_FAILED'}
$ResultPath=Join-Path $Data 'fial\semantic-v2\last-run.json'
if(!(Test-Path -LiteralPath $ResultPath -PathType Leaf)){Hold 'SEMANTIC_REPORT_MISSING'}
$result=Get-Content -LiteralPath $ResultPath -Raw | ConvertFrom-Json
if($result.version -cne 'fial-semantic-engine-v0.2' -or
 $result.applications_submitted -ne 0 -or $result.rea_executions -ne 0 -or
 $result.emails_sent -ne 0 -or $result.money_spent -ne 0 -or
 $result.state -cne 'EVIDENCE_GROUNDED_SEMANTIC_REVIEW_COMPLETE'){
 Hold 'FIAL2_AUTHORITY_OR_REPORT_INVALID'
}
Write-Host 'FIAL2_REAL_SEMANTIC_TEST=PASS REPORT_VERIFIED'
Write-Host ('FIAL2_ACCEPTED_SOURCE_QUOTES='+[int]$result.model_quotes_grounded)
$failed=@($result.cases|Where-Object {
 $_.model_status -ceq 'MODEL_OUTPUT_UNVERIFIED' -or
 $_.model_status -ceq 'MODEL_UNAVAILABLE_OR_UNVERIFIED'
})
if($failed.Count -gt 0){
 Write-Host ('FIAL2_SEMANTIC_GROUNDING=HOLD_MODEL_OUTPUT COUNT='+$failed.Count)
}elseif([int]$result.model_quotes_grounded -gt 0){
 Write-Host 'FIAL2_SEMANTIC_GROUNDING=SOURCE_QUOTE_MATCHED_INTERPRETATION_UNVERIFIED'
}else{
 Write-Host 'FIAL2_SEMANTIC_GROUNDING=HOLD_ZERO_SUPPORTED_QUOTES'
}
Write-Host ('FIAL2_REPORT='+$ResultPath)
Write-Host 'FIAL2_SCHEDULE=NOT_CHANGED OTHER_SERVICES=NOT_RESTARTED'
