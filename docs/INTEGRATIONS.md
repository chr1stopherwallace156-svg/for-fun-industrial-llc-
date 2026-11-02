# Integration inventory

| Component | Role | v0.1 interface | State |
|---|---|---|---|
| REA (morluto/rea) | Reverse-engineering CLI/MCP | External executable and arguments | Process adapter present; MCP handshake pending |
| NetBird (netbirdio/netbird) | WireGuard-based encrypted overlay VPN | External CLI: status, up, down | Operator-controlled connect/disconnect; opt-in startup connection; peer-level verification pending |

## Rules

- Keep upstream repositories independent and unmodified.
- Pin exact release versions before production deployment; this integration does not silently install or update dependencies.
- Record source URL, version, license, checksum/provenance, runtime requirements, and any local patches before adding an integration.
- Use documented APIs, CLIs, or protocols; do not scrape private internals.
- Each adapter must define start, stop, health, timeout, error, and rollback semantics.
- A service is not production-qualified merely because its process starts.
- VPN details, key custody, policy requirements, and acceptance criteria are in [VPN_ENCRYPTION.md](VPN_ENCRYPTION.md).
