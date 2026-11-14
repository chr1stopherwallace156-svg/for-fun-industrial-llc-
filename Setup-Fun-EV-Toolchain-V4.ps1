# Fun Industrial EV toolchain V4. No external program is installed unless -Action Install is explicitly selected.
[CmdletBinding()]
param([ValidateSet('Plan','Install')][string]$Action='Plan',[string]$Approval='')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$packages=@(
 @{Id='Graphviz.Graphviz';Version='16.1.0'},
 @{Id='FreeCAD.FreeCAD';Version='1.1.4'},
 @{Id='QElectroTech.QElectroTech';Version='0.100.0'}
)
$local=if($env:LOCALAPPDATA){$env:LOCALAPPDATA}else{Join-Path $HOME 'AppData\Local'}
$tools=Join-Path $local 'FunIndustrial\EVEngineering\Tools'
function Find-Py312 {
 $launcher=Get-Command py.exe -ErrorAction SilentlyContinue
 if($launcher){
  $result=(& $launcher.Source -3.12 -c 'import sys;print(sys.executable)' 2>$null)
  if($LASTEXITCODE -eq 0 -and $result -and (Test-Path -LiteralPath ([string]$result) -PathType Leaf)){return [string]$result}
 }
 foreach($f in @((Join-Path $local 'Programs\Python\Python312\python.exe'),'C:\Python312\python.exe')){
  if(Test-Path -LiteralPath $f -PathType Leaf){
   $v=(& $f -c 'import sys;print(str(sys.version_info.major)+"."+str(sys.version_info.minor))' 2>$null)
   if($LASTEXITCODE -eq 0 -and $v -eq '3.12'){return $f}
  }
 }
 return $null
}
function Checked([string]$Executable,[string[]]$Args,[string]$Stage){
 & $Executable @Args
 if($LASTEXITCODE -ne 0){throw ('FUN_EV_'+$Stage+'_HOLD_EXIT_'+$LASTEXITCODE)}
}
$winget=Get-Command winget.exe -ErrorAction SilentlyContinue
$python=Find-Py312
if($Action -eq 'Plan'){
 [pscustomobject]@{
  schema='fun.ev.toolchain.plan.v4';scope='FUN_INDUSTRIAL_ONLY';mode='NO_INSTALL';
  winget_available=([bool]$winget);python312_available=([bool]$python);python_path=$python;
  proposed_windows_packages=@($packages|ForEach-Object{$_.Id+'@'+$_.Version});
  wireviz='0.4.1';wireviz_wheel_sha256='5dfdfec91e5d26e4f27f0f9d031672da7fb3c133d127167d233f4742f01873a2';
  tool_folder=$tools;system_wide_package_changes_possible=$true;external_tools_installed=$false
 }|ConvertTo-Json -Depth 5
 exit 0
}
if($Approval -cne 'INSTALL_FUN_EV_TOOLCHAIN'){throw 'FUN_EV_OPERATOR_APPROVAL_REQUIRED'}
if(-not $winget){throw 'FUN_EV_WINGET_MISSING'}
if(-not $python){throw 'FUN_EV_PYTHON312_MISSING'}
if(Test-Path -LiteralPath (Join-Path $tools 'WireViz')){throw 'FUN_EV_WIREVIZ_TARGET_EXISTS_HOLD'}
$drive=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($tools))
if($drive.AvailableFreeSpace -lt 6GB){throw 'FUN_EV_FREE_SPACE_HOLD'}
if(!(Test-Path -LiteralPath $tools)){New-Item -ItemType Directory -Path $tools -Force|Out-Null}
if((Get-Item -LiteralPath $tools -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'FUN_EV_TOOLS_REPARSE_HOLD'}
foreach($pkg in $packages){
 Write-Output ('FUN_EV_INSTALL_PACKAGE='+$pkg.Id+' VERSION='+$pkg.Version)
 Checked $winget.Source @('show','--id',$pkg.Id,'--exact','--version',$pkg.Version,'--source','winget') 'PACKAGE_CATALOG'
 Checked $winget.Source @('install','--id',$pkg.Id,'--exact','--version',$pkg.Version,'--source','winget',
   '--accept-package-agreements','--accept-source-agreements','--disable-interactivity') 'PACKAGE_INSTALL'
}
# Create WireViz only in a new Fun Industrial venv; never use global pip or other runtimes.
$target=Join-Path $tools 'WireViz'
New-Item -ItemType Directory -Path $target -ErrorAction Stop | Out-Null
# Python venv entry-point executables contain absolute interpreter paths.
# Do not relocate venv after installation; create at final destination.
$venv=Join-Path $target 'venv';$wheelDir=Join-Path $target 'wheels'
New-Item -ItemType Directory -Path $wheelDir|Out-Null
Checked $python @('-m','venv',$venv) 'VENV'
$vpy=Join-Path $venv 'Scripts\python.exe'
if(!(Test-Path -LiteralPath $vpy -PathType Leaf)){throw 'FUN_EV_VENV_MISSING'}
Checked $vpy @('-m','pip','download','--only-binary=:all:','--no-deps','--disable-pip-version-check','--dest',$wheelDir,'wireviz==0.4.1') 'WHEEL_DOWNLOAD'
$wheel=Join-Path $wheelDir 'wireviz-0.4.1-py3-none-any.whl'
if(!(Test-Path -LiteralPath $wheel -PathType Leaf)){throw 'FUN_EV_WHEEL_MISSING'}
$expected='5DFDFEC91E5D26E4F27F0F9D031672DA7FB3C133D127167D233F4742F01873A2'
if((Get-FileHash -LiteralPath $wheel -Algorithm SHA256).Hash -cne $expected){throw 'FUN_EV_WHEEL_HASH_HOLD'}
Checked $vpy @('-m','pip','install','--only-binary=:all:','--no-input','--disable-pip-version-check','--no-cache-dir',$wheel) 'WHEEL_INSTALL'
$wv=Join-Path $venv 'Scripts\wireviz.exe'
if(!(Test-Path -LiteralPath $wv -PathType Leaf)){throw 'FUN_EV_WIREVIZ_MISSING'}
Checked $wv @('--version') 'WIREVIZ_VERSION'
& $vpy -m pip freeze --disable-pip-version-check | Out-File -LiteralPath (Join-Path $target 'dependencies-freeze.txt') -Encoding UTF8
if($LASTEXITCODE -ne 0){throw 'FUN_EV_DEPENDENCY_FREEZE_HOLD'}
Write-Output 'FUN_EV_V4_INSTALL=COMPLETED_NATIVE_QUALIFICATION_PENDING'
Write-Output ('FUN_EV_V4_WIREVIZ='+ (Join-Path $tools 'WireViz\venv\Scripts\wireviz.exe'))
