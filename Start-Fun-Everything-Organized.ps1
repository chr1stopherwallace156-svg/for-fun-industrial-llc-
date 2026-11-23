# Fun Industrial: start the existing local stack without downgrading 8802.
# Reuses reviewed local core/ML/gateway starters and the organized preview rollout.
# No background polling, auto actions, tool approvals, or changes to Elektron.
[CmdletBinding()]param([switch]$SkipPrivateGateway,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$CoreRoot=Join-Path $HOME 'FunIndustrial-SpatialUX-V2'
$MLRoot=Join-Path $HOME 'FunIndustrial-QwenML-V2'
$CoreStart=Join-Path $CoreRoot 'Start-Fun-Industrial.ps1'
$MLStart=Join-Path $MLRoot 'Start-Fun-Qwen-ML-V2.ps1'
$GatewayStart=Join-Path $CoreRoot 'Start-Fun-Private-Gateway-V43.ps1'
$PreviewStart=Join-Path $Root 'Activate-Fun-Organized-Preview.ps1'
$Repo='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Branch='feature/fun-ui-redesign-preview-20261123'
$Issues=New-Object 'System.Collections.Generic.List[string]'
$Results=New-Object 'System.Collections.Generic.List[string]'
function Hold([string]$reason){throw ('FUN_EVERYTHING_HOLD='+$reason)}
function ScriptFile([string]$path){
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('SCRIPT_MISSING='+$path)}
 if(((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SCRIPT_SYMLINK_REFUSED='+$path)
 }
}
function PortOwner([int]$port){
 return @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}
function Json([string]$url,[int]$seconds=5){
 try{return Invoke-RestMethod -Uri $url -TimeoutSec $seconds -ErrorAction Stop}catch{return $null}
}
function QwenReady(){
 $p=@(PortOwner 8088)
 if($p.Count -ne 1 -or $p[0].LocalAddress -cne '127.0.0.1'){return $false}
 $s=Json 'http://127.0.0.1:8088/health'
 return $null -ne $s -and $s.status -ceq 'ok'
}
function CoreReady(){
 if(!(QwenReady)){return $false}
 $ports=@(8791,8789,8796,8797,8798)
 foreach($port in $ports){
  $listeners=@(PortOwner $port)
  if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -cne '127.0.0.1'){return $false}
 }
 $compute=Json 'http://127.0.0.1:8791/health'
 $tools=Json 'http://127.0.0.1:8789/api/ai/tools'
 $auto=Json 'http://127.0.0.1:8796/api/ai/auto-local/status'
 $rea=Json 'http://127.0.0.1:8797/api/rea229/status'
 $unified=Json 'http://127.0.0.1:8798/api/unified/status'
 return ($null -ne $compute -and $compute.state -ceq 'running' -and
  $null -ne $tools -and $tools.local_tool_count -eq 19 -and
  $null -ne $auto -and $auto.reaExecutionGrants -eq 0 -and
  $null -ne $rea -and $rea.realReaToolCount -eq 229 -and
  $null -ne $unified -and $unified.state -ceq 'ready')
}
function MLReady(){
 $s=Json 'http://127.0.0.1:8801/api/ml/status'
 $l=@(PortOwner 8801)
 return $null -ne $s -and $s.version -ceq 'fun-qwen-scikit-v2' -and
  $s.pythonInstalled -eq $true -and $s.reaExecutionGrants -eq 0 -and
  $l.Count -eq 1 -and $l[0].LocalAddress -ceq '127.0.0.1'
}
function PreviewReady(){
 $d=Json 'http://127.0.0.1:8802/api/fun/math/v3/status'
 $h=$null
 try{$h=Invoke-WebRequest 'http://127.0.0.1:8802/ui-preview/' -UseBasicParsing -TimeoutSec 6}catch{}
 if(!$h){return $false}
 return ($h.StatusCode -eq 200 -and
  $h.Headers['x-fi-preview-version'] -ceq 'fun-industrial-organized-ui-preview-v1' -and
  $h.Content -match 'data-view="chat"' -and
  $null -ne $d -and $d.ready -eq $true -and
  $d.modelCanExecute -eq $false)
}
function GatewayReady(){
 $l=@(Get-NetTCPConnection -State Listen -LocalPort 8443 -ErrorAction SilentlyContinue)
 return $l.Count -gt 0
}
function RunStep([string]$name,[string]$file,[string[]]$stepArgs){
 try{
  ScriptFile $file
  Write-Host ('FUN_EVERYTHING_STARTING='+$name)
  $parameters=@('-NoProfile','-ExecutionPolicy','Bypass','-File',$file)+$stepArgs
  & powershell.exe @parameters
  if($LASTEXITCODE -ne 0){throw ('STEP_EXIT_'+$LASTEXITCODE)}
  Write-Host ('FUN_EVERYTHING_STEP_'+$name+'=PASS')
 }catch{
  $message=[string]$_.Exception.Message
  $Issues.Add($name+': '+$message)
  Write-Warning ('FUN_EVERYTHING_STEP_'+$name+'=HOLD '+$message)
 }
}
$remote=(& git.exe -C $Root remote get-url origin|Out-String).Trim()
$actual=(& git.exe -C $Root branch --show-current|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $remote -cne $Repo -or $actual -cne $Branch){
 Hold 'ORGANIZED_PREVIEW_SOURCE_IDENTITY_UNVERIFIED'
}
ScriptFile $PreviewStart
if($CheckOnly){
 Write-Host ('FUN_CORE_READY='+[bool](CoreReady))
 Write-Host ('FUN_ML_READY='+[bool](MLReady))
 Write-Host ('FUN_ORGANIZED_PREVIEW_READY='+[bool](PreviewReady))
 Write-Host ('FUN_PRIVATE_GATEWAY_LISTENING='+[bool](GatewayReady))
 Write-Host 'FUN_CHECK_ONLY=TRUE NO_PROCESSES_STARTED'
 return
}
if(CoreReady){
 Write-Host 'FUN_CORE=ADOPTED_EXISTING_QWEN_REA_COMPUTE'
}else{
 RunStep 'CORE' $CoreStart @('-SkipPrivateGateway')
}
if(MLReady){
 Write-Host 'FUN_ML_8801=ADOPTED_EXISTING'
}else{
 RunStep 'ML_8801' $MLStart @()
}
if(PreviewReady){
 Write-Host 'FUN_ORGANIZED_8802=ADOPTED_EXISTING'
}else{
 RunStep 'ORGANIZED_8802' $PreviewStart @()
}
if($SkipPrivateGateway){
 Write-Host 'FUN_PRIVATE_GATEWAY_8443=SKIPPED_BY_OPERATOR'
}elseif(GatewayReady){
 # Verify the peer/certificate and process identity with the existing reviewed gateway helper.
 RunStep 'PRIVATE_GATEWAY_8443' $GatewayStart @()
}else{
 RunStep 'PRIVATE_GATEWAY_8443' $GatewayStart @()
}
$coreOk=CoreReady
$mlOk=MLReady
$previewOk=PreviewReady
$qwenOk=QwenReady
$gatewayOk=GatewayReady
$checks=@(
 @{Name='CORE';Ready=$coreOk},
 @{Name='QWEN_8088';Ready=$qwenOk},
 @{Name='ML_8801';Ready=$mlOk},
 @{Name='ORGANIZED_8802';Ready=$previewOk}
)
foreach($check in $checks){
 $state=if($check.Ready){'READY'}else{'HOLD'}
 Write-Host ('FUN_'+$check.Name+'='+$state)
 if(!$check.Ready){$Issues.Add($check.Name+' not verified')}
}
foreach($version in @('V1','V2','V3')){
 $name='FunIndustrial-MathResearch'+$version+'-Daily'
 $task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
 $data=Join-Path $env:LOCALAPPDATA ('FunIndustrial\MathResearch'+$version+'\latest_report.json')
 if($task -and $task.State -ne 'Disabled' -and (Test-Path -LiteralPath $data -PathType Leaf)){
  Write-Host ('FUN_MATH_'+$version+'=SCHEDULED_AND_REPORT_PRESENT')
 }elseif($task -and $task.State -ne 'Disabled'){
  Write-Host ('FUN_MATH_'+$version+'=SCHEDULED_REPORT_NOT_VERIFIED')
  $Issues.Add('Math '+$version+' report missing')
 }else{
  Write-Host ('FUN_MATH_'+$version+'=SCHEDULE_MISSING_OR_DISABLED')
  $Issues.Add('Math '+$version+' daily task missing')
 }
}
if(!$SkipPrivateGateway){
 Write-Host ('FUN_PRIVATE_GATEWAY_8443='+$(if($gatewayOk){'LISTENING'}else{'NOT_VERIFIED'}))
 if(!$gatewayOk){$Issues.Add('Private gateway 8443 unavailable')}
}
Write-Host 'FUN_ELEKTRON=UNTOUCHED'
Write-Host 'FUN_TOOL_EXECUTION=NOT_AUTHORIZED_BY_STARTUP'
Write-Host 'FUN_DASHBOARD=http://127.0.0.1:8802/'
Write-Host 'FUN_ORGANIZED_UI=http://127.0.0.1:8802/ui-preview/'
Write-Host 'FUN_CHAT=http://127.0.0.1:8802/ui-preview/#chat'
Write-Host 'FUN_RESEARCH=http://127.0.0.1:8802/math/v3/'
if($Issues.Count -eq 0){Write-Host 'FUN_INDUSTRIAL_EVERYTHING=PASS'}
else{
 Write-Warning ('FUN_INDUSTRIAL_EVERYTHING=PARTIAL CHECKS='+$Issues.Count)
 foreach($item in $Issues){Write-Warning ('FUN_START_NOTE='+$item)}
 throw ('FUN_INDUSTRIAL_EVERYTHING_PARTIAL_COMPONENTS='+$Issues.Count)
}
