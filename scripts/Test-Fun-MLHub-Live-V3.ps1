# FI_ML_HUB_V3_REAL_MACHINE_TEST: live loopback, actual scikit-learn + Qwen.
# No service starts/stops, no model training, no data persistence.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=$PSScriptRoot
$root=Split-Path -Parent $root
if((git.exe -C $root branch --show-current) -cne 'feature/fun-ml-unified-dashboard-v3-20261113' -or $LASTEXITCODE -ne 0){throw 'ML_TEST_SOURCE_BRANCH_HOLD'}
if(@(git.exe -C $root status --porcelain=v1 --untracked-files=all).Count){throw 'ML_TEST_SOURCE_DIRTY_HOLD'}
function Snap([int]$port){
 return (@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {"$($_.LocalAddress):$($_.OwningProcess)"} | Sort-Object) -join ';')
}
$ports=@(8789,8796,8797,8798,8801,8802,8088,8791,11434,8443)
$before=@{}
foreach($port in $ports){$before[$port]=Snap $port}
$hub=Invoke-RestMethod -Uri 'http://127.0.0.1:8802/api/fun/hub/status' -TimeoutSec 10
if($hub.version -cne 'fi-ml-hub-v3' -or $hub.machineLearning.state -cne 'ready'){throw 'ML_HUB_IDENTITY_OR_READINESS_HOLD'}
$mainPage=Invoke-WebRequest -Uri 'http://127.0.0.1:8802/' -UseBasicParsing -TimeoutSec 15
$chatPage=Invoke-WebRequest -Uri 'http://127.0.0.1:8802/unified/' -UseBasicParsing -TimeoutSec 15
if($mainPage.StatusCode -ne 200 -or $mainPage.Content -notmatch 'fi-ml-panel' -or $chatPage.StatusCode -ne 200 -or $chatPage.Content -notmatch 'fi-ml-panel'){throw 'ML_DASHBOARD_RENDER_HOLD'}
$unified=Invoke-RestMethod -Uri 'http://127.0.0.1:8798/api/unified/status' -TimeoutSec 12
if($unified.version -cne 'fi-unified-task-chat-8798-v1' -or $unified.state -cne 'ready'){throw 'UNIFIED_QWEN_NOT_READY'}
$modelFile=Join-Path $env:LOCALAPPDATA 'FunIndustrial\MLScikitLearnV1\sales_model_v1.json'
$modelBefore=$null
if(Test-Path -LiteralPath $modelFile){$modelBefore=(Get-FileHash -LiteralPath $modelFile -Algorithm SHA256).Hash}
$deals=@(
 @{id='fixtureA';cost=12; sale_price=30;shipping=2;fees=3;return_allowance=1},
 @{id='fixtureB';cost=15; sale_price=40;shipping=3;fees=4;return_allowance=2},
 @{id='fixtureC';cost=23; sale_price=42;shipping=4;fees=3;return_allowance=1},
 @{id='fixtureD';cost=18; sale_price=65;shipping=6;fees=5;return_allowance=2},
 @{id='fixtureE';cost=12; sale_price=22;shipping=2;fees=2;return_allowance=1},
 @{id='fixtureF';cost=44; sale_price=51;shipping=3;fees=4;return_allowance=1},
 @{id='fixtureG';cost=8;  sale_price=30;shipping=2;fees=3;return_allowance=1},
 @{id='fixtureH';cost=25; sale_price=59;shipping=4;fees=5;return_allowance=2}
)
$request=@{
 prompt='Analyze these eight synthetic deals, rank estimated profit and identify unusual price patterns'
 data=@{deals=$deals}
 operatorConfirmed=$false
}
$body=$request|ConvertTo-Json -Depth 9 -Compress
Write-Host 'LIVE_ML_TEST=START SYNTHETIC_DEALS=8 TRAINING_APPROVAL=FALSE'
try{
 $result=Invoke-RestMethod -Method POST -Uri 'http://127.0.0.1:8802/api/ml/dashboard/run' -ContentType 'application/json' -Headers @{Origin='http://127.0.0.1:8802';'x-fi-ml'='operator-click'} -Body $body -TimeoutSec 110
}catch{
 $errorBody=if($_.ErrorDetails.Message){$_.ErrorDetails.Message}else{$_.Exception.Message}
 throw ('LIVE_ML_HTTP_HOLD='+[string]$errorBody)
}
if($result.state -cne 'completed' -or $result.route -cne 'automatic_verified_ml' -or $result.command -cne 'analyze_deals' -or
 $result.externalActions -ne 0 -or $result.verifiedML.ok -ne $true -or $result.verifiedML.kind -cne 'deal_analysis' -or
 $result.verifiedML.engine -cne 'scikit-learn' -or $result.verifiedML.external_actions -ne 0 -or
 [int]$result.verifiedML.count -ne 8){throw 'LIVE_ML_RESULT_IDENTITY_OR_ATTESTATION_HOLD'}
$rows=@($result.verifiedML.results)
if($rows.Count -ne 8){throw 'LIVE_ML_RESULT_COUNT_HOLD'}
$expected=@{}
foreach($deal in $deals){$expected[$deal.id]=[math]::Round([double]($deal.sale_price-$deal.cost-$deal.shipping-$deal.fees-$deal.return_allowance),2)}
foreach($row in $rows){
 if(!$expected.ContainsKey($row.id) -or [math]::Abs([double]$row.estimated_profit-$expected[$row.id]) -gt 0.001 -or
  $row.unusual_pattern -isnot [bool] -or $null -eq $row.outlier_score){throw ('LIVE_ML_PROFIT_OR_ANOMALY_HOLD='+[string]$row.id)}
}
$ordered=@($rows|Sort-Object -Property @{Expression='estimated_profit';Descending=$true},@{Expression='id';Descending=$false})
if((@($ordered|ForEach-Object {$_.id}) -join ',') -cne (@($rows|ForEach-Object {$_.id}) -join ',')){throw 'LIVE_ML_RANKING_HOLD'}
$modelAfter=$null
if(Test-Path -LiteralPath $modelFile){$modelAfter=(Get-FileHash -LiteralPath $modelFile -Algorithm SHA256).Hash}
if($modelBefore -cne $modelAfter){throw 'SALES_MODEL_FILE_CHANGED_HOLD'}
if($result.modelState -cne 'ready' -or [string]::IsNullOrWhiteSpace([string]$result.explanation)){throw 'QWEN_EXPLANATION_NOT_READY_ML_RESULT_VALID'}
foreach($port in $ports){if((Snap $port) -cne $before[$port]){throw ('SERVICE_LISTENER_CHANGED_PORT_'+$port)}}
Write-Host 'INTEGRATED_PAGES_RENDER=PASS'
Write-Host 'LIVE_SCIKIT_LEARN_ISOLATION_FOREST=PASS'
Write-Host 'ESTIMATED_PROFIT_VERIFIED=8/8'
Write-Host ('ANOMALIES_FLAGGED='+@($rows|Where-Object {$_.unusual_pattern -eq $true}).Count)
Write-Host ('SCIKIT_LEARN_VERSION='+[string]$result.verifiedML.version)
Write-Host 'QWEN_LIVE_EXPLANATION=PASS'
Write-Host 'TRAINING_AND_MODEL_FILE_WRITES=0'
Write-Host 'REA_ACTIONS=0'
Write-Host 'PROTECTED_LISTENERS_UNCHANGED=TRUE'
Write-Host 'FUN_ML_REAL_MACHINE_TEST=PASS'
$rows|Select-Object id,estimated_profit,unusual_pattern,outlier_score|Format-Table -AutoSize
Write-Host ('QWEN_SUMMARY='+([string]$result.explanation).Substring(0,[math]::Min(1800,([string]$result.explanation).Length)))
