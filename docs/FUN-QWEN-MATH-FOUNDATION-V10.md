# Fun Industrial V10 — Equation-driven Qwen mathematical supervision

## Why V10 exists

Real pretrained Qwen3-4B GGUF LoRA was trained successfully in V5 and
V8. V6/V8.1 showed nonzero learned query/value B matrices. V8.2 then
compared baseline, V5, V8 on six held-out questions and saw no answer
changes; all three chose the wrong minimum-error window in case 527.
V9 compared teacher-forced reference-text perplexity:

| Domain | Original | V5 | recovered V8 |
| --- | ---: | ---: | ---: |
| recurrence | 19.5370 | 19.5196 | 19.5399 |
| model selection | 103.8062 | 103.8753 | 103.9886 |
| general control | 2.4069 | 2.4077 | 2.4071 |

Lower PPL on those corpora is preferable, but the numerical
differences are small and no behavioral improvement is supported.

The previous 30-row smoke training slice contained only three
examples from each of ten very different mathematical domains, and
used a rank-2 Q/V-only LoRA in the final attention block with
SGD and two, then resumed training windows.

Crucially, the original model-selection generator used
min(errors, key=(error,window)), which breaks ties by window number
and teaches one answer despite a question that may allow multiple
minimizers. The original V1 curriculum and existing adapters and
evaluations must NOT be rewritten.

## V10 exact mathematical labels

For windows W={3,5,8} and measured errors e_w >= 0:

    e_min = min(e_3,e_5,e_8)
    W* = {w in W | e_w = e_min}
    tie = (|W*| > 1)
    selection_margin = e_(2nd smallest) - e_(smallest)

The correct representation is a SET, not an arbitrary winning index.
Example errors [18,18,29]:
  MIN_ERROR=18; BEST_WINDOWS=3,5; TIE=YES; FIBONACCI_GUARANTEE=NO; PROOF_D35=0,D38=-11,D58=-11

The proof numbers are signed differences e3-e5, e3-e8 and e5-e8.
They are independently checked against the original three errors and
appear ONLY in the assistant label and separate ground-truth file,
never in the user's input prompt. They help teach the calculation
behind the decision rather than a memorized winning window.

Validation error rankings have no implied Fibonacci causal law.

Explicit fixed label fields are intentionally easier to parse than
freeform prose and support an exact-answer score.

## V10 equations for a future learning backend

These routines are pure Python math prototypes, NOT integrated into
the pinned llama-tq gradient calculation. The current native fork
trains assistant-token masked next-token prediction; it does not
implement ranking or set-calibration losses from this V10 module.

(1) Set-valued winner labels:
  y_w = 1(w in W*)

(2) Independent Bernoulli/multi-label objective:
  L_set = mean_w[softplus(z_w) - y_w*z_w]
This supports ties naturally, instead of a one-winner categorical
softmax that cannot output more than one correct window.

(3) Hard-negative preference margin:
  m = s(answer_correct | prompt) - max_j s(answer_wrong_j | prompt)
  L_contrast = softplus(-beta*(s_correct - s_wrong))
where sequence scores must be normalized consistently for answer
length. V10 constructs incorrect answer candidates separately;
they are NEVER inserted as ground-truth labels.

(4) Correct-answer-only NLL:
  L_answer = -(1/number_of_target_tokens) * sum log
    P(correct_answer_token | prompt, prior_answer_tokens)
Requires token logits from a separate future evaluator; native V9
measured whole-text PPL, not this conditional answer score.

(5) Calibration / exact-set Brier score:
  Brier = mean_w (p_w - y_w)^2
where p_w are independent per-window probabilities in [0,1].
Unlike a categorical softmax, tied windows can both have high p.

(6) Difficulty and error margin:
  delta = e_second - e_min
Ties have delta=0, which should be checked as an independent
difficulty slice instead of scored against a single arbitrary index.

(7) Metamorphic / affine invariance:
  argmin_set(e) = argmin_set(a*e + b) for any a>0
  permutation equivariance: relabel windows, and relabel
  all correct minimizers in the same way.

(8) Stable softmin is provided for diagnostics:
  p_w = exp(-(e_w - e_min)/temperature) /
        sum_j exp(-(e_j-e_min)/temperature)
This is NOT a substitute for exact tied-set labels.

## Data plan: 392 deterministic examples

Seven balanced winner patterns:
{3}, {5}, {8}, {3,5}, {3,8}, {5,8}, {3,5,8}

Each pattern receives:
  training: 32 distinct cases = 224
  validation: 12 distinct cases = 84
  frozen test: 12 distinct cases = 84

Error minima have DISJOINT ranges by split:
  train 12..99; validation 211..299; test 411..499.
Different winning patterns cannot share the same error triple.
The generator refuses duplicates and overlap, rather than
silently dropping duplicates.

Each case has:
- A carefully phrased question requesting every tied minimum.
- An exact structured assistant answer with computed signed pairwise proof differences for correct supervision.
- An independently generated mathematical ground-truth record.
- An intentionally wrong negative answer for later contrastive
  research, stored separately from training labels.

The script checks 4 mathematical invariants per case for 1,568
offline checks, as well as 16 offline unit tests in the runner.

This is synthetic mathematics generated by deterministic equations,
not observed real-world business losses. Those labels are suitable
for teaching basic minimization, not proving applied forecast skill.

## Usage

Inspect and test without writing anything:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Fun-Qwen-Math-Foundation-V10.ps1

Create ONLY the new separate curriculum after explicit approval:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Fun-Qwen-Math-Foundation-V10.ps1 -Create -Approval I_APPROVE_ISOLATED_V10_CORRECTED_MATH_CURRICULUM_CREATION

Never overwrites an existing output directory:
  %LOCALAPPDATA%\FunIndustrial\QwenMathFoundationV10\

Files:
  train.jsonl, validation.jsonl, test.jsonl
  train-ground-truth.jsonl, validation-ground-truth.jsonl,
  test-ground-truth.jsonl, hard-negatives.jsonl, manifest.json.

The JSONL training message format is supported by the pinned fork,
which masks assistant spans. No training is performed by V10.
The model/adapter files and prior V5/V8/V9 reports remain unchanged.
No build, service management, external downloads, plugin calls,
or Elektron access.

## Next phases (NOT performed here)

1. Baseline Qwen exact-set inference on frozen validation and test.
   Evaluate exact winners, tie detection, selection margin and
   control-question regression with representative coverage.
2. Answer-only conditional NLL and correct-vs-incorrect answer
   preference margins using a separate, verified logits evaluator.
3. Independently approve a new small LoRA experiment with optimized
   target layers/rank/memory after sufficient diagnostic evidence.
4. Never tune hyperparameters on the frozen test; reserve the
   test partition for one independent final validation.
5. Do not claim generalization from synthetic windows alone: test
   distributions, wordings and realistic noise that differ from
   the training generator.

Interpretation: equations and encoding produce better *labels and
measurements*, not guaranteed better neural network behavior. A
successful dataset builder proves mathematical correctness of the
targets, not trained-model quality.
