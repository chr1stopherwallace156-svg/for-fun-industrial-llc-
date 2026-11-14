# Independent FIAL 4 offline pilot. No service start/stop, Qwen, REA or network.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fial4-grounded-evidence-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
function Hold([string]$why){throw ('FIAL4_ACTIVATION_HOLD='+$why)}
if((git.exe -C $Root remote get-url origin) -cne $Origin -or
 (git.exe -C $Root branch --show-current) -cne $Branch -or $LASTEXITCODE -ne 0){
 Hold 'REPOSITORY_IDENTITY_MISMATCH'
}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -gt 0 -or
 $LASTEXITCODE -ne 0){Hold 'SOURCE_WORKTREE_DIRTY'}
$files=@('src\fial\grounded-compiler-v4.mjs',
 'src\fial\grounded-review-v4.mjs',
 'src\fial\dashboard-status-v4.mjs',
 'src\fial\dashboard-widget-v4.js',
 'src\fial\programs\grant-grounded.fial',
 'scripts\Run-Fun-FIAL-Grounded-V4.mjs',
 'intelligence-checks\fial-grounded-v4-case.mjs')
$node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($rel in $files){
 $file=Join-Path $Root $rel
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('FILE_MISSING='+$rel)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_DENIED='+$rel)
 }
 if($file.EndsWith('.mjs') -or $file.EndsWith('.js')){
  & $node --check $file
  if($LASTEXITCODE -ne 0){Hold ('NODE_SYNTAX_FAILED='+$rel)}
 }
}
& $node --test (Join-Path $Root 'intelligence-checks\fial-grounded-v4-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'FIAL4_INDEPENDENT_TESTS_FAILED'}
Write-Host 'FIAL4_INDEPENDENT_TESTS=PASS'
$runner=Join-Path $Root 'scripts\Run-Fun-FIAL-Grounded-V4.mjs'
& $node $runner --check
if($LASTEXITCODE -ne 0){Hold 'FIAL4_COMPILER_HOLD'}
$data=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RealApplicationWorkerV1'
foreach($rel in @('last-run.json','fial\semantic-v2\last-run.json',
 'fial\semantic-v3\last-run.json')){
 if(!(Test-Path -LiteralPath (Join-Path $data $rel) -PathType Leaf)){
  Hold ('FIAL_PREREQUISITE_MISSING='+$rel)
 }
}
& $node $runner --once
if($LASTEXITCODE -ne 0){Hold 'LIVE_OFFLINE_REVIEW_FAILED'}
$report=Join-Path $data 'fial\grounded-v4\last-run.json'
if(!(Test-Path -LiteralPath $report -PathType Leaf)){Hold 'V4_REPORT_MISSING'}
$r=Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
if($r.version -cne 'fial-grounded-review-v0.4' -or
 $r.network_requests -ne 0 -or $r.model_requests -ne 0 -or
 $r.rea_actions -ne 0 -or $r.applications_submitted -ne 0 -or
 $r.money_spent -ne 0 -or $r.service_restarts -ne 0 -or
 $r.verified_eligibilities -ne 0 -or $r.semantic_entailments_proven -ne 0){
 Hold 'AUTHORITY_RECEIPT_INVALID'
}
Write-Host 'FIAL4_SOURCE_GROUNDED_PILOT=PASS'
Write-Host ('FIAL4_AUDIT_REPORT='+$report)
Write-Host 'FIAL4_PROTECTED_SERVICES=NOT_TOUCHED FIAL2_FIAL3_EVIDENCE=PRESERVED'
