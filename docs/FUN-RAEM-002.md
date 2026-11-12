# RAEM-002: Bounded synthetic stream qualification

## Objective

Prove a Fun Industrial worker can **process** a large logical input in small chunks without retaining the whole dataset in RAM. This is not a claim that 32 GiB AIL can run on 16 GiB RAM, or that the input has been compressed. The stream computes a SHA-256 checksum and counts bytes while holding only one 64 KiB synthetic chunk. CPU and memory measurements are observed, not guaranteed resource caps.

## New components

- `src/resource-aware/bounded-stream.mjs`: read-only bounded synthetic source and local regular-file SHA-256 streaming with backpressure; rejects symbolic links, absolute-path requirements, excessive input length; periodically checks worker RSS and free host memory and can return HOLD.
- `scripts/Qualify-Fun-RAEM002.mjs`: operator-initiated qualification for a **synthetic 128 MiB dataset**, with a proposed **128 MiB worker RSS ceiling**, preserving the existing RAEM-001 host reserve policy. If available headroom is too small, does not run the synthetic job. No external data collection.
- `intelligence-checks/resource-aware-stream-case.mjs`: synthetic checksum accuracy, hold, validation, local-file and symlink checks.

## Run on the user's Windows test-only checkout

With Node.js 22 or newer:

```powershell
node --test .\intelligence-checks\resource-aware-manager-case.mjs .\intelligence-checks\resource-aware-stream-case.mjs
node .\scripts\Qualify-Fun-RAEM002.mjs
```

This does **not** start, stop or restart Qwen, llama.cpp, Ollama, REA, AIL, any dashboard, or scheduler. It uses no network or write-to-disk operations; the test suite writes small temporary synthetic fixture files and deletes them. It never downloads leaked information. On a HOLD, the worker processes nothing or stops early; operators should not manually weaken reserve thresholds.

## Boundaries and interpretation

1. RAEM-001 grants are advisory; RAEM-002 checks process RSS periodically. Neither is an operating-system enforced hard memory cap. Another actor can allocate memory between samples. A future worker subprocess should have OS-backed limits, cancellation, parent liveness supervision, and crash isolation.
2. `os.freemem()` and sampled process RSS are imperfect proxies on Windows. Record real working set and Windows available-memory counters during later qualification.
3. Streaming hashes a contiguous byte sequence and retains only the resulting digest. General AIL workflows may require indexing, caching, multiple databases, browser processes, and other persistent memory.
4. This stage has no autonomous scheduled jobs. RAEM-001 provides a six-hour *planning interval* but is not a live collector.
5. `analyzeLocalFile` performs a path type check before opening; a future production version must guard against filesystem races and bind the opened descriptor before processing untrusted paths.

## Qualification gates

- The 8 stream tests must pass in the local clone.
- RAEM-001's existing 13 tests must continue to pass.
- A machine with too little headroom must report `HOLD` without launching the synthetic worker.
- When the benchmark is admitted, report `processedBytes`, `peakRssMiB`, `elapsedMs`, `sha256` and completion status.
- Repeat measurements with Windows performance counters before making any production resource-efficiency claims.
