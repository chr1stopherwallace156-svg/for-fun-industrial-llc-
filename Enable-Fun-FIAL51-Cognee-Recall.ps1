# Enable existing local Cognee recall, read-only, without restarting services.
# No model call, embedding download, REA execution, memory ingestion or writes.
[CmdletBinding()]param([switch]$AuthorizeReadOnlyTransition)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Original=Join-Path $HOME 'FunIndustrial-REA-MCP-Activation'
$Integrations=$PSScriptRoot
$Base='http://127.0.0.1:8789'
$Hub='http://127.0.0.1:8805'
$Log=Join-Path $env:LOCALAPPDATA ('FunIndustrial\MemoryEnable\backups\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
function Hold([string]$s){throw ('FUN_MEMORY_ENABLE_HOLD='+$s)}
function GetJson([string]$u){return Invoke-RestMethod -Uri $u -TimeoutSec 12 -ErrorAction Stop}
$Git=(Get-Command git.exe -ErrorAction Stop).Source
$roots=@($Original,$Integrations)
$changes=@()
$previousWriteFlags=0
$previousIngestionFlags=0
foreach($root in $roots){
 if(!(Test-Path -LiteralPath $root -PathType Container)){Hold ('ROOT_MISSING='+$root)}
 foreach($rel in @('src\intelligence\memory.mjs','cognee\memory_bridge.py')){
  $f=Join-Path $root $rel
  if(!(Test-Path -LiteralPath $f -PathType Leaf)){Hold ('REQUIRED_MODULE_MISSING='+$f)}
  if(((Get-Item -LiteralPath $f).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Hold 'MODULE_SYMLINK_DENIED'}
 }
 $tracked=@(& $Git -C $root ls-files -- src/intelligence/settings.json)
 if($LASTEXITCODE -ne 0 -or $tracked.Count){Hold ('TRACKED_OR_UNKNOWN_MEMORY_SETTINGS='+$root)}
 $cfg=Join-Path $root 'src\intelligence\settings.json'
 if(Test-Path -LiteralPath $cfg){
  $item=Get-Item -LiteralPath $cfg
  if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.Length -gt 8192){Hold 'MEMORY_SETTINGS_UNTRUSTED'}
  try{$existing=[IO.File]::ReadAllText($cfg)|ConvertFrom-Json}
  catch{Hold 'EXISTING_SETTINGS_JSON_INVALID'}
  if($existing -isnot [pscustomobject]){Hold 'EXISTING_SETTINGS_NOT_OBJECT'}
  if($existing.PSObject.Properties['writesEnabled'] -and $existing.writesEnabled -eq $true){
   $previousWriteFlags++
   if(!$AuthorizeReadOnlyTransition){Hold 'EXISTING_WRITE_AUTHORITY_REQUIRES_SEPARATE_REVIEW'}
  }
  if($existing.PSObject.Properties['automaticIngestion'] -and $existing.automaticIngestion -eq $true){
   $previousIngestionFlags++
   if(!$AuthorizeReadOnlyTransition){Hold 'EXISTING_INGESTION_REQUIRES_SEPARATE_REVIEW'}
  }
 }
}
$Python=Join-Path $env:LOCALAPPDATA 'FunIndustrial\CognitiveMemory\venv\Scripts\python.exe'
if(!(Test-Path -LiteralPath $Python -PathType Leaf)){Hold 'COGNEE_PYTHON_MISSING'}
$server=Join-Path $Original 'src\server.mjs'
$originalServerSHA=(Get-FileHash -LiteralPath $server -Algorithm SHA256).Hash
$intel=GetJson ($Base+'/api/intelligence/status')
if($intel.memory.engine -cne 'cognee' -or $intel.memory.available -ne $true){
 Hold 'EXISTING_COGNEE_RUNTIME_UNAVAILABLE'
}
try{$auto=GetJson ($Base+'/api/ai/automatic-memory/status')}
catch{Hold 'AUTO_CHAT_RECALL_ENDPOINT_MISSING_NO_FILES_CHANGED'}
if($auto.mode -cne 'automatic_contextual_read_only' -or
 $auto.enabledByDefault -ne $true -or $auto.memoryWrites -ne $false -or
 $auto.memoryGrantsToolAuthority -ne $false){Hold 'AUTO_RECALL_POLICY_UNVERIFIED'}
$hubHealth=GetJson ($Hub+'/api/fial/modules/health')
if($hubHealth.version -cne 'fial5.1-integrated-hub-v1' -or
 $hubHealth.rea_authority_added -ne $false){Hold 'FIAL51_HUB_UNVERIFIED'}
try{
 New-Item -ItemType Directory -Path $Log -Force | Out-Null
 $number=0
 foreach($root in $roots){
  $number++
  $cfg=Join-Path $root 'src\intelligence\settings.json'
  $excl=(& $Git -C $root rev-parse --git-path info/exclude | Out-String).Trim()
  if($LASTEXITCODE -ne 0 -or !$excl){Hold 'GIT_LOCAL_EXCLUDE_MISSING'}
  if(![IO.Path]::IsPathRooted($excl)){$excl=Join-Path $root $excl}
  if(!(Test-Path -LiteralPath (Split-Path $excl) -PathType Container)){Hold 'GIT_EXCLUDE_PARENT_MISSING'}
  $oldCfg=$null;$oldExcl=$null
  if(Test-Path -LiteralPath $cfg){$oldCfg=[IO.File]::ReadAllText($cfg)}
  if(Test-Path -LiteralPath $excl){$oldExcl=[IO.File]::ReadAllText($excl)}
  try{
   if($null -eq $oldCfg){$config=[pscustomobject]@{}}
   else{$config=$oldCfg|ConvertFrom-Json}
  }catch{Hold 'EXISTING_SETTINGS_JSON_INVALID'}
  if($config -isnot [pscustomobject]){Hold 'EXISTING_SETTINGS_NOT_OBJECT'}
  if($config.PSObject.Properties['writesEnabled'] -and $config.writesEnabled -eq $true -and
   !$AuthorizeReadOnlyTransition){Hold 'EXISTING_WRITE_AUTHORITY_REQUIRES_SEPARATE_REVIEW'}
  if($config.PSObject.Properties['automaticIngestion'] -and $config.automaticIngestion -eq $true -and
   !$AuthorizeReadOnlyTransition){Hold 'EXISTING_INGESTION_REQUIRES_SEPARATE_REVIEW'}
  $config|Add-Member -NotePropertyName enabled -NotePropertyValue $true -Force
  $config|Add-Member -NotePropertyName writesEnabled -NotePropertyValue $false -Force
  $config|Add-Member -NotePropertyName automaticIngestion -NotePropertyValue $false -Force
  $changes+=@([pscustomobject]@{cfg=$cfg;excl=$excl;oldCfg=$oldCfg;oldExcl=$oldExcl})
  if($null -ne $oldCfg){[IO.File]::WriteAllText((Join-Path $Log ('config-'+$number+'.json')),$oldCfg)}
  if($null -ne $oldExcl){[IO.File]::WriteAllText((Join-Path $Log ('exclude-'+$number+'.txt')),$oldExcl)}
  $rule='src/intelligence/settings.json'
  $rules=if($null -eq $oldExcl){@()}else{$oldExcl -split '\r?\n'}
  if($rules -notcontains $rule){
   [IO.File]::AppendAllText($excl,[Environment]::NewLine+$rule+[Environment]::NewLine)
  }
  $tmp=$cfg+'.tmp-'+[guid]::NewGuid().ToString('N')
  $json=($config|ConvertTo-Json -Depth 10)+[Environment]::NewLine
  [IO.File]::WriteAllText($tmp,$json,[Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tmp -Destination $cfg -Force
 }
 $now=GetJson ($Base+'/api/intelligence/status')
 $autoNow=GetJson ($Base+'/api/ai/automatic-memory/status')
 if($now.memory.enabled -ne $true -or $now.memory.writesEnabled -ne $false -or
  $autoNow.memoryAvailable -ne $true){Hold 'ORIGINAL_MEMORY_NOT_ENABLED'}
 $status=Invoke-RestMethod -Uri ($Hub+'/api/fial/modules/check') -Method Post -ContentType 'application/json' -Headers @{Origin=$Hub;'x-fi-fial-operator'='approved-exact-action'} -Body '{}' -TimeoutSec 35
 $memory=@($status.modules|Where-Object {$_.id -eq 'persistent_memory'})
 if($status.state -cne 'SYSTEM_WIDE_ADAPTERS_CONNECTED' -or
  $memory.Count -ne 1 -or $memory[0].state -cne 'AVAILABLE_CONFIGURED' -or
  $memory[0].details.writesEnabled -ne $false){Hold 'FIAL51_MEMORY_RECHECK_FAILED'}
 if((Get-FileHash -LiteralPath $server -Algorithm SHA256).Hash -cne $originalServerSHA){
  Hold 'PROTECTED_SERVER_SOURCE_CHANGED'
 }
 Write-Host ('FUN_MEMORY_READ_ONLY_TRANSITION=CONFIRMED PREVIOUS_WRITE_FLAGS_DISABLED='+$previousWriteFlags+' PREVIOUS_INGESTION_FLAGS_DISABLED='+$previousIngestionFlags)
 Write-Host 'FUN_COGNEE_RECALL=ENABLED_AUTOMATIC_READ_ONLY'
 Write-Host 'FIAL51_MEMORY_ADAPTER=AVAILABLE_CONFIGURED'
 Write-Host 'FUN_MEMORY_WRITES=DISABLED AUTOMATIC_INGESTION=DISABLED'
 Write-Host 'FUN_MEMORY_MODEL_DOWNLOADS_DURING_ACTIVATION=0'
 Write-Host 'FUN_SERVICES_RESTARTED=0 REA_EXECUTIONS=0 ELEKTRON=UNTOUCHED'
 Write-Host ('FUN_MEMORY_BACKUPS='+$Log)
}catch{
 $why=$_.Exception.Message
 foreach($changed in $changes){
  try{
   if($null -ne $changed.oldCfg){[IO.File]::WriteAllText($changed.cfg,$changed.oldCfg)}
   elseif(Test-Path -LiteralPath $changed.cfg){Remove-Item -LiteralPath $changed.cfg -Force}
   if($null -ne $changed.oldExcl){[IO.File]::WriteAllText($changed.excl,$changed.oldExcl)}
   elseif(Test-Path -LiteralPath $changed.excl){Remove-Item -LiteralPath $changed.excl -Force}
  }catch{Write-Warning ('FUN_MEMORY_ROLLBACK_UNCONFIRMED='+$_.Exception.Message)}
 }
 throw ('FUN_MEMORY_ACTIVATION_HOLD_ROLLBACK_REQUESTED='+$why)
}
