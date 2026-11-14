# FI_FUN_ML_UNIFIED_DASHBOARD_V3 - one-command add-on, never restarts old services.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
$Branch='feature/fun-ml-unified-dashboard-v3-20261113'
$Runner=Join-Path $Root 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$Adapter=Join-Path $Root 'src\ml\dashboard-ml-proxy-v3.mjs'
$Widget=Join-Path $Root 'src\ml\dashboard-ml-widget-v3.js'
$Test=Join-Path $Root 'intelligence-checks\fi-ml-hub-v3-case.mjs'
$QwenTest=Join-Path $Root 'intelligence-checks\qwen-scikit-v2-case.mjs'
$URL='http://127.0.0.1:8802'
function Hold([string]$reason){throw ('FUN_ML_DASHBOARD_HOLD='+$reason)}
function Listener([int]$p){
  return @(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$p){
  return (@(Listener $p | ForEach-Object { "$($_.LocalAddress):$($_.OwningProcess)" } |
    Sort-Object)-join ';')
}
foreach($p in @($Runner,$Adapter,$Widget,$Test,$QwenTest)){
  if(-not (Test-Path -LiteralPath $p -PathType Leaf)){Hold ('MISSING_SOURCE='+$p)}
  if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_REFUSED'}
}
if((git.exe -C $Root branch --show-current) -cne $Branch){Hold 'SOURCE_BRANCH_MISMATCH'}
if($LASTEXITCODE -ne 0){Hold 'GIT_BRANCH_CHECK_FAILED'}
$dirty=@(git.exe -C $Root status --porcelain=v1 --untracked-files=all)
if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold 'DIRTY_CHECKOUT'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($f in @($Runner,$Adapter,$Widget,$Test,$QwenTest)){
  & $Node --check $f
  if($LASTEXITCODE -ne 0){Hold ('JS_SYNTAX_FAILED='+$f)}
}
Push-Location $Root
try{
  & $Node --test $Test $QwenTest
  if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TESTS_FAILED'}
}finally{Pop-Location}
try{
  $parent=Invoke-RestMethod 'http://127.0.0.1:8789/api/status' -TimeoutSec 10
  $chat=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 10
  $ml=Invoke-RestMethod 'http://127.0.0.1:8801/api/ml/status' -TimeoutSec 10
}catch{Hold ('REQUIRED_SERVICE_UNAVAILABLE='+$_.Exception.Message)}
if($null -eq $parent.lifecycle){Hold '8789_STATUS_INVALID'}
if($chat.version -ne 'fi-unified-task-chat-8798-v1'){Hold '8798_IDENTITY_INVALID'}
if($ml.version -ne 'fun-qwen-scikit-v2' -or $ml.pythonInstalled -ne $true -or
  $ml.reaExecutionGrants -ne 0 -or $ml.externalActions -ne 0){Hold '8801_ML_IDENTITY_INVALID'}
$protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8443)
$before=@{}
foreach($p in $protected){$before[$p]=Snapshot $p}
if($CheckOnly){
  Write-Host 'FUN_ML_DASHBOARD_PREFLIGHT=PASS STARTED=0 EXISTING_SERVICES=UNTOUCHED'
  return
}
$current=@(Listener 8802)
if($current.Count){
  if($current.Count -ne 1 -or $current[0].LocalAddress -ne '127.0.0.1'){Hold '8802_UNEXPECTED_LISTENER'}
  $owner=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$current[0].OwningProcess) -ErrorAction Stop
  if($owner.Name -ne 'node.exe' -or $owner.CommandLine -notmatch 'Run-Fun-ML-Dashboard8802\.mjs'){
    Hold '8802_OWNER_UNVERIFIED'
  }
  Write-Host ('FUN_ML_HUB_ADOPTED_PID='+$current[0].OwningProcess)
}else{
  $logDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\MLHubV3\logs\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  $arguments='"'+$Runner+'" --serve'
  $child=Start-Process -FilePath $Node -ArgumentList $arguments -WorkingDirectory $Root -PassThru -RedirectStandardOutput (Join-Path $logDir 'stdout.log') -RedirectStandardError (Join-Path $logDir 'stderr.log')
  $ready=$false
  for($i=0;$i -lt 75;$i++){
    Start-Sleep -Milliseconds 350
    try{
      $list=@(Listener 8802)
      if($list.Count -ne 1 -or $list[0].LocalAddress -ne '127.0.0.1' -or
         [int]$list[0].OwningProcess -ne [int]$child.Id){continue}
      $probe=Invoke-RestMethod ($URL+'/api/fun/hub/status') -TimeoutSec 5
      if($probe.version -eq 'fi-ml-hub-v3' -and $probe.machineLearning.state -eq 'ready'){$ready=$true;break}
    }catch{}
  }
  if(-not $ready){Hold ('8802_HEALTH_FAILED_LOGS='+$logDir)}
  Write-Host ('FUN_ML_HUB_STARTED_PID='+$child.Id+' LOGS='+$logDir)
}
try{
  $page=Invoke-WebRequest ($URL+'/') -UseBasicParsing -TimeoutSec 12
  $unified=Invoke-WebRequest ($URL+'/unified/') -UseBasicParsing -TimeoutSec 12
  $model=Invoke-RestMethod ($URL+'/api/ml/dashboard/status') -TimeoutSec 10
}catch{Hold ('HUB_RENDER_FAILED='+$_.Exception.Message)}
if($page.StatusCode -ne 200 -or $page.Content -notmatch 'fi-ml-panel' -or
   $unified.StatusCode -ne 200 -or $unified.Content -notmatch 'fi-ml-panel' -or
   $model.state -ne 'ready'){Hold 'HUB_INTEGRATION_INCOMPLETE'}
foreach($p in $protected){
  if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_SERVICE_CHANGED_PORT_'+$p)}
}
Write-Host 'FUN_ML_DASHBOARD_V3=PASS'
Write-Host ('FUN_ML_INTEGRATED_CONTROL_CENTER='+$URL+'/')
Write-Host ('FUN_ML_INTEGRATED_QWEN_CHAT='+$URL+'/unified/')
Write-Host 'ORIGINAL_8789_8798_8801_8443=UNTOUCHED'
Write-Host 'REA_APPROVAL=UNCHANGED TRAINING_APPROVAL=REQUIRED'
Write-Host 'IPHONE_USE_TERMIUS_LOCAL_FORWARD_8802=REQUIRED'
