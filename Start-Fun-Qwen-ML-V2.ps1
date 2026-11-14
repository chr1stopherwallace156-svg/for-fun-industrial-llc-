# FUN_INDUSTRIAL_QWEN_ML_V2 -- single-command guarded start; no other service restarts.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Branch='feature/fun-scikit-qwen-bridge-v2-20261113'
$Runner=Join-Path $Repo 'scripts\Run-Fun-QwenML8801.mjs'
$Module=Join-Path $Repo 'src\ml\qwen-ml-v2.mjs'
$Client=Join-Path $Repo 'src\ml\qwen-ml-client-v2.js'
$Test=Join-Path $Repo 'intelligence-checks\qwen-scikit-v2-case.mjs'
$Py=Join-Path $env:LOCALAPPDATA 'FunIndustrial\MLScikitLearnV1\venv\Scripts\python.exe'
$Bridge=Join-Path $Repo 'ml\scikit_learn_bridge.py'
$Url='http://127.0.0.1:8801'
function Hold([string]$reason){throw "FUN_QWEN_ML_HOLD=$reason"}
function Snapshot([int]$port){
  return (@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    ForEach-Object { "$($_.LocalAddress):$($_.OwningProcess)" } | Sort-Object)-join ';')
}
foreach($f in @($Runner,$Module,$Client,$Test,$Py,$Bridge)){
  if(-not (Test-Path -LiteralPath $f -PathType Leaf)){Hold "FILE_MISSING=$f"}
  if((Get-Item -LiteralPath $f).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold "SYMLINK_REFUSED=$f"}
}
if((git -C $Repo branch --show-current) -cne $Branch){Hold 'BRANCH_MISMATCH'}
if($LASTEXITCODE -ne 0){Hold 'GIT_BRANCH_CHECK_FAILED'}
if(@(git -C $Repo status --porcelain=v1 --untracked-files=all).Count){Hold 'DIRTY_SOURCE_TREE'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($f in @($Runner,$Module,$Client,$Test)){
  & $Node --check $f
  if($LASTEXITCODE -ne 0){Hold "JS_SYNTAX_INVALID=$f"}
}
Push-Location $Repo
try{
  & $Node --test $Test
  if($LASTEXITCODE -ne 0){Hold 'OFFLINE_NODE_TESTS_FAILED'}
}finally{Pop-Location}
$healthText=& $Py $Bridge health
if($LASTEXITCODE -ne 0){Hold 'PYTHON_HEALTH_FAILED'}
try{$health=$healthText|Out-String|ConvertFrom-Json}catch{Hold 'PYTHON_HEALTH_JSON_INVALID'}
if($health.ok -ne $true -or $health.version -ne '1.9.1' -or
  $health.network_listener -ne $false -or $health.external_actions -ne 0){
  Hold 'SCIKIT_INSTALL_IDENTITY_INVALID'
}
$protected=@(11434,8088,8791,8789,8796,8797,8798,8443)
$before=@{};foreach($p in $protected){$before[$p]=Snapshot $p}
if($CheckOnly){
  Write-Host 'FUN_QWEN_ML_V2_PREFLIGHT=PASS INSTALL_VERIFIED=TRUE SERVER_NOT_STARTED=TRUE'
  return
}
$old=@(Get-NetTCPConnection -State Listen -LocalPort 8801 -ErrorAction SilentlyContinue)
if($old.Count -gt 0){
  if($old.Count -ne 1 -or $old[0].LocalAddress -ne '127.0.0.1'){Hold 'UNEXPECTED_8801_LISTENER'}
  $proc=Get-CimInstance Win32_Process -Filter ("ProcessId="+$old[0].OwningProcess)
  if($proc.Name -ne 'node.exe' -or $proc.CommandLine -notmatch 'Run-Fun-QwenML8801\.mjs'){Hold '8801_OWNER_UNVERIFIED'}
  try{$state=Invoke-RestMethod ($Url+'/api/ml/status') -TimeoutSec 5}catch{Hold '8801_EXISTING_HEALTH_FAILED'}
  if($state.version -ne 'fun-qwen-scikit-v2'){Hold '8801_EXISTING_VERSION_INVALID'}
  Write-Host "FUN_QWEN_ML_ADOPTED=PID_$($old[0].OwningProcess)"
}else{
  $logs=Join-Path $env:LOCALAPPDATA ('FunIndustrial\QwenMLV2\logs\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Path $logs -Force|Out-Null
  $args='"'+$Runner+'" --serve'
  $child=Start-Process -FilePath $Node -ArgumentList $args -WorkingDirectory $Repo -PassThru -RedirectStandardOutput (Join-Path $logs 'stdout.log') -RedirectStandardError (Join-Path $logs 'stderr.log')
  $ready=$false
  for($i=0;$i -lt 70;$i++){
    Start-Sleep -Milliseconds 350
    try{
      $listener=@(Get-NetTCPConnection -State Listen -LocalPort 8801 -ErrorAction SilentlyContinue)
      if($listener.Count -ne 1 -or $listener[0].LocalAddress -ne '127.0.0.1' -or $listener[0].OwningProcess -ne $child.Id){continue}
      $state=Invoke-RestMethod ($Url+'/api/ml/status') -TimeoutSec 5
      if($state.version -eq 'fun-qwen-scikit-v2' -and $state.pythonInstalled -eq $true -and
        $state.reaExecutionGrants -eq 0){$ready=$true;break}
    }catch{}
  }
  if(-not $ready){Hold "8801_NOT_READY_LOGS=$logs"}
  Write-Host "FUN_QWEN_ML_NEW_PROCESS=PID_$($child.Id) LOGS=$logs"
}
foreach($p in $protected){
  if((Snapshot $p) -cne $before[$p]){Hold "PREEXISTING_SERVICE_CHANGED_PORT_$p"}
}
Write-Host 'FUN_QWEN_ML_V2_START=PASS'
Write-Host "FUN_QWEN_ML_URL=$Url/"
Write-Host 'FUN_REA_APPROVAL_AND_ELEKTRON=UNCHANGED'
Write-Host 'FUN_ML_TRAINING=OPERATOR_APPROVAL_REQUIRED'
Write-Host 'FUN_QWEN=EXPLANATION_ONLY_NO_TOOL_AUTHORITY'
