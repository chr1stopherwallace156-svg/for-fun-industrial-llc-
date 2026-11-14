# Recover only FIAL5 (8804), FIAL5.1 (8805), FIAL5.2 (8806).
# Uses the existing pinned-branch guarded launchers in their own checkouts.
# This does NOT start or stop Qwen, compute, REA, Elektron or the original dashboard.
[CmdletBinding()]param([switch]$VerifyLive)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Hold([string]$why){throw ('FIAL52_STACK_RECOVERY_HOLD='+$why)}
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Steps=@(
 [pscustomobject]@{Name='FIAL5';Dir='FunIndustrial-FIAL5-System';Branch='feature/fial5-system-wide-core-20261114';File='Start-Fun-FIAL-System-V5.ps1';Port=8804;Health='http://127.0.0.1:8804/api/fial/system/health';Version='fi-fial-system-dashboard-v5'},
 [pscustomobject]@{Name='FIAL51';Dir='FunIndustrial-FIAL51-Integrations';Branch='feature/fial5-1-eight-module-integration-20261114';File='Start-Fun-FIAL-Integrations-V5-1.ps1';Port=8805;Health='http://127.0.0.1:8805/api/fial/modules/health';Version='fial5.1-integrated-hub-v1'},
 [pscustomobject]@{Name='FIAL52';Dir='FunIndustrial-FIAL52-GroundedChat';Branch='feature/fial5-2-qwen-grounded-replies-20261114';File='Start-Fun-Qwen-Grounded-V5-2.ps1';Port=8806;Health='http://127.0.0.1:8806/api/fial/grounded/health';Version='fial5.2-grounded-qwen-sidecar-v1'}
)
function Listening([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$port){
 return (@(Listening $port|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
$protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8802,8803,8443)
$before=@{}
foreach($p in $protected){$before[$p]=Snapshot $p}
# Validate all three sources before starting anything.
foreach($step in $Steps){
 $step|Add-Member -NotePropertyName Root -NotePropertyValue (Join-Path $HOME $step.Dir)
 if(!(Test-Path -LiteralPath $step.Root -PathType Container)){Hold ('CHECKOUT_MISSING_'+$step.Name)}
 $repo=(git.exe -C $step.Root remote get-url origin)
 if($LASTEXITCODE -ne 0 -or $repo -cne $Origin){Hold ('REPO_IDENTITY_'+$step.Name)}
 $b=(git.exe -C $step.Root branch --show-current)
 if($LASTEXITCODE -ne 0 -or $b -cne $step.Branch){Hold ('BRANCH_IDENTITY_'+$step.Name)}
 $dirty=@(git.exe -C $step.Root status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold ('DIRTY_CHECKOUT_'+$step.Name)}
 $start=Join-Path $step.Root $step.File
 if(!(Test-Path -LiteralPath $start -PathType Leaf)){Hold ('GUARDED_STARTER_MISSING_'+$step.Name)}
 if(((Get-Item -LiteralPath $start).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('GUARDED_STARTER_SYMLINK_'+$step.Name)
 }
}
# Adoption is handled by the component launchers; they refuse unknown port owners.
foreach($step in $Steps){
 Write-Host ('FIAL52_RECOVERY_STAGE='+$step.Name+' PORT='+$step.Port)
 $starter=Join-Path $step.Root $step.File
 $args=@('-NoProfile','-ExecutionPolicy','Bypass','-File',$starter)
 if($step.Name -ceq 'FIAL52' -and $VerifyLive){$args+=@('-VerifyLive')}
 & powershell.exe @args
 if($LASTEXITCODE -ne 0){Hold ('GUARDED_STARTER_FAILED_'+$step.Name)}
 $health=Invoke-RestMethod -Uri $step.Health -TimeoutSec 9 -ErrorAction Stop
 if($health.version -cne $step.Version){Hold ('IDENTITY_MISMATCH_'+$step.Name)}
 $listeners=@(Listening $step.Port)
 if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -cne '127.0.0.1'){
  Hold ('LOCAL_LISTENER_UNVERIFIED_'+$step.Name)
 }
 Write-Host ('FIAL52_RECOVERY_READY='+$step.Name+' PID='+$listeners[0].OwningProcess)
}
foreach($p in $protected){
 if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_PORT_CHANGED_'+$p)}
}
Write-Host 'FIAL52_STACK_RECOVERY=PASS'
Write-Host 'FIAL52_RESTORED_FIAL5_FIAL51_FIAL52=TRUE'
Write-Host 'FIAL52_EXISTING_QWEN_MEMORY_REA_ELEKTRON=UNTOUCHED'
if($VerifyLive){Write-Host 'FIAL52_GROUNDED_CHAT_LIVE_QUALITY=QUALIFIED'}
else{Write-Host 'FIAL52_GROUNDED_CHAT_LIVE_QUALITY=NOT_TESTED'}
