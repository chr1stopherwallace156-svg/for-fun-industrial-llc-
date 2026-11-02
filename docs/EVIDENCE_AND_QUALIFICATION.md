# Evidence and qualification doctrine

This project adopts the disciplined evidence practices developed during separate Elektron engineering work without importing Elektron source, runtime, dependencies, host configuration, or private evidence. The reusable practices are independent verification, explicit gates, hostile test cases, regression preservation, and reproducible evidence.

## Qualification sequence

1. **Source identity:** record repository, branch, commit SHA, clean/dirty state, and file diff validation.
2. **Environment identity:** record OS, Python and Node versions, direct and resolved dependencies, and optional Ghidra version/archive digest.
3. **License and provenance:** verify the project Apache-2.0 declaration; retain third-party notices; capture package inventories. Review model-weight licenses separately from runtime code.
4. **Static validation:** syntax, imports, API schema validation, no-shell process boundaries, loopback-only service binds, and safe configuration checks.
5. **Deterministic tests:** compute service, Hopfield recall/energy, vector ranking/topology, multi-universe model isolation, default-deny bridges, sample metadata intake, sample size limits, and refusal without explicit isolated-VM attestation.
6. **Adversarial tests:** malformed shapes, non-finite values, unknown universes, unauthorized cross-space transfer, missing tools, oversized files, and report-path safety.
7. **Integration tests:** run the full service and verify expected health and local API behavior. A process starting is not proof of semantic readiness.
8. **Resource/performance tests:** record dataset, random seed, commit, hardware, wall time, memory, throughput, and accuracy/recall. No benchmark claims without repeatable measurements.
9. **Security qualification:** review process launch, sample handling, secrets, bind addresses, bridge authorization, report handling, and external tool boundaries.
10. **Host qualification:** execute the full Windows activation and qualification sequence; retain JSON reports, logs, resolved package inventories, and GitHub Actions run links.
11. **Independent review:** a reviewer who did not author the change checks evidence, failure handling, licenses, and scope before merge/release.

## Evidence record schema

Every qualification artifact should record at least: document ID, UTC timestamp, local host timestamp and timezone, repository URL, branch, commit SHA, working-tree status, OS/architecture, tool versions, dependency inventory, test command, exit code, per-test result, output hashes, and final state.

States are explicit:
- PASS: every required check completed and passed.
- PASS_WITH_ACTIONS_REQUIRED: tests pass but a documented optional or environmental gate remains.
- HOLD: required evidence or a prerequisite is unavailable; do not advance.
- FAIL: a required check failed; preserve original failure evidence before repair.

A repaired result never overwrites the original failure record. Create a new run ID and rerun the complete relevant qualification chain, including regression tests. Do not relabel a failed result as pass based on a source edit alone.

## Release policy

A green hosted CI run is necessary but not sufficient. The local Windows run, dependency/provenance review, external integration checks, and security review are separate. Real malware analysis has additional isolated-VM and Ghidra gates and is not implied by synthetic CI tests. Do not merge while a required gate is failed or held.
