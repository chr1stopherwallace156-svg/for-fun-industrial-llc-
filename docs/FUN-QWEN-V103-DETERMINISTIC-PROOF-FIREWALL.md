# Fun Industrial V10.3 — Deterministic proof firewall (offline demonstration)

## Grounded results from V10.1 / V10.2

The user executed genuine original Qwen3-4B inference on 14 examples
sampled from the corrected V10 validation set. V10.2 then read and
regraded the original saved responses. The frozen test was not opened.

Verified observations:
- 14 / 14 correct winning-window sets, including eight tied-win cases.
- 14 / 14 correct minimum, tie, and Fibonacci non-guarantee decision fields.
- 3 / 14 mathematically correct complete signed-difference proofs.
- For the three arithmetic fields D35, D38 and D58, correctness was
  respectively 8/14, 8/14 and 7/14 (19 wrong of 42 field instances).
- Thirteen sign reversals were identified; other mistakes included
  magnitude errors and inconsistent subtraction.

The original V10.1 strict 0/14 result was due to its overly narrow text
parser, not zero ability to select minimum-error window sets.
V10.2 separately identified model arithmetic errors.

## The V10.3 verification model

V10.3 is an independent deterministic Python implementation for
the restricted, structured task:

    Input:  e_3, e_5, e_8  as finite non-negative integers.
    e_min = min(e_3, e_5, e_8)
    W* = {w | e_w = e_min}
    D35 = e_3 - e_5
    D38 = e_3 - e_8
    D58 = e_5 - e_8
    Invariant: D35 + D58 = D38
    Tie: |W*| > 1

The oracle also checks that each zero difference is equivalent to
equality of the corresponding errors, and that a canonical assistant
answer passes the original V10 exact formula tests.

It parses a bounded, explicitly structured input prompt to obtain
the *three original observed values*, not Qwen's claimed proof.
If duplicate assignments, invalid or oversized numbers, ambiguous
structured fields, or an unsupported prompt are encountered, it holds.

Then V10.3 reads the original saved Qwen responses, parses the
seven fields using V10.2's safe relaxed formatter, and compares
each claimed field to the deterministic integer computation.
It emits a separate canonical **oracle-reconstructed answer**
when a model answer disagrees with the input math. The original
response is preserved for comparison, and the reconstructed answer
is *never attributed to model learning*.

Example (V10.1 validation case):
  errors 236,230,235.
  Qwen correctly chose window 5 but reported D35=-6,D38=-1,D58=+5.
  V10.3 independently computes:
    D35=+6; D38=+1; D58=-5.
  Winner {5} and minimum 230 are preserved.

## Evidence integrity / scope

V10.3:
- Depends on SHA-verified V10 corrected training/validation dataset
  and exact V10.1 saved baseline report; it does not open frozen test.
- Checks the V10.1 report SHA and each saved output's SHA, version,
  model fingerprint, case identities, mathematical ground truth,
  and training/deployment scope before auditing.
- Verifies no original report or curriculum source has changed.
- Uses only standard-library Python on 14 recorded examples.
- Does not run Qwen inference, load model weights, modify LoRA,
  train any weights, invoke external process/tools, make web
  requests, edit original responses, or write artifacts.
- Runs twelve synthetic offline unit tests first.
- Outputs corrected answers and mismatches to terminal only;
  does NOT connect to production Fun Industrial, alter dashboard
  routes or touch Elektron.

The term "firewall" here describes a prototype validation mechanism,
not a production network/security firewall. No integration with
existing UI/agent workflows is claimed.

## One-command invocation

From updated clean FunIndustrial-FISRE-Live checkout:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Verify-Fun-Qwen-Math-Answers-V103.ps1

Expected if all source and math checks pass:

    FUN_QWEN_V103_OFFLINE_TESTS=PASS
    FUN_QWEN_V103_SUMMARY=...
    FUN_QWEN_V103_PROOF_REPAIR=...  [one per incorrect saved answer]
    FUN_QWEN_V103=VERIFIED_ANSWER_RECONSTRUCTION_NO_MODEL_CHANGES
    FUN_QWEN_V103=READONLY_PROOF_CORRECTION_AUDIT_COMPLETE_NO_DEPLOYMENT

Any hold is reason to inspect the exact source, not to weaken
integrity checks or silently rewrite model outputs.

## Future phases

After V10.3 results establish the difference between original
model behavior and corrected proof presentation:

1. Expose a tightly scoped, operator-approved deterministic arithmetic
   verification tool only to the relevant Fun Industrial workflow.
2. Enforce a typed input schema and signed arithmetic constraints;
   never parse invented error inputs from untrusted model responses.
3. Build new, varied signed-arithmetic training examples with
   independent mathematical truth, train only under a separate
   explicit authorization, and evaluate against a larger held-out
   and out-of-distribution set.
4. Keep the frozen 84-case test data unopened until the validation
   design and training parameters are finalized.
5. Distinguish tool-assisted correctness from neural mathematical
   learning in all future reports.

This stage improves verifiability of an existing task; it does not
improve pretrained model weights or establish new mathematical skill.
