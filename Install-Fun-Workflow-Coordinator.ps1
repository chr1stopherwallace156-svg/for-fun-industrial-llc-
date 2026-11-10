# FI_WORKFLOW_COORDINATOR_INSTALL_V1 — add only two local JavaScript files.
# No service restart, no change to dashboard routes, no external tools or REA permissions.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Source=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$LiveSrc=Join-Path $Live 'src'
$Target=Join-Path $LiveSrc 'workflows'
$Root=Join-Path $Source 'src\workflows'
$Test=Join-Path $Source 'intelligence-checks\workflow-coordinator-case.mjs'
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$files=@('coordinator.mjs','cli.mjs')
function Hold([string]$reason){throw ('FUN_WORKFLOW_INSTALL_HOLD='+$reason)}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ',')
}
foreach($dir in @($Source,$Root,$Live,$LiveSrc)){
 if(-not(Test-Path -LiteralPath $dir -PathType Container)){Hold ('DIRECTORY_MISSING_'+$dir)}
 $d=Get-Item -LiteralPath $dir -Force
 if($d.Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'DIRECTORY_REPARSE_POINT_DENIED'}
}
foreach($name in $files){
 $file=Join-Path $Root $name
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('SOURCE_MISSING_'+$name)}
 if((Get-Item -LiteralPath $file -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SOURCE_REPARSE_POINT_DENIED'}
}
if(-not(Test-Path -LiteralPath $Test -PathType Leaf)){Hold 'TEST_MISSING'}
if(Test-Path -LiteralPath $Target){Hold 'TARGET_ALREADY_EXISTS_REQUIRES_REVIEW'}
$ports=@{}
foreach($port in @(8789,8791,8088,4479,8443)){$ports[$port]=Snapshot $port}
foreach($name in $files){& $Node --check (Join-Path $Root $name);if($LASTEXITCODE -ne 0){Hold ('SOURCE_SYNTAX_'+$name)}}
& $Node --test $Test
if($LASTEXITCODE -ne 0){Hold 'WORKFLOW_TESTS_FAILED'}
$created=$false
try{
 New-Item -Path $Target -ItemType Directory -ErrorAction Stop|Out-Null;$created=$true
 if((Get-Item $Target -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'TARGET_REPARSE_POINT_DENIED'}
 foreach($name in $files){
  $src=Join-Path $Root $name;$dst=Join-Path $Target $name
  Copy-Item -LiteralPath $src -Destination $dst -ErrorAction Stop
  if((Get-FileHash $src).Hash -ne (Get-FileHash $dst).Hash){Hold ('HASH_MISMATCH_'+$name)}
  & $Node --check $dst
  if($LASTEXITCODE -ne 0){Hold ('INSTALLED_SYNTAX_'+$name)}
 }
 foreach($port in @(8789,8791,8088,4479,8443)){
  if((Snapshot $port) -cne $ports[$port]){Hold ('PROTECTED_SERVICE_CHANGED_'+$port)}
 }
 Write-Host 'FUN_WORKFLOW_COORDINATOR_INSTALL=PASS MODE=LOCAL_CLI CHECKPOINTS=PERSISTENT RUNNING_SERVICES=UNTOUCHED REA=UNTOUCHED OLLAMA=NOT_USED'
 Write-Host ('FUN_WORKFLOW_COORDINATOR_CLI='+ (Join-Path $Target 'cli.mjs'))
}catch{
 $failure=$_.Exception.Message
 if($created){Remove-Item -LiteralPath $Target -Recurse -Force -ErrorAction SilentlyContinue}
 throw ('FUN_WORKFLOW_INSTALL_FAILED='+$failure+' INSTALL_FILES_ROLLED_BACK=TRUE')
}
