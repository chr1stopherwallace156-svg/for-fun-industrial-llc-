# Fun Industrial — Real Qwen3-4B LoRA V7 isolated paired inference check

## Verified from actual Windows operator results

V5: the pinned llama-tq GGUF-native CPU trainer used the official
Qwen3-4B-Q4_K_M GGUF and saved a candidate LoRA adapter after exactly two
training windows. Reported run duration 66.7s, peak child private committed
memory 3.055GiB. V6: real adapter GGUF digest matches
da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193.
Both trained Q/V LoRA B tensors contain nonzero elements despite the pinned
training source initializing B to all zero. 5/5 V6 checks passed.

This proves neural-weight changes in a separate, real pretrained-model LoRA
candidate. It does **not** prove improved Fibonacci reasoning or that an
adapter has been deployed.

## Why V7

V7 performs baseline (original pretrained GGUF) and adapted (same base GGUF
plus saved V5 LoRA) inference using the pinned llama-tq CPU completion tool.
The evaluation compares outputs on the *same questions*, with identical
generation seed, deterministic temperature=0, 96 maximum new tokens,
reasoning off, CPU model layers, batch/context sizes and thread count.

Cases:
1. First held-out recurrence question from the separate validation set.
2. First held-out validation model-selection question.
3. Ordinary control: capital of Japan.

The first two prompts are never identical to the train-set prompts; the
integrity-checked train/validation curriculum is loaded from local disk.
This is a **tiny smoke comparison**, not a statistically significant
benchmark, and model outputs are not automatically marked correct. Actual
answer content and official references are included in the report for
review. Text changed != quality improved, and text unchanged != no
numerical model impact.

The pinned fork source includes llama-completion, so V7 compiles this
executable in the preexisting **isolated** VS2022 no-ASM source/build folder
without rebuilding/replacing your live llama-server. Model inference runs
through six separately supervised CPU child processes in series, never
simultaneously: base then adapter for each question. No background agent,
service listener, server port, driver, Python package installation, new
model download, model weights change, or tool permission changes.

The same saved V5 adapter is checked against its exact SHA-256 and the V5
receipt; nonzero B matrices are audited again. Successful adapted
inference requires the native fork to report four LoRA tensors loaded.
Each child is supervised with RAM reserve, commit-memory reserve, private
process memory ceiling and run timeout; only that child is terminated upon
resource hold. The model is never deployed in Fun Industrial or Elektron.

## One-step command

From clean FunIndustrial-FISRE-Live checkout on branch
feature/fun-fisre-live-8802-20261122, after updating Git:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Evaluate-Fun-Qwen-Real-LoRA-V7.ps1 -Execute -Approval I_APPROVE_ISOLATED_QWEN_BASE_ADAPTER_EVALUATION

Without -Execute only seven offline guard tests run; no evaluation starts.

Expected successful markers:
- FUN_QWEN_V7_OFFLINE_TESTS=PASS
- FUN_QWEN_V7_EVALUATION_BINARY=<isolated llama-completion>
- FUN_QWEN_V7_CASE_RESULT=<baseline versus adapter generated text>
- PAIRED_BASE_VS_TRAINED_LORA_INFERENCE_COMPLETE_NOT_DEPLOYED
- FUN_QWEN_V7=PAIRED_INFERENCE_COMPLETE_NOT_DEPLOYED

Output:
%LOCALAPPDATA%\FunIndustrial\QwenActualGGUFLoRAV5\evaluation-v7\
evaluation-report.json and separate six .stdout.txt/.stderr.txt pairs.

Important: output reports contain the generated answers and prompts. They
are local, do not upload or automatically email them. Evaluation output
folder is created exactly once and reruns hold rather than overwrite
potentially valuable evidence.

If a separate CLI invocation fails, the JSON hold and local log identify
the case, mode and process result. Do not interpret a hold as successful
evaluation. Do not bypass resource guards or start the Qwen 8088 live server
to make this work.

## Further milestones

Review actual answers against the reference and compute factual/formatting
scores separately. Broaden the held-out benchmark and add non-Fibonacci
controls before additional training, judge overfitting and regressions, and
only propose an actual full-curriculum training run with separate explicit
approval. Deployment of the candidate into live Fun Industrial is a
separate decision, not part of V7.
