# FUN_PHASE5_8789_RECOVER_V1
# Targeted recovery for failed November 10 Phase 5 8789 health qualification.
# If a recognized 8789 Node dashboard is already listening, never touch it.
# If 8789 is vacant, restore EXACT backed-up pre-deployment source files if
# current files are exactly original or exactly the staged candidate, then
# start ONLY the previous dashboard Node with saved original service settings.
# No autostart re-registration, gateway/compute/llama/REA/Ollama changes.
[CmdletBinding()]param(
 [string]$DeploymentBackup='',
 [string]$RetirementBackup=''
)
$ErrorActionPreference='Stop'
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Auto=Join-Path $env:LOCALAPPDATA 'FunIndustrial\DashboardAutostart'
if(-not $DeploymentBackup){$DeploymentBackup=Join-Path $env:LOCALAPPDATA 'FunIndustrial\SecurityPrimary8789\20261110-231035-e5dc8656'}
if(-not $RetirementBackup){$RetirementBackup=Join-Path $Auto 'retired-watchdog-20261110-231030-a18f213e'}
$PrePolicy=Join-Path $RetirementBackup 'policy.retired.json'
$Server=Join-Path $Live 'src\server.mjs'
$Html=Join-Path $Live 'public\index.html'
$Tools=Join-Path $Live 'src\platform-tools.mjs'
$LogRoot=Join-Path $DeploymentBackup 'recovery'
function Hold([string]$why){throw ("FUN_PHASE5_RECOVERY_HOLD="+$why)}
function SafeFile([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('MISSING_FILE_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_FILE_'+$p)}
}
function SafeDir([string]$p){
 if(-not(Test-Path -LiteralPath $p -PathType Container)){Hold ('MISSING_DIRECTORY_'+$p)}
 if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_DIRECTORY_'+$p)}
}
function Sha([string]$p){return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}
function PortSnap([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object) -join ',')
}
function DashboardPid(){
 $all=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)
 if($all.Count -eq 0){return 0}
 if($all.Count -ne 1 -or $all[0].LocalAddress -ne '127.0.0.1' -or [int]$all[0].OwningProcess -le 0){
  Hold '8789_LISTENER_NOT_EXCLUSIVELY_LOCAL'
 }
 $id=[int]$all[0].OwningProcess
 $cim=Get-CimInstance Win32_Process -Filter ("ProcessId="+$id) -ErrorAction Stop
 if(-not $cim -or $cim.Name -ne 'node.exe' -or [string]$cim.CommandLine -notmatch 'src[/\\]server\.mjs'){
  Hold '8789_LISTENER_OWNER_NOT_KNOWN_NODE_DASHBOARD'
 }
 return $id
}
function Status([string]$path,[int]$timeout=7){
 try{return Invoke-RestMethod -Uri ('http://127.0.0.1:8789'+$path) -TimeoutSec $timeout -ErrorAction Stop}
 catch{return $null}
}
function Report([string]$label){
 $p=DashboardPid
 $security=Status '/api/security/status'
 $voice=Status '/api/voice/mobile/status'
 $memory=Status '/api/ai/automatic-memory/status'
 $ai=Status '/api/ai/status'
 Write-Host "$($label)_DASHBOARD_PID=$p"
 Write-Host "$($label)_SECURITY_STATE=$(if($security){$security.state}else{'UNAVAILABLE'})"
 Write-Host "$($label)_VOICE_ENABLED=$(if($voice){$voice.enabled}else{'UNAVAILABLE'})"
 Write-Host "$($label)_MEMORY_MODE=$(if($memory){$memory.mode}else{'UNAVAILABLE'})"
 Write-Host "$($label)_LOCAL_AI_STATE=$(if($ai){$ai.state}else{'UNAVAILABLE'})"
 return [pscustomobject]@{pid=$p;security=$security;voice=$voice;memory=$memory;ai=$ai}
}
foreach($dir in @($Live,(Join-Path $Live 'src'),(Join-Path $Live 'public'),$Auto,$DeploymentBackup,$RetirementBackup)){
 SafeDir $dir
}
foreach($file in @($Server,$Html,$Tools,$PrePolicy,
 (Join-Path $DeploymentBackup 'server.original.mjs'),
 (Join-Path $DeploymentBackup 'index.original.html'),
 (Join-Path $DeploymentBackup 'tools.original.mjs'),
 (Join-Path $DeploymentBackup 'server.staged.mjs'),
 (Join-Path $DeploymentBackup 'index.staged.html'),
 (Join-Path $DeploymentBackup 'tools.staged.mjs'))){SafeFile $file}
$protected=@{}
foreach($port in @(8088,8443,8791,4479,8794)){$protected[$port]=PortSnap $port}
$initial=DashboardPid
$patched=([IO.File]::ReadAllText($Server)).Contains('FI_SECURITY_PRIMARY_8789_V1')
Write-Host "PHASE5_SOURCE_CURRENTLY_PATCHED=$patched"
Write-Host "DASHBOARD_LISTENING=$($initial -gt 0)"
$failureLog=Join-Path $DeploymentBackup 'deployed.stderr.log'
if(Test-Path -LiteralPath $failureLog -PathType Leaf){
 $line=@(Get-Content -LiteralPath $failureLog -ErrorAction SilentlyContinue |
  Where-Object{$_ -match '^(Error|SyntaxError|TypeError|ReferenceError|RangeError|ERR_|Cannot find module|\\s+at )'}|
  Select-Object -First 1)
 if($line.Count){
  $hint=([string]$line[0]).Substring(0,[Math]::Min(160,([string]$line[0]).Length))
  $hint=$hint -replace '(?i)(key|token|secret|password)\s*[:=]\s*\S+','$1=[redacted]'
  Write-Host "FAILED_STARTUP_ERROR_HINT=$hint"
 }
}
Write-Host "FAILED_DEPLOYMENT_STDERR_PATH=$failureLog"
if($initial -gt 0){
 $status=Report 'EXISTING'
 if($status.voice.enabled -ne $true -or $status.memory.mode -ne 'automatic_contextual_read_only'){
  Hold 'EXISTING_8789_VOICE_MEMORY_NOT_HEALTHY_NO_FORCED_RESTART'
 }
 Write-Host 'FUN_PHASE5_RECOVERY=ALREADY_RUNNING_UNTOUCHED'
 Write-Host 'NO_PROCESSES_OR_SOURCE_FILES_MODIFIED=TRUE'
 exit 0
}
$pol=Get-Content -LiteralPath $PrePolicy -Raw -ErrorAction Stop|ConvertFrom-Json
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if($pol.schema -ne 'fun.dashboard.autostart.v1' -or $pol.sid -ne $sid -or
 $pol.deployedRoot -ne $Live -or $pol.host -ne '127.0.0.1' -or
 [int]$pol.port -ne 8789 -or [int]$pol.computePort -ne 8791){
 Hold 'RETIRED_POLICY_IDENTITY_NOT_TRUSTED'
}
$Node=[string]$pol.nodePath;SafeFile $Node
if([IO.Path]::GetExtension($Node) -ne '.exe'){Hold 'RETIRED_POLICY_NODE_NOT_EXECUTABLE'}
if([string]::IsNullOrWhiteSpace([string]$pol.voiceHome) -or
 [int]$pol.memoryBudgetMs -lt 12000 -or [int]$pol.memoryBudgetMs -gt 180000 -or
 @($pol.catalogueNames).Count -ne 229){Hold 'RETIRED_POLICY_RUNTIME_SETTINGS_INVALID'}
$maps=@(
 @{ live=$Server; original=(Join-Path $DeploymentBackup 'server.original.mjs'); staged=(Join-Path $DeploymentBackup 'server.staged.mjs') },
 @{ live=$Html; original=(Join-Path $DeploymentBackup 'index.original.html'); staged=(Join-Path $DeploymentBackup 'index.staged.html') },
 @{ live=$Tools; original=(Join-Path $DeploymentBackup 'tools.original.mjs'); staged=(Join-Path $DeploymentBackup 'tools.staged.mjs') }
)
foreach($m in $maps){
 $current=Sha $m.live;$original=Sha $m.original;$staged=Sha $m.staged
 if($current -ne $original -and $current -ne $staged){
  Hold 'LIVE_SOURCE_NOT_EXACT_ORIGINAL_OR_STAGED_BACKUP'
 }
}
if((DashboardPid) -ne 0){Hold 'DASHBOARD_REAPPEARED_BEFORE_RESTORE'}
New-Item -ItemType Directory -Path $LogRoot -Force -ErrorAction Stop|Out-Null
foreach($m in $maps){
 if((Sha $m.live) -ne (Sha $m.original)){
  $sourceName=Split-Path -Path $m.live -Leaf
  Copy-Item -LiteralPath $m.live -Destination (Join-Path $LogRoot ($sourceName+'.failed')) -ErrorAction Stop
  Copy-Item -LiteralPath $m.original -Destination $m.live -Force -ErrorAction Stop
  if((Sha $m.live) -ne (Sha $m.original)){Hold 'RESTORED_SOURCE_HASH_NOT_MATCHING_BACKUP'}
 }
}
& $Node --check $Server
if($LASTEXITCODE -ne 0){Hold 'RESTORED_SERVER_NODE_SYNTAX_FAILED'}
& $Node --check $Tools
if($LASTEXITCODE -ne 0){Hold 'RESTORED_TOOL_REGISTRY_SYNTAX_FAILED'}
$env:HOST='127.0.0.1';$env:PORT='8789';$env:COMPUTE_PORT='8791';$env:LOCAL_FIRST_MODE='true'
$env:FUN_VOICE_HOME=[string]$pol.voiceHome
$env:FI_COGNEE_RECALL_BUDGET_MS=[string]$pol.memoryBudgetMs
$env:REA_ALLOWED_TOOLS=(@($pol.allowedTools)-join ',')
if((DashboardPid) -ne 0){Hold 'DASHBOARD_PORT_CLAIMED_DURING_REPAIR'}
$child=Start-Process -FilePath $Node -ArgumentList 'src/server.mjs' -WorkingDirectory $Live -PassThru -RedirectStandardOutput (Join-Path $LogRoot 'restored.stdout.log') -RedirectStandardError (Join-Path $LogRoot 'restored.stderr.log') -ErrorAction Stop
$healthy=$false
for($i=0;$i -lt 100;$i++){
 Start-Sleep -Milliseconds 500
 try{
  $owner=DashboardPid
  if($owner -ne [int]$child.Id){continue}
  $v=Status '/api/voice/mobile/status' 3
  $m=Status '/api/ai/automatic-memory/status' 3
  if($v.enabled -eq $true -and $m.mode -eq 'automatic_contextual_read_only' -and $m.enabledByDefault -eq $true){$healthy=$true;break}
 }catch{}
}
if(-not $healthy){
 Write-Host "RESTORE_STDERR_LOG=$(Join-Path $LogRoot 'restored.stderr.log')"
 Hold 'RESTORED_DASHBOARD_NOT_HEALTHY'
}
foreach($port in @(8088,8443,8791,4479,8794)){
 if((PortSnap $port) -ne $protected[$port]){Hold ('PROTECTED_PORT_CHANGED_'+$port)}
}
$status=Report 'RESTORED'
Write-Host "FUN_PHASE5_RECOVERY=PASS ORIGINAL_DASHBOARD_RESTORED_PID=$($child.Id)"
Write-Host 'WATCHDOG=RETIRED REA_ALLOWLIST=UNCHANGED AUTOSTART_AT_LOGIN=DISABLED'
Write-Host "RECOVERY_LOG_DIR=$LogRoot"
