# FIAL 5.8: guarded primary 8802 dashboard swap, original source untouched.
# The old 8802 service is the only process allowed to be replaced; rollback restores it.
# All Qwen, Cognee, 8789, 8798, REA, FIAL and Elektron listeners are preserved.
[CmdletBinding()]param([switch]$VerifyLive)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$OldRoot=Join-Path $HOME 'FunIndustrial-FIAL513-Buyer'
$Branch='feature/fial5-14-live-purchase-demand-20261115'
$OldBranch='feature/fial5-13-verified-fleet-buyer-20261114'
$Origin='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git'
$OldBlob='480d18ce84710e265a968fcac522c88b5197f08a'
$Runner=Join-Path $Root 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$OldRunner=Join-Path $OldRoot 'scripts\Run-Fun-ML-Dashboard8802.mjs'
$Url='http://127.0.0.1:8802'
$OriginalState='not_checked'
$OldStopped=$false
$NewChild=$null
$OriginalPid=0
$Log=Join-Path $env:LOCALAPPDATA ('FunIndustrial\FIAL514PurchaseDemandDashboard\logs\'+
 (Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,7))
function Hold([string]$why){throw ('FIAL58_PRIMARY_HUB_HOLD='+$why)}
function Listeners([int]$port){
 return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function Snapshot([int]$port){
 return (@(Listeners $port|ForEach-Object{"$($_.LocalAddress):$($_.OwningProcess)"}|Sort-Object)-join ';')
}
function CheckSource([string]$root,[string]$branch){
 if(!(Test-Path -LiteralPath $root -PathType Container)){Hold ('CHECKOUT_MISSING='+$root)}
 $origin=(& git.exe -C $root remote get-url origin | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $origin -cne $Origin){Hold ('REPO_IDENTITY_CHANGED='+$root)}
 $active=(& git.exe -C $root branch --show-current | Out-String).Trim()
 if($LASTEXITCODE -ne 0 -or $active -cne $branch){Hold ('REPO_BRANCH_CHANGED='+$root)}
 $dirty=@(& git.exe -C $root status --porcelain=v1 --untracked-files=all)
 if($LASTEXITCODE -ne 0 -or $dirty.Count){Hold ('REPO_WORKTREE_DIRTY='+$root)}
}
function Leaf([string]$file){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('SOURCE_MISSING='+$file)}
 if(((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){
  Hold ('SOURCE_SYMLINK_REJECTED='+$file)
 }
}
function Owner([int]$port){
 $l=@(Listeners $port)
 if($l.Count -ne 1 -or $l[0].LocalAddress -cne '127.0.0.1'){Hold ('UNVERIFIED_LISTENER_'+$port)}
 $pidFound=[int]$l[0].OwningProcess
 $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$pidFound) -ErrorAction Stop
 if(!$p -or $p.Name -cne 'node.exe' -or [string]::IsNullOrWhiteSpace([string]$p.CommandLine)){
  Hold ('UNVERIFIED_NODE_PROCESS_'+$port)
 }
 return $p
}
function GetJson([string]$path){
 return Invoke-RestMethod ($Url+$path) -TimeoutSec 12 -ErrorAction Stop
}
function ReadyNew([int]$expectedPid){
 $p=Owner 8802
 if([int]$p.ProcessId -ne $expectedPid -or
  [string]$p.CommandLine -notmatch [regex]::Escape($Runner)){Hold 'NEW_8802_OWNER_DRIFT'}
 $status=GetJson '/api/fun/hub/status'
 $model=GetJson '/api/ml/dashboard/status'
 $chat=GetJson '/api/fial/grounded/status'
 $commerce=GetJson '/api/commerce/status'
 $unified=GetJson '/api/unified/status'
 $executive=GetJson '/api/operator/status'
 $real=GetJson '/api/operator/real/status'
 $business=GetJson '/api/operator/competence/status'
 $outcome=GetJson '/api/operator/outcomes/status'
 $regulatory=GetJson '/api/operator/regulatory/status'
 $fleet=GetJson '/api/operator/fleet/status'
 $procurement=GetJson '/api/operator/procurement/status'
 $fit=GetJson '/api/operator/fit/status'
 $bid=GetJson '/api/operator/bid-readiness/status'
 $buyer=GetJson '/api/operator/buyer/status'
 $demand=GetJson '/api/operator/demand/status'
 if($status.version -cne 'fi-ml-hub-v3' -or $model.state -cne 'ready' -or
  $chat.version -cne 'fial5.3-primary-grounded-chat-v1' -or
  $chat.model_interface -cne 'fixed_local_qwen_8088' -or
  $chat.memory_interface -cne 'fixed_readonly_cognee_8789' -or
  $chat.authority_added -ne $false -or $chat.tool_executions -ne 0 -or
  $null -eq $commerce.version -or $unified.state -cne 'ready' -or
  $executive.version -cne 'fial5.4-executive-operator-v1' -or
  $executive.console_version -cne 'fial5.4-executive-console-v1' -or
  $executive.outbound_permissions.email_sent -ne 0 -or
  $executive.outbound_permissions.government_filings -ne 0 -or
  $executive.outbound_permissions.spent_usd -ne 0 -or
  $executive.outbound_permissions.rea_runs -ne 0 -or
  $real.version -cne 'fial5.5-real-business-operations-v1' -or
  $real.company_identity_status -cne 'OPERATOR_PROVIDED_NOT_OFFICIALLY_VERIFIED' -or
  $real.government_filings -ne 0 -or $real.emails_sent -ne 0 -or
  $real.payments -ne 0 -or $real.rea_executions -ne 0 -or
  $real.applied_configs -ne 0 -or
  $business.version -cne 'fial5.6-business-operator-v1' -or
  $business.state -cne 'EXECUTED_LOCAL_BUSINESS_COMPETENCE_CYCLE' -or
  $business.actions.mail_sent -ne 0 -or
  $business.actions.government_filings -ne 0 -or
  $business.actions.rea_executions -ne 0 -or
  $business.actions.code_mutations -ne 0 -or
  $business.actions.model_invocations -ne 0 -or
  $outcome.version -cne 'fial5.7-verified-outcomes-v1' -or
  $outcome.external_form_submissions -ne 0 -or
  $outcome.verified_customer_revenue -ne 0 -or
  $outcome.certified_license_status -ne $false -or
  $outcome.send_attempts -gt 1 -or
  $regulatory.version -cne 'fial5.8-regulatory-economic-v1' -or
  $regulatory.state -cne 'REAL_PUBLIC_DATA_CHECK_COMPLETED' -or
  $regulatory.source_catalog_version -cne 'fial5.8.1-regulatory-catalog-2026-amendment-v1' -or
  $regulatory.authority_update -cne 'ACF_2026_FINAL_AMENDMENT_SUPERSEDES_2027_PURCHASE_RULE' -or
  @($regulatory.rule_watch|Where-Object {$_.id -eq 'acf-state-local-purchasing' -and
     $_.effective -ceq '2030-01-01' -and $_.supersedes -ceq '2027-01-01'}).Count -ne 1 -or
  $regulatory.boundaries.emails_sent -ne 0 -or
  $regulatory.boundaries.automatic_filing -ne 0 -or
  $regulatory.boundaries.model_calls -ne 0 -or
  $regulatory.boundaries.verified_individual_due_dates -ne 0 -or
  $fleet.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
  $fleet.state -cne 'PUBLISHED_HISTORICAL_FLEET_PROSPECTS_AND_OFFICIAL_SOURCE_MONITOR' -or
  $fleet.counts.verified_open_rfps -ne 0 -or
  $fleet.counts.awarded_contracts -ne 0 -or
  $fleet.counts.actual_revenue_usd -ne 0 -or
  $fleet.boundaries.rea_calls -ne 0 -or
  $fleet.boundaries.emails_sent -ne 0 -or
  $fleet.boundaries.model_calls -ne 0 -or
  @($fleet.prospects).Count -lt 30 -or
  $procurement.version -cne 'fial5.10-published-procurement-v1' -or
  $procurement.notice.solicitation_id -cne '26-27-02TR' -or
  $procurement.counts.verified_fit_for_elektron -ne 0 -or
  $procurement.counts.verified_current_published_notices -gt 1 -or
  $procurement.boundaries.actual_rfps_submitted -ne 0 -or
  $procurement.boundaries.emails_sent -ne 0 -or
  $procurement.boundaries.rea_calls -ne 0 -or
  $procurement.boundaries.model_calls -ne 0 -or
  $fit.version -cne 'fial5.11-commercial-fit-v1' -or
  $fit.state -cne 'COMMERCIAL_FIT_QUALIFICATION_RESEARCH_ONLY' -or
  @($fit.opportunities).Count -ne 3 -or
  $fit.counts.directly_qualified_bids -ne 0 -or
  $fit.counts.contracts_awarded -ne 0 -or
  $fit.counts.actual_revenue_usd -ne 0 -or
  $fit.boundaries.bids_submitted -ne 0 -or
  $fit.boundaries.applications_submitted -ne 0 -or
  $fit.boundaries.rea_calls -ne 0 -or
  $fit.boundaries.emails_sent -ne 0 -or
  $fit.boundaries.model_calls -ne 0 -or
  $bid.version -cne 'fial5.12-bid-readiness-v1' -or
  $bid.state -cne 'VERIFIED_BUSINESS_REQUIREMENTS_RESEARCH_ONLY' -or
  @($bid.leads).Count -ne 2 -or
  $bid.counts.verified_bid_ready -ne 0 -or
  $bid.counts.actual_revenue_usd -ne 0 -or
  $bid.boundaries.emails_sent -ne 0 -or
  $bid.boundaries.bids_submitted -ne 0 -or
  $bid.boundaries.registrations_made -ne 0 -or
  $bid.boundaries.rea_tool_calls -ne 0 -or
  $bid.boundaries.model_calls -ne 0 -or
  $buyer.version -cne 'fial5.13-verified-fleet-buyer-v1' -or
  $buyer.state -cne 'VERIFIED_PUBLIC_BUYER_EVIDENCE_RESEARCH_ONLY' -or
  $buyer.buyer.id -cne 'bakersfield-city-school-district' -or
  $buyer.buyer.published_total_school_buses -ne 161 -or
  $buyer.buyer.ev_bus_count_verified -ne $null -or
  $buyer.counts.verified_open_repair_bids -ne 0 -or
  $buyer.counts.verified_service_orders -ne 0 -or
  $buyer.counts.verified_revenue_usd -ne 0 -or
  $buyer.boundaries.emails_sent -ne 0 -or
  $buyer.boundaries.phone_calls_placed -ne 0 -or
  $buyer.boundaries.site_visits -ne 0 -or
  $buyer.boundaries.rea_calls -ne 0 -or
  $buyer.boundaries.model_calls -ne 0 -or
  $demand.version -cne 'fial5.14-real-purchase-demand-v1' -or
  $demand.state -cne 'REAL_OFFICIAL_BUYER_INDEX_AND_LEA_INCENTIVE_RESEARCH_ONLY' -or
  $demand.buyer.id -cne 'bakersfield-city-school-district' -or
  $demand.program.awarded_to_elektron_verified -ne $false -or
  $demand.counts.verified_live_ev_repair_rfps -ne 0 -or
  $demand.counts.buyer_orders -ne 0 -or
  $demand.counts.actual_revenue_usd -ne 0 -or
  $demand.boundaries.emails_sent -ne 0 -or
  $demand.boundaries.bids_submitted -ne 0 -or
  $demand.boundaries.applications_filed -ne 0 -or
  $demand.boundaries.rea_calls -ne 0 -or
  $demand.boundaries.model_calls -ne 0){
  Hold 'NEW_DASHBOARD_HEALTH_OR_POLICY_MISMATCH'
 }
 $page=Invoke-WebRequest ($Url+'/unified/?view=chat') -UseBasicParsing -TimeoutSec 14
 $homePage=Invoke-WebRequest ($Url+'/') -UseBasicParsing -TimeoutSec 14
 $script=Invoke-WebRequest ($Url+'/api/fial/grounded/client.js') -UseBasicParsing -TimeoutSec 14
 $operatorPage=Invoke-WebRequest ($Url+'/operations/') -UseBasicParsing -TimeoutSec 14
 $operatorClient=Invoke-WebRequest ($Url+'/api/operator/client.js') -UseBasicParsing -TimeoutSec 14
 $realClient=Invoke-WebRequest ($Url+'/api/operator/real/client.js') -UseBasicParsing -TimeoutSec 14
 $businessClient=Invoke-WebRequest ($Url+'/api/operator/competence/client.js') -UseBasicParsing -TimeoutSec 14
 $outcomeClient=Invoke-WebRequest ($Url+'/api/operator/outcomes/client.js') -UseBasicParsing -TimeoutSec 14
 $regClient=Invoke-WebRequest ($Url+'/api/operator/regulatory/client.js') -UseBasicParsing -TimeoutSec 14
 $fleetClient=Invoke-WebRequest ($Url+'/api/operator/fleet/client.js') -UseBasicParsing -TimeoutSec 14
 $procurementClient=Invoke-WebRequest ($Url+'/api/operator/procurement/client.js') -UseBasicParsing -TimeoutSec 14
 $fitClient=Invoke-WebRequest ($Url+'/api/operator/fit/client.js') -UseBasicParsing -TimeoutSec 14
 $bidClient=Invoke-WebRequest ($Url+'/api/operator/bid-readiness/client.js') -UseBasicParsing -TimeoutSec 14
 $buyerClient=Invoke-WebRequest ($Url+'/api/operator/buyer/client.js') -UseBasicParsing -TimeoutSec 14
 $demandClient=Invoke-WebRequest ($Url+'/api/operator/demand/client.js') -UseBasicParsing -TimeoutSec 14
 if($page.StatusCode -ne 200 -or $homePage.StatusCode -ne 200 -or
  $page.Content -notmatch 'id="fi-fial53-grounded"' -or
  $page.Content -notmatch 'id="action-review"' -or
  $page.Content -notmatch 'fi-ml-panel' -or $page.Content -notmatch 'fi-commerce-panel' -or
  $homePage.Content -notmatch 'fi-ui-shell' -or
  $script.Content -notmatch 'x-fi-chat-click' -or $script.Content -match 'innerHTML' -or
  $operatorPage.StatusCode -ne 200 -or $operatorPage.Content -notmatch 'fi-exec-queue' -or
  $operatorPage.Content -notmatch 'Executive Assistant' -or
  $operatorClient.StatusCode -ne 200 -or $operatorClient.Content -notmatch 'textContent' -or
  $operatorClient.Content -match 'innerHTML' -or
  $operatorPage.Content -notmatch 'fi-real-work' -or
  $realClient.StatusCode -ne 200 -or
  $realClient.Content -notmatch 'textContent' -or
  $realClient.Content -match 'innerHTML' -or
  $operatorPage.Content -notmatch 'fi-competence-question' -or
  $businessClient.StatusCode -ne 200 -or
  $businessClient.Content -notmatch 'x-fi-business-click' -or
  $businessClient.Content -match 'innerHTML' -or
  $operatorPage.Content -notmatch 'fi-outcome-status' -or
  $outcomeClient.StatusCode -ne 200 -or
  $outcomeClient.Content -notmatch 'textContent' -or
  $outcomeClient.Content -match 'innerHTML' -or
  $operatorPage.Content -notmatch 'fi-regulatory-intelligence' -or
  $regClient.StatusCode -ne 200 -or
  $regClient.Content -notmatch 'createElementNS' -or
  $regClient.Content -match 'innerHTML' -or
  $operatorPage.Content -notmatch 'fi-fleet-opportunities' -or
  $fleetClient.StatusCode -ne 200 -or
  $fleetClient.Content -notmatch 'textContent' -or
  $fleetClient.Content -match 'innerHTML' -or
  $operatorPage.Content -notmatch 'fi-procurement' -or
  $procurementClient.StatusCode -ne 200 -or
  $procurementClient.Content -notmatch 'textContent' -or
  $procurementClient.Content -match 'innerHTML' -or
  $operatorPage.Content -notmatch 'fi-commercial-fit' -or
  $fitClient.StatusCode -ne 200 -or
  $fitClient.Content -notmatch 'textContent' -or
  $fitClient.Content -match 'innerHTML' -or
  $operatorPage.Content -notmatch 'fi-bid-readiness' -or
  $bidClient.StatusCode -ne 200 -or
  $bidClient.Content -notmatch 'textContent' -or
  $bidClient.Content -match 'innerHTML' -or
  $operatorPage.Content -notmatch 'fi-fleet-buyer' -or
  $buyerClient.StatusCode -ne 200 -or
  $buyerClient.Content -notmatch 'textContent' -or
  $buyerClient.Content -match 'innerHTML' -or
  $operatorPage.Content -notmatch 'fi-purchase-demand' -or
  $demandClient.StatusCode -ne 200 -or
  $demandClient.Content -notmatch 'textContent' -or
  $demandClient.Content -match 'innerHTML'){
  Hold 'NEW_PRIMARY_DASHBOARD_UI_OR_LEGACY_CONTROLS_MISSING'
 }
 if($script.Content -notmatch 'textContent'){Hold 'CHAT_OUTPUT_ESCAPING_NOT_VERIFIED'}
 if($script.Content -match 'eval\('){Hold 'CHAT_UNTRUSTED_EVAL_REFUSED'}
 if($OldCommerceShopifyConfigured -and $commerce.shopify.configured -ne $true){
  Hold 'SHOPIFY_PREEXISTING_CONFIGURATION_NOT_PRESERVED'
 }
}
function StartNode([string]$path,[string]$root,[string]$prefix){
 $out=Join-Path $Log ($prefix+'.stdout.log')
 $err=Join-Path $Log ($prefix+'.stderr.log')
 return Start-Process -FilePath $Node -ArgumentList ('"'+$path+'" --serve') -WorkingDirectory $root -PassThru -ErrorAction Stop -RedirectStandardOutput $out -RedirectStandardError $err
}
function CheckProtected(){
 foreach($p in $Protected){
  if((Snapshot $p) -cne $Before[$p]){Hold ('PROTECTED_PROCESS_CHANGED_PORT_'+$p)}
 }
}
# Everything before the process swap is read-only.
CheckSource $Root $Branch
CheckSource $OldRoot $OldBranch
Leaf $Runner;Leaf $OldRunner
$hash=(& git.exe -C $OldRoot hash-object --path=scripts/Run-Fun-ML-Dashboard8802.mjs -- $OldRunner | Out-String).Trim()
if($LASTEXITCODE -ne 0 -or $hash -cne $OldBlob){Hold 'OLD_DASHBOARD_SOURCE_NOT_REVIEWED'}
$Node=(Get-Command node.exe -ErrorAction Stop).Source
foreach($file in @(
 'scripts\Run-Fun-ML-Dashboard8802.mjs',
 'src\fial\grounded-chat-v5-2.mjs',
 'src\fial\primary-grounded-ui-v5-3.mjs',
 'src\fial\primary-grounded-client-v5-3.js',
 'src\operator\executive-ops-v1.mjs',
 'src\operator\executive-mail-v1.mjs',
 'src\operator\executive-console-v1.mjs',
 'src\operator\executive-console-client-v1.js',
 'scripts\Run-Fun-Executive-Operator-V1.mjs',
 'scripts\Run-Fun-Real-Operations-V5-5.mjs',
 'src\operator\real-operations-v5-5.mjs',
 'src\operator\official-source-watch-v5-5.mjs',
 'src\operator\elektron-gmail-v5-5.mjs',
 'src\competence\business-knowledge-v5-6.mjs',
 'src\competence\business-finance-v5-6.mjs',
 'src\competence\business-writing-v5-6.mjs',
 'src\competence\business-workflow-v5-6.mjs',
 'src\competence\business-operator-v5-6.mjs',
 'src\competence\optional-document-tools-v5-6.mjs',
 'src\competence\business-console-v5-6.js',
 'scripts\Run-Fun-Business-Competence-V5-6.mjs',
 'scripts\Run-Fun-Outcome-V5-7.mjs',
 'src\outcomes\outcome-engine-v5-7.mjs',
 'src\outcomes\elektron-send-v5-7.mjs',
 'src\outcomes\outcome-console-v5-7.js',
 'src\regulatory\rule-catalog-v5-8.mjs',
 'src\regulatory\intelligence-engine-v5-8.mjs',
 'src\regulatory\regulatory-console-v5-8.js',
 'src\regulatory\regulatory-qwen-v5-8.mjs',
 'scripts\Run-Fun-Regulatory-Economic-V5-8.mjs',
 'src\fleet\fleet-sources-v5-9.mjs',
 'src\fleet\fleet-engine-v5-9.mjs',
 'src\fleet\fleet-console-v5-9.js',
 'src\fleet\fleet-qwen-v5-9.mjs',
 'scripts\Run-Fun-Fleet-Opportunity-V5-9.mjs',
 'src\procurement\procurement-catalog-v5-10.mjs',
 'src\procurement\procurement-engine-v5-10.mjs',
 'src\procurement\procurement-console-v5-10.js',
 'scripts\Run-Fun-Procurement-V5-10.mjs',
 'src\fit\commercial-fit-catalog-v5-11.mjs',
 'src\fit\commercial-fit-engine-v5-11.mjs',
 'src\fit\commercial-fit-console-v5-11.js',
 'src\fit\commercial-fit-qwen-v5-11.mjs',
 'scripts\Run-Fun-Commercial-Fit-V5-11.mjs',
 'src\bid-readiness\readiness-catalog-v5-12.mjs',
 'src\bid-readiness\readiness-engine-v5-12.mjs',
 'src\bid-readiness\readiness-qwen-v5-12.mjs',
 'src\bid-readiness\readiness-console-v5-12.js',
 'scripts\Run-Fun-Bid-Readiness-V5-12.mjs',
 'src\buyers\buyer-catalog-v5-13.mjs',
 'src\buyers\buyer-engine-v5-13.mjs',
 'src\buyers\buyer-console-v5-13.js',
 'src\buyers\buyer-qwen-v5-13.mjs',
 'scripts\Run-Fun-Buyer-V5-13.mjs',
 'src\demand\demand-catalog-v5-14.mjs',
 'src\demand\demand-engine-v5-14.mjs',
 'src\demand\demand-console-v5-14.js',
 'src\demand\demand-qwen-v5-14.mjs',
 'scripts\Run-Fun-Purchase-Demand-V5-14.mjs',
 'src\operator\real-operations-widget-v5-5.js',
 'src\ui\integrated-hub-v1.js',
 'intelligence-checks\fial-primary-dashboard-chat-v5-3-case.mjs',
 'intelligence-checks\fial54-executive-operator-v1-case.mjs',
 'intelligence-checks\fial54-primary-console-v1-case.mjs',
 'intelligence-checks\fial55-real-operations-case.mjs',
 'intelligence-checks\fial55-primary-dashboard-case.mjs',
 'intelligence-checks\fial55-elektron-mail-case.mjs',
 'intelligence-checks\fial56-business-competence-case.mjs',
 'intelligence-checks\fial56-primary-business-dashboard-case.mjs',
 'intelligence-checks\fial57-outcomes-case.mjs',
 'intelligence-checks\fial57-dashboard-case.mjs',
 'intelligence-checks\fial58-regulatory-intelligence-case.mjs',
 'intelligence-checks\fial58-regulatory-dashboard-case.mjs',
 'intelligence-checks\fial59-fleet-evidence-case.mjs',
 'intelligence-checks\fial59-dashboard-case.mjs',
 'intelligence-checks\fial59-qwen-context-case.mjs',
 'intelligence-checks\fial510-procurement-case.mjs',
 'intelligence-checks\fial510-dashboard-case.mjs',
 'intelligence-checks\fial511-commercial-fit-case.mjs',
 'intelligence-checks\fial511-dashboard-case.mjs',
 'intelligence-checks\fial511-qwen-context-case.mjs',
 'intelligence-checks\fial512-bid-readiness-case.mjs',
 'intelligence-checks\fial512-dashboard-case.mjs',
 'intelligence-checks\fial512-qwen-context-case.mjs',
 'intelligence-checks\fial513-buyer-evidence-case.mjs',
 'intelligence-checks\fial513-dashboard-case.mjs',
 'intelligence-checks\fial513-qwen-context-case.mjs',
 'intelligence-checks\fial514-demand-evidence-case.mjs',
 'intelligence-checks\fial514-dashboard-case.mjs',
 'intelligence-checks\fial514-qwen-context-case.mjs')){
 $f=Join-Path $Root $file;Leaf $f
 & $Node --check $f
 if($LASTEXITCODE -ne 0){Hold ('NEW_SOURCE_SYNTAX_HOLD='+$file)}
}
$tests=@(
 'intelligence-checks\fial514-demand-evidence-case.mjs',
 'intelligence-checks\fial514-dashboard-case.mjs',
 'intelligence-checks\fial514-qwen-context-case.mjs',
 'intelligence-checks\fial513-buyer-evidence-case.mjs',
 'intelligence-checks\fial513-dashboard-case.mjs',
 'intelligence-checks\fial513-qwen-context-case.mjs',
 'intelligence-checks\fial512-bid-readiness-case.mjs',
 'intelligence-checks\fial512-dashboard-case.mjs',
 'intelligence-checks\fial512-qwen-context-case.mjs',
 'intelligence-checks\fial511-commercial-fit-case.mjs',
 'intelligence-checks\fial511-dashboard-case.mjs',
 'intelligence-checks\fial511-qwen-context-case.mjs',
 'intelligence-checks\fial510-procurement-case.mjs',
 'intelligence-checks\fial510-dashboard-case.mjs',
 'intelligence-checks\fial59-fleet-evidence-case.mjs',
 'intelligence-checks\fial59-dashboard-case.mjs',
 'intelligence-checks\fial59-qwen-context-case.mjs',
 'intelligence-checks\fial58-regulatory-intelligence-case.mjs',
 'intelligence-checks\fial58-regulatory-dashboard-case.mjs',
 'intelligence-checks\fial57-outcomes-case.mjs',
 'intelligence-checks\fial57-dashboard-case.mjs',
 'intelligence-checks\fial56-business-competence-case.mjs',
 'intelligence-checks\fial56-primary-business-dashboard-case.mjs',
 'intelligence-checks\fial55-real-operations-case.mjs',
 'intelligence-checks\fial55-primary-dashboard-case.mjs',
 'intelligence-checks\fial55-elektron-mail-case.mjs',
 'intelligence-checks\fial54-executive-operator-v1-case.mjs',
 'intelligence-checks\fial54-primary-console-v1-case.mjs',
 'intelligence-checks\fial-primary-dashboard-chat-v5-3-case.mjs',
 'intelligence-checks\fi-ml-hub-v3-case.mjs',
 'intelligence-checks\integrated-hub-ui-v1-case.mjs',
 'intelligence-checks\fial-grounded-qwen-v5-2-case.mjs',
 'intelligence-checks\commerce-opportunities-v1-1-case.mjs',
 'intelligence-checks\google-trends-focus-v1-2-case.mjs')
& $Node --test ($tests|ForEach-Object {Join-Path $Root $_})
if($LASTEXITCODE -ne 0){Hold 'PRIMARY_DASHBOARD_TESTS_FAILED_BEFORE_REPLACEMENT'}
Write-Host 'FIAL58_PRIMARY_DASHBOARD_TESTS=PASS'
$q=Invoke-RestMethod 'http://127.0.0.1:8088/health' -TimeoutSec 8 -ErrorAction Stop
if($q.status -cne 'ok'){Hold 'EXISTING_QWEN_UNHEALTHY'}
$mem=Invoke-RestMethod 'http://127.0.0.1:8789/api/ai/automatic-memory/status' -TimeoutSec 10 -ErrorAction Stop
if($mem.memoryAvailable -ne $true -or $mem.memoryWrites -ne $false -or
 $mem.mode -cne 'automatic_contextual_read_only'){Hold 'EXISTING_COGNEE_READ_ONLY_POLICY_HOLD'}
$task=Get-ScheduledTask -TaskName 'FunIndustrial-Executive-Operator-V1' -ErrorAction SilentlyContinue
if(!$task -or $task.State -eq 'Disabled'){Hold 'EXECUTIVE_SCHEDULE_NOT_ACTIVE'}
$newTaskAction='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+(Join-Path $Root 'Run-Fun-Purchase-Demand-V5-14.ps1')+'"'
if(@($task.Actions).Count -ne 1 -or
 [string]$task.Actions[0].Arguments -cne $newTaskAction -or
 @($task.Triggers).Count -ne 4){Hold 'REAL_OPERATIONS_SCHEDULE_NOT_VERIFIED'}
$receiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\last-cycle-v1.json'
$realReceiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\RealWorkV55\last-real-cycle.json'
if(!(Test-Path -LiteralPath $realReceiptFile -PathType Leaf)){Hold 'FIAL58_REAL_WORK_RECEIPT_MISSING'}
$realReceipt=Get-Content -LiteralPath $realReceiptFile -Raw|ConvertFrom-Json
$businessReceiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\BusinessCompetenceV56\last-cycle.json'
if(!(Test-Path -LiteralPath $businessReceiptFile -PathType Leaf)){Hold 'BUSINESS_COMPETENCE_RECEIPT_MISSING'}
$businessReceipt=Get-Content -LiteralPath $businessReceiptFile -Raw|ConvertFrom-Json
$outcomeReceiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\OutcomeV57\verified-outcomes-v1.json'
if(!(Test-Path -LiteralPath $outcomeReceiptFile -PathType Leaf)){Hold 'OUTCOME_EVIDENCE_RECEIPT_MISSING'}
$outcomeReceipt=Get-Content -LiteralPath $outcomeReceiptFile -Raw|ConvertFrom-Json
$regReceiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\RegulatoryEconomicV58\last-intelligence-v1.json'
if(!(Test-Path -LiteralPath $regReceiptFile -PathType Leaf)){Hold 'REGULATORY_INTELLIGENCE_RECEIPT_MISSING'}
$regReceipt=Get-Content -LiteralPath $regReceiptFile -Raw|ConvertFrom-Json
$fleetReceiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\FleetOpportunityV59\last-fleet-cycle-v1.json'
if(!(Test-Path -LiteralPath $fleetReceiptFile -PathType Leaf)){Hold 'FLEET_EVIDENCE_RECEIPT_MISSING'}
$fleetReceipt=Get-Content -LiteralPath $fleetReceiptFile -Raw|ConvertFrom-Json
$procReceiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\ProcurementV510\last-procurement-cycle-v1.json'
if(!(Test-Path -LiteralPath $procReceiptFile -PathType Leaf)){Hold 'OFFICIAL_PROCUREMENT_RECEIPT_MISSING'}
$procReceipt=Get-Content -LiteralPath $procReceiptFile -Raw|ConvertFrom-Json
$fitReceiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\CommercialFitV511\last-fit-cycle-v1.json'
if(!(Test-Path -LiteralPath $fitReceiptFile -PathType Leaf)){Hold 'COMMERCIAL_FIT_RECEIPT_MISSING'}
$fitReceipt=Get-Content -LiteralPath $fitReceiptFile -Raw|ConvertFrom-Json
$bidReceiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\BidReadinessV512\last-bid-readiness-cycle-v1.json'
if(!(Test-Path -LiteralPath $bidReceiptFile -PathType Leaf)){Hold 'BID_READINESS_RECEIPT_MISSING'}
$bidReceipt=Get-Content -LiteralPath $bidReceiptFile -Raw|ConvertFrom-Json
$buyerReceiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\FleetBuyerV513\last-buyer-cycle-v1.json'
if(!(Test-Path -LiteralPath $buyerReceiptFile -PathType Leaf)){Hold 'PUBLIC_BUYER_RECEIPT_MISSING'}
$buyerReceipt=Get-Content -LiteralPath $buyerReceiptFile -Raw|ConvertFrom-Json
$demandReceiptFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\ExecutiveOperatorV1\PurchaseDemandV514\last-demand-cycle-v1.json'
if(!(Test-Path -LiteralPath $demandReceiptFile -PathType Leaf)){Hold 'PUBLIC_DEMAND_RECEIPT_MISSING'}
$demandReceipt=Get-Content -LiteralPath $demandReceiptFile -Raw|ConvertFrom-Json
if($demandReceipt.version -cne 'fial5.14-real-purchase-demand-v1' -or
 $demandReceipt.counts.verified_live_ev_repair_rfps -ne 0 -or
 $demandReceipt.counts.buyer_orders -ne 0 -or
 $demandReceipt.counts.actual_revenue_usd -ne 0 -or
 $demandReceipt.boundaries.emails_sent -ne 0 -or
 $demandReceipt.boundaries.applications_filed -ne 0 -or
 $demandReceipt.boundaries.bids_submitted -ne 0 -or
 $demandReceipt.boundaries.rea_calls -ne 0){Hold 'PUBLIC_DEMAND_RECEIPT_UNVERIFIED'}
if($buyerReceipt.version -cne 'fial5.13-verified-fleet-buyer-v1' -or
 $buyerReceipt.counts.verified_service_orders -ne 0 -or
 $buyerReceipt.counts.verified_revenue_usd -ne 0 -or
 $buyerReceipt.boundaries.emails_sent -ne 0 -or
 $buyerReceipt.boundaries.phone_calls_placed -ne 0 -or
 $buyerReceipt.boundaries.site_visits -ne 0 -or
 $buyerReceipt.boundaries.rea_calls -ne 0){Hold 'PUBLIC_BUYER_RECEIPT_UNVERIFIED'}
if($bidReceipt.version -cne 'fial5.12-bid-readiness-v1' -or
 $bidReceipt.counts.verified_bid_ready -ne 0 -or
 $bidReceipt.counts.actual_revenue_usd -ne 0 -or
 $bidReceipt.boundaries.bids_submitted -ne 0 -or
 $bidReceipt.boundaries.registrations_made -ne 0 -or
 $bidReceipt.boundaries.emails_sent -ne 0 -or
 $bidReceipt.boundaries.rea_tool_calls -ne 0){Hold 'BID_READINESS_RECEIPT_UNVERIFIED'}
if($fitReceipt.version -cne 'fial5.11-commercial-fit-v1' -or
 $fitReceipt.boundaries.bids_submitted -ne 0 -or
 $fitReceipt.boundaries.rea_calls -ne 0 -or
 $fitReceipt.counts.directly_qualified_bids -ne 0 -or
 $fitReceipt.counts.contracts_awarded -ne 0){Hold 'COMMERCIAL_FIT_RECEIPT_UNVERIFIED'}
if($procReceipt.version -cne 'fial5.10-published-procurement-v1' -or
 $procReceipt.notice.solicitation_id -cne '26-27-02TR' -or
 $procReceipt.boundaries.actual_rfps_submitted -ne 0 -or
 $procReceipt.counts.verified_fit_for_elektron -ne 0 -or
 $procReceipt.boundaries.emails_sent -ne 0 -or
 $procReceipt.boundaries.rea_calls -ne 0){Hold 'OFFICIAL_PROCUREMENT_RECEIPT_UNVERIFIED'}
if($fleetReceipt.version -cne 'fial5.9-fleet-opportunity-evidence-v1' -or
 $fleetReceipt.boundaries.emails_sent -ne 0 -or
 $fleetReceipt.boundaries.rea_calls -ne 0 -or
 $fleetReceipt.counts.verified_open_rfps -ne 0 -or
 $fleetReceipt.counts.awarded_contracts -ne 0){Hold 'FLEET_EVIDENCE_RECEIPT_INVALID'}
if($regReceipt.version -cne 'fial5.8-regulatory-economic-v1' -or
 $regReceipt.boundaries.emails_sent -ne 0 -or
 $regReceipt.boundaries.automatic_filing -ne 0 -or
 $regReceipt.boundaries.model_calls -ne 0 -or
 $regReceipt.boundaries.verified_individual_due_dates -ne 0){
 Hold 'REGULATORY_INTELLIGENCE_RECEIPT_UNVERIFIED'
}
if($outcomeReceipt.version -cne 'fial5.7-verified-outcomes-v1' -or
 $outcomeReceipt.external_form_submissions -ne 0 -or
 $outcomeReceipt.rea_calls -ne 0 -or
 $outcomeReceipt.send_attempts -gt 1){Hold 'OUTCOME_EVIDENCE_RECEIPT_UNVERIFIED'}
if($businessReceipt.version -cne 'fial5.6-business-operator-v1' -or
 $businessReceipt.actions.mail_sent -ne 0 -or
 $businessReceipt.actions.government_filings -ne 0 -or
 $businessReceipt.actions.rea_executions -ne 0 -or
 $businessReceipt.actions.model_invocations -ne 0){Hold 'BUSINESS_COMPETENCE_RECEIPT_UNVERIFIED'}
if($realReceipt.version -cne 'fial5.5-real-business-operations-v1' -or
 $realReceipt.emails_sent -ne 0 -or $realReceipt.government_filings -ne 0 -or
 $realReceipt.rea_executions -ne 0){Hold 'FIAL58_REAL_WORK_RECEIPT_UNVERIFIED'}
if(!(Test-Path -LiteralPath $receiptFile -PathType Leaf)){Hold 'EXECUTIVE_FIRST_REAL_CYCLE_MISSING'}
$receipt=Get-Content -LiteralPath $receiptFile -Raw|ConvertFrom-Json
if($receipt.version -cne 'fial5.4-executive-operator-v1' -or
 $receipt.outbound_permissions.email_sent -ne 0 -or
 $receipt.outbound_permissions.government_filings -ne 0){Hold 'EXECUTIVE_RECEIPT_UNVERIFIED'}
$parent=Invoke-RestMethod 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 9 -ErrorAction Stop
$ml=Invoke-RestMethod 'http://127.0.0.1:8801/api/ml/status' -TimeoutSec 9 -ErrorAction Stop
# 8798 exposes a .state, but 8801 returns the independent ML status contract
# without .state. Require identity + installed Python + unchanged authority instead.
if($parent.version -cne 'fi-unified-task-chat-8798-v1' -or
 $parent.state -cne 'ready' -or
 $ml.version -cne 'fun-qwen-scikit-v2' -or
 $ml.pythonInstalled -ne $true -or
 $ml.reaExecutionGrants -ne 0 -or
 $ml.externalActions -ne 0){Hold 'PRIMARY_DEPENDENCIES_NOT_READY_OR_IDENTITY_MISMATCH'}
Write-Host 'FIAL58_8798_STATUS=READY FIAL58_8801_ML_STATUS=VERIFIED_REAL_SCHEMA'
# Capture protected service identity before recovery or the controlled handoff.
$Protected=@(11434,8088,8791,8789,8796,8797,8798,8801,8803,8804,8805,8806,8443)
$Before=@{}
foreach($p in $Protected){$Before[$p]=Snapshot $p}
$initial=@(Listeners 8802)
if($initial.Count -eq 0){
 # A previous strict-mode failure could have left 8802 absent.
 # Restore only the previously pinned working dashboard from the untouched checkout.
 Write-Host 'FIAL58_MISSING_8802=RECOVERING_PINNED_ORIGINAL'
 New-Item -ItemType Directory -Path $Log -Force | Out-Null
 $recovery=StartNode $OldRunner $OldRoot 'recover-original-8802'
 $recovered=$false
 for($i=0;$i -lt 100;$i++){
  Start-Sleep -Milliseconds 250
  try{
   $l=@(Listeners 8802)
   if($l.Count -ne 1 -or $l[0].LocalAddress -cne '127.0.0.1' -or
    [int]$l[0].OwningProcess -ne [int]$recovery.Id){continue}
   $check=GetJson '/api/fun/hub/status'
   if($check.version -ceq 'fi-ml-hub-v3' -and
    $check.machineLearning.state -ceq 'ready'){$recovered=$true;break}
  }catch{}
 }
 if(!$recovered){Hold ('PINNED_ORIGINAL_8802_RECOVERY_FAILED_LOGS='+$Log)}
 CheckProtected
 Write-Host ('FIAL58_PINNED_ORIGINAL_8802_RESTORED=PASS PID='+$recovery.Id)
}elseif($initial.Count -ne 1 -or $initial[0].LocalAddress -cne '127.0.0.1'){
 Hold '8802_UNEXPECTED_OWNER_OR_NON_LOOPBACK_LISTENER'
}
$oldStatus=GetJson '/api/fun/hub/status'
$oldCommerce=GetJson '/api/commerce/status'
$OldCommerceShopifyConfigured=$oldCommerce.shopify.configured -eq $true
if($oldStatus.version -cne 'fi-ml-hub-v3' -or $oldStatus.machineLearning.state -cne 'ready'){
 Hold 'OLD_PRIMARY_DASHBOARD_UNVERIFIED'
}
$proc=Owner 8802
$command=[string]$proc.CommandLine
$runningNew=$command.IndexOf($Runner,[StringComparison]::OrdinalIgnoreCase) -ge 0
$runningOld=$command.IndexOf($OldRunner,[StringComparison]::OrdinalIgnoreCase) -ge 0
if(!$runningOld -and !$runningNew){Hold '8802_PROCESS_OWNER_UNKNOWN_NO_RESTART'}
$OriginalPid=[int]$proc.ProcessId
Write-Host ('FIAL58_ORIGINAL_8802_OWNER='+$OriginalPid+' SOURCE='+$(if($runningOld){'REVIEWED_OLD'}else{'EXISTING_FIAL53'}))
New-Item -ItemType Directory -Path $Log -Force | Out-Null
try{
 if($runningOld){
  Write-Host 'FIAL58_STARTING_CONTROLLED_8802_HANDOFF=TRUE'
  Stop-Process -Id $OriginalPid -ErrorAction Stop
  $OldStopped=$true
  for($i=0;$i -lt 80;$i++){
   if(@(Listeners 8802).Count -eq 0){break}
   Start-Sleep -Milliseconds 250
  }
  if(@(Listeners 8802).Count -gt 0){Hold 'OLD_8802_DID_NOT_RELEASE_PORT'}
  $NewChild=StartNode $Runner $Root 'new-8802'
  $ready=$false
  $lastReadyError='No 8802 readiness response observed'
  for($i=0;$i -lt 100;$i++){
   Start-Sleep -Milliseconds 250
   try{
    $listener=@(Listeners 8802)
    if($listener.Count -ne 1 -or [int]$listener[0].OwningProcess -ne [int]$NewChild.Id){
     $lastReadyError='NEW_8802_LISTENER_NOT_OWNED_BY_EXPECTED_PID'
     continue
    }
    ReadyNew $NewChild.Id
    $ready=$true;break
   }catch{
    $lastReadyError=[string]$_.Exception.Message
   }
  }
  if(!$ready){
   Write-Warning ('FIAL58_LAST_READINESS_ERROR='+$lastReadyError)
   $newErr=Join-Path $Log 'new-8802.stderr.log'
   if(Test-Path -LiteralPath $newErr -PathType Leaf){
    $lastLogs=@(Get-Content -LiteralPath $newErr -Tail 8 -ErrorAction SilentlyContinue)
    foreach($line in $lastLogs){Write-Warning ('FIAL58_NEW_8802_STDERR='+[string]$line)}
   }
   Hold ('UPGRADED_8802_NOT_READY_LAST_ERROR='+$lastReadyError)
  }
  Write-Host ('FIAL58_UPGRADED_PRIMARY_8802_PID='+$NewChild.Id)
 }else{
  ReadyNew $OriginalPid
  Write-Host ('FIAL58_EXISTING_PRIMARY_8802_ADOPTED_PID='+$OriginalPid)
 }
 CheckProtected
 if($VerifyLive){
  $payload=@{question='What approval is required before external tool execution at Fun Industrial?'}|ConvertTo-Json -Compress
  $result=Invoke-RestMethod ($Url+'/api/fial/grounded/chat') -Method POST -ContentType 'application/json' -Headers @{Origin=$Url;'x-fi-chat-click'='one-local-model-response'} -Body $payload -TimeoutSec 365 -ErrorAction Stop
  Write-Host ('FIAL58_LIVE_STATE='+$result.state)
  Write-Host ('FIAL58_MEMORY_STATE='+$result.memory_state+' EXCERPTS='+$result.memory_excerpts_included)
  Write-Host ('FIAL58_QWEN_ANSWER='+$result.answer)
  if($result.state -cne 'ANSWERED_BY_QWEN' -or
   $result.memory_state -cne 'included' -or [int]$result.memory_excerpts_included -lt 1 -or
   $result.source -cne 'qwen_local' -or $result.tool_executions -ne 0 -or
   $result.rea_executions -ne 0 -or
   [string]$result.answer -notmatch 'operator approval'){
    Hold 'LIVE_PRIMARY_GROUNDED_QWEN_NOT_QUALIFIED_NO_AUTOMATIC_RETRY'
  }
  Write-Host 'FIAL58_PRIMARY_CHAT_LIVE_QUALITY=PASS'
 }else{Write-Host 'FIAL58_PRIMARY_CHAT_LIVE_QUALITY=NOT_TESTED'}
 CheckProtected
 Write-Host 'FIAL58_PRIMARY_DASHBOARD_CONSOLIDATION=PASS'
 Write-Host 'FIAL59_FLEET_PRIMARY_DASHBOARD=PASS'
 Write-Host 'FIAL510_PROCUREMENT_PRIMARY_DASHBOARD=PASS'
 Write-Host 'FIAL511_COMMERCIAL_FIT_PRIMARY_DASHBOARD=PASS'
 Write-Host 'FIAL512_BID_READINESS_PRIMARY_DASHBOARD=PASS'
 Write-Host 'FIAL513_BUYER_PRIMARY_DASHBOARD=PASS'
 Write-Host 'FIAL514_DEMAND_PRIMARY_DASHBOARD=PASS'
 Write-Host ('FIAL58_PRIMARY_DASHBOARD='+$Url+'/unified/?view=chat')
 Write-Host 'FIAL58_TOOLS_AND_REA_APPROVAL_UI=PRESERVED'
 Write-Host 'FIAL58_OTHER_SERVICES_RESTARTED=0 ELEKTRON=UNTOUCHED'
 Write-Host ('FIAL58_DEPLOYMENT_LOGS='+$Log)
}catch{
 $why=$_.Exception.Message
 if($OldStopped){
  Write-Warning ('FIAL58_NEW_DASHBOARD_HOLD='+$why+' ROLLBACK_OLD_8802_REQUESTED')
  if($NewChild){
   $newP=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$NewChild.Id) -ErrorAction SilentlyContinue
   if($newP -and $newP.Name -ceq 'node.exe' -and
    [string]$newP.CommandLine -match [regex]::Escape($Runner)){
    Stop-Process -Id $NewChild.Id -ErrorAction SilentlyContinue
   }
  }
  $released=$false
  for($i=0;$i -lt 80;$i++){
   if(@(Listeners 8802).Count -eq 0){$released=$true;break}
   Start-Sleep -Milliseconds 250
  }
  if(!$released){Hold ('ROLLBACK_8802_PORT_OCCUPIED='+$why)}
  try{
   $restore=StartNode $OldRunner $OldRoot 'rollback-8802'
   $restored=$false
   for($i=0;$i -lt 100;$i++){
    Start-Sleep -Milliseconds 250
    try{
     $l=@(Listeners 8802)
     if($l.Count -ne 1 -or [int]$l[0].OwningProcess -ne [int]$restore.Id){continue}
     $old=GetJson '/api/fun/hub/status'
     if($old.version -ceq 'fi-ml-hub-v3' -and $old.machineLearning.state -ceq 'ready'){
      $restored=$true;break
     }
    }catch{}
   }
   if(!$restored){Hold ('ROLLBACK_OLD_DASHBOARD_NOT_CONFIRMED='+$why)}
   Write-Warning ('FIAL58_ROLLBACK_OLD_PRIMARY_DASHBOARD=PASS PID='+$restore.Id)
  }catch{Hold ('ROLLBACK_FAILED_MANUAL_REVIEW='+$_.Exception.Message+' ORIGINAL='+$why)}
 }
 throw ('FIAL58_PRIMARY_DEPLOYMENT_HOLD='+$why)
}
