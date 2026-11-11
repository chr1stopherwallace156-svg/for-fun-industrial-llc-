# Fun Industrial: reconnect the existing external llama.cpp model to compute 8791

## Diagnostic
The separate Python compute service on port 8791 was restarted with Recover-Fun-Compute.ps1, and `/health` returned running. However, `/ai/runtime/llama-cpp` returned `stopped` while the independently launched llama.cpp model at `127.0.0.1:8088/health` returned HTTP 200. The old `LlamaCppRuntime.status()` returned `stopped` whenever this Python instance did not own a launched child. It did not discover or adopt a matching external instance.

## Solution (read-only external adoption)
- Check the configured local GGUF model and server executable exist.
- Check ONLY loopback 8088 health returns `ok` or `ready`.
- Check `/v1/models` advertises the exact configured model filename or stem.
- Mark it `ready`, `ownership: external_unmanaged`, `managed: false` without starting it.
- Route chat to the same existing llama.cpp process. Recheck the model identity before each chat.
- Never terminate an externally adopted process. An unmatched model, port, or missing asset remains stopped/unknown.
- A direct start request naming another model is denied rather than adopted.

## Qualification
The pure Python offline unit tests use simulated HTTP replies, temporary test-only assets and mocked process startup. They test status, chat, wrong model, wrong port, missing assets, unavailable endpoint, different explicit model arguments, and unmanaged stop behavior. GitHub CI runs on Windows and Linux and parses the PowerShell script without executing it.

## Deployment
Clone `repair/fun-external-llama-adoption-20261111` into its OWN working folder. Run `Stage-Fun-External-Llama-Adoption.ps1` without parameters first: source compatibility, verified process ownership (ports 8088/8791/8789), model ID matching, and isolated tests. It backs up only the original Fun `ai_ml/llama_runtime.py` and does not change live files or processes.

Do NOT use `-Apply` until staging passes and volatile data is reviewed. The apply switch requires **both** `-Apply -AcceptVolatileStateLoss`, because a bounded compute restart necessarily resets memory-only Hopfield, neural-training, and universe state. No automatic snapshot of those transient states exists. The script restarts ONLY the verified 8791 Python process by invoking the established `Recover-Fun-Compute.ps1`, then verifies external model status and preserved 8088/8789 process owners. If the new process cannot be verified, source rollback and a guarded restart of the original compute implementation are attempted. Rollback can restore service availability but cannot restore prior volatile compute state.

**Do not confuse this with the distinct Elektron Ollama installation.** No Ollama calls, models or processes are involved.

## Known separate hold: REA
The old dashboard `/api/rea/tools` returned HTTP 403. This means the REA catalogue/permissions may be unavailable or blocked after the dashboard rollback. This repair does NOT change REA or authorize tool execution. Before Cognitive `-Apply`, qualify REA initialization/allowlist with a separate read-only status check and explicit operator-initiated recovery if needed.

## Caveats
- `Stage-Fun-External-Llama-Adoption.ps1` is anchored to an exact reviewed pre-adoption Python module. If the live module has other customizations, HOLD; do not overwrite them.
- If the actual llama.cpp `/v1/models` ID is not the configured GGUF filename/stem, HOLD. Diagnose that mismatch rather than bypassing identity checks.
- The stage code never changes source or process state; model status check reaches only the user's localhost.
- Even if model adoption passes, cognitive deployment is a SEPARATE guarded step and remains pending until the full chat and REA preflight is satisfied.