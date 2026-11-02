# Implementation plan and acceptance gates

## Stage 0 — repository and boundaries
- [x] Confirm public destination and personal-account ownership.
- [x] Keep Elektron separate.
- [x] Establish loopback-first design and adapter model.

## Stage 1 — local control plane
- [x] Dashboard, HTTP API, start/stop/status coordinator.
- [x] REA process adapter; MCP handshake qualification remains open.
- [x] NetBird adapter with explicit connect/disconnect controls.
- [x] Unified Activate Fun Industrial operation.
- [x] Windows one-pass install/configure/test/activate script and JSON evidence report.
- [x] GitHub-hosted Node validation on Linux, Windows, and macOS.

## Stage 2 — VPN encryption integration
- [x] Select maintained WireGuard-based NetBird integration rather than custom cryptography.
- [x] Add explicit Connect VPN and Disconnect VPN operations.
- [x] Add opt-in startup connection setting (off by default).
- [x] Document key ownership, enrollment, least-privilege policies, and verification.
- [ ] Verify installed client status parsing and SSO flow on an enrolled Windows host.
- [ ] Complete peer reachability and deny-policy tests between enrolled devices.

## Stage 3 — graph, tensor, and neural compute
- [x] NetworkX graph analytics and dashboard SVG topology view.
- [x] Quimb tensor shared-bond contraction API.
- [x] PyTorch CPU neural-network training and prediction API.
- [x] Neural training loss history and dashboard chart.
- [x] Bounded inputs and compute service tests.
- [ ] GitHub-hosted compute tests on Linux and Windows (workflow queued; await completed evidence).
- [ ] Benchmark representative real workloads and memory ceilings.
- [ ] Add explicit model/dataset versioning before persistent storage.

## Stage 4 — service qualification and secure operations
- [ ] REA MCP initialize/handshake and graceful shutdown.
- [ ] Structured, redacted logs and diagnostic bundles.
- [ ] Full transitive dependency lock and release SBOM.
- [ ] Threat model, identity, roles, TLS, CSRF, and audit trail.
- [ ] Remote access only after independent security review.

## Stage 5 — release
- [ ] Windows packaging and signed artifacts.
- [ ] Backup, upgrade, rollback, and recovery rehearsal.
- [ ] Independent release review.

A stage is complete only with implementation and evidence. GitHub CI does not establish live VPN peer connectivity or production qualification.
