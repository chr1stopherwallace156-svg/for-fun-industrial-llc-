# Read-only NetBird / HTTPS readiness diagnostic for Fun Industrial iPhone Safari.
# Never prints passwords, private keys, public keys or OAuth tokens.
# Does not change VPN, Windows Firewall, certificates, routes or running services.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$root=Join-Path $env:USERPROFILE "FunIndustrial-REA-MCP-Activation"
$envFile=Join-Path $root ".env"
$values=@{}
if(Test-Path -LiteralPath $envFile){
 foreach($line in Get-Content -LiteralPath $envFile){
  if($line -match '^\s*(FI_GATEWAY_PUBLIC_HOST|FI_GATEWAY_PORT|FI_GATEWAY_BIND_IP|FI_GATEWAY_ALLOWED_CLIENT_IPS|FI_GATEWAY_TLS_CERT|FI_GATEWAY_TLS_KEY)\s*=\s*(.*?)\s*$'){
   $values[$Matches[1]]=$Matches[2].Trim().Trim('"',"'")
  }
 }
}
function Listening([int]$port){
 @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue|Where-Object {$_.LocalAddress -eq "127.0.0.1" -or $port -eq 8443})
}
function Endpoint([string]$url){
 try{
  $r=Invoke-RestMethod -Uri $url -TimeoutSec 8 -ErrorAction Stop
  return $r
 }catch{return $null}
}
$dash=@(Listening 8789)
Write-Host "FUN_DASHBOARD_8789=$(if($dash.Count){'LISTENING_LOOPBACK'}else{'NOT_LISTENING'})"
$voice=Endpoint "http://127.0.0.1:8789/api/voice/mobile/status"
Write-Host "FUN_VOICE_UPLOAD=$(if($voice -and $voice.enabled -eq $true){'ENABLED'}else{'NOT_CONFIRMED'})"
$netbird=Get-Command netbird.exe -ErrorAction SilentlyContinue
if(-not $netbird){
 $candidate="C:\Program Files\NetBird\netbird.exe"
 if(Test-Path -LiteralPath $candidate -PathType Leaf){$netbird=Get-Item $candidate}
}
if($netbird){
 $binary=if($netbird.Source){$netbird.Source}else{$netbird.FullName}
 $nb4=""
 try{$nb4=((& $binary status --ipv4 2>$null|Out-String).Trim())}catch{}
 if($nb4 -match '^(\d{1,3}\.){3}\d{1,3}$'){
  Write-Host "NETBIRD_WINDOWS_IPV4=$nb4"
 }else{Write-Host "NETBIRD_WINDOWS_IPV4=UNAVAILABLE"}
 try{
  $table=((& $binary status --table 2>$null|Out-String).Trim())
  if($table -match 'Peers\s*\((\d+/\d+)\s+connected\)'){
   Write-Host "NETBIRD_PEERS_CONNECTED=$($Matches[1])"
  }elseif($table -match '(?im)Peers count:\s*(\d+/\d+)'){
   Write-Host "NETBIRD_PEERS_CONNECTED=$($Matches[1])"
  }else{Write-Host "NETBIRD_PEERS_CONNECTED=UNCONFIRMED"}
 }catch{Write-Host "NETBIRD_PEERS_CONNECTED=UNCONFIRMED"}
}else{
 Write-Host "NETBIRD_CLI=NOT_FOUND"
}
$t=Get-Command tailscale.exe -ErrorAction SilentlyContinue
Write-Host "TAILSCALE_CLI=$(if($t){'INSTALLED_NOT_CONFIRMED'}else{'NOT_FOUND'})"
Write-Host "HTTPS_GATEWAY_HOST_CONFIGURED=$([bool]$values['FI_GATEWAY_PUBLIC_HOST'])"
Write-Host "HTTPS_GATEWAY_BIND_CONFIGURED=$([bool]$values['FI_GATEWAY_BIND_IP'])"
Write-Host "HTTPS_GATEWAY_PEER_ALLOWLIST_CONFIGURED=$([bool]$values['FI_GATEWAY_ALLOWED_CLIENT_IPS'])"
Write-Host "HTTPS_CERT_FILE_CONFIGURED_AND_PRESENT=$([bool]($values['FI_GATEWAY_TLS_CERT'] -and (Test-Path -LiteralPath $values['FI_GATEWAY_TLS_CERT'] -PathType Leaf)))"
Write-Host "HTTPS_KEY_FILE_CONFIGURED_AND_PRESENT=$([bool]($values['FI_GATEWAY_TLS_KEY'] -and (Test-Path -LiteralPath $values['FI_GATEWAY_TLS_KEY'] -PathType Leaf)))"
$port=8443
if($values["FI_GATEWAY_PORT"] -match '^\d{1,5}$'){$port=[int]$values["FI_GATEWAY_PORT"]}
$listener=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
Write-Host "HTTPS_GATEWAY_LISTENER=$(if($listener.Count){'PRESENT'}else{'ABSENT'}) PORT=$port"
$openssl=Get-Command openssl.exe -ErrorAction SilentlyContinue
$mkcert=Get-Command mkcert.exe -ErrorAction SilentlyContinue
if(-not $openssl){
 $gitSSL="C:\Program Files\Git\usr\bin\openssl.exe"
 if(Test-Path -LiteralPath $gitSSL -PathType Leaf){$openssl=Get-Item $gitSSL}
}
Write-Host "OPENSSL_AVAILABLE=$([bool]$openssl)"
Write-Host "MKCERT_AVAILABLE=$([bool]$mkcert)"
Write-Host "CERTIFICATE_TRUST_ON_IPHONE=NOT_VERIFIED"
Write-Host "NETBIRD_REVERSE_PROXY_PRIVATE_SERVICE=NOT_VERIFIED"
Write-Host "GATEWAY_READINESS=READ_ONLY_DIAGNOSTIC_COMPLETE"
