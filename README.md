# Fun Industrial Platform

Standalone integration, compute, and open-source AI/ML platform for Fun Industrial LLC. It connects independently maintained open-source tools through adapters; it does not rewrite or absorb upstream projects.

## Platform capabilities

- Local Node.js control plane and dashboard with one Activate Fun Industrial operation.
- NetBird integration for WireGuard-based encrypted networking.
- REA 6.8.0 installed privately and connected through a real MCP initialize handshake, tools/list catalogue, and operator-approved tool calls.
- Separate local compute service: NetworkX graph analytics, Quimb tensor contraction, and PyTorch CPU neural training/prediction.
- Open-source AI/ML candidate: classic and modern Hopfield retrieval, isolated multi-universe neural/vector spaces, exact cosine vector search and kNN topology, and optional llama.cpp local inference adapter.
- Defensive static malware analysis: SHA-256 sample intake and opt-in Ghidra headless decompilation for authorized samples; no sample execution or malware binaries included.
- One-pass Windows PowerShell activation, integrated AI conversation UI, VPN-gated REA, evidence reports, and repository-scoped removal.

## AI/ML layer

See [integrated platform architecture](docs/INTEGRATED_PLATFORM.md), [VPN security boundary](docs/VPN_SECURITY_BOUNDARY.md), [open-source AI/ML architecture](docs/OPEN_SOURCE_AI_ML.md), [multi-universe design](docs/MULTI_UNIVERSE_DESIGN.md), [qualification plan](docs/OPEN_SOURCE_AI_ML_TEST_PLAN.md), [Windows qualification](docs/WINDOWS_QUALIFICATION.md), [defensive malware static analysis](docs/MALWARE_STATIC_ANALYSIS.md), and [evidence-first qualification doctrine](docs/EVIDENCE_AND_QUALIFICATION.md).

Option C means each universe owns an independent neural-state namespace and a separate vector embedding space/index. Cross-universe memory transfer is denied unless an explicit directed bridge is configured. The current vector search is exact cosine, not HNSW. Neural models train independently per universe on CPU. llama.cpp starts when the operator supplies a local executable and GGUF model; no weights are downloaded by activation or CI. The dashboard includes local chat with approval-gated built-in graph/tensor/Hopfield/multi-universe tools and explicitly allowlisted REA tool proposals. Qwen3-4B-GGUF Q4_K_M is a documented Apache-2.0 starter model, not bundled.

## Windows deployment

Clone the feature branch while PR #2 is under review; run scripts/Install-Ghidra.ps1 (optional static-analysis tool), scripts/Activate-FunIndustrial.ps1, then scripts/Qualify-FunIndustrial.ps1 in sequence. Configure llama.cpp and the local GGUF model using scripts/Configure-LocalModel.ps1. Full instructions: docs/WINDOWS_QUALIFICATION.md and docs/WINDOWS_ACTIVATION.md. Activation creates an isolated Python environment, installs pinned dependencies and CPU-only PyTorch, installs REA 6.8.0 privately, installs/checks NetBird, runs tests, and starts the enabled services. The VPN must have a connected exit-node route before REA starts.

## Security and limitations

- Dashboard and compute API are loopback-only.
- NetBird manages WireGuard private key material; this app does not access it.
- All functional AI/ML, compute, and REA APIs are gated on NetBird connection and its advertised IPv4 default exit-node route; managed compute, AI, and REA processes stop when that gate is lost. A Windows firewall kill switch and IPv6/DNS leak tests are still separate host-level qualification gates.
- PyTorch uses CPU; GPU acceleration is not claimed.
- REA readiness requires MCP initialize and tools/list; tools remain blocked unless their exact names are allowlisted and every call is approved in the UI.
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

See [isolated removal instructions](docs/INTEGRATED_PLATFORM.md#isolated-removal) and run scripts/Remove-FunIndustrial.ps1 to remove the private runtime without touching Elektron.

## Independence

This repository is separate from Elektron. No Elektron source, runtime, dependencies, or operational configuration is included.
