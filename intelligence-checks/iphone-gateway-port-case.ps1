# Synthetic read-only Windows regression for exact-IP private HTTPS gateway
# listener classification. Does not bind sockets or modify real services.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
. (Join-Path $PSScriptRoot "..\src\voice\gateway-port-state.ps1")
function Check([string]$name,[object[]]$snapshot,[string]$expect,[int]$pidExpected){
 $state=Get-FunPrivateGatewayPortState -Listeners $snapshot -ExpectedIp "100.109.4.20"
 if($state.State -ne $expect -or [int]$state.ListenerProcessId -ne $pidExpected){
  throw "FI_GATEWAY_PORT_CASE_FAIL=$name ACTUAL=$($state.State) PID=$($state.ListenerProcessId)"
 }
 Write-Host "FI_GATEWAY_PORT_CASE=PASS CASE=$name STATE=$expect"
}
$valid=[pscustomobject]@{LocalAddress="100.109.4.20";LocalPort=8443;OwningProcess=21988;State="Listen"}
$other=[pscustomobject]@{LocalAddress="0.0.0.0";LocalPort=8443;OwningProcess=4444;State="Listen"}
$otherIp=[pscustomobject]@{LocalAddress="127.0.0.1";LocalPort=8443;OwningProcess=3333;State="Listen"}
$wrongPort=[pscustomobject]@{LocalAddress="100.109.4.20";LocalPort=8789;OwningProcess=2222;State="Listen"}
Check "none" @() "stopped" 0
Check "existing_exact_one" @($valid) "existing" 21988
Check "wrong_ip" @($otherIp) "conflict" 0
Check "wildcard" @($other) "conflict" 0
Check "wrong_port" @($wrongPort) "conflict" 0
Check "two_listeners" @($valid,$other) "conflict" 0
Check "duplicate_same_ip" @($valid,$valid) "conflict" 0
Check "missing_process_owner" @([pscustomobject]@{LocalAddress="100.109.4.20";LocalPort=8443;OwningProcess=0;State="Listen"}) "conflict" 0
Write-Host "FI_GATEWAY_PORT_CLASSIFIER=PASS TESTS=8 REAL_SERVICES_UNCHANGED=TRUE"
