# Start ONLY Fun Industrial's private HTTPS gateway on the existing NetBird IP.
# Does NOT restart dashboard, compute, llama.cpp, Cognee, REA, VPN or Ollama.
# Credentials are entered interactively, inherited by one child process only,
# then removed from the calling PowerShell environment. Never stored in .env.
[CmdletBinding()]param([switch]$UseStoredCredential)
$ErrorActionPreference="Stop"
$HomeDir=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceGateway"
$CfgPath=Join-Path $HomeDir "private-gateway.json"
$Config=if(Test-Path -LiteralPath $CfgPath){Get-Content -LiteralPath $CfgPath -Raw|ConvertFrom-Json}else{throw "FI_GATEWAY_NOT_PREPARED"}
if($Config.schema -ne "fun.voice.gateway.private.v1"){throw "FI_GATEWAY_CONFIG_SCHEMA_HOLD"}
if($Config.pcIp -ne "100.109.4.20" -or $Config.port -ne 8443 -or
 $Config.publicHost -ne "100.109.4.20:8443"){throw "FI_GATEWAY_PRIVATE_BIND_HOLD"}
if($Config.iphonePeerIp -notmatch '^100\.\d+\.\d+\.\d+$' -or
 $Config.iphonePeerIp -eq $Config.pcIp){throw "FI_GATEWAY_PEER_ADDRESS_HOLD"}
$SourceGateway=Join-Path $PSScriptRoot "src\gateway.mjs"
$GatewayModule=Join-Path $HomeDir "gateway.mjs"
$SourceEntry=Join-Path $PSScriptRoot "src\voice\private-gateway-entry.mjs"
$SourceSelftest=Join-Path $PSScriptRoot "src\voice\private-gateway-selftest.mjs"
$Entry=Join-Path $HomeDir "gateway-entry.mjs"
$Selftest=Join-Path $HomeDir "gateway-selftest.mjs"
$Node=(Get-Command node.exe -ErrorAction Stop).Source
$OpenSSL=Get-Command openssl.exe -ErrorAction SilentlyContinue
if(-not $OpenSSL){
 $p="C:\Program Files\Git\usr\bin\openssl.exe"
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){throw "FI_GATEWAY_OPENSSL_MISSING"}
 $OpenSSL=Get-Item $p
}
$SSL=if($OpenSSL.Source){$OpenSSL.Source}else{$OpenSSL.FullName}
$required=@($Config.source,$Config.caPublicPem,$Config.caPublicCer,$Config.tlsCertificate,
 $Config.tlsPrivateKey,$SourceGateway,$SourceEntry,$SourceSelftest)
foreach($f in $required){if(-not(Test-Path -LiteralPath $f -PathType Leaf)){throw "FI_GATEWAY_MISSING_FILE=$f"}}
$listen=@(Get-NetTCPConnection -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
if($listen.Count){throw "FI_GATEWAY_PORT_8443_ALREADY_IN_USE"}
$NB=Get-Command netbird.exe -ErrorAction SilentlyContinue
if(-not $NB){$candidate="C:\Program Files\NetBird\netbird.exe";if(Test-Path $candidate){$NB=Get-Item $candidate}}
if(-not $NB){throw "FI_GATEWAY_NETBIRD_NOT_FOUND"}
$nbExe=if($NB.Source){$NB.Source}else{$NB.FullName}
$NBHost=((& $nbExe status --ipv4 2>$null|Out-String).Trim())
if($NBHost -ne $Config.pcIp){throw "FI_GATEWAY_NETBIRD_HOST_IP_CHANGED"}
if(-not(Get-NetIPAddress -IPAddress $Config.pcIp -AddressFamily IPv4 -ErrorAction SilentlyContinue)){throw "FI_GATEWAY_BIND_IP_NOT_ASSIGNED"}
$peerRows=@(((& $nbExe status --table --filter-by-status connected 2>$null|Out-String) -split "\r?\n")|
 Where-Object{$_ -match ('^\s*\S+\s+'+[regex]::Escape($Config.iphonePeerIp)+'\s+Connected\b')})
if($peerRows.Count -ne 1){throw "FI_GATEWAY_AUTHORIZED_IPHONE_PEER_NOT_CONNECTED"}
$chain=((& $SSL verify -CAfile $Config.caPublicPem $Config.tlsCertificate 2>&1)|Out-String)
if($LASTEXITCODE -ne 0 -or $chain -notmatch '\bOK\b'){throw "FI_GATEWAY_TLS_CHAIN_HOLD"}
$callerOld=@{}
$vars=@("FI_GATEWAY_BIND_IP","FI_GATEWAY_ALLOWED_CLIENT_IPS","FI_GATEWAY_PORT",
 "FI_GATEWAY_PUBLIC_HOST","FI_GATEWAY_TLS_CERT","FI_GATEWAY_TLS_KEY",
 "FI_GATEWAY_USERNAME","FI_GATEWAY_PASSWORD","FI_GATEWAY_LOCAL_CA_PUBLIC_PEM","PORT")
foreach($k in $vars){$callerOld[$k]=[Environment]::GetEnvironmentVariable($k,"Process")}
$start=$null;$password=$null;$secure=$null
try{
 if($UseStoredCredential){
  $secretFile=Join-Path $HomeDir "autostart\gateway-password.dpapi"
  $policyFile=Join-Path $HomeDir "autostart\supervisor-policy.json"
  if(-not(Test-Path -LiteralPath $secretFile -PathType Leaf) -or
     -not(Test-Path -LiteralPath $policyFile -PathType Leaf)){throw "FI_GATEWAY_STORED_CREDENTIAL_NOT_CONFIGURED"}
  $policy=Get-Content -LiteralPath $policyFile -Raw -ErrorAction Stop|ConvertFrom-Json
  $currentSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  if($policy.schema -ne "fun.voice.gateway.autostart.v1" -or
     $policy.sid -ne $currentSid -or
     $policy.pcIp -ne $Config.pcIp -or
     $policy.iphonePeerIp -ne $Config.iphonePeerIp -or
     $policy.gatewayPort -ne [int]$Config.port){throw "FI_GATEWAY_AUTOSTART_POLICY_HOLD"}
  $secretLine=(Get-Content -LiteralPath $secretFile -Raw -ErrorAction Stop).Trim()
  if(-not $secretLine -or $secretLine -notmatch '^[a-fA-F0-9]+$'){throw "FI_GATEWAY_ENCRYPTED_CREDENTIAL_FORMAT_HOLD"}
  $secure=ConvertTo-SecureString -String $secretLine -ErrorAction Stop
 }else{
  $secure=Read-Host "Enter a NEW private iPhone gateway password (24+ characters, not your Gmail password)" -AsSecureString
 }
 if(-not $secure){throw "FI_GATEWAY_PASSWORD_REQUIRED"}
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try{$password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
 finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
 if($password.Length -lt 24 -or $password.Length -gt 200 -or
 $password.Contains([char]10) -or $password.Contains([char]13)){
  throw "FI_GATEWAY_PASSWORD_LENGTH_OR_FORMAT_HOLD"
 }
 $env:FI_GATEWAY_BIND_IP=$Config.pcIp
 $env:FI_GATEWAY_ALLOWED_CLIENT_IPS=$Config.iphonePeerIp
 $env:FI_GATEWAY_PORT=[string]$Config.port
 $env:FI_GATEWAY_PUBLIC_HOST=$Config.publicHost
 $env:FI_GATEWAY_TLS_CERT=$Config.tlsCertificate
 $env:FI_GATEWAY_TLS_KEY=$Config.tlsPrivateKey
 $env:FI_GATEWAY_USERNAME="fiiphone"
 $env:FI_GATEWAY_PASSWORD=$password
 $env:FI_GATEWAY_LOCAL_CA_PUBLIC_PEM=$Config.caPublicPem
 $env:PORT="8789"
 # Source entry lives in src/voice and imports ../gateway.mjs; installed
 # runtime entry lives beside gateway.mjs in VoiceGateway. Keep the module
 # inside the private gateway directory and rewrite only that exact import.
 $entryText=[IO.File]::ReadAllText($SourceEntry)
 $oldImport='from "../gateway.mjs"'
 if(-not $entryText.Contains($oldImport) -or
    $entryText.IndexOf($oldImport,[StringComparison]::Ordinal) -ne
    $entryText.LastIndexOf($oldImport,[StringComparison]::Ordinal)){
  throw "FI_GATEWAY_ENTRY_IMPORT_ANCHOR_HOLD"
 }
 $entryText=$entryText.Replace($oldImport,'from "./gateway.mjs"')
 Copy-Item -LiteralPath $SourceGateway -Destination $GatewayModule -Force
 [IO.File]::WriteAllText($Entry,$entryText,[Text.UTF8Encoding]::new($false))
 Copy-Item -LiteralPath $SourceSelftest -Destination $Selftest -Force
 & $Node --check $GatewayModule
 if($LASTEXITCODE -ne 0){throw "FI_GATEWAY_MODULE_SYNTAX_HOLD"}
 & $Node --check $Entry
 if($LASTEXITCODE -ne 0){throw "FI_GATEWAY_NODE_ENTRY_SYNTAX_HOLD"}
 & $Node --check $Selftest
 if($LASTEXITCODE -ne 0){throw "FI_GATEWAY_NODE_SELFTEST_SYNTAX_HOLD"}
 $out=Join-Path $HomeDir "gateway.stdout.log"
 $err=Join-Path $HomeDir "gateway.stderr.log"
 $start=Start-Process -FilePath $Node -ArgumentList "gateway-entry.mjs" -WorkingDirectory $HomeDir -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
 $ready=$false
 for($i=0;$i -lt 40;$i++){
  Start-Sleep -Milliseconds 300
  $start.Refresh()
  if($start.HasExited){break}
  $l=@(Get-NetTCPConnection -LocalAddress $Config.pcIp -LocalPort 8443 -State Listen -ErrorAction SilentlyContinue)
  if($l.Count -eq 1 -and [int]$l[0].OwningProcess -eq $start.Id){$ready=$true;break}
 }
 if(-not $ready){throw "FI_GATEWAY_LISTENER_STARTUP_HOLD"}
 & $Node $Selftest
 if($LASTEXITCODE -ne 0){throw "FI_GATEWAY_TLS_SELFTEST_HOLD"}
 Write-Host "FI_IPHONE_GATEWAY_START=PASS PID=$($start.Id) BIND=$($Config.pcIp):8443 PEER=$($Config.iphonePeerIp)"
 Write-Host ("FI_IPHONE_GATEWAY_USERNAME=fiiphone PASSWORD="+$(if($UseStoredCredential){"DPAPI_PROTECTED_AT_REST"}else{"OPERATOR_HELD_NOT_SAVED"}))
 Write-Host ("FI_IPHONE_SAFARI_URL=https://"+$Config.publicHost)
 Write-Host "FI_IPHONE_GATEWAY_FIREWALL_AND_NETBIRD_POLICIES=NOT_CHANGED"
 Write-Host "FI_IPHONE_GATEWAY_TRUST_ON_PHONE=REQUIRES_SAFARI_VERIFICATION"
 Write-Host "FI_IPHONE_OTHER_SERVICES=NOT_RESTARTED"
}catch{
 if($start){
  try{$start.Refresh();if(-not $start.HasExited){Stop-Process -Id $start.Id -Force -ErrorAction SilentlyContinue}}catch{}
 }
 throw
}finally{
 foreach($k in $vars){
  if($null -eq $callerOld[$k]){Remove-Item ("Env:"+$k) -ErrorAction SilentlyContinue}
  else{[Environment]::SetEnvironmentVariable($k,$callerOld[$k],"Process")}
 }
 $password=$null;$secure=$null
}
