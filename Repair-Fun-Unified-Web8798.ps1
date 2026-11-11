# FI_UNIFIED_WEB_8798_REPAIR_V2
# Controlled refresh of ONLY the existing, owner-verified Unified Chat 8798.
# NEVER stop Qwen/llama.cpp 8088, original 8789, local 8796, REA 8797,
# compute 8791 or Elektron's separate Ollama process.
[CmdletBinding()]param([switch]$Apply)
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Runner=Join-Path $Repo 'scripts\Run-Fun-Unified-Chat8798.mjs'
$Diagnostic=Join-Path $Repo 'scripts\Diagnose-Fun-Unified-Web8798.mjs'
$Starter=Join-Path $Repo 'Start-Fun-Unified-Chat8798.ps1'
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Protected=@(8789,8796,8797,8088,8791)
function Hold([string]$Code){throw ('FUN_WEB_REPAIR_HOLD='+$Code)}
function Listen([int]$Port){
 return @(
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
   Sort-Object LocalAddress,OwningProcess |
   ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}
 )
}
if(-not $Apply){
 Write-Host 'FUN_WEB_REPAIR=INACTIVE. Explicit -Apply required.'
 exit 0
}
foreach($F in @($Runner,$Diagnostic,$Starter)){
 if(-not (Test-Path -LiteralPath $F -PathType Leaf)){Hold ('SOURCE_MISSING_'+$F)}
 if((Get-Item -LiteralPath $F).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_REFUSED_'+$F)}
}
# Preflight tests and a real read-only HTTPS GET occur before touching 8798.
& $Node --check $Diagnostic
if($LASTEXITCODE -ne 0){Hold 'DIAGNOSTIC_SYNTAX'}
& $Node --check $Runner
if($LASTEXITCODE -ne 0){Hold 'RUNNER_SYNTAX'}
& $Node $Diagnostic --check-example-org
if($LASTEXITCODE -ne 0){Hold 'WEB_DIAGNOSTIC_FAILED_8798_PRESERVED'}
$Before=@{}
foreach($Port in $Protected){
 $Before[$Port]=@(Listen $Port)
 if($Before[$Port].Count -eq 0){Hold ('PROTECTED_LISTENER_MISSING_'+$Port)}
}
$Current=@(Listen 8798)
if($Current.Count -ne 1){Hold '8798_SINGLE_LISTENER_REQUIRED'}
if(-not ($Current[0] -match '^127\.0\.0\.1:(\d+)$')){Hold '8798_NOT_LOOPBACK_ONLY'}
$OldPid=[int]$Matches[1]
$Owner=Get-CimInstance Win32_Process -Filter "ProcessId=$OldPid" -ErrorAction Stop
if(-not $Owner){Hold '8798_PROCESS_NOT_FOUND'}
if($Owner.Name -ne 'node.exe'){Hold '8798_NOT_NODE'}
if([string]$Owner.CommandLine -notmatch [regex]::Escape($Runner)){Hold '8798_WRONG_SCRIPT_OWNER'}
if([string]$Owner.CommandLine -notmatch '--serve'){Hold '8798_NOT_EXPLICIT_SERVER'}
$Old=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 15
if($Old.version -ne 'fi-unified-task-chat-8798-v1' -or !$Old.rea.ready -or !$Old.local.ready){Hold '8798_STATUS_NOT_READY'}
$R=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/status' -TimeoutSec 15
$T=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/tools' -TimeoutSec 15
$AI=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/status' -TimeoutSec 15
if($R.liveMcpHealth -ne 'ready' -or [int]$R.realReaToolCount -ne 229 -or [int]$T.local_tool_count -ne 19 -or $AI.state -ne 'ready'){Hold 'PARENT_HEALTH_NOT_READY'}
Write-Host ('FUN_WEB_REPAIR_PREFLIGHT=PASS VERIFIED_OLD_8798_PID='+$OldPid)
# Exactly one known owned process is stopped. Never terminate by process name.
Stop-Process -Id $OldPid -Force -ErrorAction Stop
$Freed=$false
for($i=0;$i -lt 40;$i++){
 Start-Sleep -Milliseconds 150
 if(@(Listen 8798).Count -eq 0){$Freed=$true;break}
}
if(-not $Freed){Hold '8798_NOT_RELEASED'}
# The existing launcher verifies syntax, tests, services, and protected PIDs.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Starter
if($LASTEXITCODE -ne 0){Hold '8798_STARTER_FAILED_CHECK_LOGS'}
$Now=@(Listen 8798)
if($Now.Count -ne 1){Hold 'NEW_8798_LISTENER_INVALID'}
if(-not ($Now[0] -match '^127\.0\.0\.1:(\d+)$')){Hold 'NEW_8798_NOT_LOOPBACK'}
$NewPid=[int]$Matches[1]
if($NewPid -eq $OldPid){Hold 'NEW_PID_NOT_DISTINCT'}
foreach($Port in $Protected){
 if((@(Listen $Port) -join ';') -cne ($Before[$Port] -join ';')){Hold ('PROTECTED_LISTENER_CHANGED_'+$Port)}
}
$New=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 15
if($New.version -ne 'fi-unified-task-chat-8798-v1' -or !$New.rea.ready -or !$New.local.ready -or !$New.ai.ready){Hold 'NEW_8798_HEALTH_HOLD'}
Write-Host ('FUN_WEB_REPAIR=PASS OLD_8798_PID='+$OldPid+' NEW_8798_PID='+$NewPid)
Write-Host 'ONLY_8798_RESTARTED=TRUE QWEN_8088=UNCHANGED REA_8797=UNCHANGED LOCAL_8796=UNCHANGED ORIGINAL_8789=UNCHANGED COMPUTE_8791=UNCHANGED'
Write-Host 'NEXT=RUN_LIVE_WEBSITE_CHAT_READ_ONLY'
