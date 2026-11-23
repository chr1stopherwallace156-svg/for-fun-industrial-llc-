# FUN MATH V3 FULL INTEGRATION: V3 research + reviewed 8802 dashboard handoff.
# Starts no AI or REA workers, no Elektron access. Updates only known 8802 Node owner.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fun-math-v3-autonomous-eprocess-dashboard-20261122'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Runner=Join-Path $Root 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$Worker=Join-Path $Root 'math_research_v3\Install-Fun-MathResearchV3.ps1'
$Url='http://127.0.0.1:8802'
$Protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8803,8804,8805,8806,8443)
$Before=@{}
$OldProcess=$null
$OldRunner=$null
$OldRoot=$null
$OldStopped=$false
$Child=$null
$Log=Join-Path $env:LOCALAPPDATA ('FunIndustrial\MathV3Dashboard\logs\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
function Hold([string]$reason){throw ('FUN_MATH_V3_HOLD='+$reason)}
function Leaf([string]$path){
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('SOURCE_FILE_MISSING='+$path)}
 if(((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold ('SOURCE_SYMLINK='+$path)}
}
function GitIdentity([string]$root,[string[]]$allowed){
 if(!(Test-Path -LiteralPath (Join-Path $root '.git'))){Hold ('NOT_GIT_CHECKOUT='+$root)}
 $remote=(& git.exe -C $root remote get-url origin | Out-String).Trim()
 $branch=(& git.exe -C $root branch --show-current | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $remote -cne $Origin -or $allowed -cnotcontains $branch){Hold ('SOURCE_UNREVIEWED='+$root)}
 return $branch
}
function Listener([int]$port){return @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)}
function Snapshot([int]$port){return (@(Listener $port | ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object)-join ';')}
function Protect(){foreach($port in $Protected){if((Snapshot $port) -cne [string]$Before[$port]){Hold ('PROTECTED_PORT_CHANGED_'+$port)}}}
function Owner(){
 $set=@(Listener 8802)
 if(!$set.Count){return $null}
 if($set.Count -ne 1 -or $set[0].LocalAddress -cne '127.0.0.1'){Hold 'PORT_8802_HAS_UNREVIEWED_LISTENER'}
 $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$set[0].OwningProcess) -ErrorAction Stop
 if(!$proc -or $proc.Name -ine 'node.exe' -or [string]::IsNullOrWhiteSpace([string]$proc.CommandLine)){
  Hold 'PORT_8802_OWNER_NOT_NODE'
 }
 return $proc
}
function RunnerPath([string]$commandLine){
 $pattern='(?i)([A-Z]:\\[^"\r\n]*?\\scripts\\Run-Fun-ML-Dashboard8802\.mjs)'
 $matchesFound=@([regex]::Matches($commandLine,$pattern))
 if($matchesFound.Count -ne 1){Hold 'PORT_8802_COMMAND_LINE_UNRECOGNIZED'}
 $file=[string]$matchesFound[0].Groups[1].Value
 Leaf $file
 return $file
}
function Live(){
 $p=Owner
 if(!$p -or ([string]$p.CommandLine).IndexOf($Runner,[StringComparison]::OrdinalIgnoreCase) -lt 0){Hold 'NEW_8802_OWNER_NOT_VERIFIED'}
 $homepageResponse=Invoke-WebRequest ($Url+'/') -UseBasicParsing -TimeoutSec 8
 $page=Invoke-WebRequest ($Url+'/math/v3/') -UseBasicParsing -TimeoutSec 8
 $client=Invoke-WebRequest ($Url+'/api/fun/math/v3/client.js') -UseBasicParsing -TimeoutSec 8
 $status=Invoke-RestMethod ($Url+'/api/fun/math/v3/status') -TimeoutSec 8
 $candidate=Invoke-RestMethod ($Url+'/api/fun/math/v3/candidates?era=2025') -TimeoutSec 12
 $chat=Invoke-WebRequest ($Url+'/chat/') -UseBasicParsing -TimeoutSec 8
 $chatJs=Invoke-WebRequest ($Url+'/api/fial/grounded/client.js') -UseBasicParsing -TimeoutSec 8
 $qwen=Invoke-RestMethod ($Url+'/api/fial/grounded/status') -TimeoutSec 8
 $v2=Invoke-RestMethod ($Url+'/api/fun/math/status') -TimeoutSec 8
 if($homepageResponse.StatusCode -ne 200 -or $homepageResponse.Content -notmatch 'Mathematical Discovery V3' -or
    $page.StatusCode -ne 200 -or $page.Headers['x-fi-math-version'] -cne 'fun-math-v3-readonly-8802' -or
    $client.Content -notmatch 'useMathV3Evidence' -or
    $status.ready -ne $true -or $status.version -cne 'fun-math-v3-readonly-8802' -or
    $status.equationsPerEra -ne 138 -or $status.modelCanExecute -ne $false -or
    $status.elektronTouched -ne $false -or
    $candidate.ready -ne $true -or @($candidate.rows).Count -ne 138 -or
    $chat.StatusCode -ne 200 -or $chat.Content -notmatch 'fi-fial53-math-v3-evidence' -or
    $chatJs.Content -notmatch 'useMathV3Evidence' -or
    $qwen.model_interface -cne 'fixed_local_qwen_8088' -or $qwen.authority_added -ne $false -or
    $v2.ready -ne $true){Hold 'V3_DASHBOARD_READONLY_QWEN_OR_V2_VERIFICATION_FAILED'}
 return $status
}
function Spawn([string]$file,[string]$cwd,[string]$tag){
 return Start-Process -FilePath $Node -ArgumentList ('"'+$file+'" --serve') -WorkingDirectory $cwd -PassThru -RedirectStandardOutput (Join-Path $Log ($tag+'.stdout.log')) -RedirectStandardError (Join-Path $Log ($tag+'.stderr.log'))
}
function WaitHealthy([string]$kind){
 $reason='No HTTP response'
 for($i=0;$i -lt 120;$i++){
  Start-Sleep -Milliseconds 250
  try{
   $p=Owner
   if(!$p){continue}
   if($kind -eq 'new'){
    if([string]$p.CommandLine -notmatch [regex]::Escape($Runner)){continue}
    return (Live)
   }
   if([string]$p.CommandLine -notmatch [regex]::Escape($OldRunner)){continue}
   $s=Invoke-RestMethod ($Url+'/api/fun/hub/status') -TimeoutSec 4
   if($s.state -ceq 'ready'){return $true}
  }catch{$reason=[string]$_.Exception.Message}
 }
 Hold ('PORT_8802_'+$kind+'_NOT_HEALTHY_'+$reason)
}
# All checks before stopping port 8802.
Leaf $Runner;Leaf $Worker
$null=GitIdentity $Root @($Branch)
$clean=@(& git.exe -C $Root status --porcelain=v1 --untracked-files=all)
if($LASTEXITCODE -ne 0 -or $clean.Count){Hold 'NEW_GIT_WORKTREE_DIRTY'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Py=(Get-Command py.exe -ErrorAction Stop).Source
$nodeFiles=@($Runner,'src\math\math-report-bridge-v3.mjs','src\ui\math-v3-page.mjs','src\ui\math-v3-page.js','src\fial\grounded-chat-v5-2.mjs','src\fial\primary-grounded-client-v5-3.js')
foreach($file in $nodeFiles){
 $full=if([IO.Path]::IsPathRooted($file)){$file}else{Join-Path $Root $file}
 Leaf $full
 & $Node --check $full
 if($LASTEXITCODE -ne 0){Hold ('NODE_SYNTAX_INVALID='+$file)}
}
& $Py -3 -m unittest discover -s (Join-Path $Root 'math_research_v3') -p 'test_engine.py' -q
if($LASTEXITCODE -ne 0){Hold 'V3_PYTHON_TESTS_FAILED'}
& $Node --test (Join-Path $Root 'test\math-v3-dashboard.test.mjs')
if($LASTEXITCODE -ne 0){Hold 'V3_NODE_TESTS_FAILED'}
# Run only separate research worker and then schedule 07:30; do not touch V1 or V2 tasks.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Worker -RunOnce
if($LASTEXITCODE -ne 0){Hold 'V3_WORKER_RUN_FAILED'}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Worker -InstallSchedule
if($LASTEXITCODE -ne 0){Hold 'V3_SCHEDULE_FAILED'}
foreach($port in $Protected){$Before[$port]=Snapshot $port}
$OldProcess=Owner
if($OldProcess){
 $OldRunner=RunnerPath ([string]$OldProcess.CommandLine)
 $OldRoot=Split-Path (Split-Path $OldRunner -Parent) -Parent
 $oldBranch=GitIdentity $OldRoot @('feature/fun-fisre-live-8802-20261122','feature/fun-math-v2-dashboard-chat-20261122',$Branch)
 & git.exe -C $OldRoot ls-files --error-unmatch -- scripts/Run-Fun-ML-Dashboard8802.mjs | Out-Null
 if($LASTEXITCODE -ne 0){Hold 'PREVIOUS_DASHBOARD_SOURCE_NOT_TRACKED'}
 $changed=@(& git.exe -C $OldRoot status --porcelain=v1 -- scripts/Run-Fun-ML-Dashboard8802.mjs)
 if($LASTEXITCODE -ne 0 -or $changed.Count){Hold 'PREVIOUS_DASHBOARD_SOURCE_MODIFIED'}
 if($oldBranch -ceq $Branch){
  try{
   $v=Live
   Protect
   Write-Host ('FUN_MATH_V3_DASHBOARD=PASS ADOPTED_REVIEWED_8802 DRAWS='+$v.draws)
   Write-Host ('FUN_MATH_V3_URL='+$Url+'/math/v3/')
   Write-Host ('FUN_QWEN_CHAT='+$Url+'/chat/')
   Write-Host 'FUN_ONLY=TRUE ELEKTRON=UNTOUCHED'
   return
  }catch{Write-Host 'FUN_MATH_V3_DASHBOARD=KNOWN_8802_NEEDS_UPDATE'}
 }
}
New-Item -ItemType Directory -Path $Log -Force | Out-Null
try{
 Protect
 if($OldProcess){
  Write-Host ('FUN_MATH_V3_PREVIOUS_8802_PID='+[int]$OldProcess.ProcessId)
  Stop-Process -Id ([int]$OldProcess.ProcessId) -ErrorAction Stop
  $OldStopped=$true
  for($i=0;$i -lt 80;$i++){
   if(!(Owner)){break}
   Start-Sleep -Milliseconds 200
  }
  if(Owner){Hold 'PREVIOUS_8802_NOT_RELEASED'}
 }
 Protect
 $Child=Spawn $Runner $Root 'new'
 $verified=WaitHealthy 'new'
 Protect
 Write-Host 'FUN_MATH_V3_DASHBOARD=PASS'
 Write-Host ('FUN_MATH_V3_DRAWS='+$verified.draws+' EQUATIONS='+$verified.equationsPerEra+' STALE='+$verified.stale)
 Write-Host ('FUN_MATH_V3_URL='+$Url+'/math/v3/')
 Write-Host ('FUN_QWEN_CHAT='+$Url+'/chat/')
 try{
  $h=Invoke-RestMethod 'http://127.0.0.1:8088/health' -TimeoutSec 4
  if($h.status -ceq 'ok'){Write-Host 'FUN_QWEN_8088=HEALTHY'}
  else{Write-Warning 'FUN_QWEN_8088=HEALTH_NOT_VERIFIED; NO_RESTART'}
 }catch{Write-Warning 'FUN_QWEN_8088=OFFLINE; DASHBOARD_AND_RESEARCH_UNAFFECTED'}
 Write-Host ('FUN_MATH_V3_LOGS='+$Log)
 Write-Host 'FUN_V3_SCHEDULE=07:30 V1_V2_UNTOUCHED=TRUE ELEKTRON=UNTOUCHED REA_AND_OTHER_SERVICES=UNTOUCHED'
}catch{
 $failure=[string]$_.Exception.Message
 if($Child){
  try{
   $current=Owner
   if($current -and [int]$current.ProcessId -eq [int]$Child.Id -and
      [string]$current.CommandLine -match [regex]::Escape($Runner)){
    Stop-Process -Id ([int]$Child.Id) -ErrorAction Stop
   }
  }catch{Write-Warning ('FUN_MATH_V3_CLEANUP_HOLD='+$_.Exception.Message)}
 }
 if($OldStopped -and $OldRunner -and $OldRoot){
  for($i=0;$i -lt 80;$i++){if(!(Owner)){break};Start-Sleep -Milliseconds 200}
  if(Owner){Hold ('ROLLBACK_BLOCKED_PORT_OCCUPIED_ORIGINAL='+$failure)}
  try{
   $null=Spawn $OldRunner $OldRoot 'rollback-old'
   $null=WaitHealthy 'old'
   Write-Warning 'FUN_MATH_V3_ROLLBACK=PREVIOUS_8802_RESTORED'
  }catch{Hold ('ROLLBACK_MANUAL_REVIEW='+$_.Exception.Message+' ORIGINAL='+$failure)}
 }
 throw ('FUN_MATH_V3_ACTIVATION_FAILED='+$failure)
}