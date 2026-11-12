# FI_REA229_8797_GUARDED_REFRESH_V1
# Explicit operator-approved replacement of only the independently owned 8797 sidecar.
# -CheckOnly performs validation without stopping/starting any process or making MCP calls.
# -Apply REQUIRES the exact approval phrase. Never restart 8789/8796/8798/8088/8791.
[CmdletBinding()]param([switch]$CheckOnly,[switch]$Apply,[string]$ApprovalPhrase='')
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Runner=Join-Path $Repo 'scripts\Run-Fun-Rea229-Sidecar8797.mjs'
$Starter=Join-Path $Repo 'Start-Fun-Rea229-Sidecar8797.ps1'
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Protected=@(8789,8796,8798,8088,8791,8794,4479)
$Required=@(8789,8796,8798,8088,8791)
function Hold([string]$Code){throw ('REA8797_GUARDED_HOLD='+$Code)}
function Listen([int]$Port){
 return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
   Sort-Object LocalAddress,OwningProcess |
   ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"})
}
function CurrentOwner([int]$ProcessId){
 return Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
}
if($CheckOnly -and $Apply){Hold 'CHOOSE_ONLY_ONE_MODE'}
if(-not $CheckOnly -and -not $Apply){
 Write-Host 'REA8797_GUARDED=INACTIVE. Use -CheckOnly for read-only qualification. -Apply requires a separate approval phrase.'
 exit 0
}
if($Apply -and $ApprovalPhrase -cne 'AUTHORIZE REA 8797 RESTART'){Hold 'EXPLICIT_APPROVAL_PHRASE_REQUIRED'}
$Files=@(
 $Runner,$Starter,(Join-Path $Repo 'src\adapters\rea.mjs'),
 (Join-Path $Repo 'src\experimental\rea-full-229.mjs'),
 (Join-Path $Repo 'src\experimental\rea-error-evidence-v33.mjs'),
 (Join-Path $Repo 'src\experimental\verified-binary-layout-v3-2.mjs'),
 (Join-Path $Repo 'scripts\Run-Fun-Unified-Chat8798.mjs'),
 (Join-Path $Repo 'intelligence-checks\rea229-full-case.mjs'),
 (Join-Path $Repo 'intelligence-checks\verified-binary-layout-v3-2-case.mjs'),
 (Join-Path $HOME 'FunIndustrial-REA-MCP-Activation\.env')
)
foreach($File in $Files){
 if(-not(Test-Path -LiteralPath $File -PathType Leaf)){Hold ('REQUIRED_SOURCE_MISSING_'+$File)}
 if((Get-Item -LiteralPath $File).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SOURCE_LINK_REFUSED_'+$File)}
}
$Code=Get-Content -LiteralPath (Join-Path $Repo 'src\experimental\rea-full-229.mjs') -Raw
if($Code -notmatch 'boundedMcpErrorEvidence'){Hold 'V33_EXACT_CALL_ERROR_BOUNDARY_MISSING'}
$Branch=(& git.exe -C $Repo branch --show-current)
if($LASTEXITCODE -ne 0 -or $Branch -ne 'feature/fun-rea8797-guarded-refresh-20261111'){Hold 'WRONG_REVIEW_BRANCH'}
$Dirty=@(& git.exe -C $Repo status --porcelain=v1 --untracked-files=all)
if($LASTEXITCODE -ne 0 -or $Dirty.Count -gt 0){Hold 'DIRTY_SOURCE_TREE'}
foreach($F in @(
 (Join-Path $Repo 'src\experimental\rea-full-229.mjs'),
 (Join-Path $Repo 'src\experimental\rea-error-evidence-v33.mjs'),
 (Join-Path $Repo 'src\experimental\verified-binary-layout-v3-2.mjs'),
 $Runner
)){
 & $Node --check $F
 if($LASTEXITCODE -ne 0){Hold ('NODE_SYNTAX_'+$F)}
}
Push-Location $Repo
try{
 & $Node --test 'intelligence-checks\rea229-full-case.mjs' 'intelligence-checks\verified-binary-layout-v3-2-case.mjs' 'intelligence-checks\verified-file-v3-1-case.mjs' 'intelligence-checks\verified-rea-v3-case.mjs' 'intelligence-checks\unified-task-chat-case.mjs' 'intelligence-checks\adaptive-capability-v2-case.mjs'
 if($LASTEXITCODE -ne 0){Hold 'OFFLINE_QUALIFICATION_FAILED_NO_RESTART'}
}finally{Pop-Location}
$Before=@{}
foreach($Port in $Protected){
 $Before[$Port]=@(Listen $Port)
 if($Required -contains $Port -and $Before[$Port].Count -eq 0){Hold ('PROTECTED_LISTENER_MISSING_'+$Port)}
}
$Current=@(Get-NetTCPConnection -LocalPort 8797 -State Listen -ErrorAction SilentlyContinue)
if($Current.Count -ne 1 -or $Current[0].LocalAddress -ne '127.0.0.1'){Hold '8797_NOT_ONE_LOOPBACK_LISTENER'}
$OldPid=[int]$Current[0].OwningProcess
$Owner=CurrentOwner $OldPid
if(-not $Owner -or $Owner.Name -ne 'node.exe'){Hold '8797_NOT_NODE'}
if([string]$Owner.CommandLine -notmatch [regex]::Escape($Runner)){Hold '8797_WRONG_REPOSITORY_SCRIPT_OWNER'}
if([string]$Owner.CommandLine -notmatch '(?<!\S)--serve(?!\S)'){Hold '8797_MISSING_EXPLICIT_SERVE'}
$Created=$Owner.CreationDate
$OldStatus=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/status' -TimeoutSec 15
if($OldStatus.version -ne 'fi-rea-229-full-mcp-v1' -or
 $OldStatus.state -ne 'ready' -or $OldStatus.liveMcpHealth -ne 'ready' -or
 [int]$OldStatus.realReaToolCount -ne 229 -or $OldStatus.busy -ne $false){
 Hold '8797_NOT_IDLE_AND_READY'
}
$OldTools=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/tools?limit=229' -TimeoutSec 20
$ParentTools=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/tools' -TimeoutSec 15
$Local=Invoke-RestMethod 'http://127.0.0.1:8796/api/ai/auto-local/status' -TimeoutSec 15
$Unified=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 15
$P3=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/v3/status' -TimeoutSec 15
$P31=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/v3.1/status' -TimeoutSec 15
$P32=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/v3.2/status' -TimeoutSec 15
if(@($OldTools.tools).Count -ne 229 -or [int]$ParentTools.rea_tool_count -ne 229 -or
 [int]$ParentTools.local_tool_count -ne 19 -or $Local.sidecar -ne $true -or
 -not $Unified.rea.ready -or -not $Unified.local.ready){Hold 'DEPENDENT_CATALOGUES_NOT_READY'}
if($P3.preparationPending -or $P31.preparationPending -or $P32.preparationPending -or
 $P3.busy -or $P31.busy -or $P32.busy){Hold 'UNIFIED_APPROVAL_PENDING_OR_BUSY'}
# Protect against accidentally terminating unrelated children via taskkill /T.
# The current REA MCP process may be Node/Python/rea; unknown descendants are HOLD.
$Processes=@(Get-CimInstance Win32_Process -ErrorAction Stop)
$Tree=@($OldPid);$Cursor=0
while($Cursor -lt $Tree.Count){
 $ParentPid=$Tree[$Cursor];$Cursor++
 foreach($Child in @($Processes | Where-Object {[int]$_.ParentProcessId -eq $ParentPid})){
  if($Tree -contains [int]$Child.ProcessId){continue}
  $Tree+=([int]$Child.ProcessId)
  if($Tree.Count -gt 8){Hold 'DESCENDANT_TREE_TOO_LARGE_MANUAL_REVIEW'}
  if(@('node.exe','python.exe','pythonw.exe','rea.exe','rea-agents.exe') -notcontains $Child.Name){
   Hold ('UNEXPECTED_CHILD_PROCESS_'+$Child.Name)
  }
 }
}
# This REA adapter owns exactly one directly spawned MCP child. Refuse any
# unexpected descendants or unknown command ownership: NEVER taskkill /T.
if($Tree.Count -ne 2){Hold 'REA_CHILD_PROCESS_TREE_UNEXPECTED_MANUAL_REVIEW'}
$McpPid=[int]$Tree[1]
$Mcp=CurrentOwner $McpPid
if(-not $Mcp -or [int]$Mcp.ParentProcessId -ne $OldPid -or
 $Mcp.Name -notin @('node.exe','python.exe','pythonw.exe','rea.exe','rea-agents.exe') -or
 [string]::IsNullOrWhiteSpace($Mcp.CommandLine) -or
 $Mcp.CommandLine -notmatch '(?i)rea|mcp'){Hold 'MCP_CHILD_OWNERSHIP_UNVERIFIED'}
$McpCreated=$Mcp.CreationDate
# Re-evaluate the listener + process creation identity before any termination.
$Again=@(Get-NetTCPConnection -LocalPort 8797 -State Listen -ErrorAction SilentlyContinue)
$AgainOwner=CurrentOwner $OldPid
if($Again.Count -ne 1 -or [int]$Again[0].OwningProcess -ne $OldPid -or
 -not $AgainOwner -or $AgainOwner.CreationDate -ne $Created){Hold '8797_OWNER_CHANGED'}
Write-Host ('REA8797_GUARDED_PREFLIGHT=PASS OLD_PID='+$OldPid+' MCP_TOOLS=229 LOCAL_TOOLS=19')
Write-Host ('REA8797_PROCESS_TREE_REVIEW='+($Tree -join ','))
Write-Host 'REA8797_PENDING_APPROVALS=NONE'
if($CheckOnly){
 Write-Host 'REA8797_CHECK_ONLY=PASS RESTARTS=0 MCP_CALLS=0 PROTECTED_SERVICES_UNCHANGED=TRUE'
 exit 0
}
# Explicit -Apply only. All operations above are preflight; stopping the old
# sidecar is not reversible in-memory. Failure after this point can leave 8797
# unavailable; do not blindly retry.
Write-Host 'REA8797_GUARDED_APPLY=OPERATOR_APPROVED'
$AgainStatus=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/status' -TimeoutSec 12
if($AgainStatus.busy -ne $false -or $AgainStatus.liveMcpHealth -ne 'ready'){Hold 'REA_BECAME_BUSY'}
# Stop only exact owner PIDs after reconfirming their identities.
# A partial failure is surfaced; never broaden to taskkill /T or kill by name.
$ChildNow=CurrentOwner $McpPid
$RootNow=CurrentOwner $OldPid
$GuardListener=@(Get-NetTCPConnection -LocalPort 8797 -State Listen -ErrorAction SilentlyContinue)
if(-not $ChildNow -or $ChildNow.CreationDate -ne $McpCreated -or
 [int]$ChildNow.ParentProcessId -ne $OldPid -or
 -not $RootNow -or $RootNow.CreationDate -ne $Created -or
 $GuardListener.Count -ne 1 -or [int]$GuardListener[0].OwningProcess -ne $OldPid){
 Hold 'PROCESS_IDENTITY_CHANGED_BEFORE_STOP'
}
Stop-Process -Id $McpPid -Force -ErrorAction Stop
Stop-Process -Id $OldPid -Force -ErrorAction Stop
$Freed=$false
for($I=0;$I -lt 40;$I++){
 Start-Sleep -Milliseconds 200
 if(@(Listen 8797).Count -eq 0){$Freed=$true;break}
}
if(-not $Freed){Hold '8797_NOT_RELEASED_NO_AUTOMATIC_RETRY'}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Starter
if($LASTEXITCODE -ne 0){Hold '8797_RESTART_FAILED_MANUAL_RECOVERY_REQUIRED'}
$New=@(Get-NetTCPConnection -LocalPort 8797 -State Listen -ErrorAction SilentlyContinue)
if($New.Count -ne 1 -or $New[0].LocalAddress -ne '127.0.0.1'){Hold '8797_REPLACEMENT_NOT_LOOPBACK'}
$NewPid=[int]$New[0].OwningProcess
if($NewPid -eq $OldPid){Hold '8797_PID_NOT_REPLACED'}
$NewStatus=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/status' -TimeoutSec 15
if($NewStatus.liveMcpHealth -ne 'ready' -or [int]$NewStatus.realReaToolCount -ne 229 -or
 $NewStatus.busy -ne $false -or [int]$NewStatus.executedCalls -ne 0){Hold '8797_NEW_SESSION_NOT_CLEAN'}
$NewTools=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/tools?limit=229' -TimeoutSec 15
$OriginalNames=(@($OldTools.tools | ForEach-Object {$_.name} | Sort-Object) -join [char]10)
$NewNames=(@($NewTools.tools | ForEach-Object {$_.name} | Sort-Object) -join [char]10)
if(@($NewTools.tools).Count -ne 229 -or $OriginalNames -cne $NewNames){Hold '8797_CATALOGUE_CHANGED'}
foreach($Port in $Protected){
 if((@(Listen $Port) -join ';') -cne ($Before[$Port] -join ';')){Hold ('PROTECTED_LISTENER_CHANGED_'+$Port)}
}
Write-Host ('REA8797_GUARDED_REFRESH=PASS OLD_PID='+$OldPid+' NEW_PID='+$NewPid)
Write-Host 'REA_229=PRESERVED LOCAL_19=PRESERVED QWEN_8088=PRESERVED ORIGINAL_8789=PRESERVED COMPUTE_8791=PRESERVED UNIFIED_8798=PRESERVED'
Write-Host 'NO_MCP_TOOL_EXECUTION=TRUE NEXT=8798_GUARDED_REFRESH_REQUIRES_SEPARATE_OPERATOR_APPROVAL'
