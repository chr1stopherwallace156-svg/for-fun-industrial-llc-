# Successor deployment architecture and Windows qualification

## What this successor adds

- Separate HTTPS gateway process at `src/gateway.mjs`.
- Gateway requires explicit NetBird interface IPv4, explicit allowed client IPv4 addresses, a dedicated username/password, a TLS private key/certificate, and exact public Host.
- It binds only to the selected NetBird interface address, not a wildcard interface.
- It rejects remote peers outside the allowlist, requires Basic authentication over TLS, checks Host and browser Origin, strips authorization/cookie/origin before forwarding to the loopback dashboard, and proxies only to 127.0.0.1.
- A bounded supervisor at `src/supervisor.mjs` owns only its two child Node scripts (dashboard and gateway), writes PID/state metadata and separate stdout/stderr logs, and allows at most three restarts in ten minutes before stopping.
- `scripts/Install-FunIndustrialGateway.ps1` installs an inbound Windows Firewall allow rule constrained to the selected interface, local VPN address, exact client IPs, TCP 8443, and the Node executable. It registers a current-user interactive logon task, not a SYSTEM task.
- Removal unregisters only the exact Fun Industrial task, removes only the exact named gateway firewall rule, and stops only processes whose command lines identify this repository.

## Deployment prerequisites

1. The base platform's Node and Python qualifications must pass on the actual Windows host.
2. NetBird must be installed and signed in on the Windows PC and iPhone.
3. Obtain the PC's NetBird IPv4 address and exact adapter alias, plus the iPhone's NetBird IPv4 address from the NetBird admin console. Do not use a LAN or public address.
4. Choose a private DNS name resolvable by the iPhone over NetBird, or use the exact VPN IP address. The TLS certificate SAN must match the exact Safari host.
5. Provision a trusted TLS certificate and private key. The iPhone must trust the issuing CA through a controlled certificate profile installation. Never click through a TLS warning.
6. Choose a unique username and a random URL-safe password of at least 24 characters. Do not reuse the NetBird password.
7. Run the installer from an elevated PowerShell session. The scheduled task is registered to the current interactive user and runs at logon with least privilege.

## Installer

Run from the repository root with explicit, confirmed values. The password parameter must be a SecureString; the installer does not echo it. Example shape (replace every placeholder with values confirmed from the NetBird admin console and certificate location):

~~~powershell
$pw=Read-Host 'Create a unique gateway password (24+ URL-safe characters)' -AsSecureString; .\scripts\Install-FunIndustrialGateway.ps1 -NetBirdInterface 'NetBird' -NetBirdBindIPv4 '100.x.y.z' -AllowedClientIPv4 @('100.x.y.w') -PublicHost 'fun-industrial.example.net:8443' -TlsKeyPath 'C:\path\server-key.pem' -TlsCertPath 'C:\path\server-cert.pem' -GatewayUsername 'operator' -GatewayPassword $pw
~~~

The script refuses an unassigned interface/address, wildcard peer allowlists, weak credentials, missing certificate files, or a certificate outside its validity period. It sets restrictive ACLs on the private .env file, adds the narrow inbound firewall rule, registers the current-user scheduled task, and starts the task. Review the task and firewall rule after installation.

## Runtime evidence

- Supervisor state/PID manifest: `.runtime/supervisor/processes.json`.
- Dashboard stdout/stderr: `reports/dashboard.out.log`, `reports/dashboard.err.log`.
- Gateway stdout/stderr: `reports/https-gateway.out.log`, `reports/https-gateway.err.log`.
- Dashboard remains at loopback 8787; compute remains at loopback 8790; gateway uses 8443 on the selected NetBird interface only.
- Open Safari at `https://<exact-private-host>:8443` only after the iPhone NetBird peer is connected and trusts the certificate.

## Security boundaries and uncompleted qualifications

This is not a whole-device outbound VPN kill switch. The inbound firewall allow rule restricts access to the Fun Industrial HTTPS gateway; it does not block unrelated Windows processes from direct internet egress. IPv6/DNS leak tests, NetBird exit-node routing verification, fail-closed host egress policy, iPhone certificate trust, live iPhone Safari access, Windows reboot/startup, restart recovery, and rollback still require host-level qualification. Do not claim production VPN-only egress until those tests pass.

The gateway's allowlist is exact IP based. If NetBird peer addresses or interface alias change, update configuration and requalify the firewall rule. Never broaden the firewall rule to Any remote address or Any interface to make connectivity work.

## Rollback

Run `scripts/Remove-FunIndustrial.ps1 -WhatIf` first to review the exact owned actions. Then run it without `-WhatIf` to unregister the Fun Industrial supervisor task, remove the exact Fun Industrial gateway inbound rule, stop only repository-identified processes, and remove private runtime/configuration files. It does not uninstall NetBird or change its network policy. Do not use broad process-name termination.
