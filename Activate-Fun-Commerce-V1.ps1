# FUN_COMMERCE_INTELLIGENCE_V1_ACTIVATE: tests -> guarded 8802-only restart -> one operator-authorized Google RSS retrieval.
# Preserves original 8789, Qwen, compute, 8796, 8797, 8798, 8801, 8443 and Elektron.
[CmdletBinding()]param([switch]$SkipGoogleRefresh,[switch]$RefreshCalifornia)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fun-ml-unified-dashboard-v3-20261113'
$Runner=Join-Path $Root 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$Prior='24ef0a6affa148f33d54208cbf369069be1be7ce'
$Url='http://127.0.0.1:8802'
$node=(Get-Command node.exe -ErrorAction Stop).Source
function Hold([string]$why){throw ('FUN_COMMERCE_HOLD='+$why)}
function Snapshot([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
}
function GetPortOwners([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function VerifyNewHub([int]$expectedPid=0){
 $owners=@(GetPortOwners 8802)
 if($owners.Count -ne 1 -or $owners[0].LocalAddress -cne '127.0.0.1'){return $false}
 if($expectedPid -gt 0 -and [int]$owners[0].OwningProcess -ne $expectedPid){return $false}
 try{
  $c=Invoke-RestMethod ($Url+'/api/commerce/status') -TimeoutSec 8
  $d=Invoke-RestMethod ($Url+'/api/commerce/data') -TimeoutSec 8
  $opportunity=Invoke-RestMethod ($Url+'/api/commerce/opportunities') -TimeoutSec 8
  $focus=Invoke-RestMethod ($Url+'/api/commerce/focus') -TimeoutSec 8
  $m=Invoke-RestMethod ($Url+'/api/ml/dashboard/status') -TimeoutSec 8
  $main=Invoke-WebRequest ($Url+'/') -UseBasicParsing -TimeoutSec 10
  $chat=Invoke-WebRequest ($Url+'/unified/') -UseBasicParsing -TimeoutSec 10
  $script=Invoke-WebRequest ($Url+'/api/commerce/widget.js') -UseBasicParsing -TimeoutSec 8
  $uiClient=Invoke-WebRequest ($Url+'/api/ui/client.js') -UseBasicParsing -TimeoutSec 8
  $uiStyle=Invoke-WebRequest ($Url+'/api/ui/style.css') -UseBasicParsing -TimeoutSec 8
  return ($c.version -ceq 'fun-commerce-intelligence-v1' -and
   $d.version -ceq 'fun-commerce-intelligence-v1' -and $opportunity.version -ceq 'fun-commerce-opportunities-v1.1' -and
   $opportunity.qualifies_as_verified_sales_opportunity -eq $false -and $opportunity.order_authority -eq $false -and
   $focus.version -ceq 'fun-google-trends-focus-v1.2' -and $focus.county_count -eq 58 -and
   $focus.county_level_metrics_available -eq $false -and $m.state -ceq 'ready' -and
   $main.Content -match 'fi-commerce-panel' -and $chat.Content -match 'fi-commerce-panel' -and
   $main.Content -match 'id="fi-ui-shell"' -and $chat.Content -match 'id="fi-ui-shell"' -and
   $uiClient.Content -match 'FUN_INTEGRATED_CONTROL_CENTER_UI_V1' -and
   $uiStyle.Content -match 'FUN_INTEGRATED_CONTROL_CENTER_UI_V1' -and
   $script.Content -match 'FUN_COMMERCE_WIDGET_V1')
 }catch{return $false}
}
if((git.exe -C $Root branch --show-current) -cne $Branch -or $LASTEXITCODE -ne 0){Hold 'SOURCE_BRANCH_MISMATCH'}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count){Hold 'SOURCE_DIRTY_HOLD'}
if(!(Test-Path -LiteralPath $Runner -PathType Leaf)){Hold 'RUNNER_MISSING'}
foreach($path in @('src\commerce\trends-commerce-v1.mjs','src\commerce\trends-commerce-widget-v1.js',
 'intelligence-checks\commerce-intelligence-v1-case.mjs')){
 $p=Join-Path $Root $path
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){Hold ('COMMERCE_SOURCE_MISSING='+$path)}
 & $node --check $p
 if($LASTEXITCODE -ne 0){Hold ('COMMERCE_JS_SYNTAX_HOLD='+$path)}
}
# Run the guarded launcher in inspection-only mode: checks all offline tests and parent health.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'Start-Fun-ML-Dashboard-V3.ps1') -CheckOnly
if($LASTEXITCODE -ne 0){Hold 'OFFLINE_TEST_OR_REQUIRED_SERVICE_PREFLIGHT_FAILED_NO_PROCESS_CHANGED'}
Write-Host 'FUN_COMMERCE_TESTS_AND_SERVICE_PREFLIGHT=PASS'
$protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8443)
$before=@{}
foreach($port in $protected){$before[$port]=Snapshot $port}
$previous=@(GetPortOwners 8802)
if($previous.Count -gt 1){Hold 'MULTIPLE_8802_OWNERS'}
$oldPid=0
if($previous.Count -eq 1){
 if($previous[0].LocalAddress -cne '127.0.0.1'){Hold '8802_NOT_LOOPBACK'}
 $oldPid=[int]$previous[0].OwningProcess
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$oldPid) -ErrorAction Stop
 if(!$p -or $p.Name -ine 'node.exe' -or [string]$p.CommandLine -notmatch 'Run-Fun-ML-Dashboard8802\.mjs' -or
   [string]$p.CommandLine -notmatch [regex]::Escape($Runner)){Hold ('8802_PROCESS_IDENTITY_HOLD='+$oldPid)}
}
$active=$false
if($oldPid -gt 0 -and (VerifyNewHub $oldPid)){
 $active=$true
 Write-Host ('FUN_COMMERCE_HUB=ALREADY_ACTIVE PID='+$oldPid)
}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$logDir=Join-Path $env:LOCALAPPDATA ('FunIndustrial\CommerceIntelligenceV1\logs\'+$stamp)
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$rollback=$null
if(!$active){
 if($oldPid -gt 0){
  $existing=git.exe -C $Root cat-file -t $Prior
  if($LASTEXITCODE -ne 0 -or $existing -cne 'commit'){Hold 'KNOWN_PRE_COMMERCE_FALLBACK_COMMIT_MISSING'}
  $rollback=Join-Path $env:LOCALAPPDATA ('FunIndustrial\CommerceIntelligenceV1\rollback\'+$stamp+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
  git.exe -C $Root worktree add --detach $rollback $Prior
  if($LASTEXITCODE -ne 0){Hold 'FALLBACK_WORKTREE_CREATE_HOLD'}
 }
 $stopped=$false;$newProcess=$null
 try{
  if($oldPid -gt 0){
   Stop-Process -Id $oldPid -ErrorAction Stop
   $stopped=$true
   for($i=0;$i -lt 40;$i++){if(!(Get-Process -Id $oldPid -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 250}
   if(Get-Process -Id $oldPid -ErrorAction SilentlyContinue){Hold 'OLD_HUB_STOP_HOLD'}
  }
  $newProcess=Start-Process -FilePath $node -ArgumentList ('"'+$Runner+'" --serve') -WorkingDirectory $Root -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $logDir 'hub.out.log') -RedirectStandardError (Join-Path $logDir 'hub.err.log')
  $ready=$false
  for($i=0;$i -lt 50;$i++){Start-Sleep -Milliseconds 500;if($newProcess.HasExited){break};if(VerifyNewHub $newProcess.Id){$ready=$true;break}}
  if(!$ready){Hold 'NEW_COMMERCE_HUB_HEALTH_FAILED'}
  foreach($port in $protected){if((Snapshot $port) -cne $before[$port]){Hold ('PROTECTED_SERVICE_CHANGED_PORT_'+$port)}}
  Write-Host ('FUN_COMMERCE_HUB_ACTIVATION=PASS PID='+$newProcess.Id)
 }catch{
  $failure=[string]$_.Exception.Message
  if($newProcess -and !$newProcess.HasExited){
   $list=@(GetPortOwners 8802)
   if($list.Count -eq 1 -and [int]$list[0].OwningProcess -eq [int]$newProcess.Id){Stop-Process -Id $newProcess.Id -ErrorAction SilentlyContinue}
  }
  if($stopped -and $rollback){
   try{
    $fallbackRunner=Join-Path $rollback 'scripts\Run-Fun-ML-Dashboard8802.mjs'
    $p=Start-Process -FilePath $node -ArgumentList ('"'+$fallbackRunner+'" --serve') -WorkingDirectory $rollback -PassThru -ErrorAction Stop -RedirectStandardOutput (Join-Path $logDir 'fallback.out.log') -RedirectStandardError (Join-Path $logDir 'fallback.err.log')
    Write-Host ('FUN_COMMERCE_FALLBACK_LAUNCH_REQUESTED_PID='+$p.Id+' SOURCE='+$rollback)
   }catch{Write-Warning ('FALLBACK_START_HOLD='+$_.Exception.Message)}
  }
  Write-Host ('FUN_COMMERCE_ORIGINAL_ERROR='+$failure)
  Write-Host ('FUN_COMMERCE_LOGS='+$logDir)
  throw
 }
 if($rollback){
  git.exe -C $Root worktree remove --force $rollback
  if($LASTEXITCODE -ne 0){Write-Warning ('OLD_WORKTREE_CLEANUP_HOLD='+$rollback)}
 }
}
# An operator can upgrade UI without another external Google request.
if($SkipGoogleRefresh){
 Write-Host 'GOOGLE_TRENDS_FETCH=SKIPPED_UI_ONLY CACHED_EVIDENCE=PRESERVED'
}else{
try{
 $response=Invoke-RestMethod -Uri ($Url+'/api/commerce/trends/refresh') -Method POST -ContentType 'application/json' -Headers @{Origin=$Url;'x-fi-commerce'='operator-click'} -Body '{}' -TimeoutSec 26
 if($response.state -cne 'captured_unverified_search_interest' -or @($response.items).Count -lt 1){Hold 'GOOGLE_TRENDS_EMPTY_OR_UNVERIFIED'}
 Write-Host ('GOOGLE_TRENDS_LIVE_FETCH=PASS TOPICS='+@($response.items).Count)
 Write-Host ('GOOGLE_TRENDS_EVIDENCE_SHA256='+[string]$response.source_sha256)
 Write-Host ('GOOGLE_TRENDS_FETCHED_UTC='+[string]$response.fetched_utc)
 foreach($trend in @($response.items)|Select-Object -First 8){
  Write-Host ('TREND='+[string]$trend.query+' | approximate traffic '+[string]$trend.approx_traffic)
 }
}catch{
 Write-Host ('GOOGLE_TRENDS_LIVE_FETCH=HOLD DETAIL='+[string]$_.Exception.Message)
 Write-Host 'GOOGLE_TRENDS_RETRY=USE_DASHBOARD_REFRESH_BUTTON_NO_PROCESS_RESTART'
}
}
if($RefreshCalifornia){
 try{
  $california=Invoke-RestMethod -Uri ($Url+'/api/commerce/california/refresh') -Method POST -ContentType 'application/json' -Headers @{Origin=$Url;'x-fi-commerce'='operator-click'} -Body '{}' -TimeoutSec 26
  if($california.state -cne 'captured_california_statewide_search_interest' -or
     $california.geographic_scope -cne 'US-CA' -or @($california.items).Count -lt 1){
    Hold 'CALIFORNIA_SOURCE_RESPONSE_INVALID'
  }
  Write-Host ('GOOGLE_CALIFORNIA_RSS=PASS TOPICS='+@($california.items).Count+' GEO=US-CA')
  Write-Host ('GOOGLE_CALIFORNIA_EVIDENCE_SHA256='+[string]$california.source_sha256)
  Write-Host ('GOOGLE_CALIFORNIA_FETCHED_UTC='+[string]$california.fetched_utc)
  Write-Host 'GOOGLE_CALIFORNIA_COUNTY_METRICS=NOT_AVAILABLE'
 }catch{
  Write-Host ('GOOGLE_CALIFORNIA_RSS=HOLD DETAIL='+[string]$_.Exception.Message)
  Write-Host 'GOOGLE_CALIFORNIA_RETRY=USE_DASHBOARD_CALIFORNIA_REFRESH_BUTTON'
 }
}else{
 Write-Host 'GOOGLE_CALIFORNIA_RSS=SKIPPED_OPERATOR_NOT_REQUESTED'
}
try{
 $focus=Invoke-RestMethod ($Url+'/api/commerce/focus') -TimeoutSec 10
 if($focus.version -cne 'fun-google-trends-focus-v1.2' -or $focus.county_count -ne 58 -or
    $focus.county_level_metrics_available -ne $false){Hold 'CALIFORNIA_FOCUS_ATTESTATION_FAILED'}
 Write-Host ('GOOGLE_COMMERCE_FILTER_V12=PASS INCLUDED='+[int]$focus.relevant_count+' EXCLUDED='+[int]$focus.excluded_count)
 Write-Host ('GOOGLE_CA_STATEWIDE_SCOPE='+[string]$focus.markets.'US-CA'.state)
 Write-Host 'GOOGLE_CA_COUNTY_DIRECTORY=58 METRICS=UNAVAILABLE'
}catch{throw ('CALIFORNIA_FILTER_VERIFICATION_HOLD='+[string]$_.Exception.Message)}
try{
 $rank=Invoke-RestMethod ($Url+'/api/commerce/opportunities') -TimeoutSec 10
 if($rank.version -cne 'fun-commerce-opportunities-v1.1' -or $rank.order_authority -ne $false -or
    $rank.qualifies_as_verified_sales_opportunity -ne $false){Hold 'RESEARCH_QUEUE_ATTESTATION_FAILED'}
 Write-Host ('FUN_COMMERCE_V1_1_RESEARCH_QUEUE=PASS STATE='+[string]$rank.state)
 Write-Host ('FUN_COMMERCE_V1_1_CATALOG_MATCHES='+@($rank.matches).Count)
 Write-Host ('FUN_COMMERCE_V1_1_PRODUCT_RESEARCH_LEADS='+@($rank.research_leads).Count)
 foreach($lead in @($rank.research_leads)|Select-Object -First 5){
  Write-Host ('PRODUCT_RESEARCH_LEAD='+[string]$lead.search_query+' | supplier cost NOT VERIFIED')
 }
}catch{throw ('RESEARCH_QUEUE_READONLY_HOLD='+[string]$_.Exception.Message)}
Write-Host 'FUN_INTEGRATED_UI_V1=PASS RESPONSIVE_NAV=OVERVIEW_COMMERCE_ML_CHAT_TOOLS_WORKSPACE'
Write-Host 'FUN_COMMERCE_CONTROL_CENTER=http://127.0.0.1:8802/'
Write-Host 'FUN_COMMERCE_SHOPIFY=TOKEN_REQUIRED_FOR_PC_READ_ONLY_SYNC'
if($SkipGoogleRefresh -and -not $RefreshCalifornia){
 Write-Host 'FUN_COMMERCE_EXTERNAL_ACTIONS=NO_EXTERNAL_REFRESH_UI_ONLY'
}elseif($SkipGoogleRefresh -and $RefreshCalifornia){
 Write-Host 'FUN_COMMERCE_EXTERNAL_ACTIONS=ONE_CALIFORNIA_RSS_READ_NO_PURCHASES'
}elseif(-not $SkipGoogleRefresh -and $RefreshCalifornia){
 Write-Host 'FUN_COMMERCE_EXTERNAL_ACTIONS=US_AND_CALIFORNIA_RSS_READS_NO_PURCHASES'
}else{
 Write-Host 'FUN_COMMERCE_EXTERNAL_ACTIONS=ONE_GOOGLE_RSS_READ_NO_PURCHASES'
}
Write-Host 'FUN_COMMERCE_PROTECTED_SERVICES=NO_INTENTIONAL_RESTART'
Write-Host ('FUN_COMMERCE_ACTIVATION_LOGS='+$logDir)
