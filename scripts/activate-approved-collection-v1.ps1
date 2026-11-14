param(
 [Parameter(Mandatory=$true)][string]$Root,
 [Parameter(Mandatory=$true)][string]$Stage
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function RequireExit([string]$Label){if($LASTEXITCODE -ne 0){throw ($Label+':EXIT='+$LASTEXITCODE)}}
$Root=[IO.Path]::GetFullPath($Root)
$Stage=[IO.Path]::GetFullPath($Stage)
$baseline='integration/fun-live-evidence-20261113'
$plan='070b202f-1a78-41ae-aaec-7f8cc859417b'
$task='OP1-DEMAND'
$database=Join-Path $env:USERPROFILE 'FunIndustrial-LangGraph-V1\evidence-plans-v1.sqlite'
$python=Join-Path $env:USERPROFILE 'FunIndustrial-LangGraph-V1\.venv\Scripts\python.exe'
$env:FUN_COGNITION_PYTHON=$python
$env:FUN_TEST_LIVE_QWEN='1'
$env:FUN_EVIDENCE_DATABASE=$database
$node=(Get-Command node -ErrorAction Stop).Source
$changed=@(
 'src/server.mjs',
 'public/index.html',
 'src/cognition/evidence-assessment-storage-v1.mjs',
 'src/cognition/approved-single-page-retrieval-v1.mjs',
 'src/cognition/approved-collection-bridge-v1.mjs'
)
$existing=@('src/server.mjs','public/index.html','src/cognition/evidence-assessment-storage-v1.mjs')
if(!(Test-Path -LiteralPath $Root -PathType Container)){throw 'PRODUCTION_ROOT_MISSING'}
if(!(Test-Path -LiteralPath $Stage -PathType Container)){throw 'STAGE_ROOT_MISSING'}
if(!(Test-Path -LiteralPath $python -PathType Leaf)){throw 'PYTHON_VENV_MISSING'}
if(!(Test-Path -LiteralPath $database -PathType Leaf)){throw 'EVIDENCE_DB_MISSING'}
foreach($rel in $changed){if(!(Test-Path -LiteralPath (Join-Path $Stage $rel) -PathType Leaf)){throw ('STAGED_FILE_MISSING='+$rel)}}
Write-Host 'STAGE7932_OFFLINE_VERIFICATION=START'
foreach($rel in @('src/server.mjs','src/cognition/approved-single-page-retrieval-v1.mjs','src/cognition/approved-collection-bridge-v1.mjs','src/cognition/evidence-assessment-storage-v1.mjs','src/cognition/approved-collection-contract-v1.test.mjs','scripts/approved-source-preflight-v1.mjs')){
 & $node --check (Join-Path $Stage $rel)
 RequireExit ('JS_SYNTAX_HOLD='+$rel)
}
& $node --test (Join-Path $Stage 'src/cognition/approved-collection-contract-v1.test.mjs')
RequireExit 'ISOLATED_E2E_TEST_HOLD'
& $node (Join-Path $Stage 'scripts/approved-source-preflight-v1.mjs') $database $python $plan $task
RequireExit 'READONLY_PRODUCTION_PREFLIGHT_HOLD'
Write-Host 'STAGE7932_OFFLINE_VERIFICATION=PASS'
# Detect local drift against the pushed baseline; never overwrite newer work.
foreach($rel in $existing){
 $target=Join-Path $Root $rel
 if(!(Test-Path -LiteralPath $target -PathType Leaf)){throw ('PRODUCTION_FILE_MISSING='+$rel)}
 $expected=(& git -C $Root rev-parse ($baseline+':'+$rel))
 RequireExit ('BASELINE_READ_HOLD='+$rel)
 $actual=(& git -C $Root hash-object ('--path='+$rel) -- $target)
 RequireExit ('LOCAL_HASH_HOLD='+$rel)
 if(($expected | Out-String).Trim() -ne ($actual | Out-String).Trim()){throw ('LOCAL_DRIFT_HOLD_NO_CHANGES='+$rel)}
}
foreach($rel in $changed | Where-Object {$_ -notin $existing}){
 $dest=Join-Path $Root $rel
 if(Test-Path -LiteralPath $dest){$a=(Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash;$b=(Get-FileHash -LiteralPath (Join-Path $Stage $rel) -Algorithm SHA256).Hash;if($a -ne $b){throw ('EXISTING_MODULE_HOLD='+$rel)}}
}
Write-Host 'PRODUCTION_SOURCE_DRIFT=NONE'
# Confirm listener identity. Only the dashboard process is eligible for restart.
$listeners=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalAddress -in @('127.0.0.1','::1')})
$owners=@($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
if($owners.Count -gt 1){throw 'MULTIPLE_DASHBOARD_OWNERS_HOLD'}
$oldPid=0
if($owners.Count -eq 1){
 $oldPid=[int]$owners[0]
 $proc=Get-CimInstance Win32_Process -Filter ("ProcessId = "+$oldPid)
 if(!$proc -or $proc.Name -ine 'node.exe' -or $proc.CommandLine -notmatch 'server\.mjs'){throw ('DASHBOARD_PROCESS_IDENTITY_HOLD='+$oldPid)}
 $page=Invoke-WebRequest -Uri 'http://127.0.0.1:8789/' -UseBasicParsing -TimeoutSec 6
 if($page.StatusCode -ne 200 -or $page.Content -notmatch 'fiGroundedResearch'){throw 'EXISTING_DASHBOARD_IDENTITY_HOLD'}
 Write-Host ('EXISTING_DASHBOARD_PID='+$oldPid)
}else{Write-Host 'EXISTING_DASHBOARD_PID=NONE'}
# The Qwen check is read-only. Never start, stop or reconfigure Qwen.
try{
 $models=Invoke-WebRequest -Uri 'http://127.0.0.1:8088/v1/models' -UseBasicParsing -TimeoutSec 6
 if($models.StatusCode -ne 200){throw 'MODEL_UNREADY'}
 Write-Host 'QWEN_API=READY'
}catch{throw 'QWEN_NOT_READY_NO_CHANGES'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\ApprovedCollectionBackup\'+$stamp)
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach($rel in $changed){
 $dest=Join-Path $Root $rel
 if(Test-Path -LiteralPath $dest){
  $save=Join-Path $backup $rel
  New-Item -ItemType Directory -Path (Split-Path -Parent $save) -Force | Out-Null
  Copy-Item -LiteralPath $dest -Destination $save -Force
 }
}
Write-Host ('BACKUP_DIRECTORY='+$backup)
$deployed=$false;$oldStopped=$false;$newProcess=$null
$logDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\ApprovedCollectionLogs\'+$stamp)
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
try{
 $deployed=$true
 foreach($rel in $changed){
  $from=Join-Path $Stage $rel;$to=Join-Path $Root $rel
  New-Item -ItemType Directory -Path (Split-Path -Parent $to) -Force | Out-Null
  Copy-Item -LiteralPath $from -Destination $to -Force
  if((Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash){throw ('FILE_COPY_INTEGRITY_HOLD='+$rel)}
 }
 if($oldPid -gt 0){
  Stop-Process -Id $oldPid -ErrorAction Stop
  $oldStopped=$true
  Wait-Process -Id $oldPid -Timeout 12 -ErrorAction SilentlyContinue
  if(Get-Process -Id $oldPid -ErrorAction SilentlyContinue){throw 'DASHBOARD_STOP_HOLD'}
 }
 $env:HOST='127.0.0.1';$env:PORT='8789'
 $newProcess=Start-Process -FilePath $node -ArgumentList @('src/server.mjs') -WorkingDirectory $Root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'dashboard.out.log') -RedirectStandardError (Join-Path $logDir 'dashboard.err.log')
 $ready=$false
 for($i=0;$i -lt 20;$i++){
  Start-Sleep -Milliseconds 750
  if($newProcess.HasExited){break}
  try{
   $response=Invoke-WebRequest -Uri 'http://127.0.0.1:8789/' -UseBasicParsing -TimeoutSec 3
   if($response.StatusCode -eq 200 -and $response.Content -match 'fiApproveCollectSource' -and $response.Content -match 'fiGroundedClaim'){$ready=$true;break}
  }catch{}
 }
 if(!$ready){throw 'DASHBOARD_NEW_HEALTH_HOLD'}
 # This deliberately unapproved request MUST be rejected before any network access.
 $rejected=$false
 try{
  Invoke-WebRequest -Uri 'http://127.0.0.1:8789/api/research/collect-source' -UseBasicParsing -TimeoutSec 8 -Method POST -ContentType 'application/json' -Body '{"approved":false,"url":"https://example.org/","plan_id":"070b202f-1a78-41ae-aaec-7f8cc859417b","task_id":"OP1-DEMAND"}' | Out-Null
 }catch{if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 403){$rejected=$true}}
 if(!$rejected){throw 'UNAPPROVED_RETRIEVAL_GATE_HOLD'}
 Write-Host 'STAGE7932_ACTIVATION=PASS'
 Write-Host ('DASHBOARD_PID='+$newProcess.Id)
 Write-Host 'DASHBOARD_URL=http://127.0.0.1:8789'
 Write-Host 'APPROVAL_GATE=PASS_NO_EXTERNAL_REQUESTS'
 Write-Host 'SINGLE_PAGE_LIVE_COLLECTION=AWAITING_OPERATOR_CLICK'
 Write-Host ('DASHBOARD_LOGS='+$logDir)
 Write-Host 'OTHER_SERVICES_UNTOUCHED=TRUE'
}catch{
 $failure=[string]$_.Exception.Message
 if($newProcess -and !$newProcess.HasExited){Stop-Process -Id $newProcess.Id -ErrorAction SilentlyContinue}
 if($deployed){
  foreach($rel in $changed){
   $to=Join-Path $Root $rel;$saved=Join-Path $backup $rel
   if(Test-Path -LiteralPath $saved){Copy-Item -LiteralPath $saved -Destination $to -Force}
   elseif(Test-Path -LiteralPath $to){Remove-Item -LiteralPath $to -Force}
  }
 }
 if($oldStopped){
  try{Start-Process -FilePath $node -ArgumentList @('src/server.mjs') -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'rollback.out.log') -RedirectStandardError (Join-Path $logDir 'rollback.err.log') | Out-Null}catch{Write-Host ('ROLLBACK_RESTART_HOLD='+$_.Exception.Message)}
 }
 Write-Host ('STAGE7932_ORIGINAL_ERROR='+$failure)
 Write-Host ('STAGE7932_ROLLBACK_OR_HOLD='+$failure)
 Write-Host ('DASHBOARD_LOGS='+$logDir)
 throw
}
