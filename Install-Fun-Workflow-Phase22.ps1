# FI_PHASE22_INSTALL_V1 — additive local CLI only. Never restart services or alter existing checkpoints.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Target=Join-Path $Live 'src\workflows'
$Source=Join-Path $Root 'src\workflows'
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Git=(Get-Command git.exe -ErrorAction Stop).Source
$names=@('phase22.mjs','phase22-cli.mjs')
$baseline=@{
 'coordinator.mjs'='506f2cb0a1c874e83eaed7a37ada278318ff6fa2'
 'cli.mjs'='4e82c185bc896da83cdb45634d8fd55f0786ee6f'
 'optimization-step.mjs'='21a6eeb99bcad124ef972e64fb2f91ee96ff9fea'
}
$ports=@(8789,8791,8088,4479,8443)
function Hold([string]$reason){throw ('FUN_PHASE22_INSTALL_HOLD='+$reason)}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ',')
}
foreach($dir in @($Root,$Source,$Live,$Target)){
 if(-not(Test-Path -LiteralPath $dir -PathType Container)){Hold ('DIRECTORY_MISSING_'+$dir)}
 if((Get-Item -LiteralPath $dir -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SYMLINK_DIRECTORY_DENIED'}
}
$branch=(& $Git -C $Root branch --show-current)
if($LASTEXITCODE -ne 0 -or $branch.Trim() -ne 'feature/fun-workflow-phase22-20261110'){Hold 'WRONG_STAGING_BRANCH'}
foreach($name in $baseline.Keys){
 $installed=Join-Path $Target $name
 if(-not(Test-Path -LiteralPath $installed -PathType Leaf)){Hold ('LIVE_BASELINE_MISSING_'+$name)}
 if((Get-Item -LiteralPath $installed -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'LIVE_BASELINE_SYMLINK'}
 $hash=& $Git -C $Root hash-object --path=('src/workflows/'+$name) -- $installed
 if($LASTEXITCODE -ne 0 -or $hash.Trim() -ne $baseline[$name]){Hold ('LIVE_BASELINE_CHANGED_'+$name)}
}
foreach($name in $names){
 $s=Join-Path $Source $name
 $t=Join-Path $Target $name
 if(-not(Test-Path -LiteralPath $s -PathType Leaf)){Hold ('SOURCE_MISSING_'+$name)}
 if((Get-Item -LiteralPath $s -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold 'SOURCE_SYMLINK'}
 if(Test-Path -LiteralPath $t){Hold ('PHASE22_ALREADY_INSTALLED_'+$name)}
 & $Node --check $s
 if($LASTEXITCODE -ne 0){Hold ('SOURCE_SYNTAX_'+$name)}
}
$test=Join-Path $Root 'intelligence-checks\workflow-phase22-case.mjs'
if(-not(Test-Path -LiteralPath $test -PathType Leaf)){Hold 'TEST_MISSING'}
& $Node --test $test (Join-Path $Root 'intelligence-checks\workflow-optimization-case.mjs')
if($LASTEXITCODE -ne 0){Hold 'REGRESSION_TESTS_FAILED'}
$before=@{};foreach($p in $ports){$before[$p]=Snapshot $p}
$copied=@()
try{
 foreach($name in $names){
  $s=Join-Path $Source $name
  $t=Join-Path $Target $name
  Copy-Item -LiteralPath $s -Destination $t -ErrorAction Stop
  $copied+=,$t
  if((Get-FileHash -LiteralPath $s).Hash -ne (Get-FileHash -LiteralPath $t).Hash){Hold ('INSTALLED_HASH_MISMATCH_'+$name)}
  & $Node --check $t
  if($LASTEXITCODE -ne 0){Hold ('INSTALLED_SYNTAX_'+$name)}
 }
 foreach($p in $ports){if((Snapshot $p) -cne $before[$p]){Hold ('PROTECTED_LISTENER_CHANGED_'+$p)}}
 Write-Host 'FUN_PHASE22_INSTALL=PASS MODEL=LLAMA_CPP_EXTERNAL OPTUNA_OR_TOOLS=EXISTING REA=UNCHANGED SERVICES=UNTOUCHED'
 Write-Host ('FUN_PHASE22_CLI='+ (Join-Path $Target 'phase22-cli.mjs'))
}catch{
 foreach($path in $copied){Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue}
 throw ('FUN_PHASE22_INSTALL_ROLLBACK=ATTEMPTED REASON='+$_.Exception.Message)
}
