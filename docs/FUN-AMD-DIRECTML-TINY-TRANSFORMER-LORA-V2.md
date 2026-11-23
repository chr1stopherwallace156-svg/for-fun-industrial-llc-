# Fun Industrial — Tiny Transformer LoRA on AMD DirectML V2

## Purpose

Follow up the November 23, 2026 successful RX 6600 DirectML eight-parameter
gradient-update test with a miniature frozen Qwen-inspired transformer block
that trains real query and value low-rank adapter matrices in isolation.

The existing Qwen3-4B inference model, llama.cpp instance on port 8088,
dashboard 8802, other Fun services and Elektron are not modified, restarted,
or used as a training target.

## Model under test

- Miniature frozen random base: hidden size 32, four query heads, two key/value
  heads and eight dimensions per attention head (grouped-query attention).
- RMSNorm-inspired normalization and SwiGLU-inspired feed-forward path.
- DirectML operator checks: linear, matrix multiplication, reshape, transpose,
  repeat-interleave, softmax, rsqrt, elementwise operations, SiLU, and manual
  neural-network gradient updates.
- Four trainable LoRA matrices: Q A/B and V A/B, rank 4, 448 parameters.
- A synthetic teaching target constructed with the same frozen miniature
  base with alternate LoRA values; no separate model is loaded.
- 64 bounded SGD steps; requires at least 10% observed training loss reduction.
- No model downloads, package installations, global Python modifications,
  model conversion, optimizer checkpoint, or Qwen weight edits.
- This checks device placement, nonzero Q/V updates and numerical stability;
  it is not a held-out reasoning evaluation.

## Run

From the existing clean FunIndustrial-FISRE-Live checkout on branch
feature/fun-fisre-live-8802-20261122:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Test-Fun-AMD-DirectML-TinyTransformer-LoRA-V2.ps1

Expected successful result:
- state: PASS_DIRECTML_TINY_TRANSFORMER_LORA
- FUN_DIRECTML_V2=PASS_TINY_TRANSFORMER_LORA_ONLY
- FUN_QWEN3_4B_TRAINING=NOT_YET_QUALIFIED

On failure, the JSON prints the underlying DirectML operator error.
Do not change live Qwen server settings to resolve a probe failure.

## Validation status

The miniature training logic was tested in a separate Linux CPU PyTorch
environment during authoring and reduced the training loss. This was a
development-side CPU logic check, NOT a Windows RX 6600 DirectML test.
Only the operator's local run can establish the GPU result.

## Unresolved full-Qwen requirements

1. Measure peak AMD VRAM and system RAM under realistic transformer shapes.
2. Test sequence lengths / layer characteristics closer to Qwen3-4B.
3. Obtain a matching source Qwen3-4B Hugging Face safetensors checkpoint.
4. Identify or implement a supported frozen-quantized-weight training
   backend. The existing CUDA-only QLoRA trainer does not work through
   torch-directml merely because this tiny LoRA probe succeeds.
5. Perform a bounded actual Qwen adapter update with held-out Fibonacci and
   non-Fibonacci tests before conversion or deployment.
6. Independently validate against the original checkpoint and existing GGUF.

No claim of Qwen neural weight modification, improved general reasoning,
Fibonacci-encoded model architecture, or production training compatibility
is made by this experiment.
