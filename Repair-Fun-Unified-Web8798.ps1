# FI_UNIFIED_WEB_8798_REPAIR_V2
# Controlled refresh of ONLY the existing, owner-verified Unified Chat 8798.
# NEVER stop Qwen/llama.cpp 8088, original 8789, local 8796, REA 8797,
# compute 8791 or Elektron's separate Ollama process.
[CmdletBinding()]param([switch]$Apply)
$ErrorActionPreference='Stop'
$Repo=$PSScriptRoot
$Runner=Join-Path $Repo 'scripts\Run-Fun-Unified-Chat8798.mjs'
$Diagnostic=Join-Path $Repo 'scripts\Diagnose-Fun-Unified-Web8798.mjs'
$AdaptiveDiagnostic=Join-Path $Repo 'scripts\Diagnose-Fun-Adaptive-V2.mjs'
$V3Diagnostic=Join-Path $Repo 'scripts\Diagnose-Fun-Verified-V3.mjs'
$V31Diagnostic=Join-Path $Repo 'scripts\Diagnose-Fun-Verified-File-V31.mjs'
$V32Diagnostic=Join-Path $Repo 'scripts\Diagnose-Fun-Verified-Binary-V32.mjs'
$V34Diagnostic=Join-Path $Repo 'scripts\Diagnose-Fun-Verified-PE-V34.mjs'
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
foreach($F in @($Runner,$Diagnostic,$AdaptiveDiagnostic,$V3Diagnostic,$V31Diagnostic,$V32Diagnostic,$V34Diagnostic,$Starter)){
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
# V2 must see exactly 229 registered REA and 19 registered local functions.
# Planning is a read-only GET of existing catalogues; no MCP tools/calls.
& $Node --check $AdaptiveDiagnostic
if($LASTEXITCODE -ne 0){Hold 'ADAPTIVE_V2_SYNTAX_8798_PRESERVED'}
& $Node $AdaptiveDiagnostic --plan 'Find tools to inspect a Rust binary'
if($LASTEXITCODE -ne 0){Hold 'ADAPTIVE_V2_LIVE_PREFLIGHT_FAILED_8798_PRESERVED'}
# Exact read-only V3 pilot prepares from the real 8797 catalogue without
# calling any MCP tool; a failed schema preflight preserves the old 8798.
& $Node --check $V3Diagnostic
if($LASTEXITCODE -ne 0){Hold 'V3_DIAGNOSTIC_SYNTAX_8798_PRESERVED'}
& $Node $V3Diagnostic --prepare-only
if($LASTEXITCODE -ne 0){Hold 'V3_LIVE_PREFLIGHT_FAILED_8798_PRESERVED'}
# V3.1: check the actual installed inspect_rust_binary schema before
# any 8798 restart. No file opened and no MCP tool call is made.
& $Node --check $V31Diagnostic
if($LASTEXITCODE -ne 0){Hold 'V31_DIAGNOSTIC_SYNTAX_8798_PRESERVED'}
& $Node $V31Diagnostic --schema-only
if($LASTEXITCODE -ne 0){Hold 'V31_LIVE_SCHEMA_NOT_SUPPORTED_8798_PRESERVED'}
# V3.2: verify live inspect_binary_layout schema only, before touching port 8798.
& $Node --check $V32Diagnostic
if($LASTEXITCODE -ne 0){Hold 'V32_DIAGNOSTIC_SYNTAX_8798_PRESERVED'}
& $Node $V32Diagnostic --schema-only
if($LASTEXITCODE -ne 0){Hold 'V32_LIVE_SCHEMA_NOT_SUPPORTED_8798_PRESERVED'}
# V3.4: every selected PE tool must have a compatible actual live schema.
# Read-only catalogue queries only, no staged file opened and no MCP call.
& $Node --check $V34Diagnostic
if($LASTEXITCODE -ne 0){Hold 'V34_DIAGNOSTIC_SYNTAX_8798_PRESERVED'}
& $Node $V34Diagnostic --schema-only
if($LASTEXITCODE -ne 0){Hold 'V34_LIVE_PE_SCHEMAS_NOT_SUPPORTED_8798_PRESERVED'}
# Perform the entire offline V1+V2 qualification BEFORE stopping the old 8798.
# A parsing/test failure must not tear down a working chat instance.
$PreflightSources=@(
 (Join-Path $Repo 'src\experimental\adaptive-capability-v2.mjs'),
 (Join-Path $Repo 'src\experimental\verified-rea-v3.mjs'),
 (Join-Path $Repo 'src\experimental\verified-file-v3-1.mjs'),
 (Join-Path $Repo 'src\experimental\verified-binary-layout-v3-2.mjs'),
 (Join-Path $Repo 'src\experimental\verified-pe-inspection-v3-4.mjs'),
 (Join-Path $Repo 'scripts\Diagnose-Fun-Verified-PE-V34.mjs'),
 (Join-Path $Repo 'src\experimental\unified-task-chat.mjs'),
 (Join-Path $Repo 'src\experimental\unified-task-client.js'),
 (Join-Path $Repo 'scripts\Run-Fun-Unified-Chat8798.mjs')
)
foreach($Source in $PreflightSources){
 if(-not (Test-Path -LiteralPath $Source -PathType Leaf)){Hold ('ADAPTIVE_V2_SOURCE_MISSING_'+$Source)}
 & $Node --check $Source
 if($LASTEXITCODE -ne 0){Hold ('ADAPTIVE_V2_SYNTAX_HOLD_'+$Source)}
}
Push-Location $Repo
try{
 & $Node --test 'intelligence-checks\unified-task-chat-case.mjs' 'intelligence-checks\adaptive-capability-v2-case.mjs' 'intelligence-checks\verified-rea-v3-case.mjs' 'intelligence-checks\verified-file-v3-1-case.mjs' 'intelligence-checks\verified-binary-layout-v3-2-case.mjs' 'intelligence-checks\verified-pe-inspection-v3-4-case.mjs'
 if($LASTEXITCODE -ne 0){Hold 'ADAPTIVE_V2_OFFLINE_TESTS_FAILED_8798_PRESERVED'}
}finally{Pop-Location}
Write-Host 'ADAPTIVE_V2_PREFLIGHT=PASS EXACT_229_AND_19_CATALOGUES_VERIFIED NO_TOOL_EXECUTION=TRUE'
Write-Host 'V3_GUARDED_PREFLIGHT=PASS READONLY_TOOL_SCHEMA_VERIFIED MCP_CALLS=0'
Write-Host 'V31_GUARDED_PREFLIGHT=PASS LIVE_PATH_SCHEMA_VERIFIED FILES_OPENED=0 MCP_CALLS=0'
Write-Host 'V32_GUARDED_PREFLIGHT=PASS LIVE_LAYOUT_PATH_SCHEMA_VERIFIED FILES_OPENED=0 MCP_CALLS=0'
Write-Host 'V34_OFFLINE_PREFLIGHT=PASS FIVE_PE_TOOLS_SCHEMA_BOUND NO_LIVE_MCP_CALLS=TRUE'
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
if($New.version -ne 'fi-unified-task-chat-8798-v1' -or !$New.rea.ready -or !$New.local.ready -or !$New.ai.ready -or !$New.verifiedPeV34.enabled){Hold 'NEW_8798_HEALTH_HOLD'}
Write-Host ('FUN_WEB_REPAIR=PASS OLD_8798_PID='+$OldPid+' NEW_8798_PID='+$NewPid)
Write-Host 'ONLY_8798_RESTARTED=TRUE QWEN_8088=UNCHANGED REA_8797=UNCHANGED LOCAL_8796=UNCHANGED ORIGINAL_8789=UNCHANGED COMPUTE_8791=UNCHANGED'
Write-Host 'NEXT=V32_USE_EXISTING_STAGED_PE_SAMPLE_PREPARE_REVIEW_THEN_CONFIRM_SEPARATELY'
