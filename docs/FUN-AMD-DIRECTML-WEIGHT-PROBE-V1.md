# Fun Industrial — AMD RX 6600 DirectML Actual Weight Update V1

## Findings from operator diagnostics (2026-11-23)
- Windows 11 Home, build 26200
- AMD RX 6600 (vendor nominal 8 GiB VRAM); driver 32.0.21045.29003
- System RAM 15.61 GiB; ~3.88 GiB available when measured
- Qwen3-4B Q4_K_M via llama.cpp 127.0.0.1:8088 with
  --threads 4 --ctx-size 4096 --n-gpu-layers 0
- Active llama.cpp build lists **no accelerator devices** and only CPU/RPC DLL backends
- Global Python 3.12: torch 2.15.0+cpu; CUDA False, HIP None, DirectML absent
- Original Qwen HF safetensors checkpoint, PEFT, transformers, accelerate and
  bitsandbytes absent. No original Qwen weight training yet.
- Do not interpret resident model RAM as wholly reclaimable. Do not add Windows
  standby cache to already available memory.

## What this test does

The standalone Python probe creates 8 trainable float parameters, moves them to
DirectML, evaluates a deterministic loss, computes gradients, updates the
parameters on the device, and validates that loss decreased. A successful test
establishes **tiny DirectML autodiff and real weight updates**; it does **not**
qualify Qwen3-4B, bitsandbytes, QLoRA, production GPU acceleration, CUDA, ROCm
or compatible operator coverage for transformers.

## User-approved isolated installation and test

From checkout FunIndustrial-FISRE-Live on
feature/fun-fisre-live-8802-20261122:

Read-only script preflight:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Test-Fun-AMD-DirectML-Weights-V1.ps1

**Explicit installation**: If the operator elects to execute this command, it
creates an isolated virtual environment in
%LOCALAPPDATA%\FunIndustrial\AMDDirectMLWeightProbeV1\venv and installs from
public PyPI the pinned torch-directml==0.2.5.dev240914 wheel with its dependencies.

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Test-Fun-AMD-DirectML-Weights-V1.ps1 -InstallAndProbe -Approval I_APPROVE_ISOLATED_DIRECTML_INSTALL

The installation involves downloading substantial packages, storage and network
use. It does not use the working Qwen GGUF, does not overwrite global PyTorch,
does not modify live launcher settings, and does not restart any services.
The runner checks at least 4 GiB free disk, requires explicit approval, refuses
existing incomplete environments and checks service listener PIDs before/after
a successful test. It avoids re-installation after a completed installation.

**Do not run installation if a software or driver compatibility issue already
exists.** The isolated package is historically pinned to the Windows Python
3.12 wheel listed on PyPI (Sep 2024); its dependency resolver may install an
older version of torch inside the venv even though the global Python has
torch 2.15.0+cpu.

If an error appears, report the full FUN_DIRECTML_PROBE_HOLD and JSON diagnostic.
Do not attempt to repair by changing global Python/AMD drivers or disabling
RAM protections.

## Separate route: GPU-accelerated *inference* only

No GPU offloading is possible with the current llama.cpp binaries because
--list-devices returns none and ggml-vulkan.dll is absent. A compatible
**separately staged** llama.cpp Vulkan build could be benchmarked later on the
RX 6600 without changing the live CPU server. It would be only an inference
optimization, not equivalent to neural weight training.

Authoritative references:
- https://learn.microsoft.com/en-us/windows/ai/directml/pytorch-windows
- https://pypi.org/project/torch-directml/
- https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md

## Next guarded milestones

1. Tiny DirectML actual gradient + weight update (this probe).
2. Small compatible transformer layer and LoRA-gradient benchmark with VRAM
   monitoring and held-out accuracy.
3. Re-evaluate RAM/VRAM usage, supported matrix operators and actual performance.
4. Obtain verified matching original Qwen checkpoint and dependencies.
5. Train/evaluate Qwen adapter **only on an actually supported backend**.
6. Convert adapter to compatible GGUF and validate isolated inference before
   any separate explicit approval to alter the live 8088 server.

No claims of Qwen having learned Fibonacci are made.
