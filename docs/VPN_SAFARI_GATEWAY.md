# VPN-only Safari gateway (successor implementation)

## Security model

The application services remain loopback-only on 127.0.0.1:8787 and 127.0.0.1:8790. The separate HTTPS gateway in `src/gateway.mjs` is designed to bind only to one explicit NetBird IPv4 address, accept only explicitly allowlisted NetBird client IPs, require HTTP Basic authentication over TLS, enforce an exact Host and same-origin policy, and proxy to the loopback dashboard. It strips browser credentials and Origin before forwarding to the loopback backend. It never binds to 0.0.0.0.

This is an application gateway, not yet a qualified host firewall kill switch. A Windows Defender Firewall inbound rule restricted to the NetBird interface and known client IPs is still required. The gateway must not be started until the NetBird interface address, iPhone peer address, trusted DNS name, and certificate trust have been confirmed.

## Configuration

Set these values in the Fun Industrial private `.env` (never commit them):
- `FI_GATEWAY_BIND_IP`: the PC's actual NetBird IPv4 address.
- `FI_GATEWAY_ALLOWED_CLIENT_IPS`: comma-separated exact NetBird peer IPs permitted to connect (include the iPhone's peer address only).
- `FI_GATEWAY_PUBLIC_HOST`: exact private DNS name and optional port, e.g. `fun-industrial.example.net:8443`.
- `FI_GATEWAY_USERNAME`: dedicated gateway username.
- `FI_GATEWAY_PASSWORD`: unique random password of at least 24 characters.
- `FI_GATEWAY_TLS_KEY` and `FI_GATEWAY_TLS_CERT`: paths to the private key and matching server certificate. The certificate SAN must contain the exact public DNS name or IP used by Safari, and its issuing CA must be trusted by iOS.

Start with `node src/gateway.mjs` only after the host-level firewall rule is installed and the certificate has been validated. The service will refuse missing or wildcard configuration. Do not expose port 8443 on a public/WAN interface.

## iPhone

Enroll the iPhone in the same NetBird network. Connect NetBird on the iPhone, then open the exact HTTPS name in Safari. Install/trust the private CA on iOS only through an approved, controlled certificate distribution method. Never use an untrusted-certificate bypass.

## Current limitations / qualification gate

This implementation provides the HTTPS/authenticated reverse-proxy process and unit tests for strict configuration. It does not yet provision certificates, install a Windows Firewall rule, create a Windows scheduled task, implement a persistent supervisor, or prove iOS trust and actual NetBird reachability. Those are separate host qualification steps. Do not run this gateway yet. No claims of Safari-ready deployment until end-to-end Windows + iPhone tests pass.
