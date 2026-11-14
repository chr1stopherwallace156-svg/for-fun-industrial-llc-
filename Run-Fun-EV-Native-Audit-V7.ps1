# Fun Industrial-only V7: read-only native SVG/BOM artifact evidence audit.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ProjectId)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$entry=Join-Path $root 'src\ev-conversion\native-artifact-audit-v7.mjs'
if(!(Test-Path -LiteralPath $entry -PathType Leaf)){throw 'FUN_EV_V7_SOURCE_MISSING_HOLD'}
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){$node=Get-Command node -ErrorAction SilentlyContinue}
if(-not $node){throw 'FUN_EV_V7_NODE_MISSING_HOLD'}
& $node.Source $entry audit $ProjectId
if($LASTEXITCODE -ne 0){throw 'FUN_EV_V7_AUDIT_HOLD'}
