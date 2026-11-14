# FUN_FIAL2_QWEN8088_ONLY_RECOVERY_V1
# Explicitly operator-invoked. May start ONE missing local llama.cpp process, never restart,
# stop or modify another Fun Industrial or Elektron process. Runs FIAL2 only after health.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fun-ml-unified-dashboard-v3-20261113'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Llama=Join-Path $HOME 'FunIndustrial\.runtime\llama.cpp\llama-server.exe'
$Model=Join-Path $HOME 'FunIndustrial\.runtime\models\Qwen3-4B-Q4_K_M.gguf'
$FialRunner=Join-Path $Root 'scripts\Run-Fun-FIAL-Semantic-V2.mjs'
$QwenUrl='http://127.0.0.1:8088/health'
$ProtectedPorts=@(11434,8791,8789,8796,8797,8798,8801,8802,8443)
function Hold([string]$reason){throw ('FUN_FIAL2_QWEN_RECOVERY_HOLD='+$reason)}
function OrdinaryFile([string]$f){
 if(!(Test-Path -LiteralPath $f -PathType Leaf)){Hold ('MISSING_FILE='+$f)}
 if(((Get-Item -LiteralPath $f -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SYMLINK_REFUSED='+$f)
 }
}
function Listeners([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$port){
 return (@(Listeners $port|ForEach-Object { "$($_.LocalAddress):$($_.OwningProcess)" }|Sort-Object)-join ';')
}
function VerifyListener(){
 $found=@(Listeners 8088)
 if($found.Count -eq 0){return $null}
 if($found.Count -ne 1 -or $found[0].LocalAddress -cne '127.0.0.1'){
  Hold '8088_UNEXPECTED_INTERFACE_OR_MULTIPLE_LISTENERS'
 }
 $id=[int]$found[0].OwningProcess
 if($id -le 0){Hold '8088_INVALID_OWNER'}
 $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id) -ErrorAction Stop
 if($null -eq $proc -or $proc.Name -ine 'llama-server.exe' -or
   [string]$proc.ExecutablePath -ine $Llama -or
   ([string]$proc.CommandLine).IndexOf('Qwen3-4B-Q4_K_M.gguf',[StringComparison]::OrdinalIgnoreCase) -lt 0){
  Hold ('8088_UNTRUSTED_LISTENER_PID_'+$id)
 }
 return $id
}
function Health(){
 try{
  $r=Invoke-RestMethod -Uri $QwenUrl -TimeoutSec 4 -ErrorAction Stop
  return ($r.status -ceq 'ok')
 }catch{return $false}
}
if((git.exe -C $Root remote get-url origin) -cne $Origin -or
   (git.exe -C $Root branch --show-current) -cne $Branch -or $LASTEXITCODE -ne 0){
 Hold 'GIT_REPOSITORY_IDENTITY_INVALID'
}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -gt 0 -or $LASTEXITCODE -ne 0){
 Hold 'SOURCE_WORKTREE_CHANGED'
}
OrdinaryFile $Llama
OrdinaryFile $Model
OrdinaryFile $FialRunner
$Node=(Get-Command node.exe -ErrorAction Stop).Source
& $Node --check $FialRunner
if($LASTEXITCODE -ne 0){Hold 'FIAL2_SOURCE_SYNTAX_INVALID'}
$size=(Get-Item -LiteralPath $Model).Length
if($size -lt 1024*1024*500){Hold ('QWEN_MODEL_FILE_TOO_SMALL_BYTES_'+$size)}
$existing=VerifyListener
$before=@{}
foreach($port in $ProtectedPorts){$before[$port]=Snapshot $port}
if($null -ne $existing){
 if(!(Health)){Hold ('8088_LISTENER_PRESENT_BUT_UNHEALTHY_NO_RESTART_PID_'+$existing)}
 Write-Host ('FUN_QWEN_8088=HEALTHY_ADOPTED_PID_'+$existing)
}else{
 # Refuse a second copy if the intended Qwen model is already being loaded
 # by a process which has not yet bound 8088 or bound a different port.
 $candidates=@(Get-CimInstance Win32_Process -Filter "Name='llama-server.exe'" -ErrorAction Stop)
 foreach($candidate in $candidates){
  if(([string]$candidate.CommandLine).IndexOf('Qwen3-4B-Q4_K_M.gguf',[StringComparison]::OrdinalIgnoreCase) -ge 0){
   Hold ('QWEN_PROCESS_ALREADY_EXISTS_WITHOUT_EXPECTED_LISTENER_PID_'+$candidate.ProcessId)
  }
 }
 if($CheckOnly){
  Write-Host 'FUN_QWEN_8088=MISSING VERIFIED_FILES_PRESENT CHECK_ONLY_NO_START'
  Write-Host 'FUN_FIAL2=NOT_RUN'
  return
 }
 $logs=Join-Path $env:LOCALAPPDATA ('FunIndustrial\FIAL2QwenRecovery\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
 New-Item -ItemType Directory -Path $logs -Force -ErrorAction Stop|Out-Null
 $args='--model "'+$Model+'" --host 127.0.0.1 --port 8088 --threads 4 --ctx-size 4096 --n-gpu-layers 0 --jinja'
 $child=Start-Process -FilePath $Llama -ArgumentList $args -WorkingDirectory (Split-Path $Llama) -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $logs 'llama.stdout.log') -RedirectStandardError (Join-Path $logs 'llama.stderr.log')
 Write-Host ('FUN_QWEN_8088=START_REQUEST_PID_'+$child.Id)
 Write-Host ('FUN_QWEN_START_LOGS='+$logs)
 $ready=$false
 for($i=0;$i -lt 150;$i++){
  Start-Sleep -Milliseconds 600
  $listener=VerifyListener
  if($listener -and $listener -ne $child.Id){Hold ('8088_PROCESS_RACE_PID_'+$listener)}
  if($listener -eq $child.Id -and (Health)){$ready=$true;break}
  if($child.HasExited){Hold ('QWEN_EXITED_BEFORE_HEALTH_CHECK_LOGS='+$logs)}
 }
 if(!$ready){Hold ('QWEN_STARTUP_NOT_HEALTHY_LOGS='+$logs)}
 Write-Host ('FUN_QWEN_8088=STARTED_HEALTHY_PID_'+$child.Id)
}
foreach($port in $ProtectedPorts){
 if((Snapshot $port) -cne $before[$port]){Hold ('PROTECTED_SERVICE_CHANGED_PORT_'+$port)}
}
if($CheckOnly){
 Write-Host 'FUN_FIAL2=NOT_RUN CHECK_ONLY'
 return
}
Write-Host 'FUN_QWEN_8088=READY EXISTING_FUN_SERVICES_UNTOUCHED'
& $Node $FialRunner --once
if($LASTEXITCODE -ne 0){Hold 'FIAL2_LIVE_SEMANTIC_REVIEW_FAILED'}
$receiptPath=Join-Path $env:LOCALAPPDATA 'FunIndustrial\RealApplicationWorkerV1\fial\semantic-v2\last-run.json'
OrdinaryFile $receiptPath
$receipt=Get-Content -LiteralPath $receiptPath -Raw|ConvertFrom-Json
if($receipt.version -cne 'fial-semantic-engine-v0.2' -or
 $receipt.applications_submitted -ne 0 -or $receipt.rea_executions -ne 0 -or
 $receipt.emails_sent -ne 0 -or $receipt.money_spent -ne 0){
 Hold 'FIAL2_AUTHORITY_REPORT_INVALID'
}
Write-Host ('FUN_FIAL2_QWEN_CASES='+[int]$receipt.candidates_reviewed+' GROUNDED_QUOTES='+[int]$receipt.model_quotes_grounded)
$unavailable=@($receipt.cases|Where-Object {
 $_.model_status -ceq 'MODEL_UNAVAILABLE_OR_UNVERIFIED' -or
 $_.model_status -ceq 'MODEL_OUTPUT_UNVERIFIED'
})
if($unavailable.Count -gt 0){
 Write-Host ('FUN_FIAL2_SEMANTICS=MODEL_REQUEST_OR_JSON_HOLD COUNT='+$unavailable.Count)
}elseif([int]$receipt.model_quotes_grounded -gt 0){
 Write-Host 'FUN_FIAL2_SEMANTICS=SOURCE_QUOTES_MATCHED_INTERPRETATION_UNVERIFIED'
}else{
 Write-Host 'FUN_FIAL2_SEMANTICS=NO_SOURCE_GROUNDED_INTERPRETATIONS'
}
Write-Host ('FUN_FIAL2_EVIDENCE_REPORT='+$receiptPath)
Write-Host 'FUN_FIAL2_QWEN_RECOVERY=PASS NO_OTHER_SERVICES_RESTARTED ELEKTRON_OLLAMA_UNTOUCHED'
