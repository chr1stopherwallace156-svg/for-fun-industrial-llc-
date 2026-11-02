# Fun Industrial Platform

A standalone integration application for Fun Industrial LLC. It coordinates existing open-source tools through adapters; it does not rewrite or absorb their upstream projects.

## Current status — v0.1.0 bootstrap

The first implementation branch contains a local Node.js control plane, dashboard, lifecycle coordinator, REA process adapter, and read-only NetBird status adapter. These are initial integration components, not a claim that optional upstream services have been installed or qualified on an operator's machine.

## Capabilities

- **Central control panel:** local dashboard to start, stop, and inspect integrated services.
- **Coordinated startup:** invokes enabled adapters in sequence and reports each observed state.
- **REA integration:** starts the independently installed REA CLI/MCP process when explicitly enabled.
- **VPN visibility:** reads NetBird client status; it does not enroll, connect, disconnect, or alter VPN configuration.
- **Safety boundary:** loopback-only binding, no committed secrets, no automatic installation, no privilege elevation, and no shell command interpolation.
- **Extensibility:** adapter boundaries allow additional upstream projects to be integrated without copying their source.

## Requirements and quick start

Node.js 22.23.4 or newer is required.

```sh
npm run check
npm test
npm start
```

Open http://127.0.0.1:8787.

Optional adapter settings are documented in `.env.example`. Both integrations are disabled by default.

## Important qualification notes

- REA process startup is not yet an MCP initialize/handshake qualification.
- NetBird status output is not independent proof of tunnel connectivity or cryptographic security.
- NetBird must be installed and enrolled separately using its official operator flow.
- Remote administration is not implemented. Do not expose this dashboard to a LAN or the internet.
- Host acceptance, CI, packaging, and release qualification remain outstanding.

## Upstream projects

- [REA](https://github.com/morluto/rea) — reverse-engineering CLI/MCP capability.
- [NetBird](https://github.com/netbirdio/netbird) — encrypted overlay networking based on WireGuard.

The integration calls upstream software through its external interface. It does not modify those upstream repositories. Preserve upstream licenses and attribution; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Integration inventory](docs/INTEGRATIONS.md)
- [Security model](SECURITY.md)
- [Operations](docs/OPERATIONS.md)
- [Implementation plan and acceptance gates](docs/IMPLEMENTATION_PLAN.md)

## Independence

This repository and application are separate from Elektron. No Elektron source, runtime, dependencies, or operational configuration is included.
