# FIAL5.12 one operator action: if the prior FIAL5.11 deployment is missing,
# restore that *reviewed* milestone first (not the entire PC), then perform
# the FIAL5.12 first source cycle, scheduler in-place update and guarded 8802 handoff.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Old=Join-Path $HOME 'FunIndustrial-FIAL511-CommercialFit'
$OldBranch='feature/fial5-11-commercial-fit-qualification-20261114'
$OldActivation=Join-Path $Old 'Activate-Fun-Commercial-Fit-V5-11.ps1'
$Install=Join-Path $Root 'Install-Fun-Bid-Readiness-V5-12.ps1'
$Deploy=Join-Path $Root 'Deploy-Fun-FIAL512-PrimaryDashboard.ps1'
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
function Hold([string]$why){throw ('FIAL512_ALL_IN_ONE_HOLD='+$why)}
function KnownSource([string]$dir,[string]$branch){
 $origin=(& git.exe -C $dir remote get-url origin|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $origin -cne $Origin){Hold 'UNKNOWN_CHECKOUT_REMOTE'}
 $b=(& git.exe -C $dir branch --show-current|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $b -cne $branch){Hold 'UNKNOWN_CHECKOUT_BRANCH'}
 $dirty=@(& git.exe -C $dir status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold 'UNCOMMITTED_WORKTREE_UNTOUCHED'}
}
KnownSource $Root 'feature/fial5-12-bid-readiness-20261114'
foreach($file in @($Install,$Deploy)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('SCRIPT_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_SCRIPT_REFUSED='+$file)
 }
}
$Url='http://127.0.0.1:8802'
$fitActive=$false
try{
 $r=Invoke-RestMethod ($Url+'/api/operator/fit/status') -TimeoutSec 8 -ErrorAction Stop
 $fitActive=$r.version -ceq 'fial5.11-commercial-fit-v1' -and
  $r.counts.directly_qualified_bids -eq 0 -and $r.boundaries.rea_calls -eq 0
}catch{Write-Host 'FIAL512_PREVIOUS_FIAL511_STATUS=NOT_YET_VERIFIED'}
if(!(Test-Path -LiteralPath $Old -PathType Container)){
 & git.exe clone --quiet --depth 1 --single-branch --branch $OldBranch $Origin $Old
 if($LASTEXITCODE -ne 0){Hold 'PREVIOUS_FIAL511_CHECKOUT_FAILED'}
}
KnownSource $Old $OldBranch
& git.exe -C $Old pull --ff-only origin $OldBranch
if($LASTEXITCODE -ne 0){Hold 'PREVIOUS_FIAL511_FAST_FORWARD_FAILED'}
KnownSource $Old $OldBranch
if(!$fitActive){
 $task=Get-ScheduledTask -TaskName 'FunIndustrial-Executive-Operator-V1' -ErrorAction Stop
 $oldRunner=Join-Path $HOME 'FunIndustrial-FIAL510-Procurement\Run-Fun-Procurement-V5-10.ps1'
 $prevRunner=Join-Path $Old 'Run-Fun-Commercial-Fit-V5-11.ps1'
 $currentAction=[string]$task.Actions[0].Arguments
 if(@($task.Actions).Count -ne 1 -or
  (!$currentAction.Contains($oldRunner) -and !$currentAction.Contains($prevRunner))){
  Hold 'PRIOR_FIAL510_OR_FIAL511_TASK_UNVERIFIED_NO_AUTO_RESTART'
 }
 Write-Host 'FIAL512_BOOTSTRAP=ACTIVATING_PREVIOUS_REVIEWED_FIAL511'
 & $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $OldActivation
 if($LASTEXITCODE -ne 0){Hold 'PREVIOUS_FIAL511_ACTIVATION_HOLD'}
 Write-Host 'FIAL512_FIAL511_BOOTSTRAP=PASS'
}else{Write-Host 'FIAL512_FIAL511=ALREADY_LIVE'}
$ready=Invoke-RestMethod ($Url+'/api/operator/fit/status') -TimeoutSec 12 -ErrorAction Stop
if($ready.version -cne 'fial5.11-commercial-fit-v1' -or
 $ready.counts.directly_qualified_bids -ne 0 -or
 $ready.boundaries.rea_calls -ne 0){Hold 'PRIOR_FIAL511_NOT_VERIFIED'}
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Install
if($LASTEXITCODE -ne 0){Hold 'FIAL512_FIRST_SOURCE_CHECK_OR_SCHEDULE_HOLD'}
Write-Host 'FIAL512_PHASE_1=REAL_SOURCES_AND_FOUR_TRIGGER_SCHEDULE_PASS'
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){Hold 'FIAL512_8802_HANDOFF_OR_QWEN_HOLD'}
Write-Host 'FIAL512_PHASE_2=PRIMARY_DASHBOARD_AND_QWEN_PASS'
$bid=Invoke-RestMethod ($Url+'/api/operator/bid-readiness/status') -TimeoutSec 15 -ErrorAction Stop
$fit=Invoke-RestMethod ($Url+'/api/operator/fit/status') -TimeoutSec 15 -ErrorAction Stop
$proc=Invoke-RestMethod ($Url+'/api/operator/procurement/status') -TimeoutSec 15 -ErrorAction Stop
$fleet=Invoke-RestMethod ($Url+'/api/operator/fleet/status') -TimeoutSec 15 -ErrorAction Stop
$reg=Invoke-RestMethod ($Url+'/api/operator/regulatory/status') -TimeoutSec 15 -ErrorAction Stop
$task=Get-ScheduledTask -TaskName 'FunIndustrial-Executive-Operator-V1' -ErrorAction Stop
if($bid.version -cne 'fial5.12-bid-readiness-v1' -or
 $bid.counts.verified_bid_ready -ne 0 -or $bid.counts.lead_paths -ne 2 -or
 $bid.boundaries.bids_submitted -ne 0 -or
 $bid.boundaries.registrations_made -ne 0 -or
 $bid.boundaries.rea_tool_calls -ne 0 -or
 $fit.version -cne 'fial5.11-commercial-fit-v1' -or
 $proc.version -cne 'fial5.10-published-procurement-v1' -or
 $fleet.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
 $reg.source_catalog_version -cne 'fial5.8.1-regulatory-catalog-2026-amendment-v1' -or
 @($task.Triggers).Count -ne 4){Hold 'FINAL_SYSTEM_OR_AUTHORITY_BOUNDARY_INVALID'}
Write-Host 'FIAL512_SYSTEM_INTEGRATION=PASS'
Write-Host ('FIAL512_COMMERCIAL_PATHWAYS='+$bid.counts.lead_paths)
Write-Host ('FIAL512_OFFICIAL_SOURCES_CURRENT='+$bid.counts.source_documents_current)
Write-Host 'FIAL512_DIRECT_READY_BIDS=0'
Write-Host 'FIAL512_REGISTERED_VENDOR_OR_LICENSES=UNVERIFIED'
Write-Host 'FIAL512_FOUR_DAILY_TRIGGERS=PRESERVED'
Write-Host 'FIAL512_EMAIL_BIDS_GRANTS_PAYMENTS_MODELS_REA=ZERO'
Write-Host ('FIAL512_OPERATIONS='+$Url+'/operations/')
Write-Host ('FIAL512_CHAT='+$Url+'/unified/?view=chat')
Write-Host 'FIAL512_ALL_IN_ONE=PASS'
