# Fun Industrial — AMD DirectML Qwen-Geometry LoRA Probe V3

Purpose: escalate the passed 8-parameter GPU autograd test (V1) and 448-
parameter miniature transformer LoRA test (V2) to realistic Qwen3-4B
single-layer dimensions, while maintaining strict separation from the live
Qwen server, running ML/REA dashboard, and Elektron.

## Confirmed operator evidence (Nov 23, 2026)

- Windows 11 Home, AMD RX 6600, 15.61 GiB available physical RAM total
- CPU-only Qwen3-4B Q4_K_M live on 127.0.0.1:8088; live llama.cpp has
  no accelerator backends.
- Isolated DirectML training environment:
  torch 2.4.1+cpu + privateuseone:0 (RX 6600).
- V1 real tiny neural weight updates: PASS, eight parameters, 16 steps.
- V2 real miniature grouped-query attention LoRA training: PASS, 448 trainable
  parameters, 64 steps; 99.02% synthetic training loss reduction.
- **No LoRA adapter for the original Qwen3-4B has yet been trained.**

## V3 shapes

The V3 Python test constructs a *synthetic single transformer block* using
Qwen3-style grouped query attention (GQA), Q/K RMS normalization, causal
masking, RoPE, residual paths, RMS normalization and SwiGLU feed-forward.

It has two profiles:

- scaled: width 512, 8 attention heads, 2 KV heads, head dimension 64,
  feed-forward width 2048, sequence 6, 12 updates, host free RAM >=2.5 GiB.
- qwen3-4b-layer: width 2560, 32 attention heads, 8 KV heads, head dimension
  128, intermediate width 9728, sequence 4, 4 updates, host free RAM >=3.3 GiB.

Both use float32 **random frozen base matrices**, not Qwen checkpoint
weights, with 4-rank query/value LoRA adapters. The full-dimension profile
allocates roughly 101 million random frozen float32 parameters (about
0.38 GiB of raw tensor bytes before GPU/host copies, activations and library
overhead), **not** four billion actual Qwen model parameters. The test
uses only one block rather than all 36 layers. This memory estimate is not
a measured VRAM peak. The probe explicitly reports
gpu_vram_peak_verified=false and actual_peak_vram_bytes=null.

Training is on a synthetic teacher output created by changing only LoRA
matrices of that exact frozen random block. A successful test establishes
DirectML gradient operator compatibility, real nonzero Q/V LoRA weight
changes, numerical finiteness and a reduction in synthetic training error.

The small synthetic task is deliberately not proof of intelligence,
mathematical generalization, Qwen3-4B quantized training compatibility,
or practical wall-clock training feasibility.

## Run

Prerequisite: previously installed isolated DirectML venv and clean known
branch. No package installs, downloads, network access, model loading, or
live llama.cpp restarts.

Scaled-only:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Test-Fun-AMD-DirectML-QwenGeometry-LoRA-V3.ps1

Scaled then explicitly opt in to full single-layer geometry:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Test-Fun-AMD-DirectML-QwenGeometry-LoRA-V3.ps1 -QwenLayer

Both run from the existing FunIndustrial-FISRE-Live checkout. The runner
verifies current branch/clean checkout, original isolated environment and
service listener PID stability. The Python probe checks available host
RAM before constructing a model and uses bounded batch/sequence lengths,
two CPU threads, no trained checkpoints, no optimizer moment buffers,
and only 12 or 4 updates according to the profile.

If DirectML does not implement a necessary operation, the probe prints
HOLD_DIRECTML_QWEN_GEOMETRY_LORA_UNVERIFIED with a concrete reason.
Do not change global Python, AMD drivers or live llama.cpp to bypass a hold.

## Developer-side CPU-only validation

The shape/training operations were separately exercised on CPU with PyTorch
2.10.0 in an isolated development container. Scaled shape: training loss
0.000733 -> 0.000156 over 12 steps. Full-dimension single block:
0.000978 -> 0.000585 over 4 steps.

These numbers **are not** predictions for RX 6600 and do not establish a
Windows DirectML pass. Only the operator's Windows GPU probe can do that.

## What remains before actual Qwen neural weight adaptation

1. Verify the exact upstream Qwen HF base and tokenizer matching the running
   GGUF variant and revision; obtain its original safetensors model securely.
2. Measure peak GPU dedicated VRAM and RAM for substantially longer training
   runs and larger sequence lengths.
3. Validate a practical frozen quantized-weight backend or streaming/offload
   approach: the existing CUDA-only 4-bit QLoRA trainer cannot directly use
   torch-directml; full float32/float16 Qwen3-4B parameter residency is a very
   different memory burden than this synthetic one-block test.
4. Train an actual low-rank adapter against the source model's weights on the
   960/320 Fibonacci+math curriculum, then run held-out and regression tests.
5. Convert to a compatible llama.cpp LoRA GGUF and validate isolated inference
   against the original before any separately approved live model change.

The active Qwen model, its original GGUF, all live services, tool permissions,
and Elektron remain untouched by V3.
