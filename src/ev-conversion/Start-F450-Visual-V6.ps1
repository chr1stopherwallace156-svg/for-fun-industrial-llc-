param([string]$SourceMesh,[string]$LicenseEvidence,[string]$OutputRoot=(Join-Path $env:LOCALAPPDATA 'FunIndustrial\EVEngineering\F450VisualV6'))
$ErrorActionPreference='Stop'
$exe=$null
$c=Get-Command blender.exe -ErrorAction SilentlyContinue
if($c){$exe=$c.Source}
if(!$exe){
 foreach($root in @("$env:ProgramFiles\Blender Foundation","$env:LOCALAPPDATA\Programs\Blender Foundation")){
  if(Test-Path $root){$exe=Get-ChildItem $root -Filter blender.exe -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName;if($exe){break}}
 }
}
if(!$exe){Write-Output 'BLENDER_STATUS=NOT_FOUND';Write-Output 'V6_IMPORT=NOT_STARTED';exit 0}
Write-Output "BLENDER_FOUND=$exe"
if(!$SourceMesh -or !$LicenseEvidence){Write-Output 'V6_IMPORT=AWAITING_LICENSED_MESH_AND_LICENSE_EVIDENCE';exit 0}
if(!(Test-Path -LiteralPath $SourceMesh)){throw 'SOURCE_MESH_MISSING'}
if(!(Test-Path -LiteralPath $LicenseEvidence)){throw 'LICENSE_EVIDENCE_MISSING'}
if((Test-Path $OutputRoot) -and @(Get-ChildItem $OutputRoot -Force).Count){throw 'OUTPUT_NOT_EMPTY_HOLD'}
$script=Join-Path $PSScriptRoot 'f450-visual-import-v6.py'
& $exe --background --factory-startup --python $script -- $SourceMesh $OutputRoot $LicenseEvidence
if($LASTEXITCODE -ne 0){throw 'BLENDER_IMPORT_HOLD'}
if(!(Test-Path (Join-Path $OutputRoot 'F450-Visual-Reference-V6-receipt.json'))){throw 'V6_RECEIPT_MISSING'}
Write-Output 'FUN_F450_VISUAL_V6=COMPLETE'
