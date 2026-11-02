# Implementation plan and acceptance gates

## Stage 0 — repository and boundaries
- [x] Confirm public destination and personal-account ownership.
- [x] Keep Elektron separate.
- [x] Establish loopback-first design and adapters.

## Stage 1 — local control plane
- [x] Dashboard, HTTP API, start/stop/status coordinator.
- [x] REA process adapter with handshake limitation documented.
- [x] NetBird read-only status adapter.
- [x] Configuration validation and baseline tests.
- [ ] CI and Windows host acceptance tests.

## Stage 2 — service qualification
- [ ] REA MCP initialize/handshake and graceful shutdown.
- [ ] Machine-readable NetBird peer/tunnel verification.
- [ ] Structured, redacted logs and diagnostic bundles.
- [ ] Adapter contract and fault-injection tests.

## Stage 3 — remote operations
- [ ] Threat model, identity, roles, TLS, CSRF, audit trail.
- [ ] Remote access only after independent security review.

## Stage 4 — release
- [ ] Windows packaging and signed artifacts.
- [ ] Version-pinned software bill of materials and license audit.
- [ ] Backup, upgrade, rollback, and recovery rehearsal.

A stage is complete only with implementation and test evidence. No deployment or VPN enrollment is implied.
