# Fun Industrial V6: read-only Graphviz audit by default; explicit approval for WinGet install.
# Only Fun Industrial WireViz runtime evidence and ordinary Graphviz install directories are inspected.
[CmdletBinding()]
param([ValidateSet('Audit','Install')][string]$Action='Audit',[string]$Approval='')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$local=$env:LOCALAPPDATA
if(-not $local){throw 'FUN_EV_V6_LOCALAPPDATA_HOLD'}
$wvRoot=Join-Path $local 'FunIndustrial\EVEngineering\Tools\WireViz'
$wv=Join-Path $wvRoot 'venv\Scripts\wireviz.exe'
$receipt=Join-Path $wvRoot 'v5-recovery-receipt.json'
$packageId='Graphviz.Graphviz'
$version='16.1.0'
function Check-File([string]$Path){
 if(-not (Test-Path -LiteralPath $Path -PathType Leaf)){return $false}
 $item=Get-Item -LiteralPath $Path -Force -ErrorAction Stop
 if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'FUN_EV_V6_REPARSE_FILE_HOLD'}
 return $true
}
function Find-Graphviz {
 $roots=@($env:ProgramFiles,[Environment]::GetEnvironmentVariable('ProgramFiles(x86)'),(Join-Path $local 'Programs'))|Where-Object{$_}|Select-Object -Unique
 $found=@()
 foreach($root in $roots){
  if(-not (Test-Path -LiteralPath $root -PathType Container)){continue}
  $top=Get-Item -LiteralPath $root -Force
  if(($top.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'FUN_EV_V6_REPARSE_ROOT_HOLD'}
  foreach($folder in @(Get-ChildItem -LiteralPath $root -Directory -Force -ErrorAction Stop|Where-Object{$_.Name -match '^Graphviz(?:$|[-_ ])'})){
   if(($folder.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'FUN_EV_V6_REPARSE_GRAPHVIZ_HOLD'}
   $bin=Join-Path $folder.FullName 'bin'
   if(-not (Test-Path -LiteralPath $bin -PathType Container)){continue}
   $binItem=Get-Item -LiteralPath $bin -Force
   if(($binItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'FUN_EV_V6_REPARSE_BIN_HOLD'}
   $dot=Join-Path $bin 'dot.exe'
   if(Check-File $dot){
    $f=Get-Item -LiteralPath $dot -Force
    if($f.Length -gt 150MB -or $f.Length -le 0){throw 'FUN_EV_V6_DOT_FILE_SIZE_HOLD'}
    $found+= [pscustomobject]@{path=$dot;sha256=(Get-FileHash -LiteralPath $dot -Algorithm SHA256).Hash;bytes=$f.Length}
   }
  }
 }
 return @($found)
}
function Audit-State {
 $wvExists=Check-File $wv
 $receiptExists=Check-File $receipt
 $receiptState=$null
 if($receiptExists){
  $rr=Get-Content -LiteralPath $receipt -Raw -ErrorAction Stop|ConvertFrom-Json -ErrorAction Stop
  $receiptState=[string]$rr.state
 }
 $candidates=@(Find-Graphviz)
 return [pscustomobject]@{
  schema='fun.ev.graphviz-native.audit.v6';scope='FUN_INDUSTRIAL_ONLY';mode='READ_ONLY';
  wireviz_exe_exists=$wvExists;wireviz_exe_sha256=$(if($wvExists){(Get-FileHash -LiteralPath $wv -Algorithm SHA256).Hash}else{$null});
  wireviz_v5_receipt_exists=$receiptExists;wireviz_v5_receipt_state=$receiptState;
  graphviz_package_id=$packageId;graphviz_requested_version=$version;
  graphviz_dot_candidates=$candidates;graphviz_found_in_scoped_paths=($candidates.Count -gt 0);
  native_svg_render_qualified=$false;installer_executed=$false
 }
}
$before=Audit-State
if($Action -eq 'Audit'){$before|ConvertTo-Json -Depth 7;exit 0}
if($Approval -cne 'APPROVE_FUN_EV_GRAPHVIZ_INSTALL'){throw 'FUN_EV_V6_APPROVAL_REQUIRED_HOLD'}
if(-not $before.wireviz_exe_exists -or $before.wireviz_v5_receipt_state -cne 'WIREVIZ_NATIVE_BINARY_INSTALLED_RENDER_NOT_QUALIFIED'){
 throw 'FUN_EV_V6_WIREVIZ_RECEIPT_HOLD'
}
if($before.graphviz_found_in_scoped_paths){throw 'FUN_EV_V6_GRAPHVIZ_ALREADY_PRESENT_HOLD'}
$winget=Get-Command winget.exe -ErrorAction SilentlyContinue
if(-not $winget){throw 'FUN_EV_V6_WINGET_MISSING_HOLD'}
# Native argument arrays use an unambiguous parameter name, not an automatic variable.
$showArguments=@('show','--id',$packageId,'--exact','--version',$version,'--source','winget')
$shown=@(& $winget.Source @showArguments)
if($LASTEXITCODE -ne 0){throw 'FUN_EV_V6_CATALOG_EXIT_HOLD'}
$catalog=($shown|ForEach-Object{[string]$_}) -join [Environment]::NewLine
if($catalog -notmatch [regex]::Escape($packageId) -or
   $catalog -notmatch ('(?im)^\s*Version:\s*'+[regex]::Escape($version)+'(?:\s|$)') -or
   $catalog -match 'The following commands are available:'){throw 'FUN_EV_V6_CATALOG_MISMATCH_HOLD'}
Write-Output ('FUN_EV_V6_INSTALL_REQUEST='+$packageId+'@'+$version)
$installArguments=@('install','--id',$packageId,'--exact','--version',$version,'--source','winget',
 '--accept-package-agreements','--accept-source-agreements','--disable-interactivity')
& $winget.Source @installArguments
if($LASTEXITCODE -ne 0){throw ('FUN_EV_V6_WINGET_INSTALL_EXIT_'+$LASTEXITCODE+'_HOLD')}
$after=Audit-State
if(-not $after.graphviz_found_in_scoped_paths){throw 'FUN_EV_V6_POSTINSTALL_DOT_NOT_FOUND_HOLD'}
[pscustomobject]@{
 schema='fun.ev.graphviz-native.install-result.v6';scope='FUN_INDUSTRIAL_ONLY';
 state='GRAPHVIZ_CANDIDATE_FOUND_RENDER_NOT_QUALIFIED';graphviz_dot_candidates=$after.graphviz_dot_candidates;
 installer_executed=$true;native_svg_render_qualified=$false
}|ConvertTo-Json -Depth 7
