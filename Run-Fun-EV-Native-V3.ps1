# Fun Industrial-only V3 native CAD/WireViz inspection and optional hash-pinned renderer.
# Probe never executes external CAD, WireViz, Graphviz, packages or services.
[CmdletBinding()]
param(
 [ValidateSet('probe','render')][string]$Action='probe',
 [string]$ProjectId='',
 [string]$WireVizSha256='',
 [string]$DotSha256=''
)
$ErrorActionPreference='Stop'
$source=Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'src\ev-conversion\native-wireviz-v3.mjs'
if(!(Test-Path -LiteralPath $source -PathType Leaf)){throw 'FUN_EV_V3_SOURCE_MISSING'}
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){$node=Get-Command node -ErrorAction SilentlyContinue}
if(-not $node){throw 'FUN_EV_V3_NODE_MISSING'}
if($Action -eq 'probe'){
 if($ProjectId -or $WireVizSha256 -or $DotSha256){throw 'FUN_EV_V3_PROBE_ARGUMENT_HOLD'}
 & $node.Source $source probe
}else{
 if(!$ProjectId -or !$WireVizSha256 -or !$DotSha256){throw 'FUN_EV_V3_RENDER_PIN_HOLD'}
 & $node.Source $source render $ProjectId $WireVizSha256 $DotSha256
}
if($LASTEXITCODE -ne 0){throw 'FUN_EV_V3_COMMAND_HOLD'}
