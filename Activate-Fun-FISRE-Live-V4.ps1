# FUN_FISRE_LIVE_V4_8802_ACTIVATION
# Operator-initiated deployment: replace ONLY known 8802 Node dashboard.
# Never touches protected services, Elektron, REA authority, or Qwen.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$OldRoot=Join-Path $HOME 'FunIndustrial-SpatialUX-V2'
$Branch='feature/fun-fisre-live-8802-20261122'
$OldBranch='feature/fun-oneport-spatial-ux-v2-20261115'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$NewRunner=Join-Path $Root 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$OldRunner=Join-Path $OldRoot 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$Url='http://127.0.0.1:8802'
$Protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8803,8804,8805,8806,8443)
$Before=@{}
$OldStopped=$false
$NewChild=$null
$OriginalPid=0
$Log=Join-Path $env:LOCALAPPDATA ('FunIndustrial\FISRELiveV4\logs\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,7))
function Hold([string]$message){throw ('FUN_FISRE_DEPLOY_HOLD='+$message)}
function Leaf([string]$path){
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('FILE_MISSING='+$path)}
 if((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint){
  Hold ('FILE_LINK_DENIED='+$path)
 }
}
function VerifyCheckout([string]$dir,[string]$expected){
 if(!(Test-Path -LiteralPath (Join-Path $dir '.git'))){Hold ('CHECKOUT_MISSING='+$dir)}
 $remote=(& git.exe -C $dir remote get-url origin|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $remote -cne $Origin){Hold ('SOURCE_REMOTE_CHANGED='+$dir)}
 $active=(& git.exe -C $dir branch --show-current|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $active -cne $expected){Hold ('SOURCE_BRANCH_CHANGED='+$dir)}
 $dirty=@(& git.exe -C $dir status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold ('SOURCE_DIRTY='+$dir)}
}
function Listeners([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$port){
 return (@(Listeners $port|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
function Owner([int]$port){
 $all=@(Listeners $port)
 if($all.Count -eq 0){return $null}
 if($all.Count -ne 1 -or $all[0].LocalAddress -cne '127.0.0.1'){Hold ('UNEXPECTED_LISTENER_'+$port)}
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$all[0].OwningProcess) -ErrorAction Stop
 if(!$p -or $p.Name -cne 'node.exe' -or [string]::IsNullOrWhiteSpace([string]$p.CommandLine)){
  Hold ('PROCESS_IDENTITY_UNVERIFIED_'+$port)
 }
 return $p
}
function ProtectedUnchanged(){
 foreach($p in $Protected){
  if((Snapshot $p) -cne [string]$Before[$p]){Hold ('PROTECTED_LISTENER_CHANGED_'+$p)}
 }
}
function LiveNew(){
 $owner=Owner 8802
 if(!$owner -or [string]$owner.CommandLine -notmatch [regex]::Escape($NewRunner)){
  Hold 'NEW_8802_PROCESS_OWNER_UNKNOWN'
 }
 $response=Invoke-WebRequest ($Url+'/') -UseBasicParsing -TimeoutSec 8
 $page=Invoke-WebRequest ($Url+'/fisre/') -UseBasicParsing -TimeoutSec 8
 $directChat=Invoke-WebRequest ($Url+'/chat/') -UseBasicParsing -TimeoutSec 8
 $grounded=Invoke-RestMethod ($Url+'/api/fial/grounded/status') -TimeoutSec 8
 $inventory=Invoke-RestMethod ($Url+'/api/fun/capabilities/status') -TimeoutSec 8
 $reaDispatch=Invoke-RestMethod ($Url+'/api/fun/rea/dispatch/status') -TimeoutSec 8
 $client=Invoke-WebRequest ($Url+'/api/fisre/client.js') -UseBasicParsing -TimeoutSec 8
 $status=Invoke-RestMethod ($Url+'/api/fisre/status') -TimeoutSec 8
 # FISRE and the dashboard shell are local 8802 routes. Existing ML and chat
 # statuses may legitimately return 502 when their independent worker is down.
 # Their health must not block installation of a separate, read-only module.
 if($response.StatusCode -ne 200 -or
  $response.Headers['x-fi-dashboard-version'] -cne 'fun-industrial-one-port-spatial-ux-v2' -or
  $response.Content -notmatch 'data-section="reasoning"' -or
  $response.Content -notmatch 'data-section="chat"' -or
  $response.Content -notmatch 'data-section="procurement"' -or
  $page.StatusCode -ne 200 -or $page.Content -notmatch 'id="fi-form"' -or
  $directChat.StatusCode -ne 200 -or
  $directChat.Content -notmatch 'id="fi-fial53-grounded"' -or
  $directChat.Content -notmatch 'id="fi-fial53-code"' -or
  $directChat.Content -notmatch 'id="fi-fial53-rea-panel"' -or
  $grounded.model_interface -cne 'fixed_local_qwen_8088' -or
  $grounded.authority_added -ne $false -or
  $grounded.capability_fabric_version -cne 'fun-ai-capability-fabric-v1' -or
  $inventory.version -cne 'fun-ai-capability-fabric-v1' -or
  @($inventory.domains).Count -ne 12 -or
  $inventory.permissionsUnchanged -ne $true -or
  $reaDispatch.version -cne 'fun-ai-reviewed-rea-dispatch-v1' -or
  $reaDispatch.operatorApprovalRequired -ne $true -or
  $reaDispatch.modelCanExecute -ne $false -or
  @($reaDispatch.approvedTools).Count -ne 2 -or
  $client.StatusCode -ne 200 -or $client.Content -notmatch 'operator-click' -or
  $status.version -cne 'fun-fisre-live-v4' -or
  $status.state -cne 'available_operator_click_only' -or
  $status.toolAuthorityAdded -ne $false -or
  $status.newListener -ne $false -or
  $status.chatCodeReasoning -ne $true -or
  $status.qwenChatIntegration -cne 'same_8802_grounded_8088_with_fisre_evidence'){
  Hold 'NEW_8802_HEALTH_OR_AUTHORITY_INVALID'
 }
}
function ReportUpstreamStatus(){
 # Observational only: do not call /api/start, POST prompts, restart workers,
 # or fail an otherwise healthy FISRE deployment for unrelated 502 responses.
 foreach($p in @('/api/fun/hub/status','/api/unified/status')){
  try{
   $up=Invoke-RestMethod ($Url+$p) -TimeoutSec 5 -ErrorAction Stop
   if($up.state -ceq 'ready'){
    Write-Host ('FUN_FISRE_DEPENDENCY='+$p+' STATE=READY')
   }else{
    Write-Warning ('FUN_FISRE_DEPENDENCY='+$p+' STATE=DEGRADED_RETURNED_STATUS')
   }
  }catch{
   Write-Warning ('FUN_FISRE_DEPENDENCY='+$p+' STATE=DEGRADED_HTTP_ONLY NO_RESTART')
  }
 }
}
function StartDashboard([string]$file,[string]$directory,[string]$label){
 $out=Join-Path $Log ($label+'.stdout.log')
 $err=Join-Path $Log ($label+'.stderr.log')
 return Start-Process -FilePath $Node -ArgumentList ('"'+$file+'" --serve') -WorkingDirectory $directory -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
}
# Fully read-only preflight before any process termination.
VerifyCheckout $Root $Branch
VerifyCheckout $OldRoot $OldBranch
Leaf $NewRunner;Leaf $OldRunner
foreach($p in @(
 'src\semantic\fisre_v1.py',
 'src\semantic\fisre_proof_v2.py',
 'src\semantic\fisre_source_v4.py',
 'src\semantic\fisre-live-bridge-v4.mjs',
 'src\intelligence\operator-reviewed-dispatch-v1.mjs',
 'src\intelligence\capability-fabric-v1.mjs',
 'src\ui\fisre-qwen-chat-v4.mjs',
 'src\cognition\fisre-evidence-v3.mjs',
 'src\ui\fisre-workspace-v4.mjs',
 'src\ui\fisre-workspace-v4.js',
 'scripts\Run-Fun-FISRE-Live-V4.py'
)){Leaf (Join-Path $Root $p)}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
Leaf $Node
$Py=(Get-Command py.exe -ErrorAction Stop).Source
Leaf $Py
& $Py -3.12 -c 'import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else 1)'
if($LASTEXITCODE -ne 0){Hold 'PYTHON_312_NOT_AVAILABLE'}
& $Node --check $NewRunner
if($LASTEXITCODE -ne 0){Hold 'DASHBOARD_SYNTAX_INVALID'}
& $Node --check (Join-Path $Root 'src\semantic\fisre-live-bridge-v4.mjs')
if($LASTEXITCODE -ne 0){Hold 'FISRE_BRIDGE_SYNTAX_INVALID'}
foreach($p in $Protected){$Before[$p]=Snapshot $p}
$original=Owner 8802
if($original){
 $OriginalPid=[int]$original.ProcessId
 $oldOwner=([string]$original.CommandLine).IndexOf($OldRunner,[StringComparison]::OrdinalIgnoreCase) -ge 0
 $newOwner=([string]$original.CommandLine).IndexOf($NewRunner,[StringComparison]::OrdinalIgnoreCase) -ge 0
 if(!$oldOwner -and !$newOwner){Hold '8802_OWNER_NOT_REVIEWED'}
 if($newOwner){
  # Adopt an already healthy integrated chat; otherwise replace only 8802.
  $currentReady=$false
  try{LiveNew;ProtectedUnchanged;$currentReady=$true}catch{}
  if($currentReady){
   ReportUpstreamStatus
   Write-Host 'FUN_FISRE_LIVE_V4=PASS ADOPTED_INTEGRATED_8802=TRUE'
   Write-Host ('FUN_FISRE_URL='+$Url+'/#chat')
   Write-Host 'FUN_QWEN_FISRE_CHAT=UNIFIED_8802_DIRECT_8088'
 Write-Host 'FUN_QWEN_CAPABILITY_FABRIC=12_DOMAINS_READONLY_ROUTING'
 Write-Host 'FUN_REA_DISPATCH=EXACT_READONLY_PREPARE_CONFIRM_SEPARATE_CLICKS'
   return
  }
  Write-Host 'FUN_FISRE_EXISTING_8802=UPGRADING_SAME_KNOWN_PROCESS'
 }
}
# Do not run broad scripts or touch unrelated services during the handoff.
New-Item -ItemType Directory -Path $Log -Force|Out-Null
try{
 if($original){
  Write-Host ('FUN_FISRE_OLD_8802_PID='+$OriginalPid)
  Stop-Process -Id $OriginalPid -ErrorAction Stop
  $OldStopped=$true
  for($i=0;$i -lt 90;$i++){
   if(@(Listeners 8802).Count -eq 0){break}
   Start-Sleep -Milliseconds 200
  }
  if(@(Listeners 8802).Count -ne 0){Hold '8802_OLD_OWNER_NOT_RELEASED'}
 }
 ProtectedUnchanged
 $NewChild=StartDashboard $NewRunner $Root 'new-8802'
 $ready=$false
 $last='No response'
 for($i=0;$i -lt 110;$i++){
  Start-Sleep -Milliseconds 250
  try{
   $now=Owner 8802
   if(!$now -or [int]$now.ProcessId -ne [int]$NewChild.Id){continue}
   LiveNew
   $ready=$true
   break
  }catch{$last=[string]$_.Exception.Message}
 }
 if(!$ready){Hold ('8802_START_FAILED_'+$last)}
 ProtectedUnchanged
 ReportUpstreamStatus
 Write-Host 'FUN_FISRE_LIVE_V4=PASS'
 Write-Host ('FUN_FISRE_URL='+$Url+'/#chat')
 Write-Host 'FUN_FISRE_SOURCE_ANALYSIS=ACTIVE_ON_OPERATOR_CLICK'
 Write-Host 'FUN_QWEN_FISRE_CHAT=UNIFIED_8802_DIRECT_8088'
 Write-Host 'FUN_QWEN_CAPABILITY_FABRIC=12_DOMAINS_READONLY_ROUTING'
 Write-Host 'FUN_REA_DISPATCH=EXACT_READONLY_PREPARE_CONFIRM_SEPARATE_CLICKS'
 Write-Host 'FUN_FISRE_PROOF=BOUNDED_RATIONAL_WITH_SOURCE_REPLAY'
 Write-Host 'FUN_FISRE_COGNITION=PROPOSED_ONLY'
 Write-Host 'FUN_FISRE_TOOL_AUTHORITY=UNCHANGED'
 Write-Host 'FUN_FISRE_OTHER_SERVICES=UNTOUCHED'
 Write-Host ('FUN_FISRE_LOGS='+$Log)
}catch{
 $message=[string]$_.Exception.Message
 if($NewChild){
  try{
   $owner=Owner 8802
   if($owner -and [int]$owner.ProcessId -eq [int]$NewChild.Id -and
      [string]$owner.CommandLine -match [regex]::Escape($NewRunner)){
    Stop-Process -Id $NewChild.Id -ErrorAction Stop
   }
  }catch{Write-Warning ('FUN_FISRE_NEW_8802_CLEANUP_HOLD='+$_.Exception.Message)}
 }
 if($OldStopped){
  for($i=0;$i -lt 80;$i++){
   if(@(Listeners 8802).Count -eq 0){break}
   Start-Sleep -Milliseconds 200
  }
  if(@(Listeners 8802).Count -ne 0){Hold ('ROLLBACK_PORT_OCCUPIED_ORIGINAL_'+$message)}
  try{
   $rollback=StartDashboard $OldRunner $OldRoot 'rollback-original-8802'
   $restored=$false
   for($i=0;$i -lt 110;$i++){
    Start-Sleep -Milliseconds 250
    try{
     $p=Owner 8802
     if(!$p -or [int]$p.ProcessId -ne [int]$rollback.Id){continue}
     $h=Invoke-RestMethod ($Url+'/api/fun/hub/status') -TimeoutSec 6
     if($h.state -ceq 'ready'){$restored=$true;break}
    }catch{}
   }
   if(!$restored){Hold ('ROLLBACK_FAILED_ORIGINAL_'+$message)}
   Write-Warning 'FUN_FISRE_ROLLBACK=PREVIOUS_SPATIAL_8802_RESTORED'
  }catch{Hold ('ROLLBACK_FAILED_MANUAL_REVIEW='+$_.Exception.Message+' ORIGINAL='+$message)}
 }
 throw ('FUN_FISRE_LIVE_DEPLOYMENT_HOLD='+$message)
}
