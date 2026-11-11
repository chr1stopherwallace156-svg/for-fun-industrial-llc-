# FI_DASHBOARD_AUTOSTART_DIAGNOSTIC_V1
# Read-only: evaluates the canonical supervisor's pure Policy-Ready,
# Confirm-Owner and Endpoint-Ready functions against an IN-MEMORY policy
# with proposed verified hashes and PID. Does not edit policy, task or status.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
$Live=Join-Path $env:USERPROFILE 'FunIndustrial-REA-MCP-Activation'
$Auto=Join-Path $env:LOCALAPPDATA 'FunIndustrial\DashboardAutostart'
$PolicyPath=Join-Path $Auto 'policy.json'
$StatusPath=Join-Path $Auto 'status.json'
$LiveWatcher=Join-Path $Auto 'Watch-Fun-Dashboard-8789.ps1'
$CanonicalWatcher=Join-Path $Root 'Watch-Fun-Dashboard-8789.ps1'
$TaskName='FunIndustrial-Dashboard8789-Autostart'
$Server=Join-Path $Live 'src\server.mjs'
$Html=Join-Path $Live 'public\index.html'
function Hold([string]$code){throw ("FUN_DASHBOARD_SUPERVISOR_DIAGNOSTIC_HOLD="+$code)}
function FHash([string]$file){return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToUpperInvariant()}
foreach($file in @($PolicyPath,$StatusPath,$LiveWatcher,$CanonicalWatcher,$Server,$Html)){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){Hold ("REQUIRED_FILE_MISSING_"+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ("SYMLINK_FILE_"+$file)}
}
$policyHashBefore=FHash $PolicyPath
$sourceHash=FHash $CanonicalWatcher
$liveHash=FHash $LiveWatcher
Write-Host "SUPERVISOR_SOURCE_MATCH=$($sourceHash -ceq $liveHash)"
if($sourceHash -cne $liveHash){
 Write-Host "INSTALLED_SUPERVISOR_SHA256=$liveHash"
 Write-Host "REPOSITORY_SUPERVISOR_SHA256=$sourceHash"
 Hold 'INSTALLED_WATCHER_SOURCE_DIFFERS_NO_SIMULATION'
}
$parserTokens=$null;$parserErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($CanonicalWatcher,[ref]$parserTokens,[ref]$parserErrors)
if($parserErrors.Count){Hold 'CANONICAL_WATCHER_PARSE_ERRORS'}
# Inspect actual executable command AST nodes, never raw source text.
# Commented references to Start-Process in Confirm-Owner are NOT executable.
function Assert-ReadOnlyFunctionAst($functionAst,[string]$name){
 $allowed=@('Get-CimInstance','Get-Process','Invoke-RestMethod','Get-FileHash',
  'Test-Path','Join-Path','ForEach-Object','Sort-Object','Where-Object','Endpoint-Ready')
 $calls=@($functionAst.FindAll({param($n)
   $n -is [Management.Automation.Language.CommandAst]
 },$true))
 foreach($call in $calls){
  $command=$call.GetCommandName()
  if([string]::IsNullOrWhiteSpace($command) -or $command -notin $allowed){
   Hold ('UNEXPECTED_EXECUTABLE_COMMAND_IN_FUNCTION_'+$name)
  }
 }
 # Never allow a write/process action hidden as a .NET member invocation.
 $forbiddenMethods=@('WriteAllText','WriteAllBytes','AppendAllText',
  'Delete','Move','Replace','SetAttributes','Start','Kill','Stop','Terminate')
 $members=@($functionAst.FindAll({param($n)
   $n -is [Management.Automation.Language.InvokeMemberExpressionAst]
 },$true))
 foreach($member in $members){
  $method=[string]$member.Member.Extent.Text
  $method=$method.Trim([char[]]@([char]39,[char]34))
  if($method -in $forbiddenMethods){Hold ('UNEXPECTED_EXECUTABLE_METHOD_IN_FUNCTION_'+$name)}
 }
}
# Define ONLY the three selected read-only functions, never execute the
# watchdog's main loop, mutex, task registration or status-file writer.
$names=@('Policy-Ready','Confirm-Owner','Endpoint-Ready')
foreach($name in $names){
 $defs=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true))
 if($defs.Count -ne 1){Hold ('CANONICAL_READ_ONLY_FUNCTION_MISSING_'+$name)}
 Assert-ReadOnlyFunctionAst $defs[0] $name
 $code=$defs[0].Extent.Text
 . ([scriptblock]::Create($code))
}
$listener=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)
if($listener.Count -ne 1 -or $listener[0].LocalAddress -ne '127.0.0.1'){Hold 'LISTENER_8789_IDENTITY_UNEXPECTED'}
$actualPid=[int]$listener[0].OwningProcess
if($actualPid -le 0){Hold 'LISTENER_8789_NO_PROCESS'}
$process=Get-Process -Id $actualPid -ErrorAction Stop
$wmi=Get-CimInstance Win32_Process -Filter ("ProcessId="+$actualPid) -ErrorAction Stop
if($process.ProcessName -ne 'node' -or $wmi.Name -ne 'node.exe' -or
  [string]$wmi.CommandLine -notmatch 'src[/\\]server\.mjs'){Hold 'LISTENER_8789_NOT_VERIFIED_NODE_DASHBOARD'}
$actualTicks=[int64]$process.StartTime.ToUniversalTime().Ticks
$policy=Get-Content -LiteralPath $PolicyPath -Raw -ErrorAction Stop | ConvertFrom-Json
$status=Get-Content -LiteralPath $StatusPath -Raw -ErrorAction Stop | ConvertFrom-Json
$task=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$taskInfo=Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
if(-not $task){Hold 'AUTOSTART_TASK_MISSING'}
$serverSha=FHash $Server
$htmlSha=FHash $Html
$restored=($policy.serverSha256 -eq $serverSha -and $policy.htmlSha256 -eq $htmlSha -and
 [int]$policy.verifiedExistingPid -eq $actualPid -and [int64]$policy.verifiedExistingStartUtcTicks -eq $actualTicks)
Write-Host "SUPERVISOR_TASK_STATE=$($task.State)"
Write-Host "SUPERVISOR_LAST_TASK_RESULT=$(if($taskInfo){$taskInfo.LastTaskResult}else{'UNAVAILABLE'})"
Write-Host "SUPERVISOR_LAST_STATUS=$($status.state):$($status.reason)"
Write-Host "SUPERVISOR_STATUS_CHECKED_UTC=$($status.checkedUtc)"
Write-Host "LIVE_8789_PID=$actualPid POLICY_PINNED_PID=$($policy.verifiedExistingPid)"
Write-Host "POLICY_CURRENTLY_MATCHES_RUNNING_SOURCE_AND_PROCESS=$restored"
Write-Host "POLICY_SHA256=$policyHashBefore"
# Keep all original policy fields untouched; simulate the reconciled identity
# only in memory. No persistent hash, PID, tasks or files are modified.
$policy.serverSha256=$serverSha
$policy.htmlSha256=$htmlSha
$policy.verifiedExistingPid=$actualPid
$policy.verifiedExistingStartUtcTicks=$actualTicks
$script:spawnedDashboardPid=0
$script:spawnedDashboardStartUtcTicks=[int64]0
$ready=Policy-Ready $policy
$endpointReady=Endpoint-Ready
$ownerStatus=if($ready){Confirm-Owner $actualPid $policy}else{'SKIPPED_POLICY_INVALID'}
Write-Host "SIMULATED_POLICY_READY=$ready"
Write-Host "SIMULATED_ENDPOINT_READY=$endpointReady"
Write-Host "SIMULATED_OWNER_CLASSIFICATION=$ownerStatus"
if(-not $ready){
 $envFile=Join-Path $Live '.env'
 $voiceMarker=Join-Path ([string]$policy.voiceHome) 'mobile-upload.enabled'
 $missing=@(@($Server,$Html,$envFile,$voiceMarker,[string]$policy.nodePath)|Where-Object{-not(Test-Path -LiteralPath $_ -PathType Leaf)})
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $cats=@($policy.catalogueNames)
 $allowed=@($policy.allowedTools)
 $badCats=@($cats|Where-Object{[string]$_ -notmatch '^[-A-Za-z0-9_./:]{1,128}$'})
 $badAllowed=@($allowed|Where-Object{[string]$_ -notmatch '^[-A-Za-z0-9_./:]{1,128}$'})
 $allowOutside=@($allowed|Where-Object{$_ -cnotin $cats})
 $voiceValue=if(Test-Path -LiteralPath $voiceMarker -PathType Leaf){([IO.File]::ReadAllText($voiceMarker)).Trim()}else{'MISSING'}
 Write-Host "SIMULATED_POLICY_SID_MATCH=$($policy.sid -eq $sid)"
 Write-Host "SIMULATED_POLICY_REQUIRED_FILES_MISSING=$($missing.Count)"
 Write-Host "SIMULATED_POLICY_CATALOGUE_COUNT=$($cats.Count) UNIQUE=$(@($cats|Sort-Object -Unique).Count) INVALID_NAMES=$($badCats.Count)"
 Write-Host "SIMULATED_POLICY_ALLOWED_COUNT=$($allowed.Count) INVALID_NAMES=$($badAllowed.Count) OUTSIDE_CATALOGUE=$($allowOutside.Count)"
 Write-Host "SIMULATED_POLICY_VOICE_MARKER_VALID=$($voiceValue -eq 'FI_VOICE_MOBILE_RECORDING_ENABLED_V1')"
 Write-Host "SIMULATED_POLICY_MEMORY_BUDGET_VALID=$([int]$policy.memoryBudgetMs -ge 12000 -and [int]$policy.memoryBudgetMs -le 180000)"
}
if((FHash $PolicyPath) -cne $policyHashBefore){Hold 'POLICY_CHANGED_DURING_READ_ONLY_DIAGNOSTIC'}
Write-Host 'FUN_DASHBOARD_SUPERVISOR_DIAGNOSTIC=PASS_READ_ONLY'
