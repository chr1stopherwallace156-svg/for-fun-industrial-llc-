# Fun Industrial — V9 Qwen3 base / V5 / recovered V8 reference-likelihood probe

## Why another diagnostic instead of longer training

The operator successfully recovered V8's trained GGUF LoRA into a
separate 82,368-byte verified adapter after a Windows destination-exists
save failure. V8's Q/V LoRA B matrices changed relative to V5, but a
six-question, three-way (18 sequential runs) deterministic inference
test found **no generated text changes** across the original pretrained
Qwen3-4B model, the V5 LoRA and the recovered V8 LoRA.

V8.2 examples:
- 3087 + 41838 = 44925; all three modes correct.
- 13731 + 26605 = 40336; all three modes correct.
- Case 527: errors 18, 18, 29 for windows 3, 5, 8; **all
  three modes incorrectly selected window 8**. The best windows are 3
  and 5 tied. The existing curriculum generator chooses a single
  tie-break winner and can therefore omit the tie in reference text.
- Another case: errors 20, 23, 4; all three modes correctly selected
  window 8.
- Capital of Japan: Tokyo; capital of France: Paris; unchanged.

These tests show a genuine trained adapter with no observed answer
improvement in this small sample, not that its numeric effect is zero.

## V9 goal

Measure **teacher-forced reference-text perplexity**, using the pinned
GGUF-native research fork's native llama-perplexity CPU tool. Compare
how likely each mode finds the *same* fixed reference corpus:

- Original verified pretrained Qwen3-4B Q4_K_M GGUF, no LoRA.
- Same base GGUF plus verified original V5 LoRA.
- Same base GGUF plus hash-verified recovered V8 LoRA.

Perplexity (PPL) is an estimate of token-level predictive performance.
**Lower is better for this fixed reference text**, but not necessarily
for general question answering. PPL includes prompts, structural
ChatML delimiters, and answers in the scored window, so the result is
NOT a direct probability of the correct answer conditional on the
question. It is NOT a measure of reasoning ability or proof of
generalization. This native tool reports four decimals; tiny numeric
differences can be rounded away.

## Local bounded datasets

Three independent domains, each with eight cases:

1. Held-out Fibonacci recurrence examples from the existing
   integrity-checked V5 curriculum validation split.
2. Held-out model-selection examples with **unique minimum error**,
   excluding cases that have ties and an underspecified single-winner
   reference. The original dataset is never edited.
3. An unrelated set of eight questions about world capitals.

The corpora are canonical, low-context non-thinking ChatML reference
text. They are written only to the new V9 experiment folder on explicit
approval, with their SHA-256 fingerprints recorded in a local manifest.

## Isolation and resource guards

- First validate official Qwen model SHA-256:
  7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5
- Verify V5 LoRA SHA-256:
  da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193
- Verify recovered V8 LoRA SHA-256:
  05efce40082eee0815decc4c21f74150c612adbb2e88fb2149c9c4dd951f7240
- Require successful V8.2 comparison receipt with the above identities.
- Use the already validated isolated MSVC no-ASM build folder to
  compile llama-perplexity only if it does not already exist. Never
  fetch remote source, install packages, or touch the active
  llama-server.
- Nine sequential local CPU likelihood processes (not parallel),
  with context 128 tokens, batch 128, microbatch 64 and 4 threads,
  each with a maximum 240-second guarded process duration.
- Use the existing V5 RAM watchdog and V7 initial memory gate;
  stop only a supervised isolated child process on resource breach.
- Require native log confirmation that 4 GGUF LoRA tensors were
  loaded for V5 and V8 (and were not loaded for baseline).
- Source model, adapters and prior V8.2 report are rehashed after
  the benchmark and must remain byte-identical.
- Never retrain, deploy, merge weights, open model servers, alter
  network/firewall permissions, or touch Elektron.
- Never overwrite a previous V9 output folder or previous result.

## Command

Read-only preflight:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Probe-Fun-Qwen-LoRA-Likelihood-V9.ps1

Separate explicit approval for CPU measurement and any needed
**isolated offline compilation** of llama-perplexity:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Probe-Fun-Qwen-LoRA-Likelihood-V9.ps1 -Execute -Approval I_APPROVE_ISOLATED_QWEN_V9_LIKELIHOOD_EVALUATION

V9 runs eleven standard-library-only offline safety tests before
allowing execution.

If completed, the terminal emits:
- FUN_QWEN_V9_OFFLINE_TESTS=PASS
- FUN_QWEN_V9_DOMAIN_RESULT=... for each corpus
- REAL_QWEN_THREE_WAY_HELDOUT_PPL_COMPLETE_NOT_DEPLOYED
- FUN_QWEN_V9=HELDOUT_LIKELIHOOD_COMPARISON_COMPLETE_NOT_DEPLOYED

New output only:
%LOCALAPPDATA%\FunIndustrial\QwenActualGGUFLoRAV5\likelihood-probe-v9\
comparison.json, manifest.json, three plaintext corpora and nine
individual native logs.

If a benchmark holds due to an insufficient corpus token count,
ambiguous native output, a missing binary, or a memory limit,
preserve all generated logs and do **not** retrain or overwrite the
folder. Review the actual failure before changing the methodology.

## Interpretation

The current V8 training is real, but no behavioral improvement was
seen in six questions. A modest lower PPL on the Fibonacci corpora
could indicate a slight distributional shift toward reference
answers, but might be unrelated to improved decision making.
Similar or higher PPL on controls may signal unwanted changes.
Use the outcome to decide whether to develop a more focused
answer-only likelihood benchmark, repair the training dataset's
tie-handling cases, or plan a separately approved larger training
experiment. Do not auto-deploy based on this small V9 result.
