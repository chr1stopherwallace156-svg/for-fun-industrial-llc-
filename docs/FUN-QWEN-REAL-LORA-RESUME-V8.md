# Fun Industrial — Qwen3-4B actual pretrained-weight LoRA continuation (V8)

## Evidence and reason for next training experiment

The operator's V5 run successfully trained against the original official
Qwen3-4B Q4_K_M GGUF, produced an 82,368-byte isolated rank-two Q/V LoRA
adapter after two training windows, and V6 demonstrated nonzero B-matrix
updates where the pinned training fork initialized every B tensor to zero.

V7 performed three paired inference checks, and all three outputs were
unchanged, but they were truncated inside a thinking trace. The corrected
V7.1 nonthinking evaluation successfully completed all three paired checks,
again showing no exact text change. The first held-out Fibonacci recurrence
was correct for both original and adapted models (3087 + 41838 = 44925).
The held-out model selection was *wrong*: Qwen chose window 8 with error 29
rather than the tied best windows 3 and 5, whose errors were both 18.
These are only three qualitative pairs and do not establish the broader
accuracy or lack of any numerical model effects.

The V8 objective is narrow: test whether another short, genuine LoRA
optimization pass produces more learned adapter changes without risking
the original model or previous evidence. Success is not an improvement
claim until separate inference evaluation is completed.

## Resume strategy, not fresh retraining

The pinned external llama-tq v2026.10.31 code explicitly supports
--resume from three files:
- qwen-fibonacci-smoke.lora.gguf (learned adapter)
- qwen-fibonacci-smoke.lora.gguf.opt (optimizer state)
- qwen-fibonacci-smoke.lora.gguf.state (training offset and learning-rate step)

V8 validates that the original 82,368-byte LoRA still matches its exact
SHA-256 and has nonzero learned B matrices. It checks the verified original
pretrained GGUF digest, V5 completion log and receipt, original 30-example
training slice hash, all three existing checkpoint files and their sizes
and checkpoint position. It reads these inputs but does not modify them.

On explicit new training approval, it makes *exclusive-create* verified
copies of all three resume inputs under:

%LOCALAPPDATA%\FunIndustrial\QwenActualGGUFLoRAV5\continuation-v8\

It refuses any existing continuation-v8 directory to prevent overwriting
previous work. No other training directory is cleaned, erased or edited.

The resumed trainer uses exactly the same verified 30-example training
slice, original Qwen GGUF, target block 35 Q/V matrices, rank 2, alpha 2,
SGD, learning rate 0.0001, context 128, batch 32, microbatch 32,
4 threads, and CPU backend as V5; the new limit is **up to 16 more
training windows** (or natural epoch completion), using --resume.

It does **not** switch training data mid-resume, increase rank, change
targets, alter optimizer settings, train all 36 blocks, or load the live
server. Those changes would invalidate resume compatibility and
require a different, independently approved experiment.

## Guards and resource usage

- Minimum 5.3 GiB available host RAM and 6.0 GiB commit headroom *before*
  the run; otherwise holds without creating the V8 output folder.
- The running process inherits the V5 watchdog: stop if host RAM falls below
  1.25 GiB, commit headroom below 0.8 GiB, supervised child private
  commit exceeds 5.0 GiB, or elapsed training time exceeds 2,400 seconds.
- Stops only the isolated training child process tree on resource breach,
  never the normal Qwen service or unrelated Windows processes.
- Checks baseline model and adapter provenance and a native log confirming
  two LoRA pairs were resumed, not initialized afresh.
- Requires a native training completion log or natural epoch-end save.
- Saves a separate candidate GGUF and verifies the new adapter SHA differs
  from V5; checks that trained query/value B-tensor statistics changed.
- No GPU backend used, no new model download, no external source clone,
  no package install, no adaptive changes to network permissions, no
  automatic live deployment.

**Caution**: process private commit is not total system memory.
The watchdog reduces memory pressure risks but cannot guarantee
zero effect on every Windows workload. With a 16 GiB host, keep other
heavy work idle while the isolated run is active.

## Running

From a clean checkout of feature/fun-fisre-live-8802-20261122:

Read-only validation:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Continue-Fun-Qwen-Real-LoRA-V8.ps1

Separate explicit approval to resume *real training*:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Continue-Fun-Qwen-Real-LoRA-V8.ps1 -Execute -Approval I_APPROVE_ISOLATED_QWEN_LORA_V8_CONTINUATION

The launcher runs nine synthetic, standard-library-only offline tests
before the guarded Python worker starts. A Windows run is required to
establish whether the V5 saved checkpoint supports actual resumption on
this machine; the GitHub implementation is NOT proof of local success.

Expected only if resumed training and integrity checks pass:

    PASS_REAL_QWEN_LORA_V8_CONTINUED_CANDIDATE_NOT_DEPLOYED
    FUN_QWEN_V8=REAL_LORA_CONTINUED_CANDIDATE_REQUIRES_BEHAVIORAL_EVALUATION

V8 results and training log are stored solely in continuation-v8.
On any hold, leave this folder in place. Do not force a retry that
overwrites the candidate or weaken memory limits; inspect the specific
reason and local training.log first.

## Next step if V8 passes

Run an independent deterministic comparison of original Qwen, V5 adapter,
and V8 candidate on longer held-out math and non-math questions.
Score correct answers, tie handling, unknowns and regressions before
declaring any learned reasoning improvement.

The active Qwen GGUF, V5 adapter, V6 audit, V7 and V7.1 reports, live
services and Elektron are never intentionally modified by V8.
