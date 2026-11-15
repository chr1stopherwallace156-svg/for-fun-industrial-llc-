# FUN_FIAL581_QWEN_ONLY_THEN_DASHBOARD_RECOVERY_V1
# Explicit operator recovery. Start only missing fixed llama.cpp on 8088,
# adopt healthy Qwen if present, then invoke reviewed 8802 handoff.
# No Qwen restart, no new FIAL worker, no REA, no Elektron Ollama 11434.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Branch='repair/fial58-2026-amendment-data-integrity-20261114'
$Llama=Join-Path $HOME 'FunIndustrial\.runtime\llama.cpp\llama-server.exe'
$Model=Join-Path $HOME 'FunIndustrial\.runtime\models\Qwen3-4B-Q4_K_M.gguf'
$Deploy=Join-Path $Root 'Deploy-Fun-FIAL58-PrimaryDashboard.ps1'
$Url='http://127.0.0.1:8088/health'
$OtherPorts=@(11434,8791,8789,8796,8797,8798,8801,8802,8803,8804,8805,8806,8443)
function Hold([string]$why){throw ('FIAL581_QWEN_RECOVERY_HOLD='+$why)}
function Ordinary([string]$file){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('REQUIRED_FILE_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('UNREVIEWED_SYMLINK='+$file)
 }
}
function Listening([int]$port){
 return @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}
function Snapshot([int]$port){
 return (@(Listening $port|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
function QwenHealth(){
 try{
  $r=Invoke-RestMethod -Uri $Url -TimeoutSec 6 -ErrorAction Stop
  return $r.status -ceq 'ok'
 }catch{return $false}
}
function QwenOwner(){
 $listeners=@(Listening 8088)
 if(!$listeners.Count){return $null}
 if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -cne '127.0.0.1'){
  Hold '8088_NOT_EXACTLY_ONE_LOOPBACK_LISTENER'
 }
 $ownerPid=[int]$listeners[0].OwningProcess
 $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$ownerPid) -ErrorAction Stop
 if(!$proc -or $proc.Name -ine 'llama-server.exe' -or
  [string]$proc.ExecutablePath -ine $Llama -or
  [string]$proc.CommandLine -notmatch 'Qwen3-4B-Q4_K_M\.gguf'){
  Hold ('8088_OWNER_UNREVIEWED_PID_'+$ownerPid)
 }
 return $ownerPid
}
$sourceOrigin=(& git.exe -C $Root remote get-url origin|Out-String).Trim()
$sourceBranch=(& git.exe -C $Root branch --show-current|Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $sourceOrigin -cne $Origin -or $sourceBranch -cne $Branch){
 Hold 'SOURCE_IDENTITY_MISMATCH'
}
$changes=@(& git.exe -C $Root status --porcelain=v1 --untracked-files=all)
if($LASTEXITCODE -ne 0 -or $changes.Count){Hold 'SOURCE_WORKTREE_DIRTY'}
foreach($file in @($Deploy,$Llama,$Model)){Ordinary $file}
if((Get-Item -LiteralPath $Model).Length -lt 500MB){Hold 'MODEL_FILE_TOO_SMALL'}
$before=@{}
foreach($port in $OtherPorts){$before[$port]=Snapshot $port}
$existing=QwenOwner
if($null -ne $existing){
 if(!(QwenHealth)){Hold ('EXISTING_8088_UNHEALTHY_DO_NOT_RESTART_PID_'+$existing)}
 Write-Host ('FIAL581_QWEN_8088=HEALTHY_ADOPTED_PID_'+$existing)
}else{
 $others=@(Get-CimInstance Win32_Process -Filter "Name='llama-server.exe'" -ErrorAction Stop)
 foreach($p in $others){
  if(([string]$p.CommandLine).IndexOf('Qwen3-4B-Q4_K_M.gguf',[StringComparison]::OrdinalIgnoreCase) -ge 0){
   Hold ('QWEN_MODEL_ALREADY_RUNNING_WITHOUT_8088_PID_'+$p.ProcessId)
  }
 }
 if($CheckOnly){
  Write-Host 'FIAL581_QWEN_8088=MISSING_FILES_VERIFIED_CHECK_ONLY'
  Write-Host 'FIAL581_NO_PROCESSES_STARTED=TRUE'
  return
 }
 $logs=Join-Path $env:LOCALAPPDATA ('FunIndustrial\FIAL581Qwen8088Recovery\logs\'+
  (Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $args='--model "'+$Model+'" --host 127.0.0.1 --port 8088 --threads 4 --ctx-size 4096 --n-gpu-layers 0 --jinja'
 $child=Start-Process -FilePath $Llama -ArgumentList $args -WorkingDirectory (Split-Path $Llama) -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $logs 'llama.stdout.log') -RedirectStandardError (Join-Path $logs 'llama.stderr.log')
 Write-Host ('FIAL581_QWEN_8088=START_REQUEST_PID_'+$child.Id)
 Write-Host ('FIAL581_QWEN_LOGS='+$logs)
 $ready=$false
 for($i=0;$i -lt 150;$i++){
  Start-Sleep -Milliseconds 600
  $p=QwenOwner
  if($p -and $p -ne $child.Id){Hold ('8088_RACE_UNREVIEWED_OWNER_PID_'+$p)}
  if($p -eq $child.Id -and (QwenHealth)){$ready=$true;break}
  if($child.HasExited){Hold ('QWEN_EXITED_LOGS='+$logs)}
 }
 if(!$ready){Hold ('QWEN_START_NOT_HEALTHY_LOGS='+$logs)}
 Write-Host ('FIAL581_QWEN_8088=STARTED_HEALTHY_PID_'+$child.Id)
}
foreach($port in $OtherPorts){
 if((Snapshot $port) -cne $before[$port]){
  Hold ('UNRELATED_SERVICE_CHANGED_PORT_'+$port)
 }
}
if($CheckOnly){
 Write-Host 'FIAL581_QWEN_CHECK_ONLY=PASS_DASHBOARD_UNCHANGED'
 return
}
function Dependency([string]$name,[string]$uri){
 try{
  $result=Invoke-RestMethod -Uri $uri -TimeoutSec 10 -ErrorAction Stop
  Write-Host ('FIAL581_DEPENDENCY_'+$name+'=RESPONDING')
  return $result
 }catch{
  Hold ('DEPENDENCY_'+$name+'_OFFLINE_NO_AUTOMATIC_RESTART')
 }
}
$mem=Dependency 'COGNEE_8789' 'http://127.0.0.1:8789/api/ai/automatic-memory/status'
if($mem.memoryAvailable -ne $true -or $mem.memoryWrites -ne $false -or
 $mem.mode -cne 'automatic_contextual_read_only'){
 Hold 'COGNEE_8789_POLICY_OR_AVAILABILITY_NOT_VERIFIED'
}
$uni=Dependency 'UNIFIED_8798' 'http://127.0.0.1:8798/api/unified/status'
if($uni.version -cne 'fi-unified-task-chat-8798-v1' -or $uni.state -cne 'ready'){
 Hold 'UNIFIED_8798_NOT_READY'
}
$ml=Dependency 'ML_8801' 'http://127.0.0.1:8801/api/ml/status'
if($ml.version -cne 'fun-qwen-scikit-v2' -or $ml.pythonInstalled -ne $true -or
 $ml.reaExecutionGrants -ne 0 -or $ml.externalActions -ne 0){
 Hold 'ML_8801_NOT_READY_OR_AUTHORITY_INVALID'
}
$Shell=(Get-Command powershell.exe -ErrorAction Stop).Source
Write-Host 'FIAL581_DASHBOARD=INVOKING_REVIEWED_8802_ONLY_DEPLOYMENT'
& $Shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Deploy -VerifyLive
if($LASTEXITCODE -ne 0){
 Hold '8802_REVIEWED_DEPLOYMENT_FAILED_SEE_FIAL581_DASHBOARD_LOGS'
}
$reg=Dependency 'REGULATORY_8802' 'http://127.0.0.1:8802/api/operator/regulatory/status'
if($reg.source_catalog_version -cne 'fial5.8.1-regulatory-catalog-2026-amendment-v1' -or
 $reg.state -cne 'REAL_PUBLIC_DATA_CHECK_COMPLETED' -or
 $reg.authority_update -cne 'ACF_2026_FINAL_AMENDMENT_SUPERSEDES_2027_PURCHASE_RULE' -or
 @($reg.rule_watch|Where-Object {$_.id -ceq 'acf-state-local-purchasing' -and
   $_.effective -ceq '2030-01-01'}).Count -ne 1){
 Hold '8802_REGULATORY_CARB_AMENDMENT_STILL_UNVERIFIED'
}
Write-Host 'FIAL581_QWEN_AND_DASHBOARD_RECOVERY=PASS'
Write-Host 'FIAL581_SCHEDULER=UNCHANGED'
Write-Host 'FIAL581_ELEKTRON_OLLAMA=UNTOUCHED'
Write-Host 'FIAL581_REA_EXTERNAL_ACTIONS=ZERO'
Write-Host 'FIAL581_OPERATIONS=http://127.0.0.1:8802/operations/'
Write-Host 'FIAL581_CHAT=http://127.0.0.1:8802/unified/?view=chat'
