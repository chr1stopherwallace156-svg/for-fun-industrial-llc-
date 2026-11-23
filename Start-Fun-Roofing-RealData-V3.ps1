# Fun Industrial Roofing Selective V3 — initiate one complete official public source.
# Operator-click equivalent; no secret API keys, model executions, messages or REA.
param(
 [ValidateSet('la_assessor_2021_2025','la_permits_pre2010',
              'la_permits_2010_2019','la_permits_2020_present','sb_arcgis_parcels')]
 [string]$Source='la_assessor_2021_2025'
)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $MyInvocation.MyCommand.Path
if(-not $env:LOCALAPPDATA){throw 'FUN_REALDATA_LOCAL_STORAGE_NOT_CONFIGURED'}
$driveLetter=([System.IO.Path]::GetPathRoot($env:LOCALAPPDATA)).Substring(0,1)
$volume=Get-PSDrive -Name $driveLetter -ErrorAction Stop
$required=if($Source -eq 'la_assessor_2021_2025'){18GB}else{8GB}
if($null -eq $volume.Free -or [double]$volume.Free -lt [double]$required){
 throw ('FUN_REALDATA_FREE_DISK_HOLD_DRIVE='+$driveLetter+' REQUIRED_GB='+($required/1GB))
}
Write-Host ('FUN_REALDATA_DISK_PRECHECK=PASS FREE_GB='+[math]::Round(($volume.Free/1GB),1))
$Activate=Join-Path $Root 'Activate-Fun-Roofing-Bulk-V2.ps1'
if(-not(Test-Path -LiteralPath $Activate)){throw 'FUN_REALDATA_ACTIVATION_SCRIPT_NOT_FOUND'}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Activate
if($LASTEXITCODE -ne 0){throw 'FUN_REALDATA_ACTIVATION_PRECHECK_FAILED'}
$Base='http://127.0.0.1:8802'
$state=Invoke-RestMethod -Method Get -Uri ($Base+'/api/fun/roofing/bulk/status') -TimeoutSec 12
if($state.version -cne 'fun-roofing-bulk-v2' -or
   $state.selection.version -cne 'fun-roofing-selective-v3' -or
   $state.elektronTouched -ne $false -or
   $state.automatedOutreach -ne 0){
 throw 'FUN_REALDATA_UNVERIFIED_STATUS_OR_AUTHORITY_HOLD'
}
if($state.job -and $state.job.state -eq 'RUNNING'){
 Write-Host ('FUN_REALDATA_ALREADY_RUNNING='+$state.job.source)
 Write-Host 'FUN_REALDATA_NO_DUPLICATE_SOURCE_STARTED=TRUE'
 exit 0
}
$existing=@($state.source_runs | Where-Object {$_.source_id -eq $Source -and
                $_.state -eq 'INGESTED_NOT_COMPLETENESS_VERIFIED'})
if($existing.Count -gt 0 -and $state.selection.state -eq 'READY'){
 Write-Host ('FUN_REALDATA_ALREADY_INGESTED='+$Source)
 Write-Host ('FUN_REALDATA_SOURCE_ROWS='+$existing[0].ingested)
 Write-Host 'FUN_REALDATA_NO_REDUNDANT_DOWNLOAD=TRUE'
 exit 0
}
# Previously downloaded official file: inspect only CSV header names, not records.
$archiveDir=Join-Path (Join-Path $env:LOCALAPPDATA 'FunIndustrial\RoofingBulkV2') 'official_downloads'
$extension=if($Source -eq 'la_assessor_2021_2025'){'zip'}elseif($Source -like 'la_permits_*'){'csv'}else{''}
if($extension){
 $cached=Join-Path $archiveDir ($Source+'.'+$extension)
 # Python on some Windows hosts uses an OpenSSL CA store that cannot verify
 # official LA City's certificate. Fetch the fixed public CSV with Windows'
 # native certificate validation before letting the Python importer reuse it.
 if($Source -like 'la_permits_*' -and
    -not(Test-Path -LiteralPath $cached -PathType Leaf)){
  $windowsDownload=Join-Path $Root 'Download-Fun-LACity-Permits-WindowsTLS-V1.ps1'
  if(-not(Test-Path -LiteralPath $windowsDownload -PathType Leaf)){
   throw 'FUN_LACITY_WINDOWS_TLS_DOWNLOADER_MISSING'
  }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $windowsDownload -Source $Source
  if($LASTEXITCODE -ne 0){
   throw 'FUN_LACITY_WINDOWS_CERT_VERIFIED_DOWNLOAD_FAILED_NO_IMPORT_STARTED'
  }
  Write-Host 'FUN_LACITY_WINDOWS_TLS_DOWNLOAD=COMPLETED_IMPORT_STILL_PENDING'
 }
 if(Test-Path -LiteralPath $cached -PathType Leaf){
  Write-Host ('FUN_REALDATA_REUSE_CACHED_ARCHIVE_BYTES='+(Get-Item -LiteralPath $cached).Length)
  $py=(Get-Command python.exe -ErrorAction Stop).Source
  & $py -B (Join-Path $Root 'src\roofing\roofing_bulk_v2.py') inspect --file $cached
  if($LASTEXITCODE -ne 0){throw 'FUN_REALDATA_CACHED_SOURCE_SCHEMA_HOLD'}
  if($Source -eq 'la_assessor_2021_2025'){
   & $py -B (Join-Path $Root 'src\roofing\roofing_bulk_v2.py') probe-assessor --file $cached --sample-rows 1500
   if($LASTEXITCODE -ne 0){throw 'FUN_REALDATA_CACHED_ASSESSOR_SAMPLE_HOLD'}
   Write-Host 'FUN_REALDATA_ASSESSOR_SAMPLE_VALIDATED=TRUE_FULL_IMPORT_STILL_UNVERIFIED'
  }
 }
}
$body=@{source=$Source}|ConvertTo-Json -Compress
$headers=@{'Origin'=$Base;'x-fi-roofing-bulk-click'='operator-sync-full-export'}
$params=@{Method='Post';Uri=($Base+'/api/fun/roofing/bulk/sync');
 ContentType='application/json';Headers=$headers;Body=$body;TimeoutSec=20}
$response=Invoke-RestMethod @params
if($response.state -cne 'OPERATOR_SYNC_REQUESTED' -or
   $response.source -cne $Source -or
   $response.reportedComplete -ne $false){throw 'FUN_REALDATA_LAUNCH_RESPONSE_INVALID'}
Write-Host ('FUN_REALDATA_PUBLIC_SOURCE_START_REQUESTED='+$Source)
Write-Host ('FUN_REALDATA_WORKER_PID='+$response.workerPid)
Write-Host 'FUN_REALDATA_COMPLETION=NOT_YET_VERIFIED'
Write-Host 'FUN_REALDATA_SOURCE_IS_PUBLIC=TRUE NO_PRIVATE_API_KEY_REQUIRED=TRUE'
Write-Host 'FUN_REALDATA_TARGETING=AUTOMATIC_SELECT_HOLD_PRUNE_AFTER_VALIDATED_FULL_IMPORT'
Write-Host ('FUN_REALDATA_DASHBOARD='+$Base+'/roofing/bulk/')
