# FIAL 5.3: guarded primary 8802 dashboard swap, original source untouched.
# The old 8802 service is the only process allowed to be replaced; rollback restores it.
# All Qwen, Cognee, 8789, 8798, REA, FIAL and Elektron listeners are preserved.
[CmdletBinding()]param([switch]$VerifyLive)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$OldRoot=Join-Path $HOME 'FunIndustrial-MLHub-V3'
$Branch='feature/fial5-3-primary-dashboard-grounded-chat-20261114'
$OldBranch='feature/fun-ml-unified-dashboard-v3-20261113'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$OldBlob='9756e3a8092308094a101912129344ec0ca64cd2'
$Runner=Join-Path $Root 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$OldRunner=Join-Path $OldRoot 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$Url='http://127.0.0.1:8802'
$OriginalState='not_checked'
$OldStopped=$false
$NewChild=$null
$OriginalPid=0
$Log=Join-Path $env:LOCALAPPDATA ('FunIndustrial\FIAL53PrimaryDashboard\logs\'+
 (Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,7))
function Hold([string]$why){throw ('FIAL53_PRIMARY_HUB_HOLD='+$why)}
function Listeners([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$port){
 return (@(Listeners $port|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
function CheckSource([string]$root,[string]$branch){
 if(!(Test-Path -LiteralPath $root -PathType Container)){Hold ('CHECKOUT_MISSING='+$root)}
 $origin=(& git.exe -C $root remote get-url origin | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $origin -cne $Origin){Hold ('REPO_IDENTITY_CHANGED='+$root)}
 $active=(& git.exe -C $root branch --show-current | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $active -cne $branch){Hold ('REPO_BRANCH_CHANGED='+$root)}
 $dirty=@(& git.exe -C $root status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold ('REPO_WORKTREE_DIRTY='+$root)}
}
function Leaf([string]$file){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('SOURCE_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SOURCE_SYMLINK_REJECTED='+$file)
 }
}
function Owner([int]$port){
 $l=@(Listeners $port)
 if($l.Count -ne 1 -or $l[0].LocalAddress -cne '127.0.0.1'){Hold ('UNVERIFIED_LISTENER_'+$port)}
 $pidFound=[int]$l[0].OwningProcess
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$pidFound) -ErrorAction Stop
 if(!$p -or $p.Name -cne 'node.exe' -or [string]::IsNullOrWhiteSpace([string]$p.CommandLine)){
  Hold ('UNVERIFIED_NODE_PROCESS_'+$port)
 }
 return $p
}
function GetJson([string]$path){
 return Invoke-RestMethod ($Url+$path) -TimeoutSec 12 -ErrorAction Stop
}
function ReadyNew([int]$pid){
 $p=Owner 8802
 if([int]$p.ProcessId -ne $pid -or
  [string]$p.CommandLine -notmatch [regex]::Escape($Runner)){Hold 'NEW_8802_OWNER_DRIFT'}
 $status=GetJson '/api/fun/hub/status'
 $model=GetJson '/api/ml/dashboard/status'
 $chat=GetJson '/api/fial/grounded/status'
 $commerce=GetJson '/api/commerce/status'
 $unified=GetJson '/api/unified/status'
 if($status.version -cne 'fi-ml-hub-v3' -or $model.state -cne 'ready' -or
  $chat.version -cne 'fial5.3-primary-grounded-chat-v1' -or
  $chat.model_interface -cne 'fixed_local_qwen_8088' -or
  $chat.memory_interface -cne 'fixed_readonly_cognee_8789' -or
  $chat.authority_added -ne $false -or $chat.tool_executions -ne 0 -or
  $null -eq $commerce.version -or $unified.state -cne 'ready'){
  Hold 'NEW_DASHBOARD_HEALTH_OR_POLICY_MISMATCH'
 }
 $page=Invoke-WebRequest ($Url+'/unified/?view=chat') -UseBasicParsing -TimeoutSec 14
 $home=Invoke-WebRequest ($Url+'/') -UseBasicParsing -TimeoutSec 14
 $script=Invoke-WebRequest ($Url+'/api/fial/grounded/client.js') -UseBasicParsing -TimeoutSec 14
 if($page.StatusCode -ne 200 -or $home.StatusCode -ne 200 -or
  $page.Content -notmatch 'id="fi-fial53-grounded"' -or
  $page.Content -notmatch 'id="action-review"' -or
  $page.Content -notmatch 'fi-ml-panel' -or $page.Content -notmatch 'fi-commerce-panel' -or
  $home.Content -notmatch 'fi-ui-shell' -or
  $script.Content -notmatch 'x-fi-chat-click' -or $script.Content -match 'innerHTML'){
  Hold 'NEW_PRIMARY_DASHBOARD_UI_OR_LEGACY_CONTROLS_MISSING'
 }
 if($script.Content -notmatch 'textContent'){Hold 'CHAT_OUTPUT_ESCAPING_NOT_VERIFIED'}
 if($script.Content -match 'eval\('){Hold 'CHAT_UNTRUSTED_EVAL_REFUSED'}
 if($OldCommerceShopifyConfigured -and $commerce.shopify.configured -ne $true){
  Hold 'SHOPIFY_PREEXISTING_CONFIGURATION_NOT_PRESERVED'
 }
}
function StartNode([string]$path,[string]$root,[string]$prefix){
 $out=Join-Path $Log ($prefix+'.stdout.log')
 $err=Join-Path $Log ($prefix+'.stderr.log')
 return Start-Process -FilePath $Node -ArgumentList ('"'+$path+'" --serve') -WorkingDirectory $root -PassThru -ErrorAction Stop -RedirectStandardOutput $out -RedirectStandardError $err
}
function CheckProtected(){
 foreach($p in $Protected){
  if((Snapshot $p) -cne $Before[$p]){Hold ('PROTECTED_PROCESS_CHANGED_PORT_'+$p)}
 }
}
# Everything before the process swap is read-only.
CheckSource $Root $Branch
CheckSource $OldRoot $OldBranch
Leaf $Runner;Leaf $OldRunner
$hash=(& git.exe -C $OldRoot hash-object --path=scripts/Run-Fun-ML-Dashboard8802.mjs -- $OldRunner | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $hash -cne $OldBlob){Hold 'OLD_DASHBOARD_SOURCE_NOT_REVIEWED'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($file in @(
 'scripts\Run-Fun-ML-Dashboard8802.mjs',
 'src\fial\grounded-chat-v5-2.mjs',
 'src\fial\primary-grounded-ui-v5-3.mjs',
 'src\fial\primary-grounded-client-v5-3.js',
 'src\ui\integrated-hub-v1.js',
 'intelligence-checks\fial-primary-dashboard-chat-v5-3-case.mjs')){
 $f=Join-Path $Root $file;Leaf $f
 & $Node --check $f
 if($LASTEXITCODE -ne 0){Hold ('NEW_SOURCE_SYNTAX_HOLD='+$file)}
}
$tests=@(
 'intelligence-checks\fial-primary-dashboard-chat-v5-3-case.mjs',
 'intelligence-checks\fi-ml-hub-v3-case.mjs',
 'intelligence-checks\integrated-hub-ui-v1-case.mjs',
 'intelligence-checks\fial-grounded-qwen-v5-2-case.mjs',
 'intelligence-checks\commerce-opportunities-v1-1-case.mjs',
 'intelligence-checks\google-trends-focus-v1-2-case.mjs')
& $Node --test ($tests|ForEach-Object {Join-Path $Root $_})
if($LASTEXITCODE -ne 0){Hold 'PRIMARY_DASHBOARD_TESTS_FAILED_BEFORE_REPLACEMENT'}
Write-Host 'FIAL53_PRIMARY_DASHBOARD_TESTS=PASS'
$q=Invoke-RestMethod 'http://127.0.0.1:8088/health' -TimeoutSec 8 -ErrorAction Stop
if($q.status -cne 'ok'){Hold 'EXISTING_QWEN_UNHEALTHY'}
$mem=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/automatic-memory/status' -TimeoutSec 10 -ErrorAction Stop
if($mem.memoryAvailable -ne $true -or $mem.memoryWrites -ne $false -or
 $mem.mode -cne 'automatic_contextual_read_only'){Hold 'EXISTING_COGNEE_READ_ONLY_POLICY_HOLD'}
$parent=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 9 -ErrorAction Stop
$ml=Invoke-RestMethod 'http://127.0.0.1:8801/api/ml/status' -TimeoutSec 9 -ErrorAction Stop
# 8798 exposes a .state, but 8801 returns the independent ML status contract
# without .state. Require identity + installed Python + unchanged authority instead.
if($parent.version -cne 'fi-unified-task-chat-8798-v1' -or
 $parent.state -cne 'ready' -or
 $ml.version -cne 'fun-qwen-scikit-v2' -or
 $ml.pythonInstalled -ne $true -or
 $ml.reaExecutionGrants -ne 0 -or
 $ml.externalActions -ne 0){Hold 'PRIMARY_DEPENDENCIES_NOT_READY_OR_IDENTITY_MISMATCH'}
Write-Host 'FIAL53_8798_STATUS=READY FIAL53_8801_ML_STATUS=VERIFIED_REAL_SCHEMA'
$oldStatus=GetJson '/api/fun/hub/status'
$oldCommerce=GetJson '/api/commerce/status'
$OldCommerceShopifyConfigured=$oldCommerce.shopify.configured -eq $true
if($oldStatus.version -cne 'fi-ml-hub-v3' -or $oldStatus.machineLearning.state -cne 'ready'){
 Hold 'OLD_PRIMARY_DASHBOARD_UNVERIFIED'
}
$Protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8803,8804,8805,8806,8443)
$Before=@{}
foreach($p in $Protected){$Before[$p]=Snapshot $p}
$proc=Owner 8802
$command=[string]$proc.CommandLine
$runningNew=$command.IndexOf($Runner,[StringComparison]::OrdinalIgnoreCase) -ge 0
$runningOld=$command.IndexOf($OldRunner,[StringComparison]::OrdinalIgnoreCase) -ge 0
if(!$runningOld -and !$runningNew){Hold '8802_PROCESS_OWNER_UNKNOWN_NO_RESTART'}
$OriginalPid=[int]$proc.ProcessId
Write-Host ('FIAL53_ORIGINAL_8802_OWNER='+$OriginalPid+' SOURCE='+$(if($runningOld){'REVIEWED_OLD'}else{'EXISTING_FIAL53'}))
New-Item -ItemType Directory -Path $Log -Force | Out-Null
try{
 if($runningOld){
  Write-Host 'FIAL53_STARTING_CONTROLLED_8802_HANDOFF=TRUE'
  Stop-Process -Id $OriginalPid -ErrorAction Stop
  $OldStopped=$true
  for($i=0;$i -lt 80;$i++){
   if(!(Listeners 8802).Count){break}
   Start-Sleep -Milliseconds 250
  }
  if((Listeners 8802).Count){Hold 'OLD_8802_DID_NOT_RELEASE_PORT'}
  $NewChild=StartNode $Runner $Root 'new-8802'
  $ready=$false
  for($i=0;$i -lt 100;$i++){
   Start-Sleep -Milliseconds 250
   try{
    $listener=@(Listeners 8802)
    if($listener.Count -ne 1 -or [int]$listener[0].OwningProcess -ne [int]$NewChild.Id){continue}
    ReadyNew $NewChild.Id
    $ready=$true;break
   }catch{}
  }
  if(!$ready){Hold 'UPGRADED_8802_NOT_READY'}
  Write-Host ('FIAL53_UPGRADED_PRIMARY_8802_PID='+$NewChild.Id)
 }else{
  ReadyNew $OriginalPid
  Write-Host ('FIAL53_EXISTING_PRIMARY_8802_ADOPTED_PID='+$OriginalPid)
 }
 CheckProtected
 if($VerifyLive){
  $payload=@{question='What approval is required before external tool execution at Fun Industrial?'}|ConvertTo-Json -Compress
  $result=Invoke-RestMethod ($Url+'/api/fial/grounded/chat') -Method POST -ContentType 'application/json' -Headers @{Origin=$Url;'x-fi-chat-click'='one-local-model-response'} -Body $payload -TimeoutSec 365 -ErrorAction Stop
  Write-Host ('FIAL53_LIVE_STATE='+$result.state)
  Write-Host ('FIAL53_MEMORY_STATE='+$result.memory_state+' EXCERPTS='+$result.memory_excerpts_included)
  Write-Host ('FIAL53_QWEN_ANSWER='+$result.answer)
  if($result.state -cne 'ANSWERED_BY_QWEN' -or
   $result.memory_state -cne 'included' -or [int]$result.memory_excerpts_included -lt 1 -or
   $result.source -cne 'qwen_local' -or $result.tool_executions -ne 0 -or
   $result.rea_executions -ne 0 -or
   [string]$result.answer -notmatch 'operator approval'){
    Hold 'LIVE_PRIMARY_GROUNDED_QWEN_NOT_QUALIFIED_NO_AUTOMATIC_RETRY'
  }
  Write-Host 'FIAL53_PRIMARY_CHAT_LIVE_QUALITY=PASS'
 }else{Write-Host 'FIAL53_PRIMARY_CHAT_LIVE_QUALITY=NOT_TESTED'}
 CheckProtected
 Write-Host 'FIAL53_PRIMARY_DASHBOARD_CONSOLIDATION=PASS'
 Write-Host ('FIAL53_PRIMARY_DASHBOARD='+$Url+'/unified/?view=chat')
 Write-Host 'FIAL53_TOOLS_AND_REA_APPROVAL_UI=PRESERVED'
 Write-Host 'FIAL53_OTHER_SERVICES_RESTARTED=0 ELEKTRON=UNTOUCHED'
 Write-Host ('FIAL53_DEPLOYMENT_LOGS='+$Log)
}catch{
 $why=$_.Exception.Message
 if($OldStopped){
  Write-Warning ('FIAL53_NEW_DASHBOARD_HOLD='+$why+' ROLLBACK_OLD_8802_REQUESTED')
  if($NewChild){
   $newP=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$NewChild.Id) -ErrorAction SilentlyContinue
   if($newP -and $newP.Name -ceq 'node.exe' -and
    [string]$newP.CommandLine -match [regex]::Escape($Runner)){
    Stop-Process -Id $NewChild.Id -ErrorAction SilentlyContinue
   }
  }
  $released=$false
  for($i=0;$i -lt 80;$i++){
   if(!(Listeners 8802).Count){$released=$true;break}
   Start-Sleep -Milliseconds 250
  }
  if(!$released){Hold ('ROLLBACK_8802_PORT_OCCUPIED='+$why)}
  try{
   $restore=StartNode $OldRunner $OldRoot 'rollback-8802'
   $restored=$false
   for($i=0;$i -lt 100;$i++){
    Start-Sleep -Milliseconds 250
    try{
     $l=@(Listeners 8802)
     if($l.Count -ne 1 -or [int]$l[0].OwningProcess -ne [int]$restore.Id){continue}
     $old=GetJson '/api/fun/hub/status'
     if($old.version -ceq 'fi-ml-hub-v3' -and $old.machineLearning.state -ceq 'ready'){
      $restored=$true;break
     }
    }catch{}
   }
   if(!$restored){Hold ('ROLLBACK_OLD_DASHBOARD_NOT_CONFIRMED='+$why)}
   Write-Warning ('FIAL53_ROLLBACK_OLD_PRIMARY_DASHBOARD=PASS PID='+$restore.Id)
  }catch{Hold ('ROLLBACK_FAILED_MANUAL_REVIEW='+$_.Exception.Message+' ORIGINAL='+$why)}
 }
 throw ('FIAL53_PRIMARY_DEPLOYMENT_HOLD='+$why)
}
