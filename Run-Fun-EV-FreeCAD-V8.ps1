# Fun Industrial EV V8 — read-only FreeCAD preflight.
[CmdletBinding()]
param([string]$ProjectId='bench-4d5012c1')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$source=Join-Path $root 'src\ev-conversion\freecad-preflight-v8.mjs'
if(!(Test-Path -LiteralPath $source -PathType Leaf)){throw 'FUN_EV_V8_SOURCE_HOLD'}
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){$node=Get-Command node -ErrorAction SilentlyContinue}
if(-not $node){throw 'FUN_EV_V8_NODE_HOLD'}
& $node.Source $source preflight $ProjectId
if($LASTEXITCODE -ne 0){throw 'FUN_EV_V8_PREFLIGHT_HOLD'}
