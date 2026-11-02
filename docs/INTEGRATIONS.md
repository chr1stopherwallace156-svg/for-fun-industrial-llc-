# Integration inventory

| Component | Role | v0.1 interface | State |
|---|---|---|---|
| REA (morluto/rea) | Reverse-engineering CLI/MCP | External executable and arguments | Process adapter present; MCP handshake pending |
| NetBird (netbirdio/netbird) | Encrypted overlay VPN | External CLI status command | Read-only status adapter; install and enroll separately |

Keep upstream repositories independent and unmodified. Before production pin exact release versions, checksums, provenance, license text, runtime requirements, and update policy. Integrate through documented APIs, CLIs, or protocols. Each adapter requires start, stop, health, timeout, failure, and rollback tests.
