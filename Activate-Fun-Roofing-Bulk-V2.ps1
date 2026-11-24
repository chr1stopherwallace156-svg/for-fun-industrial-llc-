# Fun Industrial: activate full countywide roofing bulk database UI on existing reviewed 8802.
# Existing / homepage and AI, research, REA, ML, Elektron services remain unchanged.
# Only known 8802 node dashboard is updated, with rollback of previous instance.
[CmdletBinding()]param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$ExpectedBranch='feature/fun-roofing-bulk-v2-20261123'
$TrustedRemote='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$Runner=Join-Path $Root 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$URL='http://127.0.0.1:8802'
$Protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8803,8804,8805,8806,8443)
$Before=@{}
$PreviousProcess=$null
$PreviousRunner=$null
$PreviousRoot=$null
$OldStopped=$false
$NewChild=$null
$Logs=Join-Path $env:LOCALAPPDATA ('FunIndustrial\OrganizedUIPreview\logs\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
function Hold([string]$reason){throw ('FUN_UI_PREVIEW_HOLD='+$reason)}
function RequireFile([string]$path){
 if(!(Test-Path -LiteralPath $path -PathType Leaf)){Hold ('MISSING_FILE='+$path)}
 if(((Get-Item -LiteralPath $path -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('LINK_NOT_ALLOWED='+$path)
 }
}
function VerifyRepo([string]$root,[string[]]$branches){
 if(!(Test-Path -LiteralPath (Join-Path $root '.git'))){Hold ('NOT_GIT_SOURCE='+$root)}
 $remote=(& git.exe -C $root remote get-url origin|Out-String).Trim()
 $ref=(& git.exe -C $root branch --show-current|Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $remote -cne $TrustedRemote -or $branches -cnotcontains $ref){
  Hold ('SOURCE_IDENTITY_NOT_REVIEWED='+$root)
 }
 return $ref
}
function Listeners([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$port){
 return (@(Listeners $port|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
function Protect(){
 foreach($port in $Protected){
  if((Snapshot $port) -cne [string]$Before[$port]){Hold ('PROTECTED_PORT_CHANGED='+$port)}
 }
}
function Owner(){
 $set=@(Listeners 8802)
 if($set.Count -eq 0){return $null}
 if($set.Count -ne 1 -or $set[0].LocalAddress -cne '127.0.0.1'){
  Hold '8802_UNEXPECTED_LISTENER'
 }
 $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$set[0].OwningProcess) -ErrorAction Stop
 if(!$proc -or $proc.Name -ine 'node.exe' -or [string]::IsNullOrWhiteSpace([string]$proc.CommandLine)){
  Hold '8802_OWNER_NOT_VERIFIED'
 }
 return $proc
}
function SourceFromCommand([string]$line){
 $pattern='(?i)([A-Z]:\\[^"\r\n]*?\\scripts\\Run-Fun-ML-Dashboard8802\.mjs)'
 $matches=@([regex]::Matches($line,$pattern))
 if($matches.Count -ne 1){Hold '8802_OWNER_SCRIPT_UNRECOGNIZED'}
 $file=[string]$matches[0].Groups[1].Value
 RequireFile $file
 return $file
}
function PreviewLive([string]$ExpectedRunner){
 $owner=Owner
 if(!$owner -or ([string]$owner.CommandLine).IndexOf($ExpectedRunner,[StringComparison]::OrdinalIgnoreCase) -lt 0){
  Hold 'PREVIEW_8802_OWNER_CHANGED'
 }
 $homepageResponse=Invoke-WebRequest ($URL+'/') -UseBasicParsing -TimeoutSec 8
 $page=Invoke-WebRequest ($URL+'/ui-preview/') -UseBasicParsing -TimeoutSec 8
 $css=Invoke-WebRequest ($URL+'/api/fun/ui-preview/app.css') -UseBasicParsing -TimeoutSec 8
 $client=Invoke-WebRequest ($URL+'/api/fun/ui-preview/app.js') -UseBasicParsing -TimeoutSec 8
 $qwen=Invoke-RestMethod ($URL+'/api/fun/ui-preview/health') -TimeoutSec 8
 $v3=Invoke-RestMethod ($URL+'/api/fun/math/v3/status') -TimeoutSec 8
 $chat=Invoke-WebRequest ($URL+'/chat/') -UseBasicParsing -TimeoutSec 8
 $roofPage=Invoke-WebRequest ($URL+'/roofing/') -UseBasicParsing -TimeoutSec 8
 $roofCss=Invoke-WebRequest ($URL+'/api/fun/roofing/style.css') -UseBasicParsing -TimeoutSec 8
 $roofJs=Invoke-WebRequest ($URL+'/api/fun/roofing/client.js') -UseBasicParsing -TimeoutSec 8
 $roofStatus=Invoke-RestMethod ($URL+'/api/fun/roofing/status') -TimeoutSec 8
 $roofLeads=Invoke-RestMethod ($URL+'/api/fun/roofing/leads?minAge=20') -TimeoutSec 8
 $bulkPage=Invoke-WebRequest ($URL+'/roofing/bulk/') -UseBasicParsing -TimeoutSec 8
 $bulkCss=Invoke-WebRequest ($URL+'/api/fun/roofing/bulk/style.css') -UseBasicParsing -TimeoutSec 8
 $bulkJs=Invoke-WebRequest ($URL+'/api/fun/roofing/bulk/client.js') -UseBasicParsing -TimeoutSec 8
 $bulkStatus=Invoke-RestMethod ($URL+'/api/fun/roofing/bulk/status') -TimeoutSec 8
 $roofOpportunities=Invoke-RestMethod ($URL+'/api/fun/roofing/bulk/opportunities') -TimeoutSec 12
 $zipGeo=Invoke-RestMethod ($URL+'/api/fun/roofing/bulk/geo?mode=blocks&limit=5') -TimeoutSec 12
 $procPage=Invoke-WebRequest ($URL+'/procurement/') -UseBasicParsing -TimeoutSec 8
 $procClient=Invoke-WebRequest ($URL+'/api/operator/procurement/client.js') -UseBasicParsing -TimeoutSec 8
 if($homepageResponse.StatusCode -ne 200 -or
   $homepageResponse.Headers['x-fi-dashboard-version'] -cne 'fun-industrial-one-port-spatial-ux-v2' -or
   $homepageResponse.Content -notmatch 'id="fi-app"' -or
   $page.StatusCode -ne 200 -or
   $page.Headers['x-fi-preview-version'] -cne 'fun-industrial-organized-ui-preview-v1' -or
   $page.Content -notmatch 'Everything in its place' -or
   $page.Content -notmatch 'data-view="chat"' -or
   $page.Content -notmatch 'href="/roofing/bulk/#roof-opportunities"' -or
   $css.StatusCode -ne 200 -or $css.Content -notmatch 'home-hero-grid' -or
   $client.StatusCode -ne 200 -or $client.Content -notmatch "useMathV3Evidence" -or
   $qwen.version -cne 'fun-ui-preview-qwen-health-v1' -or $qwen.modelStart -ne $false -or
   $v3.version -cne 'fun-math-v3-readonly-8802' -or $v3.modelCanExecute -ne $false -or
   $chat.StatusCode -ne 200 -or $chat.Content -notmatch 'fi-fial53-question' -or
   $roofPage.StatusCode -ne 200 -or
   $roofPage.Headers['x-fi-roofing-version'] -cne 'fun-roofing-opportunity-v1' -or
   $roofPage.Content -notmatch 'id="roof-property-file"' -or
   $roofCss.StatusCode -ne 200 -or $roofCss.Content -notmatch 'market-scroll' -or
   $roofJs.StatusCode -ne 200 -or $roofJs.Content -notmatch 'roof-markets' -or
   $roofStatus.version -cne 'fun-roofing-opportunity-v1' -or
   $roofStatus.elektronTouched -ne $false -or
   $roofStatus.outreachAuthorized -ne $false -or
   $roofLeads.proofOfNoPermit -ne $false -or
   $bulkPage.StatusCode -ne 200 -or
   $bulkPage.Headers['x-fi-roofing-version'] -cne 'fun-roofing-bulk-v2' -or
   $bulkPage.Content -notmatch 'id="total-properties"' -or
   $bulkCss.StatusCode -ne 200 -or $bulkCss.Content -notmatch 'source-card' -or
   $bulkJs.StatusCode -ne 200 -or $bulkJs.Content -notmatch 'operator-sync-full-export' -or
   $bulkStatus.version -cne 'fun-roofing-bulk-v2' -or
   $bulkStatus.selection.version -cne 'fun-roofing-selective-v3' -or
   $bulkPage.Content -notmatch 'id="selection-selected"' -or
   $bulkPage.Content -notmatch 'id="roof-opportunities"' -or
   $bulkPage.Content -notmatch 'id="roof-opportunity-historical-button"' -or
   $bulkPage.Content -notmatch 'id="roof-opportunity-recalculate-button"' -or
   $bulkPage.Content -notmatch 'id="roof-geo-svg"' -or
   $bulkPage.Content -notmatch 'id="roof-geo-blocks"' -or
   $bulkPage.Content -notmatch 'id="roof-geo-properties"' -or
   $bulkPage.Content -notmatch 'id="roof-refresh-zips"' -or
   $bulkPage.Content -notmatch 'id="roof-opportunity-no-match-button"' -or
   $bulkJs.Content -notmatch 'loadOpportunities' -or
   $bulkJs.Content -notmatch 'recalculateRoofingOpportunities' -or
   $bulkJs.Content -notmatch 'renderRoofZipReferences' -or
   $roofOpportunities.version -cne 'fun-roofing-opportunity-offers-v10' -or
   $zipGeo.version -cne 'fun-roofing-zip-street-explorer-v12' -or
   $zipGeo.read_only -ne $true -or
   $zipGeo.no_outreach -ne $true -or
   @('ZIP_STREET_RESEARCH_READY','AWAITING_LOCAL_V9_REPORTS','LOCAL_V9_REPORT_INCOMPLETE_HOLD') -cnotcontains [string]$zipGeo.state -or
   $roofOpportunities.read_only -ne $true -or
   $roofOpportunities.no_outreach_or_model_execution -ne $true -or
   @('READY_FROM_RECONCILED_LOCAL_V9_REPORTS','AWAITING_LOCAL_V9_REPORTS','LOCAL_V9_REPORT_INCOMPLETE_HOLD') -cnotcontains [string]$roofOpportunities.state -or
   $bulkPage.Content -notmatch 'id="parallel-roof-formulas"' -or
   $bulkPage.Content -notmatch 'id="formula-peer-years"' -or
   $bulkPage.Content -notmatch 'id="formula-min-peers"' -or
   $bulkPage.Content -notmatch 'id="neighbor-example-body"' -or
   $bulkPage.Content -notmatch 'id="unique-block-body"' -or
   $bulkJs.Content -notmatch 'neighborhood_research_examples' -or
   $bulkJs.Content -notmatch 'distinct_block_research_examples' -or
   $bulkJs.Content -notmatch 'unique_street_blocks_with_two_or_more_age_matched_recent_peer_permits' -or
   $bulkJs.Content -notmatch 'renderParallelFormulas' -or
   $bulkStatus.elektronTouched -ne $false -or
   $bulkStatus.automatedOutreach -ne 0 -or
   $procPage.StatusCode -ne 200 -or
   $procPage.Headers['x-fi-procurement-view'] -cne 'fun-procurement-focus-v1' -or
   $procPage.Content -notmatch 'id="fi-procurement"' -or
   $procPage.Content -match 'id="fi-exec-queue"' -or
   $procClient.StatusCode -ne 200 -or
   $procClient.Content -notmatch '/api/operator/procurement/status'){
  Hold 'PREVIEW_ROUTE_OR_EXISTING_MODULE_VERIFICATION_FAILED'
 }
 return @{home='UNCHANGED';preview='HEALTHY';roofing='BULK_V2_HEALTHY';qwen=$qwen.state;v3ready=$v3.ready}
}
function Spawn([string]$file,[string]$root,[string]$label){
 return Start-Process -FilePath $Node -ArgumentList ('"'+$file+'" --serve') -WorkingDirectory $root -PassThru -RedirectStandardOutput (Join-Path $Logs ($label+'.stdout.log')) -RedirectStandardError (Join-Path $Logs ($label+'.stderr.log'))
}
function WaitHealthy([string]$type){
 $reason='No HTTP response'
 for($i=0;$i -lt 120;$i++){
  Start-Sleep -Milliseconds 250
  try{
   $proc=Owner
   if(!$proc){continue}
   if($type -eq 'preview'){
    if(([string]$proc.CommandLine).IndexOf($Runner,[StringComparison]::OrdinalIgnoreCase) -lt 0){continue}
    return (PreviewLive $Runner)
   }else{
    if(([string]$proc.CommandLine).IndexOf($PreviousRunner,[StringComparison]::OrdinalIgnoreCase) -lt 0){continue}
    $response=Invoke-WebRequest ($URL+'/') -UseBasicParsing -TimeoutSec 6
    if($response.StatusCode -eq 200){return $true}
   }
  }catch{$reason=[string]$_.Exception.Message}
 }
 Hold ('8802_'+$type+'_START_HOLD='+$reason)
}
# Validate the downloaded source, then inspect existing process. No changes yet.
$null=VerifyRepo $Root @($ExpectedBranch)
$changes=@(& git.exe -C $Root status --porcelain=v1 --untracked-files=all)
if($LASTEXITCODE -ne 0 -or $changes.Count){Hold 'CHECKOUT_HAS_UNREVIEWED_CHANGES'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($file in @(
 'scripts\Run-Fun-ML-Dashboard8802.mjs',
 'src\ui\organized-preview-v1.mjs',
 'src\ui\organized-preview-v1.js',
 'src\ui\organized-preview-v1.css',
 'src\ui\organized-preview-health-v1.mjs',
 'test\organized-ui-preview-v1.test.mjs',
 'src\roofing\roofing-intelligence-v1.mjs',
 'src\ui\roofing-opportunity-v1.mjs',
 'src\ui\roofing-opportunity-v1.css',
 'src\ui\roofing-opportunity-v1.js',
 'test\roofing-opportunity-v1.test.mjs',
 'src\roofing\roofing-bulk-bridge-v2.mjs',
 'src\ui\roofing-bulk-page-v2.mjs',
 'src\ui\roofing-bulk-page-v2.css',
 'src\ui\roofing-bulk-page-v2.js',
 'test\roofing-bulk-v2.test.mjs',
 'src\ui\procurement-focus-v1.mjs',
 'test\procurement-focus-v1.test.mjs',
 'src\ui\oneport-dashboard-v1.js',
 'src\roofing\selective_policy_v3.py',
 'src\roofing\selective_extract_v3.py',
 'src\roofing\test_selective_v3.py',
 'test\roofing-selective-v3.test.mjs',
 'Start-Fun-Roofing-RealData-V3.ps1',
 'Download-Fun-LACity-Permits-WindowsTLS-V1.ps1',
 'src\roofing\export_roofing_pilot_v1.py',
 'src\roofing\test_export_roofing_pilot_v1.py',
 'src\roofing\roofing_dual_formulas_v4.py',
 'src\roofing\test_roofing_dual_formulas_v4.py',
 'src\roofing\roofing_neighbor_context_v5.py',
 'src\roofing\test_roofing_neighbor_context_v5.py',
 'src\roofing\audit_roofing_permit_descriptions_v6.py',
 'src\roofing\test_audit_roofing_permit_descriptions_v6.py',
 'src\roofing\audit_roofing_permit_status_v7.py',
 'src\roofing\test_audit_roofing_permit_status_v7.py',
 'src\roofing\probe_ladbs_inspections_v8.py',
 'src\roofing\test_probe_ladbs_inspections_v8.py',
 'src\roofing\diagnose_inspection_permit_shapes_v8.py',
 'src\roofing\test_diagnose_inspection_permit_shapes_v8.py',
 'src\roofing\export_roofing_location_research_v9.py',
 'src\roofing\test_export_roofing_location_research_v9.py',
 'src\roofing\roofing_opportunities_v10.py',
 'src\roofing\test_roofing_opportunities_v10.py',
 'src\roofing\roofing_geo_explorer_v12.py',
 'src\roofing\test_roofing_geo_explorer_v12.py'
)){
 $path=Join-Path $Root $file
 RequireFile $path
 # JavaScript-only syntax checking. Python files are checked by Python below.
 if($file -like '*.mjs' -or $file -like '*.js'){
  & $Node --check $path
  if($LASTEXITCODE -ne 0){Hold ('NODE_CHECK_FAILED='+$file)}
 }
}
& $Node --test (Join-Path $Root 'test\organized-ui-preview-v1.test.mjs') (Join-Path $Root 'test\roofing-opportunity-v1.test.mjs') (Join-Path $Root 'test\roofing-bulk-v2.test.mjs') (Join-Path $Root 'test\procurement-focus-v1.test.mjs') (Join-Path $Root 'test\roofing-selective-v3.test.mjs')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_NODE_TESTS_FAILED_NO_PORT_CHANGE'}
$Python=(Get-Command python.exe -ErrorAction Stop).Source
& $Python -B -c "import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8')) for p in sys.argv[1:]]; print('ROOFING_PYTHON_SYNTAX=PASS')" (Join-Path $Root 'src\roofing\roofing_bulk_v2.py') (Join-Path $Root 'src\roofing\selective_policy_v3.py') (Join-Path $Root 'src\roofing\selective_extract_v3.py') (Join-Path $Root 'src\roofing\test_selective_v3.py') (Join-Path $Root 'src\roofing\export_roofing_pilot_v1.py') (Join-Path $Root 'src\roofing\test_export_roofing_pilot_v1.py') (Join-Path $Root 'src\roofing\roofing_dual_formulas_v4.py') (Join-Path $Root 'src\roofing\test_roofing_dual_formulas_v4.py') (Join-Path $Root 'src\roofing\roofing_neighbor_context_v5.py') (Join-Path $Root 'src\roofing\test_roofing_neighbor_context_v5.py') (Join-Path $Root 'src\roofing\audit_roofing_permit_descriptions_v6.py') (Join-Path $Root 'src\roofing\test_audit_roofing_permit_descriptions_v6.py') (Join-Path $Root 'src\roofing\audit_roofing_permit_status_v7.py') (Join-Path $Root 'src\roofing\test_audit_roofing_permit_status_v7.py') (Join-Path $Root 'src\roofing\probe_ladbs_inspections_v8.py') (Join-Path $Root 'src\roofing\test_probe_ladbs_inspections_v8.py') (Join-Path $Root 'src\roofing\diagnose_inspection_permit_shapes_v8.py') (Join-Path $Root 'src\roofing\test_diagnose_inspection_permit_shapes_v8.py') (Join-Path $Root 'src\roofing\export_roofing_location_research_v9.py') (Join-Path $Root 'src\roofing\test_export_roofing_location_research_v9.py') (Join-Path $Root 'src\roofing\roofing_opportunities_v10.py') (Join-Path $Root 'src\roofing\test_roofing_opportunities_v10.py') (Join-Path $Root 'src\roofing\roofing_geo_explorer_v12.py') (Join-Path $Root 'src\roofing\test_roofing_geo_explorer_v12.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_PYTHON_SYNTAX_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_roofing_bulk_v2.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_PYTHON_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_selective_v3.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_SELECTIVE_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_export_roofing_pilot_v1.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_PUBLIC_REVIEW_PILOT_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_roofing_dual_formulas_v4.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_PARALLEL_FORMULAS_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_roofing_neighbor_context_v5.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_NEIGHBOR_COHORT_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_audit_roofing_permit_descriptions_v6.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_PERMIT_DESCRIPTION_AUDIT_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_audit_roofing_permit_status_v7.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_STATUS_EVIDENCE_AUDIT_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_probe_ladbs_inspections_v8.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_INSPECTION_V8_PROBE_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_diagnose_inspection_permit_shapes_v8.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_INSPECTION_SHAPE_V8_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_export_roofing_location_research_v9.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_LOCATION_RESEARCH_V9_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_roofing_opportunities_v10.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_AUTO_OPPORTUNITIES_V10_TESTS_FAILED_NO_PORT_CHANGE'}
& $Python -B (Join-Path $Root 'src\roofing\test_roofing_geo_explorer_v12.py')
if($LASTEXITCODE -ne 0){Hold 'ROOFING_ZIP_GEO_EXPLORER_V12_TESTS_FAILED_NO_PORT_CHANGE'}
foreach($port in $Protected){$Before[$port]=Snapshot $port}
$PreviousProcess=Owner
if($PreviousProcess){
 $PreviousRunner=SourceFromCommand ([string]$PreviousProcess.CommandLine)
 $PreviousRoot=Split-Path (Split-Path $PreviousRunner -Parent) -Parent
 $branch=VerifyRepo $PreviousRoot @(
  'feature/fun-math-v3-autonomous-eprocess-dashboard-20261122',
  'feature/fun-ui-redesign-preview-20261123',
  'feature/fun-roofing-opportunity-v1-20261123',
  'feature/fun-roofing-bulk-v2-20261123',
  'feature/fun-math-v2-dashboard-chat-20261122',
  'feature/fun-fisre-live-8802-20261122'
 )
 & git.exe -C $PreviousRoot ls-files --error-unmatch -- scripts/Run-Fun-ML-Dashboard8802.mjs 2>$null|Out-Null
 if($LASTEXITCODE -ne 0){Hold 'CURRENT_8802_SOURCE_NOT_TRACKED'}
 $dirty=@(& git.exe -C $PreviousRoot status --porcelain=v1 -- scripts/Run-Fun-ML-Dashboard8802.mjs)
 if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold 'CURRENT_8802_SOURCE_MODIFIED'}
 if($branch -ceq $ExpectedBranch){
  try{
   $verified=PreviewLive $PreviousRunner
   Protect
   Write-Host 'FUN_ROOFING_BULK_V2=PASS ALREADY_ACTIVE'
   Write-Host ('FUN_ORGANIZED_PREVIEW_URL='+$URL+'/ui-preview/')
   Write-Host ('FUN_ROOFING_BULK_V2_URL='+$URL+'/roofing/bulk/')
   Write-Host ('FUN_ORIGINAL_DASHBOARD='+$URL+'/')
   Write-Host ('FUN_QWEN_8088='+$verified.qwen)
   Write-Host 'FUN_ELEKTRON=UNTOUCHED ALL_OTHER_SERVICES=UNTOUCHED'
   return
  }catch{Write-Host 'FUN_ROOFING_BULK_V2=EXISTING_DASHBOARD_REQUIRES_UPDATE'}
 }
}
if($CheckOnly){
 Write-Host 'FUN_ROOFING_BULK_V2_PREFLIGHT=PASS; NO_PROCESS_CHANGED'
 return
}
New-Item -ItemType Directory -Path $Logs -Force|Out-Null
try{
 Protect
 if($PreviousProcess){
  Write-Host ('FUN_ORGANIZED_PREVIEW_PREVIOUS_8802_PID='+[int]$PreviousProcess.ProcessId)
  Stop-Process -Id ([int]$PreviousProcess.ProcessId) -ErrorAction Stop
  $OldStopped=$true
  for($i=0;$i -lt 70;$i++){
   if(!(Owner)){break}
   Start-Sleep -Milliseconds 200
  }
  if(Owner){Hold 'CURRENT_8802_NOT_RELEASED'}
 }
 Protect
 $NewChild=Spawn $Runner $Root 'preview-8802'
 $healthy=WaitHealthy 'preview'
 Protect
 Write-Host 'FUN_ROOFING_BULK_V2=PASS'
 Write-Host ('FUN_ORGANIZED_PREVIEW_URL='+$URL+'/ui-preview/')
   Write-Host ('FUN_ROOFING_BULK_V2_URL='+$URL+'/roofing/bulk/')
 Write-Host ('FUN_ORIGINAL_DASHBOARD='+$URL+'/')
 Write-Host ('FUN_QWEN_8088='+$healthy.qwen)
 Write-Host ('FUN_V3_RESEARCH_READY='+$healthy.v3ready)
 Write-Host ('FUN_ROOFING_BULK_V2_LOGS='+$Logs)
 Write-Host 'FUN_ELEKTRON=UNTOUCHED; QWEN_REA_ML_AND_RESEARCH=UNTOUCHED; PRODUCTION_HOMEPAGE=UNCHANGED'
}catch{
 $cause=[string]$_.Exception.Message
 if($NewChild){
  try{
   $active=Owner
   if($active -and [int]$active.ProcessId -eq [int]$NewChild.Id -and
      ([string]$active.CommandLine).IndexOf($Runner,[StringComparison]::OrdinalIgnoreCase) -ge 0){
    Stop-Process -Id ([int]$NewChild.Id) -ErrorAction Stop
   }
  }catch{Write-Warning ('FUN_UI_PREVIEW_CLEANUP_HOLD='+$_.Exception.Message)}
 }
 if($OldStopped -and $PreviousRunner -and $PreviousRoot){
  for($i=0;$i -lt 70;$i++){if(!(Owner)){break};Start-Sleep -Milliseconds 200}
  if(Owner){Hold ('ROLLBACK_BLOCKED_8802_OCCUPIED_ORIGINAL='+$cause)}
  try{
   $null=Spawn $PreviousRunner $PreviousRoot 'rollback-original-8802'
   $null=WaitHealthy 'old'
   Write-Warning 'FUN_ROOFING_BULK_V2_ROLLBACK=ORIGINAL_8802_RESTORED'
  }catch{Hold ('ROLLBACK_FAILED_MANUAL_REVIEW='+$_.Exception.Message+' ORIGINAL='+$cause)}
 }
 throw ('FUN_ROOFING_BULK_V2_DEPLOYMENT_FAILED='+$cause)
}