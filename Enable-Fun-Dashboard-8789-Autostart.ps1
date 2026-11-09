# Enroll ONLY the existing Fun Industrial dashboard on 127.0.0.1:8789
# as a current-user Windows sign-in task. No reconfiguration or restart of
# the live dashboard, NetBird, gateway, compute, llama.cpp, REA, Cognee, Elektron.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Name="FunIndustrial-Dashboard8789-Autostart"
$Source=Join-Path $PSScriptRoot "Watch-Fun-Dashboard-8789.ps1"
$Auto=Join-Path $env:LOCALAPPDATA "FunIndustrial\DashboardAutostart"
$Watch=Join-Path $Auto "Watch-Fun-Dashboard-8789.ps1"
$PolicyFile=Join-Path $Auto "policy.json"
$StatusFile=Join-Path $Auto "status.json"
$Root=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$Server=Join-Path $Root "src\server.mjs"
$Html=Join-Path $Root "public\index.html"
$EnvFile=Join-Path $Root ".env"
$Voice=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab"
$Flag=Join-Path $Voice "mobile-upload.enabled"
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$User=[Security.Principal.WindowsIdentity]::GetCurrent()
$created=$false;$registered=$false
function Hold([string]$why){throw ("FI_DASHBOARD_AUTOSTART_HOLD="+$why)}
function OnlyListener(){
 $s=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)
 if($s.Count -ne 1 -or $s[0].LocalAddress -ne "127.0.0.1" -or [int]$s[0].OwningProcess -le 0){
  Hold "PORT_8789_UNEXPECTED_LISTENER"
 }
 return [int]$s[0].OwningProcess
}
function VerifyOwner([int]$pidExpected){
 $p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$pidExpected) -ErrorAction Stop
 if(-not $p -or $p.Name -ne "node.exe" -or
    $p.CommandLine -notmatch 'src[/\\]server\.mjs'){Hold "DASHBOARD_IDENTITY_MISMATCH"}
}
if(Test-Path -LiteralPath $Auto){Hold "EXISTING_DASHBOARD_AUTOSTART_DIRECTORY"}
if(Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue){Hold "TASK_ALREADY_REGISTERED"}
foreach($f in @($Source,$Server,$Html,$EnvFile,$Flag,$Node)){
 if(-not(Test-Path -LiteralPath $f -PathType Leaf)){Hold "REQUIRED_DASHBOARD_FILE_MISSING"}
}
$tokens=$null;$parseErrors=$null
[Management.Automation.Language.Parser]::ParseFile($Source,[ref]$tokens,[ref]$parseErrors)|Out-Null
if($parseErrors.Count){Hold "SUPERVISOR_PARSE_FAILED"}
& $Node --check $Server
if($LASTEXITCODE -ne 0){Hold "LIVE_DASHBOARD_SERVER_SYNTAX"}
$txt=[IO.File]::ReadAllText($Server)
$htmlTxt=[IO.File]::ReadAllText($Html)
if(-not $txt.Contains("FI_AUTO_COGNEE_CHAT_V1") -or
   -not $txt.Contains("FI_VOICE_MOBILE_DASHBOARD_V1") -or
   -not $txt.Contains("FI_SOURCING_RETIRED_V1") -or
   -not $htmlTxt.Contains("FI_VOICE_MOBILE_PANEL_V1") -or
   ([IO.File]::ReadAllText($Flag)).Trim() -ne "FI_VOICE_MOBILE_RECORDING_ENABLED_V1"){
 Hold "DEPLOYED_VOICE_MEMORY_BASELINE_CHANGED"
}
$before=OnlyListener
VerifyOwner $before
# Pin both PID and process creation time. PID alone can be reused following
# a Windows restart and is not an adequate trusted-process identity.
$beforeProcess=Get-Process -Id $before -ErrorAction Stop
try{$verifiedStartUtcTicks=[int64]$beforeProcess.StartTime.ToUniversalTime().Ticks}
catch{Hold "DASHBOARD_START_TIME_UNAVAILABLE"}
if($verifiedStartUtcTicks -le 0){Hold "DASHBOARD_START_TIME_INVALID"}
try{
 $mobile=Invoke-RestMethod "http://127.0.0.1:8789/api/voice/mobile/status" -TimeoutSec 8 -ErrorAction Stop
 $memory=Invoke-RestMethod "http://127.0.0.1:8789/api/ai/automatic-memory/status" -TimeoutSec 8 -ErrorAction Stop
 $rea=Invoke-RestMethod "http://127.0.0.1:8789/api/rea/tools" -TimeoutSec 40 -ErrorAction Stop
 $catalog=Invoke-RestMethod "http://127.0.0.1:8789/api/rea/catalog" -TimeoutSec 40 -ErrorAction Stop
}catch{Hold "LIVE_DASHBOARD_RUNTIME_UNAVAILABLE"}
if($mobile.enabled -ne $true -or $mobile.code -ne "FI_VOICE_MOBILE_UPLOAD_V1" -or
   $memory.mode -ne "automatic_contextual_read_only" -or
   $memory.enabledByDefault -ne $true){Hold "LIVE_VOICE_OR_MEMORY_STATUS_MISMATCH"}
$budget=[int]$memory.recallBudgetMs
if($budget -lt 12000 -or $budget -gt 180000){Hold "MEMORY_RECALL_BUDGET_UNBOUNDED"}
# The FULL MCP catalogue is distinct from /api/rea/tools (operator
# permission-filtered). Capture each separately; never grant 229 execution
# permissions merely to satisfy a catalogue-size assertion.
$catalogueNames=@($catalog.tools|ForEach-Object{[string]$_.name})
$names=@($rea.tools|ForEach-Object{[string]$_.name})
$badCatalogue=@($catalogueNames|Where-Object{$_ -notmatch '^[-A-Za-z0-9_./:]{1,128}$'})
$badAllowed=@($names|Where-Object{$_ -notmatch '^[-A-Za-z0-9_./:]{1,128}$'})
$uniqueCatalogue=@($catalogueNames|Sort-Object -Unique)
$uniqueAllowed=@($names|Sort-Object -Unique)
$unexpectedAllowed=@($names|Where-Object{$_ -cnotin $catalogueNames})
Write-Host ("FI_DASHBOARD_REA_INVENTORY CATALOGUE_COUNT="+$catalogueNames.Count+
 " PERMISSION_FILTERED_COUNT="+$names.Count+
 " CATALOGUE_DUPLICATES="+($catalogueNames.Count-$uniqueCatalogue.Count)+
 " ALLOWED_OUTSIDE_CATALOGUE="+$unexpectedAllowed.Count)
if($catalogueNames.Count -ne 229 -or $uniqueCatalogue.Count -ne 229 -or
   $badCatalogue.Count -ne 0){
 Hold "REA_229_CATALOGUE_INTEGRITY_HOLD"
}
if($names.Count -gt 229 -or $names.Count -ne $uniqueAllowed.Count -or
   $badAllowed.Count -ne 0 -or $unexpectedAllowed.Count -ne 0){
 Hold "REA_PERMISSION_FILTER_INTEGRITY_HOLD"
}
$policy=[ordered]@{
 schema="fun.dashboard.autostart.v1";sid=$User.User.Value;
 deployedRoot=$Root;nodePath=$Node;host="127.0.0.1";port=8789;
 computePort=8791;voiceHome=$Voice;
 memoryBudgetMs=$budget;catalogueNames=$catalogueNames;allowedTools=$names;
 verifiedExistingPid=$before;verifiedExistingStartUtcTicks=$verifiedStartUtcTicks;
 serverSha256=(Get-FileHash -LiteralPath $Server -Algorithm SHA256).Hash;
 htmlSha256=(Get-FileHash -LiteralPath $Html -Algorithm SHA256).Hash;
 noProcessReplacement=$true;noOtherServiceStart=$true;
 capturedUtc=[DateTime]::UtcNow.ToString("o")
}
Write-Host "FI_DASHBOARD_AUTOSTART_PREFLIGHT=PASS LIVE_PID=$before REA_CATALOGUE=229 REA_EXPOSED=$($names.Count) MEMORY=READ_ONLY VOICE=ENABLED"
try{
 New-Item -ItemType Directory -Path $Auto -ErrorAction Stop|Out-Null
 $created=$true
 & icacls.exe $Auto /inheritance:r /grant:r ("*"+$User.User.Value+":(OI)(CI)F") "SYSTEM:(OI)(CI)F"|Out-Null
 if($LASTEXITCODE -ne 0){Hold "DASHBOARD_AUTOSTART_ACL_FAILED"}
 Copy-Item -LiteralPath $Source -Destination $Watch -ErrorAction Stop
 [IO.File]::WriteAllText($PolicyFile,($policy|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
 & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Watch -ProbeOnce
 if($LASTEXITCODE -ne 0){Hold ("DASHBOARD_SUPERVISOR_PROBE_FAILED_"+$LASTEXITCODE)}
 $probe=Get-Content -LiteralPath $StatusFile -Raw -ErrorAction Stop|ConvertFrom-Json
 if($probe.state -ne "running" -or $probe.reason -ne "EXISTING_DASHBOARD_PRESERVED"){
  Hold "DASHBOARD_SUPERVISOR_PROBE_WRONG_STATUS"
 }
 Write-Host "FI_DASHBOARD_AUTOSTART_PROBE=PASS CURRENT_DASHBOARD_PRESERVED=TRUE"
 $exe=(Get-Command powershell.exe -ErrorAction Stop).Source
 $action=New-ScheduledTaskAction -Execute $exe -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$Watch+'"')
 $trigger=New-ScheduledTaskTrigger -AtLogOn -User $User.Name
 $principal=New-ScheduledTaskPrincipal -UserId $User.Name -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Fun Industrial 8789 dashboard-only startup at user sign-in; preserve live services." -ErrorAction Stop|Out-Null
 $registered=$true
 try{Start-ScheduledTask -TaskName $Name -ErrorAction Stop;$started="REQUESTED"}
 catch{$started="PENDING_DESKTOP_SIGNIN"}
 $seen=$false;$status=$null
 for($i=0;$i -lt 20;$i++){
  Start-Sleep -Milliseconds 500
  try{
   $status=Get-Content -LiteralPath $StatusFile -Raw -ErrorAction Stop|ConvertFrom-Json
   if($status.checkedUtc -ne $probe.checkedUtc -and $status.state -in @("running","waiting","hold")){$seen=$true;break}
  }catch{}
 }
 if($seen -and $status.state -eq "hold"){Hold ("TASK_REPORTED_"+$status.reason)}
 $task=Get-ScheduledTask -TaskName $Name -ErrorAction Stop
 if($task.State -eq "Disabled"){Hold "TASK_DISABLED"}
 $info=Get-ScheduledTaskInfo -TaskName $Name -ErrorAction SilentlyContinue
 $result=if($info){[int64]$info.LastTaskResult}else{0}
 if(-not $seen -and $result -notin @(0,267011,267009)){Hold ("TASK_STARTUP_RESULT_"+$result)}
 $after=OnlyListener
 VerifyOwner $after
 if($after -ne $before){Hold "LIVE_DASHBOARD_PID_CHANGED"}
 $setupState=if(-not $seen){"PASS_REGISTERED_PENDING_SIGNIN"}elseif($status.state -eq "waiting"){"PASS_REGISTERED_OWNER_METADATA_WAITING"}else{"PASS"}
 $supervisorState=if(-not $seen){"PENDING_SIGNIN"}elseif($status.state -eq "waiting"){"WAITING_NOT_TRUSTING_UNVERIFIED_OWNER"}else{"RUNNING"}
 Write-Host ("FI_DASHBOARD_AUTOSTART_SETUP="+$setupState+" TASK="+$Name)
 Write-Host ("FI_DASHBOARD_AUTOSTART_SUPERVISOR="+$supervisorState+" CURRENT_DASHBOARD_PID_UNCHANGED=TRUE PID="+$after)
 Write-Host ("FI_DASHBOARD_AUTOSTART_RUNTIME_REASON="+$(if($seen){$status.reason}else{"NOT_YET_OBSERVED"}))
 Write-Host "FI_DASHBOARD_AUTOSTART_ENV=CAPTURED_HOST_PORT_COMPUTE_VOICE_COGNEE_REA_CATALOGUE229_WITH_EXISTING_PERMISSIONS"
 Write-Host "FI_DASHBOARD_AUTOSTART_GATEWAY_TASK=UNCHANGED"
 Write-Host "FI_DASHBOARD_AUTOSTART_OTHER_SERVICES=NOT_RESTARTED"
 Write-Host "FI_DASHBOARD_AUTOSTART_TRIGGER=WINDOWS_USER_SIGNIN WATCH_EVERY_20_SECONDS"
}catch{
 $err=$_.Exception.Message
 if($registered){
  Stop-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
 }
 if($created){Remove-Item -LiteralPath $Auto -Recurse -Force -ErrorAction SilentlyContinue}
 throw ("FI_DASHBOARD_AUTOSTART_SETUP_HOLD="+$err+" LIVE_SERVICES_UNCHANGED_EXPECTED")
}
