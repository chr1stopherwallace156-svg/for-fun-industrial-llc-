# Fun Industrial — Audit real Qwen3-4B learned LoRA matrices (V6)

## Evidence from the operator's successful V5 training run (2026-11-23)

The Windows 11 PC completed the following with an external, pinned
GGUF-native CPU-based training fork:

- MSVC CMake config, build and native llama-finetune completed.
- The operator's genuine official Qwen3-4B Q4_K_M GGUF SHA-256:
  7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5
- 30-example, ten-family Fibonacci/math training slice used, verified SHA:
  fa59b109c325243c141ad220ad0b13d2ee690084a521437a01335e56c1258cbf
- Two native GGUF LoRA training context windows completed, as attested by
  the pinned fork's exact "stopped after 2 windows (--stop-after)" marker.
- The operator reported training time 66.7 s, observed peak child private
  committed memory 3.055 GiB, host RAM after 8.523 GiB.
- Candidate LoRA adapter file produced under isolated V5 candidate folder:
  qwen-fibonacci-smoke.lora.gguf, 82,368 bytes, SHA-256:
  da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193
- No original GGUF weight changes, live inference restart, auto-deployment,
  full 960-example training, or independent accuracy evaluation.

## Purpose

The presence of a GGUF candidate alone is not sufficient evidence of nonzero
learned adapter values. The pinned llama-tq source initializes each LoRA A
matrix randomly and each B matrix with **all zeros**. Actual nonzero B values
in a saved adapter provide strong direct evidence of a learned update on that
adapter, not just its initial state.

V6 reads **only** the 82 KiB adapter's GGUF header/tensor bytes; compares its
full SHA-256 with the operator's reported V5 candidate, validates the receipt
and two-window training completion marker, and inspects exactly four tensors:

- blk.35.attn_q.weight.lora_a
- blk.35.attn_q.weight.lora_b
- blk.35.attn_v.weight.lora_a
- blk.35.attn_v.weight.lora_b

It checks architecture, adapter type, LoRA alpha 2.0, float32 tensor types,
finite values, correct shapes/suffixes, and nonzero B tensors in both Q and V.
The result includes nonzero element counts, maximum absolute values and L2
norms, but does not print or change the full learned matrices.

## Run

From clean checkout on feature/fun-fisre-live-8802-20261122:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Audit-Fun-Qwen-Real-LoRA-V6.ps1

Expected if evidence passes:

    FUN_QWEN_V6_TESTS=PASS
    PASS_REAL_QWEN_LORA_B_TENSORS_LEARNED_NOT_DEPLOYED
    FUN_QWEN_V6=PASS_LEARNED_LORA_B_WEIGHTS_UNDEPLOYED

The audit performs **no** network requests, training, package installation,
model loading, inference, stopping/starting services, or model writes.

A hold can result from any difference in GGUF adapter layout, hash, training
receipt, target tensor naming or a genuinely zero B matrix. If it holds,
report its specific reason and review without weakening integrity checks.

## Still unproven

- Whether the adapter produces statistically meaningful changes in output
  quality or improves held-out Fibonacci reasoning.
- Whether any changes help rather than hurt other topics.
- Whether the 2-window smoke run trained even one entire example.
- Whether loading the adapter is compatible with the production llama.cpp
  binary or dashboard.
- Whether the full 960/320 train/validation task can be completed within RAM
  limits. Do not assume CPU process private commitment is total system use.

A separate bounded sequential base-versus-adapter inference evaluation is the
next checkpoint before approving more training, adaptation or deployment.
