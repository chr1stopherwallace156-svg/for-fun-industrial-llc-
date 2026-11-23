# Fun Industrial V10.1 — Original Qwen3-4B exact-set math baseline

## Ground truth already created and verified

V10 generated 392 entirely synthetic, equation-verified examples in
%LOCALAPPDATA%\FunIndustrial\QwenMathFoundationV10.
Its operator result reported 16/16 offline tests, 1,568 equation invariants,
and 224 training / 84 validation / 84 reserved test examples.

Dataset labels are set-valued minimum-error choices across windows 3, 5, 8:
- unique best: 3, 5 or 8;
- two-way ties: 3+5, 3+8, 5+8;
- three-way tie: 3+5+8.

Each label includes the minimum error, every winner, tie indicator,
Fibonacci non-guarantee, and arithmetic proof differences
D35=e3-e5, D38=e3-e8, D58=e5-e8.

## Why evaluate BEFORE another real LoRA training experiment

Earlier Qwen3-4B V5 and V8 LoRA checkpoints have nonzero learned weights,
but generated answers were unchanged in V8.2's six-question comparison,
and V9 reference-text perplexity did not support an improvement.
We need a baseline that can separately measure:
1. exact winner-set decision including ties;
2. arithmetic proof correctness;
3. structured field parsing/format compliance;
4. model adherence to full exact target format.

V10.1 evaluates ONLY original pretrained Qwen3-4B without adapters.
That isolates pre-training capability, so any later independent training
may be compared using exactly the same question selection and grading.

## Bounded evaluation design

V10.1 selects **14 cases**, exactly two from each of the seven
minimum-error winner patterns, from the already-existing V10
**validation** split. It does NOT open or decode V10's frozen test data.
It checks SHA-256 from manifest for train and validation JSONL, and
validation ground truth, checks mathematical equations, signed proof
numbers, train/validation prompt separation, seven-pattern balance and
every oracle answer before allowing inference.

Uses existing pinned isolated llama-completion.exe and original model
SHA-256 7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5.
No model download, compilation, Python installs, new weights, training,
live inference server restart or source edits.

The run executes 14 supervised CPU child processes SEQUENTIALLY;
each uses the previous V7.1 deterministic no-think ChatML prompt
with 160 maximum generated tokens, CPU-only, temperature zero,
same seed, four threads. The preexisting V7.1 RAM and process
watchdogs apply. Resource pressure or process failure yields a
hold rather than restarting or touching any other process.

Output is exclusively under
%LOCALAPPDATA%\FunIndustrial\QwenActualGGUFLoRAV5\math-v10-baseline-v101\
and includes a new baseline-report.json plus separate native stdout
and stderr logs. No source file is overwritten.

## Scoring

Main strict exact answer = all of:
- exact set of best windows equals ground truth;
- correct minimum integer error;
- correctly identify whether tie exists;
- confirm Fibonacci window choice has no guaranteed generalization;
- pairwise signed arithmetic differences D35,D38,D58 correct.

The decoder also records:
- structured answer successfully parsed;
- structured best-windows field present and correct;
- each error and tie by pattern.

If model writes correct informal language but omits required format,
strict accuracy is zero by definition. It is useful to report
that separately rather than falsely calling an informal mathematical
answer incorrect. V10.1 does NOT claim to validate freeform natural
language reasoning independently: structured field comparison is the
only partial independent score.

14 observations are a diagnostic baseline, NOT statistically robust.
Increase validation sampling later after reviewing failure modes.
Do not use frozen test examples to tune training architecture,
hyperparameters, prompts, or formatting.

## Run

Read-only preflight after a clean repo update:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Evaluate-Fun-Qwen-Math-Baseline-V101.ps1

Explicit operator approval for baseline-only CPU inference:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Evaluate-Fun-Qwen-Math-Baseline-V101.ps1 -Execute -Approval I_APPROVE_ISOLATED_QWEN_V101_BASELINE_EVALUATION

Runner runs 12 offline tests first and refuses any existing V10.1
evaluation directory.

Successful terminal markers:
- FUN_QWEN_V101_TESTS=PASS
- FUN_QWEN_V101_RESULT=... (strict accuracy counts)
- V101_ORIGINAL_QWEN_MATH_BASELINE_EVALUATED_NO_TRAINING
- FUN_QWEN_V101=EXACT_MATH_BASELINE_SCORED_NOT_TRAINED

On a hold, preserve the local evidence and investigate without
weakening memory gates or overwriting any previous experiment.

## Next stage, after actual baseline

Compare observed errors by winner pattern and proof-field category.
If baseline is already highly accurate, focus on out-of-distribution
questions and real-world generalization. If formatting alone fails,
repair prompting or decoding before spending GPU/CPU resources on LoRA.
If mathematical decisions and ties fail, consider a NEW explicitly
approved LoRA experiment with data balanced by tie structure; evaluate
using the same validation protocol before any frozen test.

At no point does V10.1 deploy into Fun Industrial's live dashboard
or touch Elektron.
