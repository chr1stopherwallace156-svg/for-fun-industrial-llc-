# FUN_CAPABILITY_INDEX_STAGE_V1
# Stage only. Never modifies the installed dashboard or restarts any process.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Server=Join-Path $Live 'src\server.mjs'
$Patcher=Join-Path $Repo 'scripts\patch-capability-live.mjs'
$Work=Join-Path $env:LOCALAPPDATA ('FunIndustrial\CapabilityIndex8789\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
function Hold([string]$reason){throw ('FUN_CAPABILITY_STAGE_HOLD='+$reason)}
function File([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('SOURCE_MISSING_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_FILE_'+$p)}
}
foreach($p in @($Server,$Patcher,
 (Join-Path $Repo 'src\cognition\capability-index.mjs'),
 (Join-Path $Repo 'src\cognition\capability-chat.mjs'),
 (Join-Path $Repo 'intelligence-checks\capability-index-case.mjs'))){File $p}
$Original=[IO.File]::ReadAllText($Server)
if(-not $Original.Contains('FI_COGNITIVE_LIVE_PATCH_V1')){Hold 'COGNITIVE_KERNEL_NOT_INSTALLED'}
if($Original.Contains('FI_CAPABILITY_INDEX_LIVE_V1')){Hold 'CAPABILITY_INDEX_ALREADY_INSTALLED'}
$listener=@(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue)
if($listener.Count -ne 1 -or $listener[0].LocalAddress -ne '127.0.0.1'){Hold 'DASHBOARD_OWNER_AMBIGUOUS'}
$dashPid=[int]$listener[0].OwningProcess
$proc=Get-CimInstance Win32_Process -Filter ("ProcessId="+$dashPid)
if(-not $proc -or $proc.Name -ne 'node.exe' -or [string]$proc.CommandLine -notmatch 'src[/\\]server\.mjs'){Hold 'DASHBOARD_OWNER_NOT_VERIFIED'}
$node=[string]$proc.ExecutablePath
File $node
$AI=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/status' -TimeoutSec 12
$Cognition=Invoke-RestMethod 'http://127.0.0.1:8789/api/cognition/health' -TimeoutSec 8
if($AI.state -ne 'ready'){Hold 'LOCAL_MODEL_NOT_READY'}
if($Cognition.version -ne 'fi-cognitive-live-bridge-v1' -or $Cognition.reaExecutionGrants -ne 0){Hold 'COGNITION_NOT_HEALTHY_OR_AUTHORITY_UNEXPECTED'}
& $node --check $Patcher
if($LASTEXITCODE -ne 0){Hold 'PATCHER_NODE_SYNTAX_FAILED'}
foreach($path in @('src\cognition\capability-index.mjs','src\cognition\capability-chat.mjs')){
 & $node --check (Join-Path $Repo $path)
 if($LASTEXITCODE -ne 0){Hold 'MODULE_NODE_SYNTAX_FAILED'}
}
Push-Location $Repo
try{
 & $node --test 'intelligence-checks\capability-index-case.mjs'
 if($LASTEXITCODE -ne 0){Hold 'CAPABILITY_INDEX_OFFLINE_TESTS_FAILED'}
}finally{Pop-Location}
New-Item -ItemType Directory -Path $Work -Force | Out-Null
$Staged=Join-Path $Work 'server.staged.mjs'
Copy-Item -LiteralPath $Server -Destination (Join-Path $Work 'server.original.mjs')
& $node $Patcher $Server $Staged
if($LASTEXITCODE -ne 0){Hold 'STAGE_PATCH_FAILED'}
& $node --check $Staged
if($LASTEXITCODE -ne 0){Hold 'STAGED_SERVER_SYNTAX_FAILED'}
if((Get-FileHash -LiteralPath $Server).Hash -ne (Get-FileHash -LiteralPath (Join-Path $Work 'server.original.mjs')).Hash){Hold 'ORIGINAL_SOURCE_CHANGED_DURING_STAGE'}
Write-Host 'FUN_CAPABILITY_INDEX_STAGE=PASS'
Write-Host 'COGNITIVE_KERNEL=UNCHANGED_AI=READY'
Write-Host 'CAPABILITY_ROUTES=3 READ_ONLY_DISCOVERY=TRUE REA_EXECUTION_GRANTS=0'
Write-Host 'LIVE_SERVER_CHANGED=FALSE PROCESSES_RESTARTED=0'
Write-Host ('FUN_CAPABILITY_INDEX_BACKUP='+$Work)
Write-Host 'FUN_CAPABILITY_INDEX_LIVE_DEPLOY=NOT_PERFORMED'
