# FUN_EV_ENGINEERING_V1: stand-alone local runner. Does not start/stop any service.
[CmdletBinding()]
param([ValidateSet('status','catalog','init','verify')][string]$Action='status',[string]$ProjectId='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$cli=Join-Path $root 'src\ev-conversion\cli.mjs'
if(!(Test-Path -LiteralPath $cli -PathType Leaf)){throw 'FUN_EV_SOURCE_MISSING_HOLD'}
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){$node=Get-Command node -ErrorAction SilentlyContinue}
if(-not $node){throw 'FUN_EV_NODE_MISSING_HOLD'}
if($Action -in @('init','verify') -and [string]::IsNullOrWhiteSpace($ProjectId)){throw 'FUN_EV_PROJECT_ID_REQUIRED'}
if($Action -in @('status','catalog') -and -not [string]::IsNullOrWhiteSpace($ProjectId)){throw 'FUN_EV_UNEXPECTED_PROJECT_ID'}
if($Action -in @('init','verify')){& $node.Source $cli $Action $ProjectId}else{& $node.Source $cli $Action}
if($LASTEXITCODE -ne 0){throw 'FUN_EV_COMMAND_HOLD'}
