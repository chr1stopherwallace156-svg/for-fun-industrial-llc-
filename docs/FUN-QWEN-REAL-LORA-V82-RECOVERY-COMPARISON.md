# Fun Industrial — V8.2 recovered LoRA and three-way inference comparison

## Confirmed evidence (Nov 23, 2026)

The isolated, native CPU Qwen3-4B GGUF LoRA V8 continuation completed
training and validation but failed to replace its copied source adapter
due to a Windows destination-exists rename error. The old main adapter
SHA-256 and resume position did not change.

V8.1 read-only audit FOUND TWO valid different learned adapters in:
  continuation-v8/qwen-fibonacci-resumed.lora.gguf.best
  continuation-v8/qwen-fibonacci-resumed.lora.gguf.tmp

Both files are 82,368 bytes and have the *same* SHA-256:
05efce40082eee0815decc4c21f74150c612adbb2e88fb2149c9c4dd951f7240

Both contain nonzero query/value LoRA B matrices (last attention block 35).
The B-tensor L2 norms increased relative to V5:
Q 0.00011237 -> 0.00063761; V 0.00004417 -> 0.00012127.
Changes in LoRA parameter magnitude are not proof of better answers.

Original V5 adapter is unchanged, SHA:
da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193

Original official Qwen3-4B Q4_K_M GGUF is unchanged, SHA:
7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5

V8.1 found no proof of a valid new V8 optimizer state or training
position: the original checkpoint triplet remained at epoch 0,
datapoint 2. The saved recovered adapter files are intended for
**inference evaluation**, not a direct resume without new
checkpoint handling.

## V8.2 workflow

With explicit new operator approval:

1. Read/verify model SHA, V5 adapter SHA, V8 original main adapter SHA.
2. Read/verify BOTH V8 recovered candidate digests and Q/V B tensor
   changes. Require existing native training log evidence of resume,
   training completion, and the Windows save failure.
3. Require the previously compiled pinned offline llama-completion
   binary. No new build, git clone, downloads, package installs.
4. Check memory availability and reject an already-existing
   recovery-evaluation-v82 output directory (no overwrite).
5. Copy only the validated .best adapter with exclusive-create into
   recovery-evaluation-v82/qwen-v8-validated-recovery.lora.gguf;
   verify copied SHA-256 exactly.
6. Run **18 sequential local inference processes** (not concurrent):
   baseline original GGUF, baseline+V5 LoRA and baseline+recovered V8
   LoRA, each on six identical prompts.
7. Print per-case responses and partial evidence checks. Save a
   JSON report, separate from V7 and V7.1, at
   recovery-evaluation-v82/comparison.json.
8. On successful completion, re-check source file SHA-256 values
   to ensure all source checkpoints and base model remain unchanged.

The run is entirely separate from the live Qwen server and uses
local CPU inference only, with no server listener/ports. It uses the
V7.1 direct-answer Qwen3 nonthinking ChatML prompt, generation seed
6427, temperature 0, up to 160 generated tokens, and the existing
per-child adaptive memory/timeout watchdog. Initial preflight
requires at least 4.3 GiB free host RAM and 4.0 GiB commit headroom.

## Cases and conservative grading

Six cases from the integrity-checked curriculum and fixed controls:
- Two held-out recurrence problems: expected sum explicitly verified
  as a number in generated answers.
- Two held-out model-selection cases: expected lowest-error window(s).
  A regex flags explicit selection of a demonstrably wrong window;
  ties and natural-language explanations remain manual-review only.
- Ordinary control questions about Japan and France capitals: checks
  for Tokyo and Paris respectively.

Output text-change counts and number/keyword presence are **not**
automatic evidence of mathematical generalization. The set of six
cases is a small feasibility/diagnostic comparison; it cannot
support a robust statistical improvement claim. This run
does not train, modify weights, merge LoRA, load any adapter into the
live server, or alter Fun Industrial's production dashboard.

## Invocation

Read-only preflight after updating your clean Git branch:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Recover-Evaluate-Fun-Qwen-V82.ps1

Copy validated candidate and run six three-way cases with explicit
separate approval:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Recover-Evaluate-Fun-Qwen-V82.ps1 -Execute -Approval I_APPROVE_ISOLATED_QWEN_V82_RECOVERY_EVALUATION

Expected ONLY if local execution succeeds:

    FUN_QWEN_V82_OFFLINE_TESTS=PASS
    FUN_QWEN_V82_RECOVERY=...
    FUN_QWEN_V82_CASE_RESULT=...
    V82_THREE_WAY_QWEN_INFERENCE_COMPLETE_RECOVERED_NOT_DEPLOYED
    FUN_QWEN_V82=THREE_WAY_RECOVERY_COMPARISON_COMPLETE_NOT_DEPLOYED

If any phase holds, preserve the recovery-evaluation-v82 directory,
native logs, V5 and V8 source checkpoints. No automatic retry or overwrite.
Review the specific reason before another isolated run.

## Next phase

Decide whether the recovered V8 adapter improves any held-out
questions, whether it regresses on controls, and whether a larger
mathematically scored validation study is justified. Further training,
new optimizer-state handling, model export, or live deployment is a
separate approval, not performed by this workflow.
