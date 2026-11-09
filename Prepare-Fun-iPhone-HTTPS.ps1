# Prepare a private NetBird-only HTTPS gateway with a locally trusted root CA.
# No changes to dashboard, NetBird, firewall, services, model, or Ollama.
# Never print or transmit private key material.
[CmdletBinding()]param()
$ErrorActionPreference="Stop"
$Root=Join-Path $env:LOCALAPPDATA "FunIndustrial\VoiceGateway"
$Certs=Join-Path $Root "certs"
$Config=Join-Path $Root "private-gateway.json"
$Source=Join-Path $PSScriptRoot "src\gateway.mjs"
$ExpectedPC="100.109.4.20"
$Port=8443
function Hold([string]$reason){throw "FI_IPHONE_HTTPS_PREPARE_HOLD=$reason"}
function Check([string]$stage){if($LASTEXITCODE -ne 0){Hold "$stage EXIT=$LASTEXITCODE"}}
# Windows PowerShell 5.1 turns OpenSSL's harmless RSA key-generation
# progress on stderr into NativeCommandError under ErrorActionPreference=Stop.
# Temporarily relax error-record handling ONLY around this native executable;
# preserve fail-closed exit-code checks for every invocation.
function Invoke-OpenSSL([string]$stage,[string[]]$Arguments){
 $prior=$ErrorActionPreference
 $exitCode=$null
 try{
  $ErrorActionPreference="Continue"
  & $ssl @Arguments 2>$null | Out-Null
  $exitCode=$LASTEXITCODE
 }finally{
  $ErrorActionPreference=$prior
 }
 if($exitCode -ne 0){Hold "$stage EXIT=$exitCode"}
}
if(-not (Test-Path -LiteralPath $Source -PathType Leaf)){Hold "GATEWAY_SOURCE_MISSING"}
if(Test-Path -LiteralPath $Root){Hold "GATEWAY_ROOT_ALREADY_EXISTS_REFUSE_OVERWRITE"}
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){Hold "PORT_8443_ALREADY_IN_USE"}
$NB=Get-Command netbird.exe -ErrorAction SilentlyContinue
if(-not $NB){
 $candidate="C:\Program Files\NetBird\netbird.exe"
 if(-not (Test-Path -LiteralPath $candidate -PathType Leaf)){Hold "NETBIRD_NOT_FOUND"}
 $NB=Get-Item $candidate
}
$nbExe=if($NB.Source){$NB.Source}else{$NB.FullName}
$ip=((& $nbExe status --ipv4 2>$null|Out-String).Trim())
if($ip -ne $ExpectedPC){Hold "NETBIRD_HOST_IP_CHANGED_EXPECTED_$ExpectedPC"}
$interface=Get-NetIPAddress -IPAddress $ip -AddressFamily IPv4 -ErrorAction SilentlyContinue
if(-not $interface){Hold "NETBIRD_IP_NOT_ASSIGNED_TO_WINDOWS"}
$table=@((& $nbExe status --table --filter-by-status connected 2>$null|Out-String) -split "\r?\n")
$peers=@()
foreach($line in $table){
 if($line -match '^\s*(\S+)\s+(\d{1,3}(?:\.\d{1,3}){3})\s+Connected\b'){
  $peerName=$Matches[1];$peerIp=$Matches[2]
  $parsedIp=$null
  if([System.Net.IPAddress]::TryParse($peerIp,[ref]$parsedIp) -and
     $parsedIp.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork){
   $peers+=@{name=$peerName;ip=$peerIp}
  }
 }
}
if($peers.Count -ne 1){Hold "REQUIRE_EXACTLY_ONE_CONNECTED_NETBIRD_PEER_FOUND_$($peers.Count)"}
$PeerIp=[string]$peers[0].ip
Write-Host "FI_IPHONE_NETBIRD_PEER_CANDIDATE=$($peers[0].name) IP=$PeerIp"
Write-Host "Verify this is YOUR iPhone's NetBird address before authorizing dashboard access."
$confirm=Read-Host "Type the iPhone NetBird IP $PeerIp to authorize this peer"
if($confirm.Trim() -ne $PeerIp){Hold "PEER_APPROVAL_NOT_CONFIRMED"}
$OpenSSL=Get-Command openssl.exe -ErrorAction SilentlyContinue
if(-not $OpenSSL){
 $p="C:\Program Files\Git\usr\bin\openssl.exe"
 if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Hold "OPENSSL_NOT_FOUND"}
 $OpenSSL=Get-Item $p
}
$ssl=if($OpenSSL.Source){$OpenSSL.Source}else{$OpenSSL.FullName}
if(-not(Get-Command node.exe -ErrorAction SilentlyContinue)){Hold "NODE_NOT_INSTALLED"}
$Gateway=Join-Path $Root "gateway.mjs"
$created=$false
try{
 New-Item -ItemType Directory -Path $Certs -Force|Out-Null
 $created=$true
 # The new directory and descendants receive ACLs limited to current user and SYSTEM.
 $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 & icacls.exe $Root /inheritance:r /grant:r ("*"+$sid+":(OI)(CI)F") "SYSTEM:(OI)(CI)F" | Out-Null
 Check "PRIVATE_ROOT_ACL"
 & icacls.exe $Certs /inheritance:r /grant:r ("*"+$sid+":(OI)(CI)F") "SYSTEM:(OI)(CI)F" | Out-Null
 Check "PRIVATE_CERT_ACL"
 $caKey=Join-Path $Certs "local-ca.private.key"
 $caPem=Join-Path $Certs "local-ca.public.pem"
 $caCer=Join-Path $Certs "fun-industrial-local-ca.cer"
 $serverKey=Join-Path $Certs "server.private.key"
 $serverCsr=Join-Path $Certs "server.csr"
 $serverCert=Join-Path $Certs "server.crt"
 $extFile=Join-Path $Certs "server.ext"
 $extensions=@"
[v3_server]
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:$ip
"@
 [IO.File]::WriteAllText($extFile,$extensions,[Text.UTF8Encoding]::new($false))
 Invoke-OpenSSL "CREATE_CA" @("req","-new","-x509","-newkey","rsa:3072","-sha256","-days","365","-nodes","-keyout",$caKey,"-out",$caPem,"-subj","/CN=Fun Industrial Private iPhone Root","-addext","basicConstraints=critical,CA:TRUE","-addext","keyUsage=critical,keyCertSign,cRLSign")
 Invoke-OpenSSL "CREATE_SERVER_KEY_AND_CSR" @("req","-new","-newkey","rsa:3072","-sha256","-nodes","-keyout",$serverKey,"-out",$serverCsr,"-subj",("/CN="+$ip))
 Invoke-OpenSSL "SIGN_SERVER" @("x509","-req","-in",$serverCsr,"-CA",$caPem,"-CAkey",$caKey,"-CAcreateserial","-out",$serverCert,"-days","180","-sha256","-extfile",$extFile,"-extensions","v3_server")
 $verify=((& $ssl verify -CAfile $caPem $serverCert 2>&1)|Out-String)
 Check "CERTIFICATE_CHAIN"
 if($verify -notmatch '\bOK\b'){Hold "SERVER_CERT_CHAIN_NOT_VALID"}
 $san=((& $ssl x509 -in $serverCert -noout -ext subjectAltName 2>&1)|Out-String)
 Check "CERTIFICATE_SAN"
 if($san -notmatch ("IP Address:"+[regex]::Escape($ip))){Hold "SERVER_IP_SAN_MISSING"}
 & $ssl x509 -in $caPem -outform DER -out $caCer
 Check "DER_CERT_FOR_IPHONE"
 Copy-Item -LiteralPath $Source -Destination $Gateway -ErrorAction Stop
 $value=[ordered]@{
   schema="fun.voice.gateway.private.v1"
   pcIp=$ip; iphonePeerIp=$PeerIp; iphonePeerName=$peers[0].name; port=$Port
   publicHost=($ip+":"+$Port)
   caPublicCer=$caCer; caPublicPem=$caPem
   tlsCertificate=$serverCert; tlsPrivateKey=$serverKey
   source=$Gateway; preparedUtc=[DateTime]::UtcNow.ToString("o")
   credentialsPersisted=$false; changesToNetBirdOrFirewall=$false
 }
 [IO.File]::WriteAllText($Config,($value|ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
 # Delete CA signing key after signing the single server certificate.
 Remove-Item -LiteralPath $caKey,$serverCsr -Force
 Write-Host "FI_IPHONE_GATEWAY_PREPARE=PASS NETBIRD_PC=$ip AUTHORIZED_IPHONE_PEER=$PeerIp PORT=$Port"
 Write-Host "FI_IPHONE_CA_PUBLIC_CERT=$caCer"
 Write-Host "FI_IPHONE_PRIVATE_SERVER_KEY=STORED_RESTRICTED_NOT_TO_SHARE"
 Write-Host "FI_IPHONE_CA_SIGNING_KEY=DELETED"
 Write-Host ("FI_IPHONE_SAFARI_URL=https://"+$ip+":"+$Port)
 Write-Host "FI_IPHONE_GATEWAY_STARTED=FALSE"
 Write-Host "FI_IPHONE_NEXT=INSTALL_AND_TRUST_CA_CERT_ON_IPHONE_THEN_START_GATEWAY"
}catch{
 if($created){Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue}
 throw
}
