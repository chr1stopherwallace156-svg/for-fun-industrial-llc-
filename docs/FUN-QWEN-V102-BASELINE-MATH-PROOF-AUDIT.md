# Fun Industrial V10.2 — disambiguate baseline math decisions vs proof vs formatting

## Actual V10.1 results from user execution (2026-11-23)

V10.1 used original pretrained Qwen3-4B and the new V10 synthetic
validation set: two cases for each of seven exact-set winner patterns,
14 total. 12 offline safety tests and full 14-case CPU inference
passed. No LoRA adapters loaded or training started; the original model
and live services were not altered. The V10 frozen test was unopened.

The terminal summary was:
- strict_exact_correct: 0 / 14
- strict_parsed: 0 / 14
- structured_winner_field_present: 14 / 14
- structured_winner_field_correct: 14 / 14
- total_tie_cases: 8 / 14
- strict_tie_cases_correct: 0 (because parser rejected format)

Do NOT interpret this as zero mathematical ability: the candidate
winner windows were correctly selected in **all** 14 validation cases.
However, many signed arithmetic proofs in the generated responses are
incorrect, even while the winner was correct.

Example (case v10-validation-7):
  errors 3=236, 5=230, 8=235
  expected BEST_WINDOWS=5 (correctly selected by model)
  correct D35 = 236-230 = +6, D38=236-235=+1,
          D58 = 230-235 = -5
  Qwen responded D35=-6, D38=-1, D58=+5:
  all THREE arithmetic signs were reversed!

Example (case v10-validation-11):
  errors 3=254, 5=267, 8=254
  expected BEST_WINDOWS=3,8
  correct differences D35=-13, D38=0, D58=+13
  Qwen's answer used commas and an explicit +13:
  this is mathematically correct but rejected by the old exact
  canonical-string parser.

Other formatting variations include:
- semicolons instead of commas between D35, D38 and D58;
- optional spaces following "=";
- explicit positive signs, and -0 used for zero;
- a trailing period or semicolon.

The V10 answer-generation code was NOT changed by the V10.1 result,
and V10.1 historical strict scores must not be rewritten.

## V10.2 regrade

This is a **read-only interpreter and audit of SAVED model outputs**.
It never invokes llama-completion, reads a model weight tensor,
runs training, touches a live port, writes data or changes Elektron.

Preconditions:
1. Existing V10.1 baseline-report.json remains intact and passes
   its version/state/model-hash/scope checks.
2. All fourteen generated-text SHA-256 hashes match those saved in
   the original report.
3. Each saved case is matched against the SHA-verified V10
   training/validation and validation-oracle data, with checks for
   prompt leakage, error triple identity, reference answer and
   exact winner-set pattern.
4. Frozen V10 test data is NOT opened, scanned or hashed.

Every response is parsed for seven structured fields:
  MIN_ERROR
  BEST_WINDOWS
  TIE
  FIBONACCI_GUARANTEE
  PROOF_D35
  D38
  D58

The audit accepts whitespace and punctuation variation while
requiring unambiguous unique fields. A missing or duplicated field is
NOT silently inferred. Parsed integers allow +13 and -0, which are
mathematically equivalent to 13 and 0 respectively. The exact
minimum, full tied-winner set, tie yes/no, non-guarantee, and
three independent signed differences are compared to the mathematical
oracle, separately.

Metrics include winner-set accuracy, full-decision-field accuracy,
proof-field accuracy, all seven mathematical fields correct,
missing/duplicate formatting counts, per-field mistakes, and
per-pattern accuracy. The original 0/14 strict-format result remains
visible for comparison.

## Execution

From the clean, updated FunIndustrial-FISRE-Live branch:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Audit-Fun-Qwen-Math-Baseline-V102.ps1

13 offline unit tests run before the read-only report audit.
No new explicit execution approval is necessary: no model inference
or mutating operations occur.

If valid, the terminal prints:
  FUN_QWEN_V102_OFFLINE_TESTS=PASS
  FUN_QWEN_V102_RESULT=...
  FUN_QWEN_V102_PER_PATTERN=...
  FUN_QWEN_V102_MISTAKE=... [one per incorrect mathematical answer]
  FUN_QWEN_V102=READONLY_ARITHMETIC_AND_FORMAT_AUDIT_COMPLETE

The script writes NO report file. Its results are printed as JSON
to the local terminal. The V10.1 baseline and its fourteen raw
inference logs remain intact.

## Implications for future improvement

Only after V10.2 determines which fields fail should we choose
between:
- prompt/decoder formatting workarounds if the mathematical proof
  is correct despite noncanonical punctuation;
- independent deterministic arithmetic verification for D35/D38/D58,
  argmin-set and ties, before presenting results as correct;
- training examples focused specifically on *signed difference*
  calculations and counterexamples, with validation held out;
- a separate explicitly approved LoRA experiment with an
  architecture and evaluation designed for actual model behavior.

This evaluation alone does not improve the Qwen model. It prevents
unnecessary retraining caused by an overly brittle parser and reveals
real sign/calculation errors that should not be ignored.
