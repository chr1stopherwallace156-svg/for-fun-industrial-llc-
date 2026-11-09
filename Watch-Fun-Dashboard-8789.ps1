# Fun Industrial deployed-dashboard-only logon supervisor.
# Never edits deployed source, gateway, VPN, firewall, REA, llama.cpp, compute,
# Cognee, or Elektron. Owns only the verified 127.0.0.1:8789 dashboard process.
[CmdletBinding()]param([switch]$ProbeOnce)
$ErrorActionPreference="Stop"
$Auto=Join-Path $env:LOCALAPPDATA "FunIndustrial\DashboardAutostart"
$PolicyFile=Join-Path $Auto "policy.json"
$StatusFile=Join-Path $Auto "status.json"
$mutex=[Threading.Mutex]::new($false,"Local\FunIndustrial-Dashboard8789-Autostart-v1")
$owns=$false
# Only this running supervisor may establish an additional trusted child PID.
$script:spawnedDashboardPid=0
$script:spawnedDashboardStartUtcTicks=[int64]0

function Write-Status([string]$state,[string]$reason){
 $data=[ordered]@{schema="fun.dashboard.autostart.status.v1";state=$state;reason=$reason;checkedUtc=[DateTime]::UtcNow.ToString("o")}
 [IO.File]::WriteAllText($StatusFile,($data|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
}
function Port-Status(){
 $all=@(Get-NetTCPConnection -LocalPort 8789 -State Listen -ErrorAction SilentlyContinue)
 if($all.Count -eq 0){return [pscustomobject]@{state="stopped";pid=0}}
 if($all.Count -ne 1 -or [string]$all[0].LocalAddress -ne "127.0.0.1" -or [int]$all[0].OwningProcess -le 0){
  return [pscustomobject]@{state="conflict";pid=0}
 }
 return [pscustomobject]@{state="existing";pid=[int]$all[0].OwningProcess}
}
# A limited interactive Task Scheduler token may not be allowed to read
# Win32_Process.CommandLine. Treat a visible, mismatching command line as a
# hard conflict. Only a missing/unreadable command line may use the fallback:
# matching Node binary path, private TCP listener, and live dashboard endpoints.
# Report short reason codes, never raw process arguments or environment.
function Confirm-Owner([int]$id,$policy){
 $cim=$null
 try{$cim=Get-CimInstance Win32_Process -Filter ("ProcessId="+$id) -ErrorAction Stop}catch{}
 if($cim){
  if($cim.Name -ne "node.exe"){return "UNEXPECTED_DASHBOARD_OWNER_NAME"}
  $line=[string]$cim.CommandLine
  if(-not [string]::IsNullOrWhiteSpace($line)){
   if($line -match 'src[/\\]server\.mjs'){return "VERIFIED_COMMANDLINE"}
   return "UNEXPECTED_DASHBOARD_OWNER_COMMANDLINE"
  }
 }
 $proc=$null
 try{$proc=Get-Process -Id $id -ErrorAction Stop}catch{return "OWNER_PROCESS_QUERY_UNAVAILABLE"}
 if($proc.ProcessName -ne "node"){return "UNEXPECTED_DASHBOARD_OWNER_NAME"}
 $exe=[string]$proc.Path
 if([string]::IsNullOrWhiteSpace($exe) -and $cim){$exe=[string]$cim.ExecutablePath}
 if([string]::IsNullOrWhiteSpace($exe)){
  # The installer established the EXACT running PID after checking the
  # executable's command line from the operator's own Windows session.
  # The limited scheduled token can read neither CommandLine nor Path.
  # Do not trust any other existing process on 8789; self-launched Node
  # children are separately bound to the PID returned by Start-Process.
  $operatorPin=[int]$policy.verifiedExistingPid
  $operatorStart=[int64]$policy.verifiedExistingStartUtcTicks
  $actualStart=[int64]0
  try{$actualStart=[int64]$proc.StartTime.ToUniversalTime().Ticks}catch{}
  if($actualStart -eq 0 -and $cim){
   try{$actualStart=[int64]$cim.CreationDate.ToUniversalTime().Ticks}catch{}
  }
  if($actualStart -le 0){return "OWNER_START_TIME_UNAVAILABLE"}
  $trustedByOperator=$operatorPin -gt 0 -and $id -eq $operatorPin -and
   $operatorStart -gt 0 -and $actualStart -eq $operatorStart
  $trustedBySupervisor=$script:spawnedDashboardPid -gt 0 -and
   $id -eq $script:spawnedDashboardPid -and
   $script:spawnedDashboardStartUtcTicks -gt 0 -and
   $actualStart -eq $script:spawnedDashboardStartUtcTicks
  if(-not($trustedByOperator -or $trustedBySupervisor)){
   return "OWNER_PIN_OR_START_TIME_MISMATCH"
  }
  if(-not(Endpoint-Ready)){return "OWNER_DASHBOARD_ENDPOINTS_UNAVAILABLE"}
  return "VERIFIED_PINNED_PROCESS_AND_ENDPOINTS"
 }
 try{
  if(-not [string]::Equals([IO.Path]::GetFullPath($exe),
   [IO.Path]::GetFullPath([string]$policy.nodePath),
   [StringComparison]::OrdinalIgnoreCase)){
   return "UNEXPECTED_DASHBOARD_OWNER_EXECUTABLE"
  }
 }catch{return "OWNER_EXECUTABLE_PATH_INVALID"}
 if(-not(Endpoint-Ready)){return "OWNER_DASHBOARD_ENDPOINTS_UNAVAILABLE"}
 return "VERIFIED_EXECUTABLE_AND_ENDPOINTS"
}
function Endpoint-Ready(){
 try{
  $v=Invoke-RestMethod "http://127.0.0.1:8789/api/voice/mobile/status" -TimeoutSec 4 -ErrorAction Stop
  $m=Invoke-RestMethod "http://127.0.0.1:8789/api/ai/automatic-memory/status" -TimeoutSec 4 -ErrorAction Stop
  return $v.enabled -eq $true -and $v.code -eq "FI_VOICE_MOBILE_UPLOAD_V1" -and
   $m.mode -eq "automatic_contextual_read_only" -and
   $m.enabledByDefault -eq $true
 }catch{return $false}
}
function Policy-Ready($p){
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 if($p.schema -ne "fun.dashboard.autostart.v1" -or $p.sid -ne $sid -or
    $p.host -ne "127.0.0.1" -or [int]$p.port -ne 8789 -or
    [int]$p.computePort -ne 8791 -or
    [int]$p.memoryBudgetMs -lt 12000 -or [int]$p.memoryBudgetMs -gt 180000 -or
    [int]$p.verifiedExistingPid -le 0 -or
    [int64]$p.verifiedExistingStartUtcTicks -le 0 -or
    @($p.catalogueNames).Count -ne 229 -or
    @($p.allowedTools).Count -gt 229 -or
    $p.voiceHome -ne (Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceLab") -or
    $p.deployedRoot -ne (Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation")){
  return $false
 }
 $server=Join-Path $p.deployedRoot "src\server.mjs"
 $html=Join-Path $p.deployedRoot "public\index.html"
 $envFile=Join-Path $p.deployedRoot ".env"
 $marker=Join-Path $p.voiceHome "mobile-upload.enabled"
 foreach($file in @($server,$html,$envFile,$marker,$p.nodePath)){
  if(-not(Test-Path -LiteralPath $file -PathType Leaf)){return $false}
 }
 if((Get-FileHash -LiteralPath $server -Algorithm SHA256).Hash -ne $p.serverSha256 -or
    (Get-FileHash -LiteralPath $html -Algorithm SHA256).Hash -ne $p.htmlSha256){
  return $false
 }
 $serverText=[IO.File]::ReadAllText($server)
 if(-not $serverText.Contains("FI_AUTO_COGNEE_CHAT_V1") -or
    -not $serverText.Contains("FI_VOICE_MOBILE_DASHBOARD_V1") -or
    -not $serverText.Contains("FI_SOURCING_RETIRED_V1")){return $false}
 if(([IO.File]::ReadAllText($marker)).Trim() -ne "FI_VOICE_MOBILE_RECORDING_ENABLED_V1"){return $false}
 # The full catalogue is inventory only. Preserve only the previously
 # permission-filtered names; never widen REA execution access at sign-in.
 $catalogueNames=@($p.catalogueNames|ForEach-Object{[string]$_})
 $names=@($p.allowedTools|ForEach-Object{[string]$_})
 if(@($catalogueNames|Where-Object{$_ -notmatch '^[-A-Za-z0-9_./:]{1,128}$'}).Count -or
    @($catalogueNames|Sort-Object -Unique).Count -ne 229 -or
    @($names|Where-Object{$_ -notmatch '^[-A-Za-z0-9_./:]{1,128}$'}).Count -or
    @($names|Sort-Object -Unique).Count -ne $names.Count -or
    @($names|Where-Object{$_ -cnotin $catalogueNames}).Count){return $false}
 return $true
}
function Start-Dashboard($p){
 $root=$p.deployedRoot
 $stdout=Join-Path $Auto "latest-start.stdout.log"
 $stderr=Join-Path $Auto "latest-start.stderr.log"
 $env:HOST="127.0.0.1";$env:PORT="8789";$env:COMPUTE_PORT="8791"
 $env:FUN_VOICE_HOME=$p.voiceHome
 $env:FI_COGNEE_RECALL_BUDGET_MS=[string]$p.memoryBudgetMs
 $env:REA_ALLOWED_TOOLS=(@($p.allowedTools)-join ",")
 # The new Node child inherits the exact previously verified settings.
 # This supervisor does not create a second compute/AI/REA process.
 $child=Start-Process -FilePath $p.nodePath -ArgumentList "src/server.mjs" -WorkingDirectory $root -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr -ErrorAction Stop
 for($i=0;$i -lt 40;$i++){
  Start-Sleep -Milliseconds 500
  $child.Refresh()
  if($child.HasExited){return "DASHBOARD_CHILD_EXITED"}
  $port=Port-Status
  if($port.state -eq "conflict"){return "DASHBOARD_PORT_CONFLICT"}
  if($port.state -eq "existing"){
   if($port.pid -ne $child.Id){return "UNEXPECTED_DASHBOARD_PROCESS"}
   if(Endpoint-Ready){
    $script:spawnedDashboardPid=[int]$child.Id
    try{$script:spawnedDashboardStartUtcTicks=[int64]$child.StartTime.ToUniversalTime().Ticks}catch{}
    return "DASHBOARD_AUTOSTART_PASS"
   }
  }
 }
 return "DASHBOARD_NOT_READY"
}

try{
 try{$owns=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$owns=$true}
 if(-not $owns){exit 0}
 while($true){
  if(-not(Test-Path -LiteralPath $PolicyFile -PathType Leaf)){
   Write-Status "hold" "POLICY_MISSING"
  }else{
   try{
    $policy=Get-Content -LiteralPath $PolicyFile -Raw -ErrorAction Stop|ConvertFrom-Json
    $valid=Policy-Ready $policy
   }catch{$valid=$false}
   if(-not $valid){
    Write-Status "hold" "POLICY_OR_DEPLOYMENT_CHANGED"
   }else{
    $port=Port-Status
    if($port.state -eq "conflict"){
     Write-Status "hold" "PORT_8789_CONFLICT"
    }elseif($port.state -eq "existing"){
     $ownerState=Confirm-Owner $port.pid $policy
     if($ownerState -like "VERIFIED_*"){
      if(Endpoint-Ready){
       Write-Status "running" "EXISTING_DASHBOARD_PRESERVED"
      }else{
       Write-Status "waiting" "EXISTING_DASHBOARD_INITIALIZING"
      }
     }elseif($ownerState -eq "OWNER_DASHBOARD_ENDPOINTS_UNAVAILABLE"){
      Write-Status "waiting" "EXISTING_DASHBOARD_INITIALIZING"
     }else{
      Write-Status "hold" $ownerState
     }
    }elseif($ProbeOnce){
     Write-Status "probe" "DASHBOARD_STOPPED_NOT_LAUNCHED"
    }else{
     Write-Status "starting" "DASHBOARD_LAUNCH_REQUESTED"
     try{
      $result=Start-Dashboard $policy
      if($result -eq "DASHBOARD_AUTOSTART_PASS"){Write-Status "running" $result}
      else{Write-Status "hold" $result}
     }catch{Write-Status "hold" "DASHBOARD_LAUNCH_EXCEPTION"}
    }
   }
  }
  if($ProbeOnce){
   $result=Get-Content -LiteralPath $StatusFile -Raw -ErrorAction Stop|ConvertFrom-Json
   if($result.state -eq "hold"){throw ("FI_DASHBOARD_AUTOSTART_PROBE_HOLD="+$result.reason)}
   Write-Host ("FI_DASHBOARD_AUTOSTART_PROBE=PASS STATUS="+$result.state+":"+ $result.reason+" EXISTING_PROCESSES_UNCHANGED=TRUE")
   break
  }
  Start-Sleep -Seconds 20
 }
}finally{
 if($owns){try{$mutex.ReleaseMutex()}catch{}}
 $mutex.Dispose()
}
