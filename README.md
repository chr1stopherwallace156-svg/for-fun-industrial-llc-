# Fun Industrial Platform

Standalone integration and compute platform for Fun Industrial LLC. It connects independently maintained open-source tools through adapters; it does not rewrite or absorb upstream projects.

## Current implementation — v0.2.0

- Local Node.js control plane and dashboard.
- One Activate Fun Industrial operation for all explicitly enabled integrations.
- NetBird integration for WireGuard-based encrypted networking.
- REA CLI/MCP adapter (MCP handshake qualification remains pending).
- Separate local graph, tensor-network, and neural compute service.
- Graph analysis and SVG graph rendering.
- Quimb tensor contraction operations.
- PyTorch CPU neural-network training and prediction, with a loss-history chart.
- One-pass Windows PowerShell installer, activation, tests, and JSON report.

## Windows deployment

Clone the integration branch and run the PowerShell activation script from the repository root. Full instructions: docs/WINDOWS_ACTIVATION.md.

The script uses an isolated Python 3.12 environment, installs pinned packages, runs tests, installs NetBird with winget when available, invokes the browser SSO login flow, configures loopback-only services, activates enabled integrations, and writes a local report. NetBird authentication requires the operator.

## Compute service

Initial APIs provide NetworkX graph analytics, Quimb tensor contraction, and PyTorch CPU model training/prediction. Models are memory-only and reset on service restart. The initial implementation is not a general-purpose trained model or production data platform.

## Security and limitations

- Dashboard and compute API are loopback-only.
- NetBird manages its own WireGuard private key material; this app does not access it.
- Peer reachability and least-privilege policy require a second enrolled device and actual connectivity tests.
- The AMD GPU is not enabled for compute; PyTorch uses CPU in this release.
- REA process startup is not proof of a successful MCP handshake.
- Remote administration, model persistence, broad subnet routes, and automatic VPN enrollment are not enabled.
- Never commit .env, setup keys, private keys, or activation reports.

## Upstream projects

- https://github.com/morluto/rea
- https://github.com/netbirdio/netbird
- https://github.com/networkx/networkx
- https://github.com/jcmgray/quimb
- https://github.com/pytorch/pytorch
- https://github.com/fastapi/fastapi

See THIRD_PARTY_NOTICES.md for preliminary license information.

## Independence

This repository is separate from Elektron. No Elektron source, runtime, dependencies, or operational configuration is included.
