# Open-source AI/ML layer — v0.1 candidate

This additive subsystem is independent of Elektron. It provides classic and modern Hopfield retrieval, isolated neural/vector universes, exact cosine search with kNN topology, and an opt-in llama.cpp adapter.

## Runtime

The llama.cpp adapter requires an operator-supplied local llama-server executable and GGUF model. It never downloads weights, uses shell execution, or binds beyond 127.0.0.1. The process adapter is currently a library interface only; it is not exposed as an unauthenticated HTTP process-launch endpoint. Process start is not proof of model readiness. GGUF model licenses are separate and must be reviewed individually.

## Hopfield memory

Classic bipolar Hopfield storage uses Hebbian weights and asynchronous recall with energy history. Modern retrieval is a continuous softmax-attention operation. This is a bounded reference implementation, not a claim of large capacity or novel learning theory.

## Vector topology

Exact cosine similarity is the correctness baseline. The topology output is an exact cosine k-nearest-neighbour graph, not HNSW. FAISS and Qdrant are possible future adapters, not installed dependencies in this phase.

## Multi-universe option C

Each universe has its own vector dimension/index, neural-state namespace, memory inbox, and independently trained in-memory PyTorch model. Per-universe neural training and prediction are exposed under /universes/{id}/neural/train and /universes/{id}/neural/predict. Transfer is denied until an explicit directed bridge is created. Reverse transfer requires a second bridge. No implicit weight sharing, index sharing, or cross-space distance comparison exists. This is a local reference/control plane, not a distributed autonomous neural fabric.

## API

Endpoints are under /ai on the existing loopback compute service: health; hopfield store/recall/modern-retrieve; universes create/list/describe; per-universe vector add/search/topology; bridge create/transfer; neural-state update; llama.cpp runtime status. The runtime adapter's process-launch method is not exposed as an unauthenticated HTTP route; operator-controlled launch integration remains a later security gate.

## Qualification and limitations

CPU-first; no model weights or corpora committed or downloaded by CI. No custom cryptography, secure transport, remote administration, GPU acceleration, production persistence, multi-host networking, or benchmark claims. CI tests deterministic synthetic fixtures. Independent code/license review and Windows host validation remain release gates.

Upstream project: https://github.com/ggml-org/llama.cpp. No upstream source is vendored or modified.
