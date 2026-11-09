# Recover only Fun Industrial's compute gateway on 127.0.0.1:8791.
# No dashboard restart, no REA actions, no model start/stop and no memory writes.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Root=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$ConfigFile=Join-Path $Root ".env"
$Port=8791
function Fail([string]$reason){throw "FUN_COMPUTE_RECOVERY_HOLD=$reason"}
function Status([string]$url){
 try{return Invoke-RestMethod -Uri $url -TimeoutSec 6 -ErrorAction Stop}catch{return $null}
}
if(-not(Test-Path -LiteralPath (Join-Path $Root "compute_service\app.py") -PathType Leaf)){Fail "COMPUTE_SOURCE_MISSING"}
if(-not(Test-Path -LiteralPath $ConfigFile -PathType Leaf)){Fail "ENV_FILE_MISSING"}
if(-not (Get-NetTCPConnection -LocalPort 8088 -State Listen -ErrorAction SilentlyContinue)){Fail "EXISTING_LLAMA_8088_NOT_LISTENING"}
$old=Status "http://127.0.0.1:$Port/health"
if($old -and $old.state -eq "running"){
 Write-Host "FUN_COMPUTE_RECOVERY=ALREADY_RUNNING PORT=$Port"
 $ai=Status "http://127.0.0.1:8789/api/ai/status"
 Write-Host "FUN_AI_STATUS=$($ai.state)"
 exit 0
}
$listener=@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if($listener.Count){Fail "COMPUTE_PORT_OCCUPIED_BUT_NOT_HEALTHY"}
$keys=@("COMPUTE_COMMAND","LLAMA_CPP_SERVER","LLAMA_CPP_MODEL","LLAMA_CPP_PORT","LLAMA_CPP_THREADS","LLAMA_CPP_CONTEXT","FUN_INDUSTRIAL_RUNTIME")
$settings=@{}
foreach($line in (Get-Content -LiteralPath $ConfigFile)){
 if($line -match '^\s*#'){continue}
 if($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$'){
  $key=$Matches[1]
  if($key -in $keys){
   $value=$Matches[2].Trim()
   if($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))){$value=$value.Substring(1,$value.Length-2)}
   $settings[$key]=[Environment]::ExpandEnvironmentVariables($value)
  }
 }
}
foreach($key in $keys){
 if($key -eq "COMPUTE_COMMAND"){continue}
 if($settings.ContainsKey($key) -and $settings[$key]){Set-Item -Path ("Env:"+$key) -Value $settings[$key]}
}
$env:COMPUTE_PORT="8791"
$env:APP_ROOT=$Root
if(-not $env:LLAMA_CPP_PORT){$env:LLAMA_CPP_PORT="8088"}
$paths=New-Object System.Collections.Generic.List[string]
if($settings.ContainsKey("COMPUTE_COMMAND") -and $settings["COMPUTE_COMMAND"]){
 $given=$settings["COMPUTE_COMMAND"].Trim()
 if($given -ieq "python" -or $given -ieq "python.exe"){
  $cmd=Get-Command python.exe -ErrorAction SilentlyContinue
  if($cmd){$paths.Add($cmd.Source)}
 }else{
  if(-not[IO.Path]::IsPathRooted($given)){$given=Join-Path $Root $given}
  $paths.Add($given)
 }
}
foreach($p in @(
 (Join-Path $Root ".venv\Scripts\python.exe"),
 (Join-Path $Root "venv\Scripts\python.exe"),
 (Join-Path $Root ".runtime\venv\Scripts\python.exe"),
 (Join-Path $env:USERPROFILE "FunIndustrial\.venv\Scripts\python.exe"),
 (Join-Path $env:USERPROFILE "FunIndustrial\venv\Scripts\python.exe"),
 (Join-Path $env:USERPROFILE "FunIndustrial\.runtime\venv\Scripts\python.exe")
)){$paths.Add($p)}
$python=$null
Push-Location $Root
try{
 foreach($candidate in ($paths|Select-Object -Unique)){
  if(-not(Test-Path -LiteralPath $candidate -PathType Leaf)){continue}
  & $candidate -c "import uvicorn,fastapi,networkx,quimb,torch; print('COMPUTE_PYTHON_READY')" 2>$null | Out-Null
  if($LASTEXITCODE -eq 0){$python=$candidate;break}
 }
}finally{Pop-Location}
if(-not $python){Fail "PYTHON_WITH_COMPUTE_DEPENDENCIES_NOT_FOUND_CHECK_COMPUTE_COMMAND"}
$logdir=Join-Path $env:LOCALAPPDATA "FunIndustrial\ComputeRecovery"
New-Item -ItemType Directory -Path $logdir -Force|Out-Null
$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$out=Join-Path $logdir ("compute-"+$stamp+".stdout.log")
$err=Join-Path $logdir ("compute-"+$stamp+".stderr.log")
$p=Start-Process -FilePath $python -ArgumentList @("-m","uvicorn","compute_service.app:app","--host","127.0.0.1","--port","8791","--no-access-log") -WorkingDirectory $Root -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
Write-Host "FUN_COMPUTE_PROCESS_STARTED=PID=$($p.Id) PORT=$Port"
$running=$false
for($i=0;$i -lt 60;$i++){
 Start-Sleep -Milliseconds 500
 $p.Refresh()
 if($p.HasExited){break}
 $h=Status "http://127.0.0.1:$Port/health"
 if($h -and $h.state -eq "running"){$running=$true;break}
}
if(-not $running){
 Write-Warning "FUN_COMPUTE_RECOVERY_LOG=$err"
 if(Test-Path $err){Get-Content $err -Tail 15}
 Fail "COMPUTE_DID_NOT_BECOME_HEALTHY"
}
Write-Host "FUN_COMPUTE_RECOVERY=PASS PORT=$Port PID=$($p.Id)"
$ai=Status "http://127.0.0.1:8789/api/ai/status"
if($ai -and $ai.state -eq "ready"){
 Write-Host "FUN_LLAMA_CPP_CHAT_BACKEND=READY EXISTING_PORT_8088_PRESERVED=TRUE"
}else{
 Write-Warning "FUN_COMPUTE_HEALTHY_BUT_AI_STATUS=$($ai.state) - Check existing llama.cpp adoption without restarting it."
}
Write-Host "FUN_COMPUTE_LOG=$err"
