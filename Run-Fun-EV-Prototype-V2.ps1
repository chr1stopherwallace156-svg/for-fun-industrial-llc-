# Fun Industrial V2: standalone source-only draft artifact generation. No external applications launched.
[CmdletBinding()]
param(
 [ValidateSet('prepare','export','inspect','demo')][string]$Action='demo',
 [Parameter(Mandatory=$true)][string]$ProjectId
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$cli=Join-Path $root 'src\ev-conversion\prototype-v2.mjs'
if(!(Test-Path -LiteralPath $cli -PathType Leaf)){throw 'FUN_EV_V2_SOURCE_MISSING'}
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){$node=Get-Command node -ErrorAction SilentlyContinue}
if(-not $node){throw 'FUN_EV_V2_NODE_MISSING'}
& $node.Source $cli $Action $ProjectId
if($LASTEXITCODE -ne 0){throw 'FUN_EV_V2_HOLD'}
