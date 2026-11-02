# Fun Industrial Platform

Standalone integration, compute, and open-source AI/ML platform for Fun Industrial LLC. It connects independently maintained open-source tools through adapters; it does not rewrite or absorb upstream projects.

## Platform capabilities

- Local Node.js control plane and dashboard with one Activate Fun Industrial operation.
- NetBird integration for WireGuard-based encrypted networking.
- REA CLI/MCP adapter (MCP handshake qualification remains pending).
- Separate local compute service: NetworkX graph analytics, Quimb tensor contraction, and PyTorch CPU neural training/prediction.
- Open-source AI/ML candidate: classic and modern Hopfield retrieval, isolated multi-universe neural/vector spaces, exact cosine vector search and kNN topology, and optional llama.cpp local inference adapter.
- Defensive static malware analysis: SHA-256 sample intake and opt-in Ghidra headless decompilation for authorized samples; no sample execution or malware binaries included.
- One-pass Windows PowerShell activation, tests, and JSON report.

## AI/ML layer

See [open-source AI/ML architecture](docs/OPEN_SOURCE_AI_ML.md), [multi-universe design](docs/MULTI_UNIVERSE_DESIGN.md), [qualification plan](docs/OPEN_SOURCE_AI_ML_TEST_PLAN.md), [Windows qualification](docs/WINDOWS_QUALIFICATION.md), and [defensive malware static analysis](docs/MALWARE_STATIC_ANALYSIS.md).

Option C means each universe owns an independent neural-state namespace and a separate vector embedding space/index. Cross-universe memory transfer is denied unless an explicit directed bridge is configured. The current vector search is exact cosine, not HNSW. Neural models train independently per universe on CPU. llama.cpp starts only when the operator supplies a local executable and GGUF model; no weights are downloaded by the app or CI. Model licenses are reviewed separately.

## Windows deployment

Clone the integration branch and run scripts/Activate-FunIndustrial.ps1 from the repository root. Full instructions: docs/WINDOWS_ACTIVATION.md. The script creates an isolated Python environment, installs pinned direct dependencies and CPU-only PyTorch, runs tests, installs NetBird, and activates enabled services. NetBird authentication requires the operator.

## Security and limitations

- Dashboard and compute API are loopback-only.
- NetBird manages WireGuard private key material; this app does not access it.
- Peer reachability and least-privilege policy require a second enrolled device and connectivity tests.
- PyTorch uses CPU; GPU acceleration is not claimed.
- REA process startup is not proof of a successful MCP handshake.
- AI/ML models and training state are in-memory; model persistence and multi-host distributed learning are not enabled.
- No custom cryptography, remote administration, broad subnet routes, or automatic model downloads.
- Never commit .env, setup keys, private keys, model weights, or activation reports.

## Upstream projects

- https://github.com/morluto/rea
- https://github.com/netbirdio/netbird
- https://github.com/networkx/networkx
- https://github.com/jcmgray/quimb
- https://github.com/pytorch/pytorch
- https://github.com/fastapi/fastapi
- https://github.com/ggml-org/llama.cpp (optional adapter; not vendored)

See THIRD_PARTY_NOTICES.md for preliminary license information.

## Independence

This repository is separate from Elektron. No Elektron source, runtime, dependencies, or operational configuration is included.
