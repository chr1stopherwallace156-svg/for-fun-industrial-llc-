# Fun Industrial — Qwen Fibonacci Neural Weight Adaptation V1

## What this implements (and what it does not)

This is a **genuine parameter-efficient fine-tuning (QLoRA)** pipeline for the
**Qwen3-4B** neural network. It is not RAG, a prompt trick, system text, a new
Qwen capability card, a new tokenizer, or another AI model.

When successfully trained, the output is a **real PEFT LoRA weight adapter**:
additional learned matrices change Qwen's behavior when that adapter is loaded
during inference. The base Qwen weights remain frozen and unmodified; this is
**not** continued pretraining of all ~4B original parameters.

**No model weights have been trained, converted, deployed or loaded as a result
of adding these source files to GitHub.** There is no claim of autonomous learning,
emergent understanding, a Fibonacci-encoded tokenizer, or universal Fibonacci
laws. Evaluated lower loss is only one necessary check, not proof of reasoning.

## 10 teaching domains

Deterministic synthetic, mathematically checkable lessons:

1. Fibonacci-style recurrence with nonstandard initial values.
2. Zeckendorf integer representation.
3. Fibonacci universal bit coding.
4. Fibonacci-window time-series averages.
5. Fibonacci ratios and golden-ratio convergence.
6. State-space dynamical systems with Fibonacci recurrence matrix.
7. Actual Fibonacci-code vs ordinary binary length; caveats about framing.
8. Shannon entropy of a binary empirical source.
9. Model/window meta-selection using supplied held-out errors (not blind bias).
10. Cases where no Fibonacci law is warranted.

Training examples explicitly teach limitations and the need for held-out
measurement. By default 960 train / 320 validation conversations. Data generation
checks train/validation prompt separation, determinism, representation and
content hashes. The train script verifies manifests before using examples.

## Hardware / compatibility prerequisites

This setup originally runs an **inference-only Qwen3-4B-Q4_K_M.gguf** through
llama.cpp at 127.0.0.1:8088, on a 16 GiB RAM Windows PC. Do **not** feed the GGUF
directly to PEFT training. Obtain a **locally stored, matching Hugging Face
Qwen3-4B safetensors checkpoint and tokenizer**, from the legitimate source
matching the GGUF model's actual provenance/revision. Do not assume similarly
named Instruct/Base releases are interchangeable.

QLoRA in this implementation requires CUDA-capable NVIDIA hardware, a working
CUDA PyTorch + bitsandbytes stack, and *at least 12 GiB GPU free memory* and
5 GiB available host RAM at preflight. Real requirements may be higher depending
on the platform and library versions. It will HOLD on machines without this.
**Installing libraries or pulling large checkpoints is never automatic.**
Training on a 16 GiB RAM computer without a suitable GPU should be considered
unsupported by this guarded pipeline, not attempted by force.

Dependencies (operator-provisioned only, in a separate isolated Python env):
- torch with compatible CUDA support
- transformers with Qwen3 support
- peft
- bitsandbytes with supported GPU/CUDA
- accelerate
- safetensors

Run offline; the trainer explicitly forces TRANSFORMERS_OFFLINE and HF_HUB_OFFLINE.

## Stage 1: read-only safety checks and curriculum build

Within the existing known FunIndustrial-FISRE-Live Git checkout:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Prepare-Fun-Qwen-Fibonacci-Weights-V1.ps1

Runs standard-library unit tests, writes the isolated verified curriculum once
under %LOCALAPPDATA%\FunIndustrial\QwenFibonacciWeightsV1\curriculum, and checks
GPU, RAM, Python training libraries and optional local base checkpoint.
No model training starts, Qwen 8088 keeps running, the 8802 dashboard remains
unchanged, no new AI model or service is started, and Elektron is untouched.

To preflight a separately acquired matching local HF checkpoint:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Prepare-Fun-Qwen-Fibonacci-Weights-V1.ps1 -BaseDir 'C:\PATH\TO\MATCHING-Qwen3-4B-HF'

Expected diagnostic states:
- FUN_FIBONACCI_WEIGHT_CURRICULUM=VERIFIED
- FUN_FIBONACCI_TRAINING_PREFLIGHT=HOLD_NOT_TRAINED (until prerequisites satisfied)
- FUN_QWEN_WEIGHT_CHANGES=ZERO_TRAINING_NOT_STARTED

## Stage 2: actual neural weight training — separately authorized

Run only when a verified compatible local checkpoint, required training libraries
and enough available CUDA/host memory exist. **Do not point at the live GGUF.**

    py -3.12 scripts\Train-Fun-Qwen-Fibonacci-LoRA-V1.py --base-dir "C:\PATH\TO\MATCHING-Qwen3-4B-HF" --approve I_APPROVE_QWEN_FIBONACCI_WEIGHT_TRAINING

The script is deliberately single-GPU, 4-bit NF4 QLoRA, batch size 1,
gradient accumulation 4, 2 CPU threads, default 100 optimizer steps, <=384
tokens/sample, gradient checkpointing. It trains LoRA matrices and evaluates
held-out validation loss both before and after. It measures actual LoRA tensor
weight change. Output is a separate candidate adapter in:

    %LOCALAPPDATA%\FunIndustrial\QwenFibonacciWeightsV1\train-output\adapter_candidate

and a training_receipt.json. Existing output is not overwritten. A
CANDIDATE_LOSS_IMPROVED_NOT_DEPLOYED result means **the adapter changed and
held-out loss improved by at least 1%**, *not* that Qwen's general reasoning
improved, not proof of all exact numerical answers, and not live activation.

A training run that holds or runs out of memory changes neither the current
Qwen GGUF nor the running 8088 server. Check output staging manually.

## Stage 3: convert the adapter (separate approval)

Only if Stage 2 produced a validated receipt. Use a reviewed local checkout of
**ggml-org/llama.cpp** with its Python GGUF converter and dependencies.
Follow its current converter version's supported PEFT adapter formats.

    py -3.12 scripts\Convert-Fun-Qwen-Fibonacci-LoRA-V1.py --training-output "%LOCALAPPDATA%\FunIndustrial\QwenFibonacciWeightsV1\train-output" --base-dir "C:\PATH\TO\MATCHING-Qwen3-4B-HF" --llama-cpp-source "C:\PATH\TO\llama.cpp" --outfile "%LOCALAPPDATA%\FunIndustrial\QwenFibonacciWeightsV1\fibonacci-lora.gguf" --approve I_APPROVE_FIBONACCI_ADAPTER_CONVERSION

This invokes llama.cpp's converter with an explicit local --base (no hub
lookup) and checks the output GGUF header. It does not load/merge/deploy.

## Stage 4: *not implemented yet* — rigorous independent evaluation and deployment

Do **not** switch the live 8088 model or assume compatibility just because GGUF
adapter conversion succeeded. Required to proceed safely:

- Verify original deployed GGUF and HF training checkpoint exactly correspond,
  including the model release/revision, architecture, and chat template.
- Test on an isolated, explicitly started inference session: existing original
  GGUF baseline vs same GGUF plus converted adapter using llama.cpp's --lora.
- Compare exact answer quality on held-out math tasks, non-Fibonacci tasks,
  original business questions and regression/safety tests. Look for both
  improvements and regressions; validation loss alone is insufficient.
- Confirm compatible llama.cpp adapter support and enforce reasonable RAM.
- Request a separate explicit operator approval and a rollback plan before
  any change to the live 8088 server.

**No automatic Qwen model restart, REA/ML permission change, new dashboard
capability, autonomous training, network downloads, or Elektron modification.**

## References

- https://huggingface.co/Qwen/Qwen3-4B
- https://huggingface.co/docs/transformers/quantization/finetune
- https://huggingface.co/docs/peft/index
- https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- https://github.com/ggml-org/llama.cpp/blob/master/convert_lora_to_gguf.py
