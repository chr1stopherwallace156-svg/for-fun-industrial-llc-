# Fun Industrial Platform

A standalone integration application for Fun Industrial LLC. It coordinates existing open-source tools through adapters; it does not rewrite or absorb their upstream projects.

## Current status — v0.2 integration candidate

The implementation branch contains a local Node.js control plane, dashboard, lifecycle coordinator, REA process adapter, and an operator-controlled NetBird VPN adapter.

## Capabilities

- **Central control panel:** local dashboard to start, stop, and inspect integrated services.
- **Coordinated startup:** starts enabled adapters and reports observed states.
- **REA integration:** starts the independently installed REA CLI/MCP process when explicitly enabled.
- **VPN encryption:** integrates NetBird's WireGuard-based encrypted overlay through its installed CLI. The dashboard provides explicit Connect VPN and Disconnect VPN controls.
- **Opt-in startup connection:** NETBIRD_AUTOCONNECT=true makes Start platform issue netbird up; it is false by default.
- **Safety boundary:** loopback-only binding, no committed secrets, no automatic installation, no privilege elevation, and no shell command interpolation.
- **Extensibility:** adapters connect upstream projects without copying their source.

## Requirements and quick start

Node.js 22.23.4 or newer is required.

```sh
npm run check
npm test
npm start
```

Open http://127.0.0.1:8787.

Copy .env.example to .env to configure optional integrations. REA and NetBird are disabled by default. Install and enroll NetBird independently before enabling its adapter.

## Qualification notes

- NetBird client-reported daemon status is not proof of peer reachability or policy correctness.
- Actual VPN use requires installation, device enrollment, least-privilege access policies, and peer connectivity tests.
- REA process startup is not yet an MCP initialize/handshake qualification.
- Remote administration is not implemented. Do not expose this dashboard to a LAN or the internet.
- GitHub-hosted CI does not prove that external clients are enrolled or reachable.

## Upstream projects

- [REA](https://github.com/morluto/rea) — reverse-engineering CLI/MCP capability.
- [NetBird](https://github.com/netbirdio/netbird) — WireGuard-based encrypted overlay networking.

See [VPN encryption architecture](docs/VPN_ENCRYPTION.md), [architecture](docs/ARCHITECTURE.md), [security model](SECURITY.md), and [third-party notices](THIRD_PARTY_NOTICES.md).

## Independence

This repository and application are separate from Elektron. No Elektron source, runtime, dependencies, or operational configuration is included.
