# FUN_INDUSTRIAL_COLD_RECOVERY_V1 — one operator-initiated Windows recovery after SSH/phone disconnect.
# Starts only missing fixed Fun Industrial services; never edits user data or invokes REA actions.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=$PSScriptRoot
$Branch='feature/fun-ml-unified-dashboard-v3-20261113'
$Main=Join-Path $Root 'Start-Fun-ML-Dashboard-V3.ps1'
$Commerce=Join-Path $Root 'Activate-Fun-Commerce-V1.ps1'
$Gateway=Join-Path $Root 'Start-Fun-Private-Gateway-V43.ps1'
function Hold([string]$reason){throw ('FUN_COLD_RECOVERY_HOLD='+$reason)}
function Ready([int]$port,[string]$path){
 return Invoke-RestMethod -Uri ('http://127.0.0.1:'+$port+$path) -TimeoutSec 12 -ErrorAction Stop
}
if((git.exe -C $Root branch --show-current) -cne $Branch -or $LASTEXITCODE -ne 0){Hold 'BRANCH_IDENTITY_INVALID'}
if(@(git.exe -C $Root status --porcelain=v1 --untracked-files=all).Count -gt 0 -or $LASTEXITCODE -ne 0){Hold 'LOCAL_CHANGES_REVIEW_REQUIRED'}
foreach($file in @($Main,$Commerce,$Gateway)){
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){Hold ('MISSING_SCRIPT='+$file)}
 if((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint){Hold ('SYMLINK_REFUSED='+$file)}
 $tokens=$null;$parseErrors=$null
 [void][System.Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$parseErrors)
 if($null -ne $parseErrors -and @($parseErrors).Count -gt 0){Hold ('SCRIPT_SYNTAX_INVALID='+$file)}
}
Write-Host 'FUN_COLD_RECOVERY=START ORDER=CORE_THEN_ML_THEN_COMMERCE_THEN_GATEWAY'
# This guarded existing launcher:
# - validates source and fixed port owners
# - starts missing 8088/8791, then 8789, 8796, 8797, 8798, then 8801 and 8802
# - preserves unrelated running services and never executes an MCP tool.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Main
if($LASTEXITCODE -ne 0){Hold 'CORE_OR_ML_STARTUP_FAILED_NO_UNSAFE_RETRY'}
Write-Host 'FUN_COLD_RECOVERY_CORE_AND_ML=PASS'
# This existing Commerce V1.1 activator will adopt already-running current code
# or replace only the verified 8802 hub after tests and guarded fallback checks.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Commerce
if($LASTEXITCODE -ne 0){Hold 'COMMERCE_V1_1_STARTUP_FAILED_NO_UNSAFE_RETRY'}
Write-Host 'FUN_COLD_RECOVERY_COMMERCE_V1_1=PASS'
# The private iPhone HTTPS gateway is separate, already peer/pin protected.
# Never bypasses NetBird/peer/certificate validation; may request a secure password
# if it has no enrolled DPAPI credential.
$gateway='HOLD'
try{
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Gateway
 if($LASTEXITCODE -eq 0){$gateway='PASS'}else{Write-Warning ('PRIVATE_GATEWAY_HOLD_EXIT='+$LASTEXITCODE)}
}catch{
 Write-Warning ('PRIVATE_GATEWAY_HOLD='+[string]$_.Exception.Message)
}
Write-Host ('FUN_COLD_RECOVERY_PRIVATE_HTTPS='+$gateway)
# Final live checks: GET only; no ML compute, model prompt, training, purchases or tool executions.
try{
 $q=Ready 8088 '/health'
 $compute=Ready 8791 '/health'
 $original=Ready 8789 '/api/ai/tools'
 $local=Ready 8796 '/api/ai/auto-local/status'
 $rea=Ready 8797 '/api/rea229/status'
 $unified=Ready 8798 '/api/unified/status'
 $ml=Ready 8801 '/api/ml/status'
 $hub=Ready 8802 '/api/fun/hub/status'
 $commerce=Ready 8802 '/api/commerce/opportunities'
 if($q.status -cne 'ok' -or $compute.state -cne 'running' -or
  [int]$original.local_tool_count -ne 19 -or
  $local.sidecar -ne $true -or $local.reaExecutionGrants -ne 0 -or
  $rea.liveMcpHealth -cne 'ready' -or [int]$rea.realReaToolCount -ne 229 -or
  $unified.state -cne 'ready' -or $unified.local.ready -ne $true -or $unified.rea.ready -ne $true -or
  $ml.version -cne 'fun-qwen-scikit-v2' -or $ml.pythonInstalled -ne $true -or
  $hub.version -cne 'fi-ml-hub-v3' -or $hub.machineLearning.state -cne 'ready' -or
  $commerce.version -cne 'fun-commerce-opportunities-v1.1' -or
  $commerce.order_authority -ne $false -or
  $commerce.qualifies_as_verified_sales_opportunity -ne $false){Hold 'LIVE_SERVICE_CONTRACT_MISMATCH'}
}catch{Hold ('LIVE_SERVICE_VERIFICATION='+[string]$_.Exception.Message)}
Write-Host 'FUN_COLD_RECOVERY=PASS'
Write-Host 'FUN_SERVICES_8088_8791_8789_8796_8797_8798_8801_8802=HEALTHY'
Write-Host 'FUN_COMMERCE_OPPORTUNITIES_V1_1=READY'
Write-Host 'FUN_CONTROL_CENTER=http://127.0.0.1:8802/'
Write-Host 'FUN_UNIFIED_CHAT=http://127.0.0.1:8802/unified/'
Write-Host ('FUN_PRIVATE_IPHONE_8443='+$gateway)
Write-Host 'FUN_OLLAMA_ELEKTRON=NOT_TOUCHED'
Write-Host 'FUN_REA_ACTIONS=0 FUN_SHOPIFY_MUTATIONS=0 FUN_MODEL_TRAINING=0'
