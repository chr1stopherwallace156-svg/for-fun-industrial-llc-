# Fun Industrial V10.4 — standalone deterministic mathematical decision component

## What existing V10.3 results established

The user executed 12/12 offline tests and a SHA-verified read-only
reconstruction of 14 baseline Qwen3-4B responses. The original model:
- correctly identified the full minimum-error set in 14/14 examples;
- reported correct minimum and tie indicator in 14/14 examples;
- produced complete mathematically correct signed subtraction proofs
  in only 3/14 examples;
- made 19 wrong arithmetic field claims across 42 checked differences.

The independent V10.3 verifier recomputed ALL 14 answers correctly
from the original observed numeric errors; 11 required repairs.
No model weights, training runs or production system were altered.

This proves a deterministic verifier works in the tested domain,
NOT that Qwen has independently learned more arithmetic.

## V10.4 objective

Offer an isolated reusable input-to-answer component that takes
**explicit operator-supplied** numeric error values. The component
does not trust model-supplied numbers, unstructured instructions, or
unsupported window labels.

Inputs are exactly:
  e3, e5, e8: integers in [0, 1,000,000,000].

The output independently computes:
  e_min = min(e3,e5,e8)
  W* = {w in {3,5,8} : e_w = e_min}
  D35 = e3-e5
  D38 = e3-e8
  D58 = e5-e8
  tie = (|W*| > 1)

Identity D35+D58=D38 is checked IN ADDITION TO independent arithmetic.
The oracle also checks tie/equality equivalence.
If a model claim is optionally supplied, the verifier parses the seven
fields and reports mismatches against the trusted inputs; it does NOT
edit the claim, run inference or assert that Qwen generated the
canonical answer.

The seven fields:
  MIN_ERROR, BEST_WINDOWS, TIE, FIBONACCI_GUARANTEE,
  PROOF_D35, D38, D58

All claims must have exactly one unambiguous occurrence of each field.
The validator supports harmless formatting differences like optional
spaces after "=" and semicolons instead of commas between proof fields.
Claims with repeated/missing fields, duplicate/unsorted winner sets,
invalid numeric inputs or out-of-range errors fail closed.

## Unit and exhaustive proofs

Twelve offline unit tests cover:
- all seven unique or tied winner patterns;
- correct and reversed signed arithmetic;
- canonical proof generation and relaxed claim parsing;
- rejecting duplicate/unsorted/missing field claims;
- strict bounded integer input schema and large boundary cases;
- an example where a wrong proof is algebraically consistent yet
  differs from the trusted source error numbers;
- explicit no-model/no-files/no-network constraints.

An additional exhaustive test traverses 12^3 = 1,728 synthetic
integer triples and checks correct winner set, minimum, pairwise
difference identity and positive-affine invariance for each.
This increases mathematical test coverage but is not a general
proof of system reliability for arbitrary natural language or
high-stakes business decisions.

## Invoke without modifying Fun Industrial

After updating your clean Git branch:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Verify-Fun-Math-Decision-V104.ps1

Default demonstration uses:
  e3=236, e5=230, e8=235.
Expected:
  min_error=230, best_windows=[5], tie=NO,
  D35=+6, D38=+1, D58=-5.

Supply your own trusted numeric values:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Verify-Fun-Math-Decision-V104.ps1 -E3 18 -E5 18 -E8 29

The CLI also supports optional explicit model-claim comparison
through the -ModelClaim parameter. Source input values always take
precedence over assertions made by any model.

Expected markers if the local unit tests and formula check pass:

    FUN_MATH_V104_TESTS=PASS
    FUN_MATH_V104_PROOFS={"error_triplets_verified":1728,"winner_patterns_covered":7}
    FUN_MATH_V104_RESULT=...
    FUN_MATH_V104=STANDALONE_VERIFIED_MATH_PASS_NOT_INTEGRATED

## Isolation / next work

No live model is loaded, no LoRA is trained or deployed, no local
network/server port is opened, and no file is written or overwritten.
The component is NOT hooked into the Fun Industrial dashboard,
REA MCP or any autonomous action. Elektron is untouched.

This is a specialized tool for three predetermined error windows.
Before considering future production integration, independently
review its input trust boundary, data types, error provenance and
operator approval scheme. Production integration would require
separate approval and tests. Neural mathematical learning remains
a separate, objectively measurable training problem.
