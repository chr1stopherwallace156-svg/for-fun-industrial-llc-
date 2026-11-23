# Fun Industrial V10.5 — Isolated Qwen-to-deterministic-math bridge

## Evidence before V10.5

V10.4 standalone verifier passed all 12 local unit tests and
1,728 exhaustive integer-triple checks. It independently computed
MIN_ERROR=230, BEST_WINDOWS=5 and the signed proof D35=6,D38=1,D58=-5
from the operator's actual numbers 236,230,235.

The V10.1 original-Qwen model benchmark on 14 validated math inputs
showed all 14 minimum-error winner sets and decision fields correct,
but only 3/14 complete signed proofs correct.
V10.3 reconstructed all 14 correct proofs from trusted inputs and
identified 19 wrong arithmetic fields across 11 saved answers.

This established the usefulness of verified arithmetic without
claiming that Qwen learned new weights or improved its neural skills.

## Objective

V10.5 now tests the complete local pipeline:

    SHA-verified V10 validation case
       -> existing isolated original Qwen3-4B CPU inference
       -> original Qwen response recorded unchanged
       -> independent, typed (e3,e5,e8) oracle calculation
       -> per-field comparison / correction evidence
       -> separate JSON comparison report

This is EXTERNAL PYTHON ORCHESTRATION between two local functions.
It does NOT prove that the Qwen model can autonomously decide when
to call an MCP tool, and the verification code is not wired to
the active Fun Industrial UI, REA MCP, dashboard, or production agent.

## Fresh held-out evaluation design

Uses existing V10 synthetic validation set only. The original
V10.1 baseline selected the FIRST TWO records from each winner
pattern. V10.5 verifies the old SHA-pinned baseline report and
source dataset, then deliberately selects the NEXT unused record
from each of the seven winner patterns:

    {3}, {5}, {8}, {3,5}, {3,8}, {5,8}, {3,5,8}

Total: SEVEN genuine local Qwen inference sessions, CPU-only, sequential.
These questions were not used by V10.1 and are excluded from
V10's training split. The independent V10 frozen test set remains
unopened. This is a focused integration diagnostic, not enough
evidence to assert generalization.

Each Qwen output is stored as original model output along with a
fingerprint and the native stdout/stderr evidence logs.
The oracle takes its numbers from the independently checked V10
validation question and matching validation ground-truth record.
It does NOT extract its values from the generated Qwen response.

The same V7.1 deterministic, non-thinking Qwen3 ChatML settings
apply, with temperature zero, 160 generated tokens, CPU, seed 6427,
four threads, per-child timeout and adaptive RAM/commit watchdog.
This test loads the original pretrained GGUF ONLY, no LoRA weights.

## Verification and graded outcomes

If the generated response has exactly seven interpretable fields:
    MIN_ERROR, BEST_WINDOWS, TIE, FIBONACCI_GUARANTEE,
    PROOF_D35, D38, D58

the bridge compares all claimed values to the independent
V10.4 oracle.

The bridge records whether Qwen:
- correctly chose all tied minima;
- correctly calculated all three differences;
- satisfied the entire mathematical answer;
- made a parseable claim or omitted/duplicated fields.

Even if Qwen outputs an internally self-consistent but incorrectly
signed calculation, the oracle derives every difference from the
trusted source numbers and detects the mismatch.

If the Qwen output is malformed or mathematically wrong, the bridge
displays a separate exact verified solution; it does NOT rewrite the
original output and DOES NOT attribute verified math to Qwen's model.
The verified response is cross-checked through BOTH the V10 training
label validator and the standalone V10.4 claim parser.

## Isolation and evidence preservation

- Original official Qwen3-4B GGUF hash:
  7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5.
- Only preexisting isolated Windows llama-completion.exe may run.
- Model, V10 dataset source files and V10.1 prior report are
  fingerprinted before and after and expected to remain unchanged.
- Live services and port listeners are not started, stopped or
  intentionally changed. The launcher compares protected listener
  ownership before and after.
- No installs, downloads, new builds, training, LoRA loading,
  external API requests, email, payments or Elektron operations.
- A new folder is created ONLY in an explicitly approved real
  inference run. Any existing V10.5 folder blocks overwriting.
- V10 frozen test split is never opened or scored.
- Fourteen offline safety/tests are run first.

New outputs exclusively in:
%LOCALAPPDATA%\FunIndustrial\QwenActualGGUFLoRAV5\math-toolbridge-v105\

Including native inference logs and toolbridge-report.json.
Previous V10.1/V10.2/V10.3/V10.4 evidence remains intact.

## Commands

Read-only preflight:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Fun-Qwen-Math-Toolbridge-V105.ps1

Execute the isolated end-to-end test with new explicit approval:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Fun-Qwen-Math-Toolbridge-V105.ps1 -Execute -Approval I_APPROVE_ISOLATED_QWEN_V105_MATH_TOOLBRIDGE_EVALUATION

Expected success markers if the user's PC actually completes work:

    FUN_QWEN_V105_OFFLINE_TESTS=PASS
    FUN_QWEN_V105_CASE_RESULT=...
    FUN_QWEN_V105_RESULT=...
    V105_ISOLATED_REAL_QWEN_TO_VERIFIED_MATH_BRIDGE_COMPLETE_NOT_DEPLOYED
    FUN_QWEN_V105=ISOLATED_QWEN_MATH_BRIDGE_PASS_NOT_DEPLOYED

If a unit test, source hash, memory check or native inference fails,
stop and examine evidence; do not silently retry or overwrite the
previous experiment's folder.

## Later milestones (outside V10.5)

Once V10.5 is observed to work end-to-end, consider a separately
approved, isolated structured tool-call interface that explicitly
passes typed input provenance and only allows the Qwen system to
request mathematical verification rather than invent numerical
measurements. Independently test parser trust, malicious/ambiguous
inputs, and failure handling before exposing it to live Fun.
Separately evaluate true neural arithmetic learning with a
broader, rephrased benchmark and controlled training.

V10.5 is a safe engineering demonstration, not a live production
capability or a trained mathematical breakthrough.
