# Fun Industrial — Qwen3 real LoRA V7.1 final-answer paired inference

## Evidence requiring benchmark correction

The operator's V7 on Windows 11 ran the genuine Qwen3-4B Q4_K_M GGUF
with and without its V5 two-window real-trained adapter, using the
pinned llama-tq llama-completion CPU binary. Six inference processes
finished, and loaded-adapter evidence passed.

All three generated baseline/adapter outputs were byte-identical under
the initial V7 settings (0/3 changes). However all six started with
<think> and used the 96-token output budget on reasoning, with neither
the heldout recurrence nor the model-selection question reaching a
final answer. Thus V7 does not establish either correct final answers
or any improvement.

The existing V7 report and all six logs are retained untouched.

## Why --reasoning off was insufficient

The pinned llama-tq completion source's common_chat_templates_apply
path doesn't pass params.default_template_kwargs on its initial user
prompt formatting path, so --reasoning off can fail to disable Qwen's
thinking format for these CLI invocations.

V7.1 instead supplies a full raw Qwen3 ChatML turn, disabled
conversation formatting (-no-cnv), and an explicit prefilled assistant
empty thinking block:

    <|im_start|>assistant
    <think>

    </think>

This is a benchmark-only workaround, not a modification of Qwen
weights or its tokenizer. Both modes get the same raw prompt and seed
(6427), temperature 0, 160 maximum new tokens, 512-token
context, and four CPU threads.

V7.1 explicitly fails if a completed run still generates <think> or
</think> in its output, rather than scoring truncated hidden
reasoning as an answer.

## Evidence and scoring

Three paired cases (6 processes run sequentially):
1. First heldout recurrence question, with expected sum from the
   integrity-checked curriculum.
2. First heldout model-selection question. Because the sampled case has
   a tie between windows 3 and 5, automated accuracy is withheld for
   this case; human review is required to check tie handling and
   Fibonacci limitations.
3. Ordinary fact control, capital of Japan = Tokyo.

V7.1 reports generated text (up to 160 new tokens), answer
hashes, base/adapter exact-text differences, and limited objective
evidence for the recurrence number and Tokyo control. A numeric value
merely appearing in text is not a full reasoning or proof-of-answer
assessment. Two Fibonacci questions and one control cannot support
statistically meaningful conclusions.

The evaluator reloads and SHA-checks the exact official model and the
V5-trained LoRA GGUF, checks nonzero trained B tensors again, confirms
the two-window training receipt, and requires the native CLI to
announce loading four LoRA tensors on adapted runs.

## Safety and artifact separation

The previous V7 result stays in evaluation-v7. V7.1 writes to an
entirely different, fresh evaluation-v71 folder. It refuses to
overwrite previous outputs.

No external model downloads, package installs, retraining,
live 8088 service changes, dashboard changes, or Elektron modifications.
It uses the existing pinned CPU llama-completion binary, or if missing,
builds it only inside the already verified isolated CMake source.
Each local child has a watchdog for low host RAM, low commit headroom,
excessive per-process private commit and elapsed duration.
It does not infer model accuracy solely from changed output strings.

## Run

From the clean FunIndustrial-FISRE-Live branch
feature/fun-fisre-live-8802-20261122:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Evaluate-Fun-Qwen-Real-LoRA-V71.ps1 -Execute -Approval I_APPROVE_ISOLATED_QWEN_BASE_ADAPTER_EVALUATION

Expected if all six corrected runs complete:

    FUN_QWEN_V71_OFFLINE_TESTS=PASS
    PAIRED_BASE_VS_TRAINED_LORA_INFERENCE_COMPLETE_NOT_DEPLOYED
    FUN_QWEN_V71=PAIRED_DIRECT_ANSWERS_COMPLETE_NOT_DEPLOYED

Output:
%LOCALAPPDATA%\FunIndustrial\QwenActualGGUFLoRAV5\evaluation-v71\
evaluation-report.json, and per-case baseline/adapter stdout and stderr.

If anything holds, preserve the generated logs; do not forcibly
restart any service or retrain. Only the user's local PC execution
can establish success with this build.

## Next choices

If V7.1 finds no meaningful improvement, the two-window rank-two
last-block-only LoRA may have had too little effective optimization
to alter greedy decoded tokens. Before more training, review
reference-answer quality, non-Fibonacci regressions, and whether
a separate, longer, independently approved memory-bounded training
run is justified. No automatic deployment follows this evaluation.
