# Security model

## Current boundary

Single-operator, same-machine control plane. It binds only to loopback. Wildcard and LAN binds are rejected.

## Safeguards

- No credentials or secrets committed.
- External commands use argument arrays with shell disabled.
- NetBird integration is read-only; no VPN state changes or enrollment.
- No automatic installation, elevation, firewall changes, or shell commands.
- No-store API responses, restrictive content security policy, and basic browser security headers.
- Mutating endpoints validate Host and, when present, Origin.

## Malware static-analysis boundary

The optional malware-analysis adapter is static-only and requires operator confirmation of a disposable offline VM. That confirmation is an attestation, not a technical isolation check. Do not run samples or use a production/connected host. Samples and reports must remain outside Git. See docs/MALWARE_STATIC_ANALYSIS.md. No dynamic detonation, payload execution, propagation, PLC interaction, or malware modification is implemented.

## Limitations

No user authentication exists. Do not expose beyond loopback. Local processes under the same OS account may interact with the service. REA process state is not an MCP handshake. NetBird status is not independent proof of tunnel security.

Before remote access, separately design and review identity, authorization, TLS, CSRF protection, rate limits, audit logs, secret storage, and session lifecycle. Remote access remains disabled.
