# Implementation plan and acceptance gates

## Stage 0 — repository and boundaries
- [x] Confirm public destination and personal-account ownership.
- [x] Keep Elektron separate.
- [x] Establish loopback-first design and adapter model.

## Stage 1 — local control plane
- [x] Dashboard, HTTP API, start/stop/status coordinator.
- [x] REA process adapter; MCP handshake qualification remains open.
- [x] NetBird adapter with read-only status and explicit connect/disconnect controls.
- [x] Configuration validation and baseline tests.
- [x] GitHub-hosted Node syntax and unit-test workflow (latest commit run must pass).

## Stage 2 — VPN encryption integration
- [x] Select maintained WireGuard-based NetBird integration rather than custom cryptography.
- [x] Add explicit Connect VPN and Disconnect VPN operations.
- [x] Add opt-in NetBird autoconnect setting (off by default).
- [x] Document key ownership, enrollment, least-privilege policies, and verification.
- [ ] Verify NetBird CLI status parsing against an installed client release.
- [ ] Complete peer reachability and deny-policy tests on enrolled devices.

## Stage 3 — service qualification
- [ ] REA MCP initialize/handshake and graceful shutdown.
- [ ] Structured, redacted logs and diagnostic bundles.
- [ ] Adapter contract and fault-injection tests.
- [ ] Dependency versions, checksums, provenance, and license bill of materials.

## Stage 4 — secure remote operations
- [ ] Threat model, identity, roles, TLS, CSRF, and audit trail.
- [ ] Remote access only after independent security review.

## Stage 5 — release
- [ ] Windows packaging and signed artifacts.
- [ ] Backup, upgrade, rollback, and recovery rehearsal.
- [ ] Independent release review.

A stage is complete only with implementation and evidence. No VPN enrollment or real peer connectivity is implied by source code alone.
