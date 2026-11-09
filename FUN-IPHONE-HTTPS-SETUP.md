# Fun Industrial iPhone — private NetBird HTTPS setup

This uses the existing voice-enabled dashboard at Windows localhost port 8789
and NetBird PC IP 100.109.4.20. It adds ONLY a separate authenticated
HTTPS gateway on 100.109.4.20 port 8443. The dashboard stays loopback-only.
The gateway is restricted to one manually verified connected iPhone peer.

## A. Prepare a private certificate and verify the iPhone peer

In Windows PowerShell:

    $g=Join-Path $env:TEMP ('FunNetBirdHTTPS-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
    git clone --quiet --depth 1 --single-branch --branch feature/fun-iphone-voice-dashboard-20261108 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git $g
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $g 'Prepare-Fun-iPhone-HTTPS.ps1')

When the preparer prints the connected peer name and NetBird IP, verify
the address in your iPhone NetBird app. Enter that exact peer IP to
authorize this device. Do not authorize an unidentified peer.

Successful preparation prints FI_IPHONE_GATEWAY_PREPARE=PASS and the
public certificate path. It has not started a gateway or changed firewall
and VPN rules.

The script creates a private local CA and a 180-day TLS server certificate
with IP SAN 100.109.4.20. Certificate and key files are stored under:

    %LOCALAPPDATA%\FunIndustrial\VoiceGateway\certs\

It restricts new folder permissions to your Windows user and SYSTEM,
and deletes the CA signing key after issuing the server certificate.
The existing dashboard, models, REA and Cognee processes are untouched.

## B. Install and trust the PUBLIC root CA on iPhone

Transfer ONLY the public certificate file:

    %LOCALAPPDATA%\FunIndustrial\VoiceGateway\certs\fun-industrial-local-ca.cer

Use your private iCloud Drive or another controlled file-transfer channel.
Do not transfer server.private.key or any other private key.

Open the .cer file on your iPhone and install the certificate profile
using Settings > General > VPN & Device Management (if prompted).
Then go to Settings > General > About > Certificate Trust Settings
and enable full trust for Fun Industrial Private iPhone Root.
Only trust a root certificate you explicitly generated and control.
Trusting a root CA can broadly affect TLS trust while it is installed.
Apple reference: https://support.apple.com/en-us/102390

## C. Start the gateway in Windows PowerShell

Use the same $g variable:

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $g 'Start-Fun-iPhone-HTTPS.ps1')

Choose a strong NEW gateway password of at least 24 characters,
distinct from your Google account password. The gateway username is
fiiphone. The password is not stored in a file or GitHub; it is held by
the running gateway process in memory. A restart requires re-entry.

The script performs a real HTTPS status request using the public root CA
to validate the certificate, then reports:

    FI_IPHONE_GATEWAY_HTTPS_SELFTEST=PASS
    FI_IPHONE_GATEWAY_START=PASS
    FI_IPHONE_SAFARI_URL=https://100.109.4.20:8443

It does not change the VPN, Windows Firewall or other services.
This is a foreground-managed independent Node process, not a Windows
Service or scheduled background agent.

## D. Use iPhone Safari

1. Connect NetBird on iPhone.
2. Open https://100.109.4.20:8443/ in Safari.
3. Authenticate using username fiiphone and your gateway password.
4. Scroll to the Spoken Voice Lab — iPhone microphone panel.
5. Record 2–30 seconds, stop, preview, then upload.
6. Windows saves a WAV under your FunIndustrial VoiceLab recordings folder;
   use the local Voice Lab analyzer when you choose.

Safari microphone APIs require a trusted secure context.
Never bypass Safari certificate warnings. If the TLS self-test passes
but the phone times out, check Windows Firewall and NetBird peer access
rules for TCP 8443. Do NOT expose port 8789 publicly or bind to 0.0.0.0.

## Security and status

- Only the explicitly confirmed connected NetBird peer is allowlisted.
- Basic authentication is protected by the private HTTPS connection.
- Source and destination IP restrictions are enforced by the gateway.
- The private CA root is trusted only if you install/enable it on iPhone.
- Uploading voice audio does not invoke REA, alter Cognee, or generate speech.
- The preparation and launch scripts have not yet been run on Windows.
- To disable mobile upload, remove mobile-upload.enabled under the
  FunIndustrial VoiceLab directory; existing audio files are not deleted.
- Do not terminate all Node processes to stop the gateway; several
  unrelated Fun Industrial services also run Node.

NetBird peer table/CLI reference: https://docs.netbird.io/get-started/cli
Apple trust documentation: https://support.apple.com/en-us/102390
