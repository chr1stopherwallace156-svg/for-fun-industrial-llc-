# FI_UNIFIED_WEB_8798_REPAIR_V1
# Opt-in, owner-verified restart of ONLY the isolated 8798 Node child.
# No stop/start of 8789,8796,8797,8088,8791, or Elektron Ollama.
[CmdletBinding()]param([switch]$Apply)
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Runner=Join-Path $Repo 'scripts\Run-Fun-Unified-Chat8798.mjs'
$Diagnostic=Join-Path $Repo 'scripts\Diagnose-Fun-Unified-Web8798.mjs'
$Starter=Join-Path $Repo 'Start-Fun-Unified-Chat8798.ps1'
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$Protected=@(8789,8796,8797,8088,8791)
function Hold([string]$Cause){throw ('FUN_WEB_REPAIR_HOLD='+$Cause)}
function Listen([int]$Port){
 return @(
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
   Sort-Object LocalAddress,OwningProcess |
   ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}
 )
}
if(-not $Apply){
 Write-Host 'FUN_WEB_REPAIR=INACTIVE Use -Apply only after reviewing owner-verified restart policy'
 exit 0
}
foreach($File in @($Runner,$Diagnostic,$Starter)){
 if(-not (Test-Path -LiteralPath $File -PathType Leaf)){Hold ('SOURCE_MISSING_'+$File)}
 if((Get-Item -LiteralPath $File).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_REFUSED_'+$File)}
}
# Preflight: do not stop a working service if the corrected new source cannot
# retrieve example.org's page outside the still-running old 8798 process.
& $Node --check $Diagnostic
if($LASTEXITCODE -ne 0){Hold 'WEB_DIAGNOSTIC_PARSE'}
& $Node --check $Runner
if($LASTEXITCODE -ne 0){Hold 'UNIFIED_RUNNER_PARSE'}
& $Node $Diagnostic --check-example-org
if($LASTEXITCODE -ne 0){Hold 'PUBLIC_WEB_DIAGNOSTIC_FAILED_8798_UNCHANGED'}
$Baseline=@{}
foreach($Port in $Protected){
 $Baseline[$Port]=@(Listen $Port)
 if($Baseline[$Port].Count -eq 0){Hold ('PROTECTED_LISTENER_MISSING_'+$Port)}
}
$Original=@(Listen 8798)
if($Original.Count -ne 1){Hold 'SINGLE_8798_LISTENER_REQUIRED'}
if(-not ($Original[0] -match '^127\.0\.0\.1:(\d+)
$OldPid=[int]$Matches[1]
$Proc=Get-CimInstance Win32_Process -Filter "ProcessId=$OldPid" -ErrorAction Stop
if(-not $Proc -or $Proc.Name -ne 'node.exe' -or
  [string]$Proc.CommandLine -notmatch [regex]::Escape($Runner) -or
  [string]$Proc.CommandLine -notmatch '--serve'){Hold '8798_OWNER_NOT_EXPECTED_UNIFIED_NODE'}
$Old=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 15
if($Old.version -ne 'fi-unified-task-chat-8798-v1' -or !$Old.rea.ready -or !$Old.local.ready){Hold '8798_STATUS_NOT_READY'}
$R=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/status' -TimeoutSec 15
$T=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/tools' -TimeoutSec 15
$AI=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/status' -TimeoutSec 15
if($R.liveMcpHealth -ne 'ready' -or [int]$R.realReaToolCount -ne 229 -or
  [int]$T.local_tool_count -ne 19 -or $AI.state -ne 'ready'){Hold 'PROTECTED_SERVICES_NOT_READY'}
Write-Host ('FUN_WEB_REPAIR_PREFLIGHT=PASS ONLY_8798_PID='+$OldPid)
# Stop only the verified 8798 owner. Never use port-wide or process-name kills.
Stop-Process -Id $OldPid -Force -ErrorAction Stop
$Freed=$false
for($i=0;$i -lt 40;$i++){
 Start-Sleep -Milliseconds 150
 if(@(Listen 8798).Count -eq 0){$Freed=$true;break}
}
if(-not $Freed){Hold '8798_PORT_NOT_RELEASED'}
# Reuse the qualified starter for a new isolated 8798 child; it checks health,
# Node syntax, 30+ offline tests and unchanged protected listener identities.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Starter
if($LASTEXITCODE -ne 0){Hold '8798_RESTART_FAILED_REVIEW_LOGS'}
$After=@(Listen 8798)
if($After.Count -ne 1){Hold '8798_REPLACEMENT_OWNER_INVALID'}
if(-not ($After[0] -match '^127\.0\.0\.1:(\d+)
$NewPid=[int]$Matches[1]
if($NewPid -eq $OldPid){Hold '8798_PID_NOT_REPLACED'}
foreach($Port in $Protected){
 if((@(Listen $Port) -join ';') -cne ($Baseline[$Port] -join ';')){Hold ('PROTECTED_LISTENER_CHANGED_'+$Port)}
}
$New=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 15
if($New.version -ne 'fi-unified-task-chat-8798-v1' -or !$New.rea.ready -or !$New.local.ready -or !$New.ai.ready){
 Hold '8798_REPLACEMENT_HEALTH_HOLD'
}
Write-Host ('FUN_WEB_REPAIR=PASS OLD_8798_PID='+$OldPid+' NEW_8798_PID='+$NewPid)
Write-Host 'ONLY_8798_RESTARTED=TRUE 8789_8796_8797_8088_8791=PRESERVED'
Write-Host 'NEXT=RUN_LIVE_UNIFIED_WEB_CHAT_READ_ONLY'
)){Hold '8798_NOT_LOOPBACK_ONLY'}
$OldPid=[int]$Matches[1]
$Proc=Get-CimInstance Win32_Process -Filter "ProcessId=$OldPid" -ErrorAction Stop
if(-not $Proc -or $Proc.Name -ne 'node.exe' -or
  [string]$Proc.CommandLine -notmatch [regex]::Escape($Runner) -or
  [string]$Proc.CommandLine -notmatch '--serve'){Hold '8798_OWNER_NOT_EXPECTED_UNIFIED_NODE'}
$Old=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 15
if($Old.version -ne 'fi-unified-task-chat-8798-v1' -or !$Old.rea.ready -or !$Old.local.ready){Hold '8798_STATUS_NOT_READY'}
$R=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/status' -TimeoutSec 15
$T=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/tools' -TimeoutSec 15
$AI=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/status' -TimeoutSec 15
if($R.liveMcpHealth -ne 'ready' -or [int]$R.realReaToolCount -ne 229 -or
  [int]$T.local_tool_count -ne 19 -or $AI.state -ne 'ready'){Hold 'PROTECTED_SERVICES_NOT_READY'}
Write-Host ('FUN_WEB_REPAIR_PREFLIGHT=PASS ONLY_8798_PID='+$OldPid)
# Stop only the verified 8798 owner. Never use port-wide or process-name kills.
Stop-Process -Id $OldPid -Force -ErrorAction Stop
$Freed=$false
for($i=0;$i -lt 40;$i++){
 Start-Sleep -Milliseconds 150
 if(@(Listen 8798).Count -eq 0){$Freed=$true;break}
}
if(-not $Freed){Hold '8798_PORT_NOT_RELEASED'}
# Reuse the qualified starter for a new isolated 8798 child; it checks health,
# Node syntax, 30+ offline tests and unchanged protected listener identities.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Starter
if($LASTEXITCODE -ne 0){Hold '8798_RESTART_FAILED_REVIEW_LOGS'}
$After=@(Listen 8798)
if($After.Count -ne 1 -or $After[0] -notmatch '^127\.0\.0\.1:(\d+)$'){Hold '8798_REPLACEMENT_OWNER_INVALID'}
$NewPid=[int]$Matches[1]
if($NewPid -eq $OldPid){Hold '8798_PID_NOT_REPLACED'}
foreach($Port in $Protected){
 if((@(Listen $Port) -join ';') -cne ($Baseline[$Port] -join ';')){Hold ('PROTECTED_LISTENER_CHANGED_'+$Port)}
}
$New=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 15
if($New.version -ne 'fi-unified-task-chat-8798-v1' -or !$New.rea.ready -or !$New.local.ready -or !$New.ai.ready){
 Hold '8798_REPLACEMENT_HEALTH_HOLD'
}
Write-Host ('FUN_WEB_REPAIR=PASS OLD_8798_PID='+$OldPid+' NEW_8798_PID='+$NewPid)
Write-Host 'ONLY_8798_RESTARTED=TRUE 8789_8796_8797_8088_8791=PRESERVED'
Write-Host 'NEXT=RUN_LIVE_UNIFIED_WEB_CHAT_READ_ONLY'
)){Hold '8798_REPLACEMENT_OWNER_INVALID'}
$NewPid=[int]$Matches[1]
if($NewPid -eq $OldPid){Hold '8798_PID_NOT_REPLACED'}
foreach($Port in $Protected){
 if((@(Listen $Port) -join ';') -cne ($Baseline[$Port] -join ';')){Hold ('PROTECTED_LISTENER_CHANGED_'+$Port)}
}
$New=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 15
if($New.version -ne 'fi-unified-task-chat-8798-v1' -or !$New.rea.ready -or !$New.local.ready -or !$New.ai.ready){
 Hold '8798_REPLACEMENT_HEALTH_HOLD'
}
Write-Host ('FUN_WEB_REPAIR=PASS OLD_8798_PID='+$OldPid+' NEW_8798_PID='+$NewPid)
Write-Host 'ONLY_8798_RESTARTED=TRUE 8789_8796_8797_8088_8791=PRESERVED'
Write-Host 'NEXT=RUN_LIVE_UNIFIED_WEB_CHAT_READ_ONLY'
)){Hold '8798_NOT_LOOPBACK_ONLY'}
$OldPid=[int]$Matches[1]
$Proc=Get-CimInstance Win32_Process -Filter "ProcessId=$OldPid" -ErrorAction Stop
if(-not $Proc -or $Proc.Name -ne 'node.exe' -or
  [string]$Proc.CommandLine -notmatch [regex]::Escape($Runner) -or
  [string]$Proc.CommandLine -notmatch '--serve'){Hold '8798_OWNER_NOT_EXPECTED_UNIFIED_NODE'}
$Old=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 15
if($Old.version -ne 'fi-unified-task-chat-8798-v1' -or !$Old.rea.ready -or !$Old.local.ready){Hold '8798_STATUS_NOT_READY'}
$R=Invoke-RestMethod 'http://127.0.0.1:8797/api/rea229/status' -TimeoutSec 15
$T=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/tools' -TimeoutSec 15
$AI=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/status' -TimeoutSec 15
if($R.liveMcpHealth -ne 'ready' -or [int]$R.realReaToolCount -ne 229 -or
  [int]$T.local_tool_count -ne 19 -or $AI.state -ne 'ready'){Hold 'PROTECTED_SERVICES_NOT_READY'}
Write-Host ('FUN_WEB_REPAIR_PREFLIGHT=PASS ONLY_8798_PID='+$OldPid)
# Stop only the verified 8798 owner. Never use port-wide or process-name kills.
Stop-Process -Id $OldPid -Force -ErrorAction Stop
$Freed=$false
for($i=0;$i -lt 40;$i++){
 Start-Sleep -Milliseconds 150
 if(@(Listen 8798).Count -eq 0){$Freed=$true;break}
}
if(-not $Freed){Hold '8798_PORT_NOT_RELEASED'}
# Reuse the qualified starter for a new isolated 8798 child; it checks health,
# Node syntax, 30+ offline tests and unchanged protected listener identities.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Starter
if($LASTEXITCODE -ne 0){Hold '8798_RESTART_FAILED_REVIEW_LOGS'}
$After=@(Listen 8798)
if($After.Count -ne 1 -or $After[0] -notmatch '^127\.0\.0\.1:(\d+)$'){Hold '8798_REPLACEMENT_OWNER_INVALID'}
$NewPid=[int]$Matches[1]
if($NewPid -eq $OldPid){Hold '8798_PID_NOT_REPLACED'}
foreach($Port in $Protected){
 if((@(Listen $Port) -join ';') -cne ($Baseline[$Port] -join ';')){Hold ('PROTECTED_LISTENER_CHANGED_'+$Port)}
}
$New=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 15
if($New.version -ne 'fi-unified-task-chat-8798-v1' -or !$New.rea.ready -or !$New.local.ready -or !$New.ai.ready){
 Hold '8798_REPLACEMENT_HEALTH_HOLD'
}
Write-Host ('FUN_WEB_REPAIR=PASS OLD_8798_PID='+$OldPid+' NEW_8798_PID='+$NewPid)
Write-Host 'ONLY_8798_RESTARTED=TRUE 8789_8796_8797_8088_8791=PRESERVED'
Write-Host 'NEXT=RUN_LIVE_UNIFIED_WEB_CHAT_READ_ONLY'
