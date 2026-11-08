# Read-only verification of domestic + international sourcing removal.
# Safe to run after a partial purge. NEVER deletes or changes a file.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$base='http://127.0.0.1:8789'
$worker='http://127.0.0.1:8792'
function RequireGone([string]$url,[string]$method='GET'){
 $status=0
 try {
  $r=Invoke-WebRequest -Uri $url -UseBasicParsing -Method $method -TimeoutSec 15 -ErrorAction Stop
  $status=[int]$r.StatusCode
 }catch{
  if(-not $_.Exception.Response){throw "SOURCE_API_UNREACHABLE=$url"}
  $status=[int]$_.Exception.Response.StatusCode
 }
 if($status -ne 410){throw "SOURCE_API_NOT_RETIRED=$url HTTP=$status"}
 Write-Host "SOURCE_API_RETIRED=PASS HTTP=410 URL=$url"
}
$status=Invoke-RestMethod "$base/api/status" -TimeoutSec 20
if($status.application -ne 'Fun Industrial Platform'){throw 'PRIMARY_PLATFORM_NOT_READY'}
$side=Invoke-RestMethod "$worker/api/status" -TimeoutSec 20
if($side.application -ne 'Fun Industrial Autonomous Workers' -or $side.state -ne 'running' -or $side.schedule.domestic -ne 'retired_no_new_scans'){throw 'WORKER_NOT_RETIRED_OR_NOT_READY'}
foreach($route in @('/api/autonomy/opportunities','/api/autonomy/international','/api/autonomy/scan')){
 RequireGone ($base+$route) $(if($route.EndsWith('/scan')){'POST'}else{'GET'})
}
foreach($route in @('/api/opportunities','/api/international','/api/opportunities/scan')){
 RequireGone ($worker+$route) $(if($route.EndsWith('/scan')){'POST'}else{'GET'})
}
$rea=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 45).tools)
$unified=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 30
if($rea.Count -ne 229 -or [int]$unified.rea_enabled -ne 229){throw 'REA_REGISTRY_SCOPE_HOLD'}
$root=Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab\autonomy-v2-github'
if(-not(Test-Path -LiteralPath (Join-Path $root 'src\service.mjs') -PathType Leaf)){throw 'WORKER_CODE_MISSING'}
$removed=0;$stillThere=New-Object 'System.Collections.Generic.List[string]'
foreach($part in @(
 'src\domestic.mjs','src\international.mjs','src\gsa-bridge.mjs',
 'Import-International.mjs','Estimate-International-Cost.mjs','GSA-Import-From-File.mjs',
 'data\gsa-import.json','data\domestic-latest.json','data\domestic-manual.json'
)){
 $name=Join-Path $root $part
 if(Test-Path -LiteralPath $name){$stillThere.Add($name)}else{$removed++}
}
if($stillThere.Count -gt 0){Write-Warning "SOURCING_SAMPLES_STILL_EXIST=$($stillThere.Count)";foreach($name in $stillThere){Write-Warning "PRESENT=$name"}}
Write-Host "SOURCING_SAMPLES_ABSENT=$removed OF=9"
$profile=[IO.Path]::GetFullPath($env:USERPROFILE)
$remaining=0
foreach($folderName in @('FunIndustrial-US-Opportunities','FunIndustrial-International-Sourcing','FunIndustrial-Asia-Sourcing','FunIndustrial-Sourcing-Retirement')){
 $folder=Join-Path $profile $folderName
 if(-not(Test-Path -LiteralPath $folder -PathType Container)){continue}
 $remaining++
 $files=@(Get-ChildItem -LiteralPath $folder -File -Recurse -Force -ErrorAction Stop)
 [long]$bytes=0;foreach($file in $files){$bytes += [long]$file.Length}
 $secrets=@($files|Where-Object {
  $_.Name -match '(?i)^(?:\.env(?:\..+)?|credentials\.(?:json|yaml|yml)|secret\.(?:json|yaml|yml)|.*\.(?:pem|key|p12|pfx))$' -and
  $_.Name -notmatch '(?i)^\.env\.(?:example|sample|template|dist)$'
 })
 Write-Host ("REMAINING_CHECKOUT={0} MiB={1:N2} CREDENTIAL_FILES_DETECTED={2}" -f $folder,($bytes/1MB),$secrets.Count)
}
$drive=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($profile))
Write-Host ("DISK_FREE_CURRENT_GIB={0:N3}" -f ($drive.AvailableFreeSpace/1GB))
Write-Host "FUN_INDUSTRIAL_VERIFIED=PASS SOURCING_APIS_RETIRED=6 REA_TOOLS=$($rea.Count) REA_ENABLED=$($unified.rea_enabled) REMAINING_SOURCE_CHECKOUTS=$remaining"
Write-Host 'VERIFICATION_MODE=READ_ONLY DELETED=0'
