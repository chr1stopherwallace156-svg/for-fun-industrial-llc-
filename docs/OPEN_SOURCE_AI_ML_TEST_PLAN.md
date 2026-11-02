# AI/ML qualification plan

Automated checks cover classic Hopfield storage/recall and energy behavior, invalid patterns, modern retrieval ranking, exact cosine ranking and kNN topology, universe isolation, directed default-deny bridges, API integration, and refusal to launch llama.cpp without local model/runtime assets.

Not yet covered: large-scale associative capacity/noisy recall, theoretical bounds, embedding quality, FAISS/Qdrant benchmarks, LLM output quality and prompt injection, model supply-chain verification, Windows process readiness/shutdown, GPU execution, multi-host networking, persistence, or penetration testing.

Release gates: green CI on supported OS; independent code/dependency/license review; Windows execution with an operator-supplied small GGUF model and recorded memory/latency; bridge revocation and negative security tests before remote exposure; reproducible benchmarks recording hardware, dataset, seed, dimensions, and commit SHA. No performance claim without evidence.

Additional tests cover independently trained per-universe neural models, inference within the owning universe, and denial of prediction from an untrained neighboring universe.
\nDefensive malware static-analysis tests use synthetic harmless byte fixtures only. They verify metadata hashing, size limits, explicit offline-VM confirmation, and missing-tool handling. They do not run Ghidra on a real sample, execute malware, or establish isolation. See docs/MALWARE_STATIC_ANALYSIS.md.\n