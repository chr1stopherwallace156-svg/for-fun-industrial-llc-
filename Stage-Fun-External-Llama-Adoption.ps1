# Fun Industrial: guarded external llama.cpp adoption, stage-only by default.
# -Apply affects ONLY the known 8791 Python compute process. All other processes untouched.
[CmdletBinding()]param([switch]$Apply,[switch]$AcceptVolatileStateLoss)
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Runtime=Join-Path $Live 'ai_ml\llama_runtime.py'
$Baseline=Join-Path $Repo 'scripts\baselines\llama-runtime-pre-adoption.py'
$Candidate=Join-Path $Repo 'ai_ml\llama_runtime.py'
$Recovery=Join-Path $Repo 'Recover-Fun-Compute.ps1'
$EnvFile=Join-Path $Live '.env'
$Backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\ExternalLlamaAdoption\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$Changed=$false;$ComputeStopped=$false
function Hold([string]$reason){throw ('FUN_EXTERNAL_LLAMA_ADOPTION_HOLD='+$reason)}
function File([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('FILE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('REPARSE_FILE_'+$p)}
}
function Port([int]$n){return @(Get-NetTCPConnection -State Listen -LocalPort $n -ErrorAction SilentlyContinue)}
function PidOf([int]$n,[string]$pattern){
 $l=@(Port $n)
 if($l.Count -ne 1 -or $l[0].LocalAddress -ne '127.0.0.1'){Hold ('PORT_OWNER_NOT_UNIQUE_'+$n)}
 $p=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$l[0].OwningProcess) -ErrorAction Stop
 if(-not $p -or [string]$p.CommandLine -notmatch $pattern){Hold ('PROCESS_IDENTITY_MISMATCH_'+$n)}
 return [int]$l[0].OwningProcess
}
function GetJson([string]$url,[int]$seconds=10){
 return Invoke-RestMethod -Uri $url -TimeoutSec $seconds -ErrorAction Stop
}
function ConfigValue([string]$key){
 $hits=@(Get-Content -LiteralPath $EnvFile | Where-Object{$_ -match ('^\s*'+[regex]::Escape($key)+'\s*=')})
 if($hits.Count -ne 1){Hold ('ENV_KEY_MISSING_OR_DUPLICATE_'+$key)}
 $val=([string]$hits[0]).Split('=',2)[1].Trim()
 if($val.Length -ge 2 -and (($val[0] -eq '"' -and $val[-1] -eq '"') -or ($val[0] -eq "'" -and $val[-1] -eq "'"))){$val=$val.Substring(1,$val.Length-2)}
 return [Environment]::ExpandEnvironmentVariables($val)
}
function VerifyModel(){
 $h=GetJson 'http://127.0.0.1:8088/health' 8
 if($h.status -notin @('ok','ready')){Hold 'LLAMA_NOT_HEALTHY'}
 $catalog=GetJson 'http://127.0.0.1:8088/v1/models' 10
 $model=ConfigValue 'LLAMA_CPP_MODEL'
 $binary=ConfigValue 'LLAMA_CPP_SERVER'
 if(-not [IO.Path]::IsPathRooted($model) -or -not [IO.Path]::IsPathRooted($binary)){Hold 'CONFIGURED_ASSET_PATH_NOT_ABSOLUTE'}
 File $model;File $binary
 $p=@(Get-Content -LiteralPath $EnvFile | Where-Object{$_ -match '^\s*LLAMA_CPP_PORT\s*='})
 if($p.Count -gt 0 -and (ConfigValue 'LLAMA_CPP_PORT') -ne '8088'){Hold 'CONFIGURED_PORT_NOT_8088'}
 $expected=[IO.Path]::GetFileName($model).ToLowerInvariant()
 $stem=[IO.Path]::GetFileNameWithoutExtension($model).ToLowerInvariant()
 $ids=@($catalog.data | ForEach-Object{[string]$_.id})
 if($ids.Count -lt 1 -or $ids.Count -gt 16){Hold 'MODEL_CATALOG_INVALID'}
 $same=$false
 foreach($id in $ids){
  $name=($id.Replace('\','/') -split '/')[-1].ToLowerInvariant()
  $prefix=$name -replace '\.gguf$',''
  if($name -eq $expected -or $prefix -eq $stem){$same=$true}
 }
 if(-not $same){Hold 'EXTERNAL_MODEL_IDENTITY_MISMATCH'}
}
function InspectVolatile(){
 $h=GetJson 'http://127.0.0.1:8791/health'
 if($h.state -ne 'running'){Hold 'COMPUTE_NOT_HEALTHY'}
 $a=GetJson 'http://127.0.0.1:8791/ai/health'
 $n=[int]$a.universe_count
 Write-Host "COMPUTE_TRAINED=$($h.model_trained) UNIVERSES=$n HOPFIELD_MEMORY=NOT_INSPECTABLE"
 if(($h.model_trained -eq $true -or $n -gt 0) -and -not $AcceptVolatileStateLoss){Hold 'VOLATILE_STATE_PRESENT'}
}
function Recover(){
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Recovery
 if($LASTEXITCODE -ne 0){Hold 'EXISTING_COMPUTE_RECOVERY_FAILED'}
}
foreach($f in @($Runtime,$Baseline,$Candidate,$Recovery,$EnvFile)){File $f}
if((Get-FileHash -LiteralPath $Runtime).Hash -ne (Get-FileHash -LiteralPath $Baseline).Hash){Hold 'LIVE_RUNTIME_NOT_EXPECTED_BASELINE'}
$computePid=PidOf 8791 'uvicorn\s+compute_service\.app:app'
$llamaPid=PidOf 8088 '(llama-server|llama\.exe)'
$dashboardPid=PidOf 8789 'src[/\\]server\.mjs'
VerifyModel
InspectVolatile
$python=[string](Get-CimInstance Win32_Process -Filter ("ProcessId="+$computePid)).ExecutablePath
File $python
Push-Location $Repo
try{
 & $python -m unittest ai_ml.test_llama_external_adoption -q
 if($LASTEXITCODE -ne 0){Hold 'EXTERNAL_ADOPTION_TESTS_FAILED'}
}finally{Pop-Location}
New-Item -ItemType Directory -Path $Backup -Force | Out-Null
Copy-Item -LiteralPath $Runtime -Destination (Join-Path $Backup 'llama-runtime.original.py')
Write-Host "FUN_EXTERNAL_LLAMA_ADOPTION_STAGE=PASS COMPUTE_PID=$computePid LLAMA_PID=$llamaPid DASHBOARD_PID=$dashboardPid"
Write-Host "BACKUP=$Backup"
if(-not $Apply){Write-Host 'FUN_EXTERNAL_LLAMA_ADOPTION_APPLY=NOT_PERFORMED';exit 0}
if(-not $AcceptVolatileStateLoss){Hold 'EXPLICIT_VOLATILE_STATE_LOSS_ACCEPTANCE_REQUIRED'}
try{
 if((PidOf 8791 'uvicorn\s+compute_service\.app:app') -ne $computePid){Hold 'COMPUTE_PROCESS_CHANGED'}
 if((PidOf 8088 '(llama-server|llama\.exe)') -ne $llamaPid){Hold 'LLAMA_PROCESS_CHANGED'}
 if((PidOf 8789 'src[/\\]server\.mjs') -ne $dashboardPid){Hold 'DASHBOARD_PROCESS_CHANGED'}
 VerifyModel
 $Changed=$true
 Copy-Item -LiteralPath $Candidate -Destination $Runtime -Force -ErrorAction Stop
 $ComputeStopped=$true
 Stop-Process -Id $computePid -ErrorAction Stop
 for($i=0;$i -lt 40;$i++){if(-not(Port 8791)){break};Start-Sleep -Milliseconds 250}
 if(Port 8791){Hold 'OLD_COMPUTE_PORT_NOT_RELEASED'}
 Recover
 $modelStatus=GetJson 'http://127.0.0.1:8791/ai/runtime/llama-cpp' 12
 if($modelStatus.state -ne 'ready' -or $modelStatus.ownership -ne 'external_unmanaged' -or $modelStatus.managed -ne $false){Hold 'MODEL_ADOPTION_NOT_VERIFIED'}
 if((PidOf 8088 '(llama-server|llama\.exe)') -ne $llamaPid){Hold 'LLAMA_PROCESS_CHANGED_POSTFLIGHT'}
 if((PidOf 8789 'src[/\\]server\.mjs') -ne $dashboardPid){Hold 'DASHBOARD_PROCESS_CHANGED_POSTFLIGHT'}
 $ai=GetJson 'http://127.0.0.1:8789/api/ai/status' 12
 if($ai.state -ne 'ready'){Hold 'DASHBOARD_AI_NOT_READY'}
 Write-Host 'FUN_EXTERNAL_LLAMA_ADOPTION_APPLY=PASS EXTERNAL_MODEL=READY OWNERSHIP=UNMANAGED'
 Write-Host "BACKUP=$Backup"
}catch{
 $reason=$_.Exception.Message
 Write-Warning "FUN_EXTERNAL_LLAMA_ADOPTION=HOLD REASON=$reason"
 if($Changed){
  try{Copy-Item -LiteralPath (Join-Path $Backup 'llama-runtime.original.py') -Destination $Runtime -Force}catch{Write-Warning 'SOURCE_ROLLBACK_FAILED'}
 }
 if($ComputeStopped){
  try{
   if(-not(Port 8791)){Recover;Write-Warning 'OLD_COMPUTE_RECOVERED_CHECK_AI_HEALTH'}
   else{Write-Warning 'COMPUTE_PORT_OCCUPIED_AFTER_FAILURE_REVIEW_REQUIRED'}
  }catch{Write-Warning 'COMPUTE_RECOVERY_FAILED_MANUAL_REVIEW_REQUIRED'}
 }
 throw ('FUN_EXTERNAL_LLAMA_ADOPTION_APPLY_HOLD='+$reason+' BACKUP='+$Backup)
}
