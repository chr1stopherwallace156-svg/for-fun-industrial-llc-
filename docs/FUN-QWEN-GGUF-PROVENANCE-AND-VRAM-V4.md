# Fun Industrial — Read-only live Qwen GGUF identity and AMD GPU memory V4

## Why this gate comes after the successful V3 test

On the operator's Windows 11 Home PC, an AMD Radeon RX 6600 with the isolated
torch-directml venv completed a Qwen3-4B-sized **single synthetic transformer
layer** test with 40,960 LoRA parameters, nonzero query/value gradients and
a 40.19% reduction in synthetic training loss over four steps.

This is meaningful DirectML gradient/operator compatibility evidence. It is
**not** evidence that any actual Qwen3-4B model weights or GGUF changed, or that
four-billion-parameter fine-tuning is feasible. Peak VRAM usage was not
measured, and the synthetic four-step test cannot establish sustained
performance or long-sequence memory requirements.

The next prerequisite is to identify the actual live Qwen GGUF architecture
and investigate exact upstream model provenance before downloading large
weights or attempting real adapter training.

## Read-only GGUF metadata inspector

- Reads up to 256 MiB of GGUF *header metadata only* from the existing
  FunIndustrial .runtime model. Does not read, mmap, rewrite or load tensor
  weights, even though the model remains available for live inference.
- Validates GGUF magic, format revision, structured metadata, 36-layer
  architecture, 2,560 hidden size, 9,728 FFN width, 32 attention heads,
  8 key/value heads, and general.architecture=qwen3.
- Reports optional base-model and source URL metadata if provided.
- Never assumes GGUF architecture metadata proves an exact HF checkpoint
  revision. Matching original source tensors/provenance must still be
  separately verified.
- Header parser uses standard-library only, with bounded sizes and
  synthetic unit tests for malformed/truncated GGUF metadata.

## Windows graphics-memory baseline

- Attempts a single Windows GPU Adapter Memory Dedicated Usage snapshot.
- GPU performance counter may be absent; absence is reported as unavailable
  rather than inventing a value. It is **not peak VRAM during training**.
- Prints host RAM available and confirms live Qwen 8088 listener still
  belongs to the same process when finished.
- Absolutely no GPU stress testing, package installs, new model downloads,
  training runs, stops, restarts or process memory clearing.

## Run from a clean checkout

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Inspect-Fun-Qwen-ModelAndVRAM-V4.ps1

Expected results:
- FUN_QWEN_V4_TESTS=PASS
- FUN_QWEN_V4_GGUF_GEOMETRY=PASS_NO_EXACT_WEIGHT_REVISION_CLAIM
- FUN_QWEN_V4_GPU_COUNTER=SNAPSHOT_ONLY_NOT_TRAINING_PEAK, or counter unavailable
- FUN_QWEN_V4_HF_REVISION_MATCH=UNVERIFIED
- FUN_QWEN_V4_QWEN_WEIGHT_CHANGES=ZERO

If architecture checks HOLD, do not attempt to force a supposedly compatible
Qwen base model into a LoRA training run. Ask for the metadata differences.
If Windows graphics counters are unavailable, the rest of the read-only
inspection remains valuable; a later optional sustained GPU-memory sampler
could verify memory use under a carefully bounded load.

## Follow-up before actual Qwen learned-weight adaptation

1. Verify exact Qwen original checkpoint identity, quantization provenance,
   architecture/chat template and tokenizer, not just the Qwen3-4B label.
2. Obtain the matching HF safetensors checkpoint using a separate documented,
   explicit model-download approval; ensure sufficient storage and memory.
3. Reassess viable Windows AMD DirectML training strategy, including
   compatibility with frozen quantized base weights, sequence length and
   realistic peak GPU/host RAM. Full float32 Qwen original weights are much
   larger than the single synthetic block and will not fit in 8 GiB VRAM.
4. Build a bounded training worker with streaming/offloading where feasible
   and test the 960 training/320 validation Fibonacci/math examples against
   actual model parameters. Never call 4B training qualified on basis of
   tiny-probe performance.
5. Test LoRA adapter changes and independent held-out/regression evaluation;
   only then consider GGUF adapter conversion and separate live activation
   with user approval.

### Primary references
- https://huggingface.co/Qwen/Qwen3-4B/blob/main/config.json
- https://github.com/ggml-org/ggml/blob/master/docs/gguf.md
