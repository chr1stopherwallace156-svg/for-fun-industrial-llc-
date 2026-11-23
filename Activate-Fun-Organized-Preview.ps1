# Fun Industrial: operator-approved organized UI preview on existing 8802.
# Existing / homepage and AI, research, REA, ML, Elektron services remain unchanged.
# Only known 8802 node dashboard is updated, with rollback of previous instance.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$ExpectedBranch='feature/fun-ui-redesign-preview-20261123'
$TrustedRemote='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Runner=Join-Path $Root 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$URL='http://127.0.0.1:8802'
$Protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8803,8804,8805,8806,8443)
$Before=@{}
$PreviousProcess=$null
$PreviousRunner=$null
$PreviousRoot=$null
$OldStopped=$false
$NewChild=$null
$Logs=Join-Path $env:LOCALAPPDATA ('FunIndustrial\OrganizedUIPreview\logs\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
function Hold([string]$reason){throw ('FUN_UI_PREVIEW_HOLD='+$reason)}
function RequireFile([string]$path){
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('MISSING_FILE='+$path)}
 if(((Get-Item -LiteralPath $path -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('LINK_NOT_ALLOWED='+$path)
 }
}
function VerifyRepo([string]$root,[string[]]$branches){
 if(!(Test-Path -LiteralPath (Join-Path $root '.git'))){Hold ('NOT_GIT_SOURCE='+$root)}
 $remote=(& git.exe -C $root remote get-url origin|Out-String).Trim()
 $ref=(& git.exe -C $root branch --show-current|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $remote -cne $TrustedRemote -or $branches -cnotcontains $ref){
  Hold ('SOURCE_IDENTITY_NOT_REVIEWED='+$root)
 }
 return $ref
}
function Listeners([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$port){
 return (@(Listeners $port|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
function Protect(){
 foreach($port in $Protected){
  if((Snapshot $port) -cne [string]$Before[$port]){Hold ('PROTECTED_PORT_CHANGED='+$port)}
 }
}
function Owner(){
 $set=@(Listeners 8802)
 if($set.Count -eq 0){return $null}
 if($set.Count -ne 1 -or $set[0].LocalAddress -cne '127.0.0.1'){
  Hold '8802_UNEXPECTED_LISTENER'
 }
 $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$set[0].OwningProcess) -ErrorAction Stop
 if(!$proc -or $proc.Name -ine 'node.exe' -or [string]::IsNullOrWhiteSpace([string]$proc.CommandLine)){
  Hold '8802_OWNER_NOT_VERIFIED'
 }
 return $proc
}
function SourceFromCommand([string]$line){
 $pattern='(?i)([A-Z]:\\[^"\r\n]*?\\scripts\\Run-Fun-ML-Dashboard8802\.mjs)'
 $matches=@([regex]::Matches($line,$pattern))
 if($matches.Count -ne 1){Hold '8802_OWNER_SCRIPT_UNRECOGNIZED'}
 $file=[string]$matches[0].Groups[1].Value
 RequireFile $file
 return $file
}
function PreviewLive([string]$ExpectedRunner){
 $owner=Owner
 if(!$owner -or ([string]$owner.CommandLine).IndexOf($ExpectedRunner,[StringComparison]::OrdinalIgnoreCase) -lt 0){
  Hold 'PREVIEW_8802_OWNER_CHANGED'
 }
 $homepageResponse=Invoke-WebRequest ($URL+'/') -UseBasicParsing -TimeoutSec 8
 $page=Invoke-WebRequest ($URL+'/ui-preview/') -UseBasicParsing -TimeoutSec 8
 $css=Invoke-WebRequest ($URL+'/api/fun/ui-preview/app.css') -UseBasicParsing -TimeoutSec 8
 $client=Invoke-WebRequest ($URL+'/api/fun/ui-preview/app.js') -UseBasicParsing -TimeoutSec 8
 $qwen=Invoke-RestMethod ($URL+'/api/fun/ui-preview/health') -TimeoutSec 8
 $v3=Invoke-RestMethod ($URL+'/api/fun/math/v3/status') -TimeoutSec 8
 $chat=Invoke-WebRequest ($URL+'/chat/') -UseBasicParsing -TimeoutSec 8
 if($homepageResponse.StatusCode -ne 200 -or
   $homepageResponse.Headers['x-fi-dashboard-version'] -cne 'fun-industrial-one-port-spatial-ux-v2' -or
   $homepageResponse.Content -notmatch 'id="fi-app"' -or
   $page.StatusCode -ne 200 -or
   $page.Headers['x-fi-preview-version'] -cne 'fun-industrial-organized-ui-preview-v1' -or
   $page.Content -notmatch 'Everything in its place' -or
   $page.Content -notmatch 'data-view="chat"' -or
   $css.StatusCode -ne 200 -or $css.Content -notmatch 'home-hero-grid' -or
   $client.StatusCode -ne 200 -or $client.Content -notmatch "useMathV3Evidence" -or
   $qwen.version -cne 'fun-ui-preview-qwen-health-v1' -or $qwen.modelStart -ne $false -or
   $v3.version -cne 'fun-math-v3-readonly-8802' -or $v3.modelCanExecute -ne $false -or
   $chat.StatusCode -ne 200 -or $chat.Content -notmatch 'fi-fial53-question'){
  Hold 'PREVIEW_ROUTE_OR_EXISTING_MODULE_VERIFICATION_FAILED'
 }
 return @{home='UNCHANGED';preview='HEALTHY';qwen=$qwen.state;v3ready=$v3.ready}
}
function Spawn([string]$file,[string]$root,[string]$label){
 return Start-Process -FilePath $Node -ArgumentList ('"'+$file+'" --serve') -WorkingDirectory $root -PassThru -RedirectStandardOutput (Join-Path $Logs ($label+'.stdout.log')) -RedirectStandardError (Join-Path $Logs ($label+'.stderr.log'))
}
function WaitHealthy([string]$type){
 $reason='No HTTP response'
 for($i=0;$i -lt 120;$i++){
  Start-Sleep -Milliseconds 250
  try{
   $proc=Owner
   if(!$proc){continue}
   if($type -eq 'preview'){
    if(([string]$proc.CommandLine).IndexOf($Runner,[StringComparison]::OrdinalIgnoreCase) -lt 0){continue}
    return (PreviewLive $Runner)
   }else{
    if(([string]$proc.CommandLine).IndexOf($PreviousRunner,[StringComparison]::OrdinalIgnoreCase) -lt 0){continue}
    $response=Invoke-WebRequest ($URL+'/') -UseBasicParsing -TimeoutSec 6
    if($response.StatusCode -eq 200){return $true}
   }
  }catch{$reason=[string]$_.Exception.Message}
 }
 Hold ('8802_'+$type+'_START_HOLD='+$reason)
}
# Validate the downloaded source, then inspect existing process. No changes yet.
$null=VerifyRepo $Root @($ExpectedBranch)
$changes=@(& git.exe -C $Root status --porcelain=v1 --untracked-files=all)
if($LASTEXITCODE -ne 0 -or $changes.Count){Hold 'CHECKOUT_HAS_UNREVIEWED_CHANGES'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($file in @(
 'scripts\Run-Fun-ML-Dashboard8802.mjs',
 'src\ui\organized-preview-v1.mjs',
 'src\ui\organized-preview-v1.js',
 'src\ui\organized-preview-v1.css',
 'src\ui\organized-preview-health-v1.mjs',
 'test\organized-ui-preview-v1.test.mjs'
)){
 $path=Join-Path $Root $file
 RequireFile $path
 if($file -notlike '*.css'){
  & $Node --check $path
  if($LASTEXITCODE -ne 0){Hold ('NODE_CHECK_FAILED='+$file)}
 }
}
& $Node --test (Join-Path $Root 'test\organized-ui-preview-v1.test.mjs')
if($LASTEXITCODE -ne 0){Hold 'PREVIEW_TESTS_FAILED_NO_PORT_CHANGE'}
foreach($port in $Protected){$Before[$port]=Snapshot $port}
$PreviousProcess=Owner
if($PreviousProcess){
 $PreviousRunner=SourceFromCommand ([string]$PreviousProcess.CommandLine)
 $PreviousRoot=Split-Path (Split-Path $PreviousRunner -Parent) -Parent
 $branch=VerifyRepo $PreviousRoot @(
  'feature/fun-math-v3-autonomous-eprocess-dashboard-20261122',
  'feature/fun-ui-redesign-preview-20261123',
  'feature/fun-math-v2-dashboard-chat-20261122',
  'feature/fun-fisre-live-8802-20261122'
 )
 & git.exe -C $PreviousRoot ls-files --error-unmatch -- scripts/Run-Fun-ML-Dashboard8802.mjs 2>$null|Out-Null
 if($LASTEXITCODE -ne 0){Hold 'CURRENT_8802_SOURCE_NOT_TRACKED'}
 $dirty=@(& git.exe -C $PreviousRoot status --porcelain=v1 -- scripts/Run-Fun-ML-Dashboard8802.mjs)
 if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold 'CURRENT_8802_SOURCE_MODIFIED'}
 if($branch -ceq $ExpectedBranch){
  try{
   $verified=PreviewLive $PreviousRunner
   Protect
   Write-Host 'FUN_ORGANIZED_PREVIEW=PASS ALREADY_ACTIVE'
   Write-Host ('FUN_ORGANIZED_PREVIEW_URL='+$URL+'/ui-preview/')
   Write-Host ('FUN_ORIGINAL_DASHBOARD='+$URL+'/')
   Write-Host ('FUN_QWEN_8088='+$verified.qwen)
   Write-Host 'FUN_ELEKTRON=UNTOUCHED ALL_OTHER_SERVICES=UNTOUCHED'
   return
  }catch{Write-Host 'FUN_ORGANIZED_PREVIEW=EXISTING_PREVIEW_REQUIRES_UPDATE'}
 }
}
if($CheckOnly){
 Write-Host 'FUN_ORGANIZED_PREVIEW_CHECK=PASS; NO_PROCESS_CHANGED'
 return
}
New-Item -ItemType Directory -Path $Logs -Force|Out-Null
try{
 Protect
 if($PreviousProcess){
  Write-Host ('FUN_ORGANIZED_PREVIEW_PREVIOUS_8802_PID='+[int]$PreviousProcess.ProcessId)
  Stop-Process -Id ([int]$PreviousProcess.ProcessId) -ErrorAction Stop
  $OldStopped=$true
  for($i=0;$i -lt 70;$i++){
   if(!(Owner)){break}
   Start-Sleep -Milliseconds 200
  }
  if(Owner){Hold 'CURRENT_8802_NOT_RELEASED'}
 }
 Protect
 $NewChild=Spawn $Runner $Root 'preview-8802'
 $healthy=WaitHealthy 'preview'
 Protect
 Write-Host 'FUN_ORGANIZED_PREVIEW=PASS'
 Write-Host ('FUN_ORGANIZED_PREVIEW_URL='+$URL+'/ui-preview/')
 Write-Host ('FUN_ORIGINAL_DASHBOARD='+$URL+'/')
 Write-Host ('FUN_QWEN_8088='+$healthy.qwen)
 Write-Host ('FUN_V3_RESEARCH_READY='+$healthy.v3ready)
 Write-Host ('FUN_ORGANIZED_PREVIEW_LOGS='+$Logs)
 Write-Host 'FUN_ELEKTRON=UNTOUCHED; QWEN_REA_ML_AND_RESEARCH=UNTOUCHED; PRODUCTION_HOMEPAGE=UNCHANGED'
}catch{
 $cause=[string]$_.Exception.Message
 if($NewChild){
  try{
   $active=Owner
   if($active -and [int]$active.ProcessId -eq [int]$NewChild.Id -and
      ([string]$active.CommandLine).IndexOf($Runner,[StringComparison]::OrdinalIgnoreCase) -ge 0){
    Stop-Process -Id ([int]$NewChild.Id) -ErrorAction Stop
   }
  }catch{Write-Warning ('FUN_UI_PREVIEW_CLEANUP_HOLD='+$_.Exception.Message)}
 }
 if($OldStopped -and $PreviousRunner -and $PreviousRoot){
  for($i=0;$i -lt 70;$i++){if(!(Owner)){break};Start-Sleep -Milliseconds 200}
  if(Owner){Hold ('ROLLBACK_BLOCKED_8802_OCCUPIED_ORIGINAL='+$cause)}
  try{
   $null=Spawn $PreviousRunner $PreviousRoot 'rollback-original-8802'
   $null=WaitHealthy 'old'
   Write-Warning 'FUN_ORGANIZED_PREVIEW_ROLLBACK=ORIGINAL_8802_RESTORED'
  }catch{Hold ('ROLLBACK_FAILED_MANUAL_REVIEW='+$_.Exception.Message+' ORIGINAL='+$cause)}
 }
 throw ('FUN_ORGANIZED_PREVIEW_DEPLOYMENT_FAILED='+$cause)
}