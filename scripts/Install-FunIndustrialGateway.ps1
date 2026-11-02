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
$node=(Get-Command node.exe).Source
$certHost=$PublicHost.Split(":")[0]
$validationCode='const fs=require("node:fs");const tls=require("node:tls");const {X509Certificate}=require("node:crypto");const cert=new X509Certificate(fs.readFileSync(process.argv[1]));tls.createSecureContext({key:fs.readFileSync(process.argv[2]),cert:fs.readFileSync(process.argv[1])});if(!cert.checkHost(process.argv[3]))process.exit(21);if(Date.parse(cert.validTo)<Date.now()||Date.parse(cert.validFrom)>Date.now())process.exit(22);'
& $node -e $validationCode $TlsCertPath $TlsKeyPath $certHost
if($LASTEXITCODE -ne 0){throw "TLS certificate/key mismatch, invalid date, or SAN does not match the public host. No firewall/task changes made."}
$pwdPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($GatewayPassword)
try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pwdPtr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pwdPtr)}
if($plain -notmatch "^[A-Za-z0-9_-]{24,}$"){throw "Gateway password must be at least 24 URL-safe alphanumeric, underscore, or hyphen characters so .env parsing is unambiguous."}
if($GatewayPort -ne 8443){throw "This qualified profile reserves gateway TCP port 8443; use the default port."}
$taskName="Fun Industrial Independent Supervisor"
if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue;Start-Sleep -Seconds 2}
$serverPath=(Join-Path $root "src\server.mjs")
$gatewayPath=(Join-Path $root "src\gateway.mjs")
$supervisorPath=(Join-Path $root "src\supervisor.mjs")
$dashboardListeners=Get-NetTCPConnection -State Listen -LocalPort 8787 -ErrorAction SilentlyContinue
foreach($entry in $dashboardListeners){
 $owner=Get-CimInstance Win32_Process -Filter ("ProcessId="+$entry.OwningProcess) -ErrorAction SilentlyContinue
 if(-not $owner -or -not $owner.CommandLine.Contains($serverPath)){throw "Port 8787 is owned by a process not proven to be this Fun Industrial checkout. No process was stopped."}
 try{Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/shutdown" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 8|Out-Null}catch{}
 Start-Sleep -Seconds 2
 $still=Get-CimInstance Win32_Process -Filter ("ProcessId="+$entry.OwningProcess) -ErrorAction SilentlyContinue
 if($still -and $still.CommandLine.Contains($serverPath)){Stop-Process -Id $still.ProcessId -Force}
}
foreach($portToCheck in @(8443)){
 foreach($entry in (Get-NetTCPConnection -State Listen -LocalPort $portToCheck -ErrorAction SilentlyContinue)){
  $owner=Get-CimInstance Win32_Process -Filter ("ProcessId="+$entry.OwningProcess) -ErrorAction SilentlyContinue
  if(-not $owner -or -not $owner.CommandLine.Contains($gatewayPath)){throw "Gateway port $portToCheck is occupied by a process not proven to be this Fun Industrial checkout. Refusing to stop it."}
  Stop-Process -Id $owner.ProcessId -Force
 }
}
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{$_.CommandLine -and $_.CommandLine.Contains($supervisorPath)}|ForEach-Object{Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
$envPath=Join-Path $root ".env"
if(-not(Test-Path $envPath)){throw "Run base activation first; expected .env missing."}
$lines=[System.Collections.Generic.List[string]]::new();Get-Content $envPath|ForEach-Object{$lines.Add($_)}
$values=[ordered]@{FI_GATEWAY_BIND_IP=$NetBirdBindIPv4;FI_GATEWAY_ALLOWED_CLIENT_IPS=($AllowedClientIPv4 -join ",");FI_GATEWAY_PORT=[string]$GatewayPort;FI_GATEWAY_PUBLIC_HOST=$PublicHost;FI_GATEWAY_USERNAME=$GatewayUsername;FI_GATEWAY_PASSWORD=$plain;FI_GATEWAY_TLS_KEY=(Resolve-Path $TlsKeyPath).Path;FI_GATEWAY_TLS_CERT=(Resolve-Path $TlsCertPath).Path}
foreach($key in $values.Keys){$found=$false;for($i=0;$i -lt $lines.Count;$i++){if($lines[$i] -match ("^"+[regex]::Escape($key)+"=")){$lines[$i]=$key+"="+$values[$key];$found=$true}}if(-not $found){$lines.Add($key+"="+$values[$key])}}
[System.IO.File]::WriteAllLines($envPath,$lines,[System.Text.UTF8Encoding]::new($false))
$acl=Get-Acl $envPath;$acl.SetAccessRuleProtection($true,$false);$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl.Access|ForEach-Object{$acl.RemoveAccessRule($_)|Out-Null}
$rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,"FullControl","Allow");$acl.SetAccessRule($rule);Set-Acl -Path $envPath -AclObject $acl
$firewallName="FunIndustrial-Gateway-$GatewayPort"
$existing=Get-NetFirewallRule -Name $firewallName -ErrorAction SilentlyContinue
if($existing){Remove-NetFirewallRule -Name $firewallName}
New-NetFirewallRule -Name $firewallName -DisplayName "Fun Industrial HTTPS gateway (NetBird peers only)" -Direction Inbound -Action Allow -Enabled True -Profile Any -Protocol TCP -LocalPort $GatewayPort -LocalAddress $NetBirdBindIPv4 -RemoteAddress $AllowedClientIPv4 -InterfaceAlias $NetBirdInterface -Program $node |Out-Null
$taskName="Fun Industrial Independent Supervisor"
$action=New-ScheduledTaskAction -Execute $node -Argument ('"'+(Join-Path $root "src\supervisor.mjs")+'"') -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 0 -MultipleInstances IgnoreNew
try{Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Fun Industrial only: supervise its own dashboard and VPN-bound HTTPS gateway." -Force|Out-Null;Start-ScheduledTask -TaskName $taskName}catch{Remove-NetFirewallRule -Name $firewallName -ErrorAction SilentlyContinue;throw}
Write-Host "FUN_INDUSTRIAL_GATEWAY_FIREWALL=PASS"
Write-Host "FUN_INDUSTRIAL_SUPERVISOR_TASK=REGISTERED_USER_LOGON"
Write-Host "BIND=$NetBirdBindIPv4 INTERFACE=$NetBirdInterface PORT=$GatewayPort CLIENTS=$($AllowedClientIPv4 -join ',')"
Write-Host "TLS_CERT_SUBJECT=$($cert.Subject) TLS_CERT_EXPIRES=$($cert.NotAfter.ToString('o'))"
Write-Host "IMPORTANT=This configures a host firewall allow rule, not a whole-device outbound VPN kill switch. Verify IPv6/DNS and iPhone trust separately."
