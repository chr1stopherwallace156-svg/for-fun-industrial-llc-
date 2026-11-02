# Third-party notices

This project integrates independently maintained software and does not vendor upstream source.

## REA

- Repository: https://github.com/morluto/rea
- Upstream package observed during initial inspection: rea-agents 6.8.0.
- Declared upstream package license: MIT.
- Integration: external CLI/MCP process; no REA source copied here.

## NetBird

- Repository: https://github.com/netbirdio/netbird
- Integration: separately installed client; this application invokes the external CLI.
- Upstream root LICENSE declares BSD-3-Clause for most repository content, with management/, signal/, relay/, and combined/ directories separately licensed under AGPLv3.
- This repository does not vendor those components. Verify the exact client release and its applicable license notices before packaging or redistribution.

This preliminary inventory is not a complete transitive dependency audit or legal opinion. Before shipping, record exact versions, checksums, provenance, license texts, and notices in a release-specific bill of materials.
