param(
 [Parameter(Mandatory=$true)][string]$Root,
 [Parameter(Mandatory=$true)][string]$Stage,
 [string]$BackupTag='20261113-205332'
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=[IO.Path]::GetFullPath($Root)
$Stage=[IO.Path]::GetFullPath($Stage)
$backup=Join-Path $env:LOCALAPPDATA ('FunIndustrial\ApprovedCollectionBackup\'+$BackupTag)
$logs=Join-Path $env:LOCALAPPDATA ('FunIndustrial\ApprovedCollectionLogs\'+$BackupTag)
$changed=@(
 'src/server.mjs',
 'public/index.html',
 'src/cognition/evidence-assessment-storage-v1.mjs',
 'src/cognition/approved-single-page-retrieval-v1.mjs',
 'src/cognition/approved-collection-bridge-v1.mjs'
)
$original=@(
 'src/server.mjs',
 'public/index.html',
 'src/cognition/evidence-assessment-storage-v1.mjs'
)
if(!(Test-Path -LiteralPath $backup -PathType Container)){throw ('PREVIOUS_BACKUP_NOT_FOUND='+$backup)}
if(!(Test-Path -LiteralPath $Stage -PathType Container)){throw 'STAGING_WORKTREE_MISSING'}
$stageMatching=0
foreach($rel in $changed){
 $dest=Join-Path $Root $rel
 $source=Join-Path $Stage $rel
 $old=Join-Path $backup $rel
 if(!(Test-Path -LiteralPath $source -PathType Leaf)){throw ('STAGED_FILE_MISSING='+$rel)}
 if($rel -in $original -and !(Test-Path -LiteralPath $old -PathType Leaf)){throw ('ORIGINAL_BACKUP_MISSING='+$rel)}
 if(Test-Path -LiteralPath $dest -PathType Leaf){
  $hash=(Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash
  if($hash -eq (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash){$stageMatching++;continue}
  if((Test-Path -LiteralPath $old -PathType Leaf) -and $hash -eq (Get-FileHash -LiteralPath $old -Algorithm SHA256).Hash){continue}
  throw ('UNEXPECTED_LOCAL_CHANGE_HOLD='+$rel)
 }else{
  if($rel -in $original){throw ('ORIGINAL_MISSING_HOLD='+$rel)}
 }
}
Write-Host ('RECOGNIZED_PATCH_FILES='+$stageMatching+'/'+$changed.Count)
$originalError=Join-Path $logs 'dashboard.err.log'
if(Test-Path -LiteralPath $originalError){
 Write-Host 'PREVIOUS_DASHBOARD_ERROR_LOG_BEGIN'
 Get-Content -LiteralPath $originalError -Tail 16
 Write-Host 'PREVIOUS_DASHBOARD_ERROR_LOG_END'
}
$listeners=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalAddress -in @('127.0.0.1','::1')})
$owners=@($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
if($owners.Count -gt 1){throw 'MULTIPLE_DASHBOARD_PROCESSES_HOLD'}
if($owners.Count -eq 1){
 $ownerPid=[int]$owners[0]
 $proc=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$ownerPid)
 if(!$proc -or $proc.Name -ine 'node.exe' -or $proc.CommandLine -notmatch 'server\.mjs'){throw ('FOREIGN_PORT_OWNER_HOLD='+$ownerPid)}
 Write-Host ('DASHBOARD_LISTENER_PID='+$ownerPid)
}
# If the previous attempt already activated the dashboard, leave its files and process alone.
if($stageMatching -eq $changed.Count -and $owners.Count -eq 1){
 $isActive=$false;$approvalRejected=$false
 try{
  $response=Invoke-WebRequest -Uri 'http://127.0.0.1:8789/' -UseBasicParsing -TimeoutSec 6
  if($response.StatusCode -eq 200 -and $response.Content -match 'fiApproveCollectSource' -and $response.Content -match 'fiGroundedClaim'){$isActive=$true}
 }catch{}
 if($isActive){
  try{
   Invoke-WebRequest -Uri 'http://127.0.0.1:8789/api/research/collect-source' -UseBasicParsing -TimeoutSec 6 -Method POST -ContentType 'application/json' -Body '{"approved":false}' | Out-Null
  }catch{if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 403){$approvalRejected=$true}}
 }
 if($isActive -and $approvalRejected){
  Write-Host 'STAGE7932_ACTIVATION=PASS_ALREADY_RUNNING'
  Write-Host ('DASHBOARD_PID='+$ownerPid)
  Write-Host 'APPROVAL_GATE=PASS_NO_EXTERNAL_REQUESTS'
  Write-Host 'OTHER_SERVICES_UNTOUCHED=TRUE'
  exit 0
 }
}
# Restore only recognized staged-file changes using the backup from the failed attempt.
# Do not touch the dashboard process here. The corrected activator will identify and restart it.
foreach($rel in $original){
 $from=Join-Path $backup $rel
 $to=Join-Path $Root $rel
 Copy-Item -LiteralPath $from -Destination $to -Force
 if((Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash){throw ('ORIGINAL_RESTORE_INTEGRITY_HOLD='+$rel)}
}
foreach($rel in $changed | Where-Object {$_ -notin $original}){
 $to=Join-Path $Root $rel
 $old=Join-Path $backup $rel
 if(Test-Path -LiteralPath $old){
  Copy-Item -LiteralPath $old -Destination $to -Force
 }elseif(Test-Path -LiteralPath $to){
  Remove-Item -LiteralPath $to -Force
 }
}
Write-Host 'PREVIOUS_PARTIAL_PATCH_RESTORED=PASS'
Write-Host 'RETRYING_CORRECTED_ACTIVATOR'
& (Join-Path $Stage 'scripts\activate-approved-collection-v1.ps1') -Root $Root -Stage $Stage
