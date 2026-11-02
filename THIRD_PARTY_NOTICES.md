# Third-party notices

This project integrates independently maintained software and does not vendor upstream source. Verify exact release and license texts before redistribution.

| Project | Pinned integration version | Declared license / notice | Role |
|---|---:|---|---|
| REA | 6.8.0 observed upstream package | MIT | External CLI/MCP reverse-engineering tool |
| NetBird | Host-installed version | BSD-3-Clause for most repository content; some server directories have separate AGPLv3 terms | WireGuard encrypted overlay client |
| NetworkX | 3.7 | BSD-3-Clause | Graph algorithms |
| Quimb | 1.15.0 | Apache-2.0 | Tensor networks and contraction |
| PyTorch | 2.7.0 CPU wheel | BSD-style license | Neural-network training and inference |
| FastAPI | 0.162.0 | MIT | Local compute API |
| Uvicorn | 0.54.0 | BSD-3-Clause | ASGI server |
| httpx | 0.28.1 | BSD-3-Clause | API test client |
| pytest | 9.0.2 | MIT | Tests |
| llama.cpp | Operator-provided build; not pinned or bundled | MIT upstream project; model weights have separate licenses | Optional local LLM runtime adapter |
| FAISS | Not installed | MIT | Future optional vector index adapter; not used in this release |
| Qdrant | Not installed | Apache-2.0 | Future optional vector database adapter; not used in this release |
| Ghidra | 12.2 optional external installation; not bundled | Apache-2.0 upstream distribution; verify bundled component notices | Headless static reverse-engineering/decompilation adapter |
| Eclipse Temurin JDK | 25, optional install prerequisite for Ghidra 12.2 | GPL-2.0 with Classpath Exception | Java runtime for external Ghidra; installed separately through WinGet |

Upstream sources: https://github.com/morluto/rea ; https://github.com/netbirdio/netbird ; https://github.com/networkx/networkx ; https://github.com/jcmgray/quimb ; https://github.com/pytorch/pytorch ; https://github.com/fastapi/fastapi ; https://github.com/encode/uvicorn ; https://github.com/encode/httpx ; https://github.com/pytest-dev/pytest ; https://github.com/ggml-org/llama.cpp ; https://github.com/facebookresearch/faiss ; https://github.com/qdrant/qdrant ; https://github.com/NationalSecurityAgency/ghidra .

Fun Industrial original code is licensed under Apache-2.0; see LICENSE and NOTICE. Ghidra remains an independently installed upstream tool and is not redistributed by this repository.

This inventory is preliminary, not a complete transitive dependency audit or legal opinion. Before release, capture exact resolved versions, checksums, provenance, license texts, and notices in a release-specific SBOM. GGUF weights must be reviewed separately from llama.cpp code.
