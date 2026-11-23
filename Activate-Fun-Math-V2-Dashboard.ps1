# Fun Industrial: Math V2 research + existing 8802 dashboard and grounded Qwen read-only view.
# Explicit operator-initiated rollout, fails closed on unexpected port owners. No changes to Elektron.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Source='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Branch='feature/fun-math-v2-dashboard-chat-20261122'
$Runner=Join-Path $Root 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$Install=Join-Path $Root 'math_research_v2\Install-Fun-MathResearchV2.ps1'
$BaseUrl='http://127.0.0.1:8802'
$Protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8803,8804,8805,8806,8443)
$Before=@{}
$Log=Join-Path $env:LOCALAPPDATA ('FunIndustrial\MathV2Dashboard\logs\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$OriginalRunner=$null
$OriginalRoot=$null
$OriginalProc=$null
$NewProc=$null
$OldStopped=$false
function Hold([string]$message){throw ('FUN_MATH_DASHBOARD_HOLD='+$message)}
function Snapshot([int]$port){
 $items=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
 return (@($items | ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object)-join ';')
}
function Protect(){
 foreach($port in $Protected){if((Snapshot $port) -cne [string]$Before[$port]){Hold ('PROTECTED_LISTENER_CHANGED_'+$port)}}
}
function CheckBranch([string]$directory,[string[]]$allowed){
 if(!(Test-Path -LiteralPath (Join-Path $directory '.git'))){Hold ('CHECKOUT_MISSING='+$directory)}
 $remote=(& git.exe -C $directory remote get-url origin | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $remote -cne $Source){Hold ('REMOTE_NOT_TRUSTED='+$directory)}
 $active=(& git.exe -C $directory branch --show-current | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $allowed -cnotcontains $active){Hold ('BRANCH_NOT_REVIEWED='+$active)}
 return $active
}
function GetOwner(){
 $listeners=@(Get-NetTCPConnection -LocalPort 8802 -State Listen -ErrorAction SilentlyContinue)
 if($listeners.Count -eq 0){return $null}
 if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -cne '127.0.0.1'){Hold 'UNEXPECTED_8802_LISTENERS'}
 $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$listeners[0].OwningProcess)
 if(!$proc -or $proc.Name -cne 'node.exe' -or [string]::IsNullOrWhiteSpace([string]$proc.CommandLine)){
  Hold 'UNRECOGNIZED_8802_PROCESS'
 }
 return $proc
}
function ExtractRunner([string]$line){
 $pattern='(?i)([A-Z]:\\[^"\r\n]*?\\scripts\\Run-Fun-ML-Dashboard8802\.mjs)'
 $matches=@([regex]::Matches($line,$pattern))
 if($matches.Count -ne 1){Hold 'CURRENT_8802_RUNNER_UNRECOGNIZED'}
 $file=[string]$matches[0].Groups[1].Value
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold 'CURRENT_8802_RUNNER_MISSING'}
 return $file
}
function Live([string]$ExpectedRunner=$Runner){
 $proc=GetOwner
 if(!$proc -or [string]$proc.CommandLine -notmatch [regex]::Escape($ExpectedRunner)){Hold '8802_EXPECTED_RUNNER_NOT_VERIFIED'}
 $main=Invoke-WebRequest ($BaseUrl+'/') -UseBasicParsing -TimeoutSec 8
 $math=Invoke-WebRequest ($BaseUrl+'/math/') -UseBasicParsing -TimeoutSec 8
 $mathjs=Invoke-WebRequest ($BaseUrl+'/api/fun/math/client.js') -UseBasicParsing -TimeoutSec 8
 $chat=Invoke-WebRequest ($BaseUrl+'/chat/') -UseBasicParsing -TimeoutSec 8
 $report=Invoke-RestMethod ($BaseUrl+'/api/fun/math/status') -TimeoutSec 8
 $qwen=Invoke-RestMethod ($BaseUrl+'/api/fial/grounded/status') -TimeoutSec 8
 $model=Invoke-WebRequest ($BaseUrl+'/api/fial/grounded/client.js') -UseBasicParsing -TimeoutSec 8
 $controls=Invoke-RestMethod ($BaseUrl+'/api/fun/control/status') -TimeoutSec 8
 if($main.StatusCode -ne 200 -or $main.Content -notmatch 'Mathematical Research' -or
    $math.StatusCode -ne 200 -or $math.Headers['x-fi-math-version'] -cne 'fun-math-v2-readonly-8802' -or
    $math.Content -notmatch 'fi-math-ask' -or $mathjs.Content -notmatch 'useMathEvidence' -or
    $chat.StatusCode -ne 200 -or $chat.Content -notmatch 'fi-fial53-math-evidence' -or
    $model.Content -notmatch 'useMathEvidence' -or
    $report.ready -ne $true -or $report.state -cne 'REPORT_VERIFIED_READONLY' -or
    $report.equations -ne 69 -or $report.modelExecutesTools -ne $false -or
    $report.elektronTouched -ne $false -or
    $qwen.model_interface -cne 'fixed_local_qwen_8088' -or $qwen.authority_added -ne $false -or
    $controls.deviceControlEnabled -ne $false){
  Hold 'INTEGRATED_8802_ROUTE_OR_EVIDENCE_VERIFICATION_FAILED'
 }
 return $report
}
function Spawn([string]$path,[string]$directory,[string]$name){
 $stdout=Join-Path $Log ($name+'.stdout.log')
 $stderr=Join-Path $Log ($name+'.stderr.log')
 return Start-Process -FilePath $Node -ArgumentList ('"'+$path+'" --serve') -WorkingDirectory $directory -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
}
function WaitReady([string]$name){
 $reason='not yet ready'
 for($i=0;$i -lt 120;$i++){
  Start-Sleep -Milliseconds 250
  try{
   $proc=GetOwner
   if(!$proc){continue}
   if($name -eq 'new'){
    if([string]$proc.CommandLine -notmatch [regex]::Escape($Runner)){continue}
    return (Live)
   }else{
    if([string]$proc.CommandLine -notmatch [regex]::Escape($OriginalRunner)){continue}
    $r=Invoke-RestMethod ($BaseUrl+'/api/fun/hub/status') -TimeoutSec 5
    if($r.state -ceq 'ready'){return $true}
   }
  }catch{$reason=[string]$_.Exception.Message}
 }
 Hold ('8802_'+$name+'_FAILED_'+$reason)
}
# Preflight: source integrity, Node parse, Python tests. No listener changes.
if(!(Test-Path -LiteralPath $Runner -PathType Leaf) -or !(Test-Path -LiteralPath $Install -PathType Leaf)){
 Hold 'SOURCE_FILES_MISSING'
}
$null=CheckBranch $Root @($Branch)
if(@(& git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -ne 0){Hold 'NEW_CHECKOUT_DIRTY'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Py=(Get-Command py.exe -ErrorAction Stop).Source
foreach($file in @($Runner,(Join-Path $Root 'src\math\math-report-bridge-v2.mjs'),
 (Join-Path $Root 'src\ui\math-research-v2.mjs'),
 (Join-Path $Root 'src\ui\math-research-v2.js'),
 (Join-Path $Root 'src\fial\grounded-chat-v5-2.mjs'),
 (Join-Path $Root 'src\fial\primary-grounded-client-v5-3.js'))){
 & $Node --check $file
 if($LASTEXITCODE -ne 0){Hold ('NODE_SYNTAX_INVALID='+$file)}
}
& $Py -3 -m unittest discover -s (Join-Path $Root 'math_research_v2') -p 'test_engine.py' -q
if($LASTEXITCODE -ne 0){Hold 'MATH_V2_TESTS_FAILED'}
& $Node --test (Join-Path $Root 'test\math-v2-dashboard.test.mjs')
if($LASTEXITCODE -ne 0){Hold 'MATH_V2_DASHBOARD_TESTS_FAILED'}
# Research worker runs independently and registers its own scheduled task.
# RunOnce first, install schedule only after success.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Install -RunOnce
if($LASTEXITCODE -ne 0){Hold 'MATH_V2_RUN_FAILED'}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Install -InstallSchedule
if($LASTEXITCODE -ne 0){Hold 'MATH_V2_SCHEDULE_FAILED'}
foreach($port in $Protected){$Before[$port]=Snapshot $port}
$OriginalProc=GetOwner
if($OriginalProc){
 $OriginalRunner=ExtractRunner ([string]$OriginalProc.CommandLine)
 $OriginalRoot=Split-Path (Split-Path $OriginalRunner -Parent) -Parent
 $oldBranch=CheckBranch $OriginalRoot @(
  'feature/fun-fisre-live-8802-20261122',
  'feature/fun-oneport-spatial-ux-v2-20261115',
  $Branch
 )
 $relative='scripts/Run-Fun-ML-Dashboard8802.mjs'
 & git.exe -C $OriginalRoot ls-files --error-unmatch -- $relative 2>$null | Out-Null
 if($LASTEXITCODE -ne 0){Hold 'OLD_RUNNER_NOT_TRACKED'}
 $diff=@(& git.exe -C $OriginalRoot status --porcelain=v1 -- $relative)
 if($LASTEXITCODE -ne 0 -or $diff.Count -ne 0){Hold 'OLD_RUNNER_MODIFIED'}
 if($oldBranch -ceq $Branch){
  try{
   $good=Live $OriginalRunner
   Protect
   Write-Host 'FUN_MATH_V2_DASHBOARD=PASS ADOPTED_EXISTING_8802'
   Write-Host ('FUN_MATH_V2_DRAWS='+$good.draws)
   Write-Host ('FUN_MATH_V2_URL='+$BaseUrl+'/math/')
   Write-Host ('FUN_QWEN_CHAT_URL='+$BaseUrl+'/chat/')
   Write-Host 'FUN_ONLY=TRUE ELEKTRON=UNTOUCHED'
   return
  }catch{Write-Host 'FUN_MATH_V2_EXISTING_8802=UPGRADE_REQUIRED'}
 }
}
New-Item -ItemType Directory -Path $Log -Force | Out-Null
try{
 Protect
 if($OriginalProc){
  Write-Host ('FUN_MATH_V2_PREVIOUS_8802_PID='+[int]$OriginalProc.ProcessId)
  Stop-Process -Id ([int]$OriginalProc.ProcessId) -ErrorAction Stop
  $OldStopped=$true
  for($i=0;$i -lt 70;$i++){
   if(!(GetOwner)){break}
   Start-Sleep -Milliseconds 200
  }
  if(GetOwner){Hold '8802_OLD_PROCESS_STILL_LISTENING'}
 }
 Protect
 $NewProc=Spawn $Runner $Root 'math-v2-8802'
 $verified=WaitReady 'new'
 Protect
 Write-Host 'FUN_MATH_V2_DASHBOARD=PASS'
 Write-Host ('FUN_MATH_V2_DRAWS='+$verified.draws+' EQUATIONS='+$verified.equations+' STALE='+$verified.stale)
 Write-Host ('FUN_MATH_V2_URL='+$BaseUrl+'/math/')
 Write-Host ('FUN_QWEN_CHAT_URL='+$BaseUrl+'/chat/')
 try{
  $q=Invoke-RestMethod 'http://127.0.0.1:8088/health' -TimeoutSec 4
  if($q.status -eq 'ok'){Write-Host 'FUN_QWEN_8088=HEALTHY'}
  else{Write-Warning 'FUN_QWEN_8088=HEALTH_UNVERIFIED CHAT_NOT_TESTED'}
 }catch{Write-Warning 'FUN_QWEN_8088=UNAVAILABLE CHAT_ROUTE_PRESENT_BUT_MODEL_NOT_VERIFIED'}
 Write-Host ('FUN_MATH_V2_LOGS='+$Log)
 Write-Host 'FUN_MATH_V2_RESEARCH=DAILY_0700; V1_UNTOUCHED=TRUE; FUN_ONLY=TRUE ELEKTRON=UNTOUCHED PROTECTED_SERVICES_UNTOUCHED=TRUE'
}catch{
 $cause=[string]$_.Exception.Message
 if($NewProc){
  try{
   $active=GetOwner
   if($active -and [int]$active.ProcessId -eq [int]$NewProc.Id -and
      [string]$active.CommandLine -match [regex]::Escape($Runner)){
    Stop-Process -Id ([int]$NewProc.Id) -ErrorAction Stop
   }
  }catch{Write-Warning ('FUN_MATH_V2_CLEANUP_HOLD='+$_.Exception.Message)}
 }
 if($OldStopped -and $OriginalRunner -and $OriginalRoot){
  for($i=0;$i -lt 70;$i++){if(!(GetOwner)){break};Start-Sleep -Milliseconds 200}
  if(GetOwner){Hold ('ROLLBACK_PORT_BUSY '+$cause)}
  try{
   $null=Spawn $OriginalRunner $OriginalRoot 'rollback-previous-8802'
   $null=WaitReady 'old'
   Write-Warning 'FUN_MATH_V2_ROLLBACK=PREVIOUS_8802_RESTORED'
  }catch{
   Hold ('ROLLBACK_MANUAL_REVIEW='+$_.Exception.Message+' ORIGINAL='+$cause)
  }
 }
 throw ('FUN_MATH_V2_ACTIVATION_FAILED='+$cause)
}