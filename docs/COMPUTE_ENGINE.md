# Graph, tensor, and neural compute engine

## Scope

The compute service is a separate local Python process integrated through a narrow HTTP adapter. It combines maintained upstream libraries rather than reimplementing their mathematics.

| Capability | Upstream engine | Initial operation |
|---|---|---|
| Graph analysis | NetworkX 3.7 | Components, density, degree centrality |
| Tensor networks | Quimb 1.15.0 | Two-tensor shared-bond contraction |
| Neural networks | PyTorch 2.15.0 | Train a bounded CPU multilayer perceptron and predict |
| API | FastAPI 0.162.0 / Uvicorn 0.54.0 | Loopback-only local service |

## API

- GET /health
- POST /graph/analyze
- POST /tensor/matmul
- POST /nn/train
- POST /nn/predict

All request sizes and matrix dimensions are bounded. The neural model is deterministic-seeded, CPU-only, and held in memory. It is not persisted and is reset when the service restarts. Do not submit sensitive training data until a data-retention policy is approved.

## Hardware policy

The initial Windows deployment uses PyTorch CPU execution. The machine's AMD Radeon GPU is not assumed to be a supported PyTorch CUDA device; CUDA is NVIDIA-specific, and a Windows AMD/ROCm path is not enabled here. This avoids misleading GPU-acceleration claims and does not change GPU drivers. A separate AMD acceleration evaluation can be performed later.

## Security boundary

The API binds to 127.0.0.1:8790 only. It is not exposed to the LAN or VPN. The service has no authentication because it is strictly local in this release. Do not change its bind address or publish the port.

## Limits and next qualification

This is a first useful computational subsystem, not a trained general-purpose model or production ML platform. Next stages: persistent model registry with explicit consent, dataset validation and lineage, graph visualization, tensor contraction memory estimates, workload queues, benchmark history, and independent security/performance review.
