[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$NetBirdInterface,
 [Parameter(Mandatory=$true)][string]$NetBirdBindIPv4,
 [Parameter(Mandatory=$true)][string[]]$AllowedClientIPv4,
 [Parameter(Mandatory=$true)][string]$PublicHost,
 [Parameter(Mandatory=$true)][string]$TlsKeyPath,
 [Parameter(Mandatory=$true)][string]$TlsCertPath,
 [Parameter(Mandatory=$true)][string]$GatewayUsername,
 [Parameter(Mandatory=$true)][securestring]$GatewayPassword,
 [int]$GatewayPort=8443
)
$ErrorActionPreference="Stop"
$root=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if(-not([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw "Run this installer in an elevated PowerShell session; the scheduled task still runs as the current user."}
if(-not(Get-Command node.exe -ErrorAction SilentlyContinue)){throw "Node.js is missing; run the base activation first."}
if($NetBirdBindIPv4 -notmatch "^(?:\d{1,3}\.){3}\d{1,3}$" -or $NetBirdBindIPv4 -eq "0.0.0.0" -or $NetBirdBindIPv4.StartsWith("127.")){throw "Bind address must be an explicit non-loopback IPv4 address."}
$ip=Get-NetIPAddress -AddressFamily IPv4 -IPAddress $NetBirdBindIPv4 -ErrorAction SilentlyContinue|Where-Object {$_.InterfaceAlias -eq $NetBirdInterface}
if(-not $ip){throw "The supplied IPv4 address is not assigned to the supplied interface. No firewall/task changes made."}
if(-not(Get-NetAdapter -Name $NetBirdInterface -ErrorAction SilentlyContinue)){throw "NetBird interface not found."}
if($AllowedClientIPv4.Count -lt 1 -or $AllowedClientIPv4 -contains "*"){throw "At least one exact NetBird client IPv4 is required; wildcard is forbidden."}
foreach($client in $AllowedClientIPv4){if($client -notmatch "^(?:\d{1,3}\.){3}\d{1,3}$" -or $client.StartsWith("127.")){throw "Invalid client IPv4: $client"}}
if($GatewayPort -lt 1 -or $GatewayPort -gt 65535){throw "Invalid gateway port."}
if(-not(Test-Path -LiteralPath $TlsKeyPath) -or -not(Test-Path -LiteralPath $TlsCertPath)){throw "TLS key/certificate files must exist. No host changes made."}
$cert=New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($TlsCertPath)
if($cert.NotAfter -le (Get-Date) -or $cert.NotBefore -gt (Get-Date)){throw "TLS certificate is not currently valid."}
if($cert.Subject -notmatch [regex]::Escape($PublicHost.Split(":")[0]) -and $cert.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::DnsName,$false) -ne $PublicHost.Split(":")[0]){throw "Certificate identity does not match the configured public hostname; inspect SAN manually before retrying."}
$pwdPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($GatewayPassword)
try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pwdPtr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pwdPtr)}
if($plain.Length -lt 24){throw "Gateway password must be at least 24 characters."}
$envPath=Join-Path $root ".env"
if(-not(Test-Path $envPath)){throw "Run base activation first; expected .env missing."}
$lines=[System.Collections.Generic.List[string]]::new();Get-Content $envPath|ForEach-Object{$lines.Add($_)}
$values=[ordered]@{FI_GATEWAY_BIND_IP=$NetBirdBindIPv4;FI_GATEWAY_ALLOWED_CLIENT_IPS=($AllowedClientIPv4 -join ",");FI_GATEWAY_PORT=[string]$GatewayPort;FI_GATEWAY_PUBLIC_HOST=$PublicHost;FI_GATEWAY_USERNAME=$GatewayUsername;FI_GATEWAY_PASSWORD=$plain;FI_GATEWAY_TLS_KEY=(Resolve-Path $TlsKeyPath).Path;FI_GATEWAY_TLS_CERT=(Resolve-Path $TlsCertPath).Path}
foreach($key in $values.Keys){$found=$false;for($i=0;$i -lt $lines.Count;$i++){if($lines[$i] -match ("^"+[regex]::Escape($key)+"=")){$lines[$i]=$key+"="+$values[$key];$found=$true}}if(-not $found){$lines.Add($key+"="+$values[$key])}}
[System.IO.File]::WriteAllLines($envPath,$lines,[System.Text.UTF8Encoding]::new($false))
$acl=Get-Acl $envPath;$acl.SetAccessRuleProtection($true,$false);$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl.Access|ForEach-Object{$acl.RemoveAccessRule($_)|Out-Null}
$rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,"FullControl","Allow");$acl.SetAccessRule($rule);Set-Acl -Path $envPath -AclObject $acl
$node=(Get-Command node.exe).Source
$firewallName="FunIndustrial-Gateway-$GatewayPort"
$existing=Get-NetFirewallRule -Name $firewallName -ErrorAction SilentlyContinue
if($existing){Remove-NetFirewallRule -Name $firewallName}
New-NetFirewallRule -Name $firewallName -DisplayName "Fun Industrial HTTPS gateway (NetBird peers only)" -Direction Inbound -Action Allow -Enabled True -Profile Any -Protocol TCP -LocalPort $GatewayPort -LocalAddress $NetBirdBindIPv4 -RemoteAddress $AllowedClientIPv4 -InterfaceAlias $NetBirdInterface -Program $node |Out-Null
$taskName="Fun Industrial Independent Supervisor"
$action=New-ScheduledTaskAction -Execute $node -Argument ('"'+(Join-Path $root "src\supervisor.mjs")+'"') -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 0 -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Fun Industrial only: supervise its own dashboard and VPN-bound HTTPS gateway." -Force|Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "FUN_INDUSTRIAL_GATEWAY_FIREWALL=PASS"
Write-Host "FUN_INDUSTRIAL_SUPERVISOR_TASK=REGISTERED_USER_LOGON"
Write-Host "BIND=$NetBirdBindIPv4 INTERFACE=$NetBirdInterface PORT=$GatewayPort CLIENTS=$($AllowedClientIPv4 -join ',')"
Write-Host "TLS_CERT_SUBJECT=$($cert.Subject) TLS_CERT_EXPIRES=$($cert.NotAfter.ToString('o'))"
Write-Host "IMPORTANT=This configures a host firewall allow rule, not a whole-device outbound VPN kill switch. Verify IPv6/DNS and iPhone trust separately."
