# FI_DASHBOARD_8789_POLICY_RECONCILE_V1
# Bounded two-pass reconciliation of a stale existing current-user autostart policy.
# Default: verification and review digest only (no writes or process changes).
# -Approve requires the exact review digest observed in a separate preview.
# Does not touch the gateway, Ollama, llama.cpp, compute, model, REA permissions or scheduled task.
[CmdletBinding()]param([switch]$Approve,[string]$ExpectedReviewDigest='')
$ErrorActionPreference='Stop'
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Server=Join-Path $Live 'src\server.mjs'
$Html=Join-Path $Live 'public\index.html'
$Tools=Join-Path $Live 'src\platform-tools.mjs'
$Auto=Join-Path $env:LOCALAPPDATA 'FunIndustrial\DashboardAutostart'
$PolicyFile=Join-Path $Auto 'policy.json'
$StatusFile=Join-Path $Auto 'status.json'
$Name='FunIndustrial-Dashboard8789-Autostart'
$Root=$PSScriptRoot
$Baseline=Join-Path $env:LOCALAPPDATA 'FunIndustrial\SecurityIntegrityV1\candidate-baseline.json'
$BaselinePin='a622d627fccb3934f23886b0360d8de4b92f82df42ff25a3d4f9e5b9b5488b9b'
$Python=Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
$Verifier=Join-Path $Root 'src\security\integrity_monitor.py'
$Base='http://127.0.0.1:8789'
function Hold([string]$why){throw ("FUN_DASHBOARD_8789_POLICY_HOLD="+$why)}
function CheckFile([string]$file){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('MISSING_FILE_'+$file)}
 if((Get-Item -LiteralPath $file -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_FILE_'+$file)}
}
function CheckDir([string]$dir){
 if(-not(Test-Path -LiteralPath $dir -PathType Container)){Hold ('MISSING_DIR_'+$dir)}
 if((Get-Item -LiteralPath $dir -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_DIR_'+$dir)}
}
function HashText([string]$input){
 $bytes=[Text.Encoding]::UTF8.GetBytes($input)
 $sha=[Security.Cryptography.SHA256]::Create()
 try{return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}
 finally{$sha.Dispose()}
}
function HashFile([string]$file){return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}
function Owner8789(){
 $listeners=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)
 if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1'){Hold 'PRIMARY_LISTENER_MISMATCH'}
 $pidActual=[int]$listeners[0].OwningProcess
 if($pidActual -le 0){Hold 'PRIMARY_LISTENER_PID_INVALID'}
 $cim=Get-CimInstance Win32_Process -Filter ("ProcessId="+$pidActual) -ErrorAction Stop
 if(-not $cim -or $cim.Name -ne 'node.exe' -or [string]$cim.CommandLine -notmatch 'src[/\\]server\.mjs'){Hold 'PRIMARY_PROCESS_IDENTITY_MISMATCH'}
 $process=Get-Process -Id $pidActual -ErrorAction Stop
 if($process.ProcessName -ne 'node'){Hold 'PRIMARY_PROCESS_NAME_MISMATCH'}
 return [pscustomobject]@{Pid=$pidActual;Cim=$cim;StartTime=$process.StartTime.ToUniversalTime();StartTicks=[int64]$process.StartTime.ToUniversalTime().Ticks}
}
function Api([string]$path,[int]$timeout=20){
 return Invoke-RestMethod -Uri ($Base+$path) -TimeoutSec $timeout -ErrorAction Stop
}
function PortOwners([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ',')
}
if(-not $Approve -and $ExpectedReviewDigest){Hold 'DIGEST_WITHOUT_APPROVAL'}
if($Approve -and $ExpectedReviewDigest -notmatch '^[a-fA-F0-9]{64}$'){Hold 'EXPLICIT_REVIEW_DIGEST_REQUIRED'}
foreach($dir in @($Live,(Join-Path $Live 'src'),(Join-Path $Live 'public'),$Auto)){CheckDir $dir}
foreach($file in @($Server,$Html,$Tools,$PolicyFile,$Baseline,$Python,$Verifier)){CheckFile $file}
if((HashFile $Baseline) -ne $BaselinePin){Hold 'BASELINE_PIN_NOT_MATCHING'}
& $Python $Verifier verify --baseline $Baseline --expected-sha $BaselinePin
if($LASTEXITCODE -ne 0){Hold '204_FILE_MONITOR_NOT_CLEAN'}
$task=Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
if(-not $task -or $task.State -ne 'Running'){Hold 'EXISTING_AUTOSTART_TASK_NOT_RUNNING'}
$taskAction=@($task.Actions)
if($taskAction.Count -ne 1 -or [string]$taskAction[0].Arguments -notmatch 'Watch-Fun-Dashboard-8789\.ps1'){Hold 'AUTOSTART_TASK_ACTION_CHANGED'}
$policy=Get-Content -LiteralPath $PolicyFile -Raw -ErrorAction Stop | ConvertFrom-Json
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$nodeExpected=[string]$policy.nodePath
if($policy.schema -ne 'fun.dashboard.autostart.v1' -or $policy.sid -ne $sid -or
   $policy.deployedRoot -ne $Live -or $policy.host -ne '127.0.0.1' -or
   [int]$policy.port -ne 8789 -or [int]$policy.computePort -ne 8791 -or
   $policy.voiceHome -ne (Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceLab') -or
   $nodeExpected -notlike '*node.exe'){Hold 'AUTOSTART_POLICY_STATIC_FIELDS_CHANGED'}
$owner=Owner8789
try{
 $expectedNode=[IO.Path]::GetFullPath($nodeExpected)
 $actualNode=[IO.Path]::GetFullPath([string]$owner.Cim.ExecutablePath)
 if(-not [string]::Equals($actualNode,$expectedNode,[StringComparison]::OrdinalIgnoreCase)){Hold 'AUTOSTART_NODE_BINARY_PATH_MISMATCH'}
}catch{Hold 'AUTOSTART_NODE_BINARY_PATH_UNVERIFIABLE'}
$serverHash=HashFile $Server
$htmlHash=HashFile $Html
$toolsHash=HashFile $Tools
$serverDate=(Get-Item $Server).LastWriteTimeUtc
$htmlDate=(Get-Item $Html).LastWriteTimeUtc
$toolsDate=(Get-Item $Tools).LastWriteTimeUtc
if($owner.StartTime -lt $serverDate -or $owner.StartTime -lt $htmlDate -or $owner.StartTime -lt $toolsDate){
 Hold 'RUNNING_PROCESS_PREDATES_DEPLOYED_FILES_REVIEW_RESTART_REQUIRED'
}
$originalPolicyHash=HashFile $PolicyFile
$serverText=[IO.File]::ReadAllText($Server)
$htmlText=[IO.File]::ReadAllText($Html)
foreach($marker in @('FI_AUTO_COGNEE_CHAT_V1','FI_VOICE_MOBILE_DASHBOARD_V1','FI_SOURCING_RETIRED_V1')){
 if(-not $serverText.Contains($marker)){Hold ('SERVER_FEATURE_MISSING_'+$marker)}
}
# The real installed dashboard is not the old GitHub sample. Its actual
# voice patcher deliberately did not depend on the sample's chat-input ID.
# Verify a distinctive live voice panel + its same-origin client script instead.
# Existing chat API identity and tool access are independently qualified below.
if(-not $htmlText.Contains('FI_VOICE_MOBILE_PANEL_V1') -or
   -not $htmlText.Contains('src="/api/voice/mobile/client.js"')){
 Hold 'LIVE_VOICE_PANEL_OR_CLIENT_SCRIPT_MISSING'
}
if(@([regex]::Matches($htmlText,'</body\s*>','IgnoreCase')).Count -ne 1){
 Hold 'LIVE_DASHBOARD_HTML_STRUCTURE_INVALID'
}
foreach($route in @('/api/ai/chat','/api/ai/tool-call','/api/ai/tools')){
 if(-not $serverText.Contains($route)){Hold ('LIVE_CHAT_ROUTE_MISSING_'+$route)}
}
$node=(Get-Command node.exe -ErrorAction Stop).Source
& $node --check $Server
if($LASTEXITCODE -ne 0){Hold 'LIVE_SERVER_SYNTAX_INVALID'}
& $node --check $Tools
if($LASTEXITCODE -ne 0){Hold 'LIVE_TOOL_REGISTRY_SYNTAX_INVALID'}
try{
 $served=(Invoke-WebRequest -Uri ($Base+'/') -Headers @{'Cache-Control'='no-cache'} -UseBasicParsing -TimeoutSec 12 -ErrorAction Stop).Content
 if(-not [string]::Equals([string]$served,$htmlText,[StringComparison]::Ordinal)){Hold 'SERVED_HTML_DIFFERS_FROM_DEPLOYED_HTML'}
}catch{Hold 'SERVED_HTML_IDENTITY_NOT_VERIFIED'}
$v=Api '/api/voice/mobile/status'
$m=Api '/api/ai/automatic-memory/status'
$a=Api '/api/ai/status'
$chatTools=Api '/api/ai/tools' 25
if($null -eq $chatTools -or $null -eq $chatTools.tools -or @($chatTools.tools).Count -eq 0){Hold 'LIVE_CHAT_TOOL_CATALOGUE_UNAVAILABLE'}
$catalog=Api '/api/rea/catalog' 45
$allow=Api '/api/rea/tools' 45
$names=@($catalog.tools|ForEach-Object {[string]$_.name})
$allowed=@($allow.tools|ForEach-Object {[string]$_.name})
$originalCatalog=@($policy.catalogueNames|ForEach-Object {[string]$_})
$originalAllowed=@($policy.allowedTools|ForEach-Object {[string]$_})
$memoryBudget=[int]$m.recallBudgetMs
if($v.enabled -ne $true -or $v.code -ne 'FI_VOICE_MOBILE_UPLOAD_V1' -or
   $m.mode -ne 'automatic_contextual_read_only' -or $m.enabledByDefault -ne $true -or
   $memoryBudget -lt 12000 -or $memoryBudget -gt 180000 -or
   [int]$policy.memoryBudgetMs -ne $memoryBudget -or $a.state -ne 'ready'){Hold 'EXISTING_VOICE_MEMORY_AI_STATUS_HOLD'}
if($names.Count -ne 229 -or $originalCatalog.Count -ne 229 -or
   @($names|Sort-Object -Unique).Count -ne 229){Hold '229_REA_CATALOGUE_INVALID'}
if((@($names|Sort-Object) -join ',') -cne (@($originalCatalog|Sort-Object) -join ',')){Hold 'REA_CATALOGUE_CHANGED_SINCE_POLICY'}
if((@($allowed|Sort-Object) -join ',') -cne (@($originalAllowed|Sort-Object) -join ',')){Hold 'REA_PERMISSION_SET_CHANGED_SINCE_POLICY'}
$ports=@{}
foreach($port in @(8088,8791,8443,4479,8794)){$ports[[string]$port]=PortOwners $port}
if(-not $ports['8088'] -or -not $ports['8791']){Hold 'INDEPENDENT_AI_OR_COMPUTE_NOT_LISTENING'}
$readable=[ordered]@{
 schema='fun.dashboard.autostart.policy.review.v1'
 baselineSha256=$BaselinePin
 originalPolicySha256=$originalPolicyHash
 currentDashboardPid=[int]$owner.Pid
 currentDashboardStartTicks=[int64]$owner.StartTicks
 serverSha256=$serverHash
 htmlSha256=$htmlHash
 toolsSha256=$toolsHash
 serverModifiedUtc=$serverDate.ToString('o')
 htmlModifiedUtc=$htmlDate.ToString('o')
 toolsModifiedUtc=$toolsDate.ToString('o')
 originalPinnedPid=[int]$policy.verifiedExistingPid
 originalPinnedServerSha256=([string]$policy.serverSha256).ToLowerInvariant()
 originalPinnedHtmlSha256=([string]$policy.htmlSha256).ToLowerInvariant()
 reaCatalogueCount=$names.Count
 reaApprovedNamesHash=HashText ((@($allowed|Sort-Object) -join ','))
 protectedListenerFingerprint=HashText (($ports.GetEnumerator()|Sort-Object Name|ForEach-Object {$_.Name+':'+$_.Value}) -join ';')
}
$json=$readable|ConvertTo-Json -Depth 6 -Compress
$reviewDigest=HashText $json
Write-Host 'FUN_DASHBOARD_POLICY_REVIEW=PASS'
Write-Host "CURRENT_PID=$($owner.Pid) ORIGINAL_PINNED_PID=$($policy.verifiedExistingPid)"
Write-Host "SERVER_SHA256=$serverHash"
Write-Host "HTML_SHA256=$htmlHash"
Write-Host "TOOLS_SHA256=$toolsHash"
Write-Host "PROCESS_STARTED_UTC=$($owner.StartTime.ToString('o'))"
Write-Host "SERVER_MODIFIED_UTC=$($serverDate.ToString('o')) HTML_MODIFIED_UTC=$($htmlDate.ToString('o'))"
Write-Host "REA_CATALOGUE=229 APPROVED_REA_TOOLS=$($allowed.Count) PERMISSIONS_UNCHANGED=TRUE"
Write-Host "POLICY_REVIEW_DIGEST=$reviewDigest"
if(-not $Approve){
 Write-Host 'FUN_DASHBOARD_POLICY_RECONCILE=NOT_PERFORMED'
 Write-Host 'REVIEW_CURRENT_SOURCE_AND_POLICY_BEFORE_EXPLICIT_APPROVAL'
 exit 0
}
if(-not [string]::Equals($ExpectedReviewDigest,$reviewDigest,[StringComparison]::OrdinalIgnoreCase)){Hold 'REVIEW_DIGEST_STALE_OR_INCORRECT'}
$after=Owner8789
if($after.Pid -ne $owner.Pid -or $after.StartTicks -ne $owner.StartTicks -or
   (HashFile $Server) -ne $serverHash -or (HashFile $Html) -ne $htmlHash -or
   (HashFile $Tools) -ne $toolsHash -or (HashFile $PolicyFile) -ne $originalPolicyHash){Hold 'FILES_OR_PROCESS_CHANGED_SINCE_REVIEW'}
$backup=Join-Path $Auto ('reconcile-backup-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
$prepared=$false
try{
 New-Item -ItemType Directory -Path $backup -ErrorAction Stop|Out-Null
 Copy-Item -LiteralPath $PolicyFile -Destination (Join-Path $backup 'policy.original.json') -ErrorAction Stop
 [IO.File]::WriteAllText((Join-Path $backup 'review.json'),($readable|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
 $policy.serverSha256=$serverHash.ToUpperInvariant()
 $policy.htmlSha256=$htmlHash.ToUpperInvariant()
 $policy.verifiedExistingPid=[int]$owner.Pid
 $policy.verifiedExistingStartUtcTicks=[int64]$owner.StartTicks
 $policy.capturedUtc=[DateTime]::UtcNow.ToString('o')
 $candidate=Join-Path $Auto ('policy.reconcile-'+[guid]::NewGuid().ToString('N')+'.tmp')
 [IO.File]::WriteAllText($candidate,($policy|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
 $staged=Get-Content -LiteralPath $candidate -Raw | ConvertFrom-Json
 if($staged.serverSha256 -ne $serverHash -or $staged.htmlSha256 -ne $htmlHash -or
    [int]$staged.verifiedExistingPid -ne [int]$owner.Pid -or
    @($staged.allowedTools).Count -ne $originalAllowed.Count -or
    @($staged.catalogueNames).Count -ne 229){Hold 'NEW_POLICY_STAGING_INVALID'}
 if((HashFile $PolicyFile) -ne $originalPolicyHash){Hold 'ORIGINAL_POLICY_CHANGED_BEFORE_REPLACE'}
 $prepared=$true
 Move-Item -LiteralPath $candidate -Destination $PolicyFile -Force -ErrorAction Stop
 if((HashFile $Server) -ne $serverHash -or (HashFile $Html) -ne $htmlHash){Hold 'LIVE_SOURCE_CHANGED_DURING_RECONCILIATION'}
 # Supervisor uses a 20-second monitor cadence. Do not stop/restart the task.
 $accepted=$false
 for($i=0;$i -lt 28;$i++){
  $state=$null
  try{$state=Get-Content -LiteralPath $StatusFile -Raw -ErrorAction Stop|ConvertFrom-Json}catch{}
  if($state -and $state.state -eq 'running' -and $state.reason -eq 'EXISTING_DASHBOARD_PRESERVED'){$accepted=$true;break}
  Start-Sleep -Seconds 1
 }
 if(-not $accepted){Hold 'SUPERVISOR_DID_NOT_ACCEPT_RECONCILED_POLICY'}
 Write-Host 'FUN_DASHBOARD_POLICY_RECONCILE=PASS'
 Write-Host "SUPERVISOR=RUNNING CURRENT_DASHBOARD_PID=$($owner.Pid)"
 Write-Host "POLICY_BACKUP=$backup"
 Write-Host 'GATEWAY_8443=UNCHANGED LLAMA_8088=UNCHANGED COMPUTE_8791=UNCHANGED'
 Write-Host 'REA_CATALOGUE_AND_APPROVED_NAMES=UNCHANGED NO_PROCESS_RESTARTS=TRUE'
}catch{
 $errorMessage=$_.Exception.Message
 if($prepared){
  try{Copy-Item -LiteralPath (Join-Path $backup 'policy.original.json') -Destination $PolicyFile -Force -ErrorAction Stop}
  catch{Write-Warning "FUN_DASHBOARD_POLICY_RESTORE_NEEDS_MANUAL_REVIEW=$backup"}
 }
 throw ("FUN_DASHBOARD_POLICY_RECONCILE_HOLD="+$errorMessage+" BACKUP="+$backup)
}
