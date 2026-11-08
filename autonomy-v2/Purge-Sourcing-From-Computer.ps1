# Permanently remove Fun Industrial sourcing-only local files and old sourcing clones.
# Requires a confirmed HTTP 410 retirement on ports 8789/8792.
# Never deletes the active Fun Industrial root, AI models, REA, SQLite, or general research.
[CmdletBinding()]
param(
 [switch]$PreviewOnly,
 [string]$Root='C:\Users\alxar\FunIndustrial-REA-MCP-Activation'
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$homeDir=[IO.Path]::GetFullPath($env:USERPROFILE)
$rootDir=[IO.Path]::GetFullPath($Root)
$autoRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab'))
$worker=[IO.Path]::GetFullPath((Join-Path $autoRoot 'autonomy-v2-github'))
$dataDir=Join-Path $worker 'data'
$logDir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
$expectedRepo='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-'
$approvedRemotes=@($expectedRepo,($expectedRepo+'.git'),'git@github.com:chr1stopherwallace156-svg/for-fun-industrial-llc-.git')
$base='http://127.0.0.1:8789'
$workerBase='http://127.0.0.1:8792'
# Hard-stop if a custom path points outside the sole known Fun Industrial install.
if($rootDir -ne (Join-Path $homeDir 'FunIndustrial-REA-MCP-Activation')){throw 'PURGE_UNEXPECTED_MAIN_PLATFORM_ROOT'}
if($autoRoot -ne (Join-Path $env:LOCALAPPDATA 'FunIndustrial\AutonomyLab')){throw 'PURGE_UNEXPECTED_AUTONOMY_ROOT'}
function Test-Http410([string]$url,[string]$method='GET'){
 $status=0
 try {
  $r=Invoke-WebRequest -Uri $url -Method $method -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
  $status=[int]$r.StatusCode
 } catch {
  $resp=$_.Exception.Response
  if(-not $resp){throw "PURGE_CANNOT_REACH_RETIRED_API=$url"}
  $status=[int]$resp.StatusCode
 }
 if($status -ne 410){throw "PURGE_REQUIRES_RETIRED_HTTP_410 URL=$url HTTP=$status"}
}
# Don't delete the sourcing code if the deployment is not fully retired and healthy.
$dashboard=Invoke-RestMethod "$base/api/status" -TimeoutSec 20
$autonomy=Invoke-RestMethod "$workerBase/api/status" -TimeoutSec 20
if($dashboard.application -ne 'Fun Industrial Platform' -or $autonomy.application -ne 'Fun Industrial Autonomous Workers' -or $autonomy.state -ne 'running'){throw 'PURGE_PLATFORM_HEALTH_NOT_VERIFIED'}
if($autonomy.schedule.domestic -ne 'retired_no_new_scans'){throw 'PURGE_DOMESTIC_SCHEDULE_STILL_ACTIVE'}
foreach($name in @('/api/autonomy/opportunities','/api/autonomy/international','/api/autonomy/scan')){
 Test-Http410 ($base+$name) $(if($name.EndsWith('/scan')){'POST'}else{'GET'})
}
foreach($name in @('/api/opportunities','/api/international','/api/opportunities/scan')){
 Test-Http410 ($workerBase+$name) $(if($name.EndsWith('/scan')){'POST'}else{'GET'})
}
$tools=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 45).tools)
if($tools.Count -ne 229){throw 'PURGE_REA_REGISTRY_NOT_READY'}
$unified=Invoke-RestMethod "$base/api/unified/status" -TimeoutSec 25
if([int]$unified.rea_enabled -ne 229){throw 'PURGE_REA_SCOPE_CHANGED'}
$liveUI=Join-Path $rootDir 'public\index.html'
$liveServer=Join-Path $rootDir 'src\server.mjs'
if(-not(Test-Path -LiteralPath $liveUI -PathType Leaf) -or -not(Test-Path -LiteralPath $liveServer -PathType Leaf)){throw 'PURGE_PRIMARY_FILES_MISSING'}
if(-not([IO.File]::ReadAllText($liveUI)).Contains('FI_SOURCING_RETIRED_V1')){throw 'PURGE_LIVE_UI_NOT_RETIRED'}
foreach($entry in @('src\http.mjs','src\jobs.mjs','src\service.mjs')){
 $f=Join-Path $worker $entry
 if(-not(Test-Path -LiteralPath $f -PathType Leaf)){throw "PURGE_WORKER_ENTRY_MISSING=$entry"}
 $raw=[IO.File]::ReadAllText($f)
 if(-not $raw.Contains('FI_SOURCING_RETIRED_V1')){throw "PURGE_WORKER_NOT_RETIRED=$entry"}
 if($raw.Contains('./domestic.mjs') -or $raw.Contains('./international.mjs') -or $raw.Contains('./gsa-bridge.mjs')){throw "PURGE_WORKER_STILL_IMPORTS_SOURCE=$entry"}
}
# Importer/example modules and obsolete research history are removable. Keep the
# actual 8792 service, Sidequest SQLite, general GitHub research and product data.
$manifest=New-Object System.Collections.Generic.List[object]
$skipped=New-Object System.Collections.Generic.List[object]
function AddFile([string]$location,[string]$category){
 if(-not(Test-Path -LiteralPath $location -PathType Leaf)){return}
 $manifest.Add([pscustomobject]@{Kind='File';Category=$category;Path=$location;Bytes=[long](Get-Item -LiteralPath $location -Force).Length})
}
function FolderIsSafe([string]$location){
 if(-not(Test-Path -LiteralPath $location -PathType Container)){return $false}
 $item=Get-Item -LiteralPath $location -Force
 if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw "PURGE_REPARSE_DIRECTORY_HOLD=$location"}
 $links=@(Get-ChildItem -LiteralPath $location -Recurse -Force -ErrorAction Stop | Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0} | Select-Object -First 1)
 if($links.Count){throw "PURGE_NESTED_REPARSE_HOLD=$location"}
 $sensitive=@(Get-ChildItem -LiteralPath $location -Recurse -File -Force -ErrorAction Stop | Where-Object {$_.Name -match '(?i)\.gguf$|^(?:llama-server|ollama)\.exe$'} | Select-Object -First 1)
 if($sensitive.Count){throw "PURGE_AI_MODEL_PROTECTION_HOLD=$location"}
 return $true
}
function FolderBytes([string]$location){
 [long]$size=0
 foreach($f in (Get-ChildItem -LiteralPath $location -Recurse -File -Force -ErrorAction Stop)){$size += [long]$f.Length}
 return $size
}
function AddFolder([string]$location,[string]$category){
 if(-not(FolderIsSafe $location)){return}
 $manifest.Add([pscustomobject]@{Kind='Folder';Category=$category;Path=$location;Bytes=(FolderBytes $location)})
}
# Exact installed source adapters. No wildcard deletions outside this worker install.
foreach($name in @(
 'src\domestic.mjs','src\international.mjs','src\gsa-bridge.mjs',
 'Import-International.mjs','Estimate-International-Cost.mjs',
 'GSA-Import-From-File.mjs','GSA-Live-Preview.mjs',
 'GSA-Preview-From-File.mjs','domestic-intake-example.json'
)){
 AddFile (Join-Path $worker $name) 'Retired sourcing source'
}
$workerTests=Join-Path $worker 'test'
if(Test-Path -LiteralPath $workerTests -PathType Container){
 foreach($f in (Get-ChildItem -LiteralPath $workerTests -File -Force -ErrorAction Stop)){
  if($f.Name -match '^(?i:domestic|international|gsa|asia|retire-sourcing)[A-Za-z0-9._-]*\.test\.mjs$'){
   AddFile $f.FullName 'Retired sourcing tests'
  }
 }
}
if(Test-Path -LiteralPath $dataDir -PathType Container){
 foreach($f in (Get-ChildItem -LiteralPath $dataDir -File -Force -ErrorAction Stop)){
  if($f.Name -match '^(?i:domestic|gsa|grants|sam|international|asia|auction|onbid)[._-].*\.(?:json|jsonl|csv|txt)$'){
   AddFile $f.FullName 'Stored sourcing snapshots'
  }
 }
}
if(Test-Path -LiteralPath $logDir -PathType Container){
 foreach($f in (Get-ChildItem -LiteralPath $logDir -File -Force -ErrorAction Stop)){
  if($f.Name -match '^(?i:domestic|gsa|international|asia)[._-].*\.(?:log|txt)$'){
   AddFile $f.FullName 'Historic sourcing logs'
  }
 }
}
# Remove only known sourcing backup folders AFTER the remaining worker is verified.
foreach($name in @('DomesticBackups','GsaBridgeBackups','InternationalBackups','AsiaSupplierBackups','SourcingRetirementBackups')){
 AddFolder (Join-Path $autoRoot $name) 'Obsolete sourcing deployment backups'
}
# Checkouts created exclusively for the now-deleted opportunity-sourcing features.
# A dirty checkout may contain user-authored files; do not delete it.
foreach($name in @('FunIndustrial-US-Opportunities','FunIndustrial-International-Sourcing','FunIndustrial-Asia-Sourcing')){
 $folder=Join-Path $homeDir $name
 if(-not(Test-Path -LiteralPath $folder -PathType Container)){continue}
 if(-not(Test-Path -LiteralPath (Join-Path $folder '.git'))){
  $skipped.Add("NOT_GIT_CHECKOUT:$folder");continue
 }
 $remote=(& git -C $folder remote get-url origin 2>&1 | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $remote -notin $approvedRemotes){
  $skipped.Add("ORIGIN_MISMATCH:$folder");continue
 }
 # Refuse to erase ignored/local credentials during repository cleanup.
 $sensitive=@(Get-ChildItem -LiteralPath $folder -Recurse -File -Force -ErrorAction Stop | Where-Object {$_.Name -match '^(?i:\.env(?:\..+)?|credentials\.(?:json|yaml|yml)|secret\.(?:json|yaml|yml)|.*\.(?:pem|key|p12|pfx))
 if($LASTEXITCODE -ne 0 -or $changes.Length -gt 0){
  $skipped.Add("LOCAL_CHANGES_PRESENT:$folder");continue
 }
 AddFolder $folder 'Obsolete sourcing Git checkout'
}
# Avoid nested paths/duplicates and only delete within exact known roots.
foreach($a in $manifest){
 if($a.Path -eq $rootDir -or $a.Path -eq $autoRoot -or $a.Path -eq $worker -or $a.Path -eq $homeDir){
  throw "PURGE_PROTECTED_ROOT_IN_MANIFEST=$($a.Path)"
 }
 if(@($manifest | Where-Object {$_.Path -eq $a.Path}).Count -ne 1){throw 'PURGE_DUPLICATE_PATH_HOLD'}
}
[long]$planned=0;foreach($a in $manifest){$planned += $a.Bytes}
Write-Host "SOURCING_PURGE_PLAN ITEMS=$($manifest.Count) FILE_BYTES=$planned APPROX_MB=$([math]::Round($planned/1MB,2))"
$manifest|Sort-Object Bytes -Descending|ForEach-Object {Write-Host ("CANDIDATE_MB={0:N2} KIND={1} CATEGORY={2} PATH={3}" -f ($_.Bytes/1MB),$_.Kind,$_.Category,$_.Path)}
foreach($x in $skipped){Write-Warning "SOURCING_PURGE_SKIPPED=$x"}
if($PreviewOnly){Write-Host 'SOURCING_PURGE=PREVIEW_ONLY DELETED=0';return}
$freeBefore=([IO.DriveInfo]::new([IO.Path]::GetPathRoot($homeDir))).AvailableFreeSpace
# Delete known code, datasets and old clones first; rollback backups are LAST.
$deleteOrder=@($manifest|Sort-Object @{Expression={if($_.Category -eq 'Obsolete sourcing deployment backups'){1}else{0}}})
[long]$removed=0;$count=0
foreach($candidate in $deleteOrder){
 if(-not(Test-Path -LiteralPath $candidate.Path)){continue}
 try{
  Remove-Item -LiteralPath $candidate.Path -Force -Recurse -ErrorAction Stop
  if(Test-Path -LiteralPath $candidate.Path){throw "DELETE_STILL_EXISTS=$($candidate.Path)"}
  $count++;$removed += $candidate.Bytes
  Write-Host "SOURCING_PURGE_REMOVED=$($candidate.Path)"
 }catch{
  Write-Warning "SOURCING_PURGE_DELETE_HOLD=$($candidate.Path) REASON=$($_.Exception.Message)"
  throw
 }
}
# Confirm the running platform remains usable after disk cleanup.
$after=Invoke-RestMethod "$base/api/status" -TimeoutSec 20
$side=Invoke-RestMethod "$workerBase/api/status" -TimeoutSec 20
if($after.application -ne 'Fun Industrial Platform' -or $side.state -ne 'running'){throw 'PURGE_POSTHEALTH_FAILED'}
$afterRea=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 40).tools)
if($afterRea.Count -ne 229){throw 'PURGE_POST_REA_REGISTRY_CHANGED'}
$freeAfter=([IO.DriveInfo]::new([IO.Path]::GetPathRoot($homeDir))).AvailableFreeSpace
$receipt=[ordered]@{
 at=(Get-Date).ToString('o');state='PURGE_COMPLETED';filesOrFoldersRemoved=$count
 logicalBytesRemoved=$removed;logicalMiB=[math]::Round($removed/1MB,2)
 diskFreeBytesBefore=$freeBefore;diskFreeBytesAfter=$freeAfter;diskFreeByteChange=($freeAfter-$freeBefore)
 paths=$deleteOrder|ForEach-Object {$_.Path};skipped=@($skipped)
 protected=@('FunIndustrial-REA-MCP-Activation','jobs.sqlite','REA','llama.cpp','Ollama','NetBird','research-sources.json')
}
$receiptDir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
New-Item -ItemType Directory -Path $receiptDir -Force|Out-Null
$receiptPath=Join-Path $receiptDir ('sourcing-purge-receipt-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')
$receipt|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $receiptPath -Encoding UTF8
Write-Host "SOURCING_PURGE=PASS REMOVED=$count SKIPPED=$($skipped.Count) LOGICAL_RECLAIMED_MIB=$([math]::Round($removed/1MB,2)) DISK_FREE_CHANGE_MIB=$([math]::Round(($freeAfter-$freeBefore)/1MB,2))"
Write-Host "PRESERVED=MAIN_PLATFORM,REA_229,LOCAL_AI,OLLAMA,NETBIRD,SIDEQUEST_SQLITE,GENERAL_RESEARCH"
Write-Host "RECEIPT=$receiptPath"
} | Select-Object -First 1)
 if($sensitive.Count){
  $skipped.Add("LOCAL_CREDENTIAL_FILES_PRESENT:$folder");continue
 }
 $changes=(& git -C $folder status --porcelain=v1 --untracked-files=all 2>&1 | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $changes.Length -gt 0){
  $skipped.Add("LOCAL_CHANGES_PRESENT:$folder");continue
 }
 AddFolder $folder 'Obsolete sourcing Git checkout'
}
# Avoid nested paths/duplicates and only delete within exact known roots.
foreach($a in $manifest){
 if($a.Path -eq $rootDir -or $a.Path -eq $autoRoot -or $a.Path -eq $worker -or $a.Path -eq $homeDir){
  throw "PURGE_PROTECTED_ROOT_IN_MANIFEST=$($a.Path)"
 }
 if(@($manifest | Where-Object {$_.Path -eq $a.Path}).Count -ne 1){throw 'PURGE_DUPLICATE_PATH_HOLD'}
}
[long]$planned=0;foreach($a in $manifest){$planned += $a.Bytes}
Write-Host "SOURCING_PURGE_PLAN ITEMS=$($manifest.Count) FILE_BYTES=$planned APPROX_MB=$([math]::Round($planned/1MB,2))"
$manifest|Sort-Object Bytes -Descending|ForEach-Object {Write-Host ("CANDIDATE_MB={0:N2} KIND={1} CATEGORY={2} PATH={3}" -f ($_.Bytes/1MB),$_.Kind,$_.Category,$_.Path)}
foreach($x in $skipped){Write-Warning "SOURCING_PURGE_SKIPPED=$x"}
if($PreviewOnly){Write-Host 'SOURCING_PURGE=PREVIEW_ONLY DELETED=0';return}
$freeBefore=([IO.DriveInfo]::new([IO.Path]::GetPathRoot($homeDir))).AvailableFreeSpace
# Delete known code, datasets and old clones first; rollback backups are LAST.
$deleteOrder=@($manifest|Sort-Object @{Expression={if($_.Category -eq 'Obsolete sourcing deployment backups'){1}else{0}}})
[long]$removed=0;$count=0
foreach($candidate in $deleteOrder){
 if(-not(Test-Path -LiteralPath $candidate.Path)){continue}
 try{
  Remove-Item -LiteralPath $candidate.Path -Force -Recurse -ErrorAction Stop
  if(Test-Path -LiteralPath $candidate.Path){throw "DELETE_STILL_EXISTS=$($candidate.Path)"}
  $count++;$removed += $candidate.Bytes
  Write-Host "SOURCING_PURGE_REMOVED=$($candidate.Path)"
 }catch{
  Write-Warning "SOURCING_PURGE_DELETE_HOLD=$($candidate.Path) REASON=$($_.Exception.Message)"
  throw
 }
}
# Confirm the running platform remains usable after disk cleanup.
$after=Invoke-RestMethod "$base/api/status" -TimeoutSec 20
$side=Invoke-RestMethod "$workerBase/api/status" -TimeoutSec 20
if($after.application -ne 'Fun Industrial Platform' -or $side.state -ne 'running'){throw 'PURGE_POSTHEALTH_FAILED'}
$afterRea=@((Invoke-RestMethod "$base/api/rea/tools" -TimeoutSec 40).tools)
if($afterRea.Count -ne 229){throw 'PURGE_POST_REA_REGISTRY_CHANGED'}
$freeAfter=([IO.DriveInfo]::new([IO.Path]::GetPathRoot($homeDir))).AvailableFreeSpace
$receipt=[ordered]@{
 at=(Get-Date).ToString('o');state='PURGE_COMPLETED';filesOrFoldersRemoved=$count
 logicalBytesRemoved=$removed;logicalMiB=[math]::Round($removed/1MB,2)
 diskFreeBytesBefore=$freeBefore;diskFreeBytesAfter=$freeAfter;diskFreeByteChange=($freeAfter-$freeBefore)
 paths=$deleteOrder|ForEach-Object {$_.Path};skipped=@($skipped)
 protected=@('FunIndustrial-REA-MCP-Activation','jobs.sqlite','REA','llama.cpp','Ollama','NetBird','research-sources.json')
}
$receiptDir=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Logs'
New-Item -ItemType Directory -Path $receiptDir -Force|Out-Null
$receiptPath=Join-Path $receiptDir ('sourcing-purge-receipt-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')
$receipt|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $receiptPath -Encoding UTF8
Write-Host "SOURCING_PURGE=PASS REMOVED=$count SKIPPED=$($skipped.Count) LOGICAL_RECLAIMED_MIB=$([math]::Round($removed/1MB,2)) DISK_FREE_CHANGE_MIB=$([math]::Round(($freeAfter-$freeBefore)/1MB,2))"
Write-Host "PRESERVED=MAIN_PLATFORM,REA_229,LOCAL_AI,OLLAMA,NETBIRD,SIDEQUEST_SQLITE,GENERAL_RESEARCH"
Write-Host "RECEIPT=$receiptPath"
