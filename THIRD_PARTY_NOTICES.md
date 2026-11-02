# Third-party notices

This project integrates independently maintained software and does not vendor upstream source. Verify the exact release and license texts before redistribution.

| Project | Pinned integration version | Declared license / notice | Role |
|---|---:|---|---|
| REA | 6.8.0 observed upstream package | MIT | External CLI/MCP reverse-engineering tool |
| NetBird | Installed client version determined on host | BSD-3-Clause for most repository content; some server directories have separate AGPLv3 terms | WireGuard encrypted overlay client |
| NetworkX | 3.7 | BSD-3-Clause | Graph algorithms |
| Quimb | 1.15.0 | Apache-2.0 | Tensor networks and contraction |
| PyTorch | 2.7.0 CPU wheel | BSD-style license | Neural-network training and inference |
| FastAPI | 0.162.0 | MIT | Local compute API |
| Uvicorn | 0.54.0 | BSD-3-Clause | ASGI server |
| httpx | 0.28.1 | BSD-3-Clause | API test client |
| pytest | 9.0.2 | MIT | Compute tests |

Upstream sources:
- https://github.com/morluto/rea
- https://github.com/netbirdio/netbird
- https://github.com/networkx/networkx
- https://github.com/jcmgray/quimb
- https://github.com/pytorch/pytorch
- https://github.com/fastapi/fastapi
- https://github.com/encode/uvicorn
- https://github.com/encode/httpx
- https://github.com/pytest-dev/pytest

This inventory is preliminary, not a complete transitive dependency audit or legal opinion. Before shipping, capture exact resolved versions, checksums, provenance, license texts, and notices in a release-specific SBOM.
