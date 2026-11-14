# Fun Industrial V5: read-only Audit by default. Explicit recovery changes only the Fun Industrial WireViz folder.
[CmdletBinding()]
param(
 [ValidateSet('Audit','Recover')][string]$Action='Audit',
 [string]$Approval=''
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$local=if($env:LOCALAPPDATA){$env:LOCALAPPDATA}else{throw 'FUN_EV_LOCALAPPDATA_MISSING_HOLD'}
$fun=Join-Path $local 'FunIndustrial'
$engineering=Join-Path $fun 'EVEngineering'
$tools=Join-Path $engineering 'Tools'
$target=Join-Path $tools 'WireViz'
$venv=Join-Path $target 'venv'
$wheels=Join-Path $target 'wheels'
$python=Join-Path $local 'Programs\Python\Python312\python.exe'
$wheelName='wireviz-0.4.1-py3-none-any.whl'
$wheelSha='5DFDFEC91E5D26E4F27F0F9D031672DA7FB3C133D127167D233F4742F01873A2'

function Check-Directory([string]$Path){
 if(Test-Path -LiteralPath $Path){
  $item=Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if(-not $item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)){
   throw ('FUN_EV_UNSAFE_DIRECTORY_HOLD:'+ $Path)
  }
  return $true
 }
 return $false
}
function Check-File([string]$Path){
 if(Test-Path -LiteralPath $Path){
  $item=Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if($item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)){
   throw 'FUN_EV_UNSAFE_FILE_HOLD'
  }
  return $true
 }
 return $false
}
function Invoke-Native([string]$Executable,[string[]]$ArgumentList,[string]$Stage){
 if([string]::IsNullOrWhiteSpace($Executable) -or @($ArgumentList).Count -eq 0){throw ('FUN_EV_'+$Stage+'_EMPTY_ARGS_HOLD')}
 & $Executable @ArgumentList
 if($LASTEXITCODE -ne 0){throw ('FUN_EV_'+$Stage+'_EXIT_'+$LASTEXITCODE)}
}
function Inspect-State {
 foreach($dir in @($fun,$engineering,$tools,$target,$venv,$wheels)){
  [void](Check-Directory $dir)
 }
 $targetExists=Test-Path -LiteralPath $target -PathType Container
 $wheelEntries=@()
 $otherEntries=@()
 if($targetExists){
  foreach($entry in @(Get-ChildItem -LiteralPath $target -Force -ErrorAction Stop)){
   if($entry.Name -cnotin @('venv','wheels')){$otherEntries+= $entry.Name}
   if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'FUN_EV_UNSAFE_TARGET_ENTRY_HOLD'}
  }
 }
 if(Test-Path -LiteralPath $wheels -PathType Container){
  $entries=@(Get-ChildItem -LiteralPath $wheels -Force -ErrorAction Stop)
  if($entries.Count -gt 32){throw 'FUN_EV_WHEEL_COUNT_HOLD'}
  foreach($entry in $entries){
   if($entry.PSIsContainer -or (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)){
    throw 'FUN_EV_UNSAFE_WHEEL_ENTRY_HOLD'
   }
   if($entry.Length -gt 104857600){throw 'FUN_EV_UNEXPECTED_LARGE_WHEEL_HOLD'}
   $h=(Get-FileHash -LiteralPath $entry.FullName -Algorithm SHA256).Hash
   $wheelEntries+= [pscustomobject]@{name=$entry.Name;sha256=$h;bytes=$entry.Length}
  }
 }
 $venvFolder=Test-Path -LiteralPath $venv -PathType Container
 $venvPython=Check-File (Join-Path $venv 'Scripts\python.exe')
 $wirevizExe=Check-File (Join-Path $venv 'Scripts\wireviz.exe')
 $badWheels=@($wheelEntries|Where-Object{$_.name -cne $wheelName -or $_.sha256 -cne $wheelSha})
 $readyToResume=($otherEntries.Count -eq 0 -and $badWheels.Count -eq 0 -and -not $venvFolder)
 return [pscustomobject]@{
  schema='fun.ev.wireviz-recovery.audit.v5';scope='FUN_INDUSTRIAL_ONLY';mode='READ_ONLY';
  target=$target;target_exists=$targetExists;
  venv_folder_exists=$venvFolder;venv_python_exists=$venvPython;wireviz_executable_exists=$wirevizExe;
  wheels_folder_exists=(Test-Path -LiteralPath $wheels -PathType Container);
  existing_wheels=@($wheelEntries);other_target_entries=@($otherEntries);
  python312_exists=(Check-File $python);resume_layout_eligible=$readyToResume;
  installed_by_this_command=$false
 }
}
$audit=Inspect-State
if($Action -eq 'Audit'){$audit|ConvertTo-Json -Depth 7;exit 0}
if($Approval -cne 'APPROVE_FUN_EV_WIREVIZ_RECOVERY'){throw 'FUN_EV_RECOVERY_APPROVAL_REQUIRED'}
if(-not $audit.resume_layout_eligible){throw 'FUN_EV_PARTIAL_VENV_OR_UNEXPECTED_FILES_HOLD'}
if(-not $audit.python312_exists){throw 'FUN_EV_PYTHON312_REQUIRED_HOLD'}
if($audit.wireviz_executable_exists -or $audit.venv_folder_exists){throw 'FUN_EV_VENV_ALREADY_EXISTS_HOLD'}
$free=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($tools)).AvailableFreeSpace
if($free -lt 1073741824){throw 'FUN_EV_DISK_FREE_SPACE_HOLD'}
$version=(& $python -c 'import sys;print(sys.version_info.major,sys.version_info.minor,sep=chr(46))')
if($LASTEXITCODE -ne 0 -or [string]$version -cne '3.12'){throw 'FUN_EV_PYTHON_VERSION_HOLD'}
# Recovery modifies only a dedicated Fun Industrial folder. Existing contents are never removed.
foreach($dir in @($fun,$engineering,$tools,$target,$wheels)){
 if(-not (Test-Path -LiteralPath $dir)){
  New-Item -ItemType Directory -Path $dir -ErrorAction Stop|Out-Null
 }
 [void](Check-Directory $dir)
}
Invoke-Native $python @('-m','venv',$venv) 'VENV_CREATE'
$vpy=Join-Path $venv 'Scripts\python.exe'
if(-not (Check-File $vpy)){throw 'FUN_EV_VENV_PYTHON_MISSING_HOLD'}
# Download full wheel-only dependency set into a controlled Fun-only cache, no global pip changes.
Invoke-Native $vpy @('-m','pip','download','--only-binary=:all:','--no-cache-dir','--disable-pip-version-check','--dest',$wheels,'wireviz==0.4.1') 'WHEELS_DOWNLOAD'
$primary=Join-Path $wheels $wheelName
if(-not (Check-File $primary)){throw 'FUN_EV_PRIMARY_WHEEL_MISSING_HOLD'}
if((Get-FileHash -LiteralPath $primary -Algorithm SHA256).Hash -cne $wheelSha){throw 'FUN_EV_PRIMARY_WHEEL_HASH_MISMATCH_HOLD'}
# Install offline using only the explicitly downloaded wheel files, in the new venv.
Invoke-Native $vpy @('-m','pip','install','--no-index','--find-links',$wheels,'--only-binary=:all:','--no-input','--disable-pip-version-check','wireviz==0.4.1') 'VENV_WIREVIZ_INSTALL'
Invoke-Native $vpy @('-m','pip','check') 'PIP_CHECK'
$wv=Join-Path $venv 'Scripts\wireviz.exe'
if(-not (Check-File $wv)){throw 'FUN_EV_WIREVIZ_EXE_MISSING_HOLD'}
Invoke-Native $wv @('--version') 'WIREVIZ_VERSION'
$freeze=@(& $vpy -m pip freeze --disable-pip-version-check)
if($LASTEXITCODE -ne 0){throw 'FUN_EV_PIP_FREEZE_HOLD'}
$freeze|Out-File -LiteralPath (Join-Path $target 'dependencies-freeze.txt') -Encoding UTF8
$inventory=@(Get-ChildItem -LiteralPath $wheels -File -Force|ForEach-Object{
 [pscustomobject]@{name=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash;bytes=$_.Length}
})
$receipt=[pscustomobject]@{
 schema='fun.ev.wireviz-recovery.receipt.v5';scope='FUN_INDUSTRIAL_ONLY';state='WIREVIZ_NATIVE_BINARY_INSTALLED_RENDER_NOT_QUALIFIED';
 tool='WireViz';version='0.4.1';venv_python=$vpy;wireviz_exe=$wv;
 primary_wheel_sha256=$wheelSha;wheels=@($inventory);dependencies=@($freeze);
 native_render_qualified=$false;other_app_installations_attempted=$false
}
$receipt|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $target 'v5-recovery-receipt.json') -Encoding UTF8
$receipt|ConvertTo-Json -Depth 8
