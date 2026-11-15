param([string]$OutputRoot = (Join-Path $env:LOCALAPPDATA 'FunIndustrial\EVEngineering\F450ConceptV5'))
$ErrorActionPreference='Stop'
$macro=Join-Path $PSScriptRoot 'F450-Concept-V5.FCMacro'
if(!(Test-Path -LiteralPath $macro)){throw 'V5_MACRO_MISSING'}
if(Test-Path -LiteralPath (Join-Path $OutputRoot 'F450-Concept-V5-receipt.json')){throw 'V5_OUTPUT_ALREADY_EXISTS_HOLD'}
$dirs=@('C:\Program Files','C:\Program Files (x86)')
$executables=@()
foreach($dir in $dirs){if(Test-Path $dir){$executables+=@(Get-ChildItem -LiteralPath $dir -Directory -Filter 'FreeCAD*' -ErrorAction SilentlyContinue | ForEach-Object { @((Join-Path $_.FullName 'bin\FreeCAD.exe'),(Join-Path $_.FullName 'FreeCAD.exe')) } | Where-Object {Test-Path $_})}}
$exe=$executables | Select-Object -First 1
if(!$exe){throw 'FREECAD_EXECUTABLE_NOT_FOUND_HOLD'}
if(Test-Path $OutputRoot){$items=@(Get-ChildItem -LiteralPath $OutputRoot -Force);if($items.Count -gt 0){throw 'V5_OUTPUT_NOT_EMPTY_HOLD'}}
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$env:FUN_F450_V5_OUTPUT=$OutputRoot
Start-Process -FilePath $exe -ArgumentList ('"'+$macro+'"') -PassThru | Out-Null
Write-Output ('V5_FREECAD_LAUNCHED='+$exe)
Write-Output ('V5_OUTPUT='+$OutputRoot)
Write-Output 'V5_PENDING_NATIVE_COMPLETION_CHECK_RECEIPT'
