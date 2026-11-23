# Fun Industrial V8.1 — recoverability audit of stranded learned Qwen LoRA

## Observed Windows V8 issue

V8 resumed the real Qwen3-4B LoRA training from copied V5
adapter + optimizer + state. The local run passed preflight, preserved
V5/V6/V7/V7.1, entered training, reached step data=0000064/0000064,
and started validation. It exited with code zero, but the V8
verification reported V8_NO_ATTESTED_STOP_OR_NATURAL_EPOCH_END.

A read-only post-run inspection then established:
- qwen-fibonacci-resumed.lora.gguf still had the original V5
  SHA-256 da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193.
- qwen-fibonacci-resumed.lora.gguf.opt still had a 96-byte
  file and .state still showed epoch 0, datapoint 2, lr_step 16.
- No V8 success receipt existed.
- The native log explicitly contained an adapter save failure.
- No new learned adapter was proven saved by the V8 launcher.

## Why trained output may still exist

The pinned llama-tq source writes GGUF adapters to
<adapter-filename>.tmp, then calls std::rename(tmp, existing_destination).
On Windows, this rename can fail if destination exists. A resumed
training run starts with the original adapter *copied to that
destination*, so a failed replacement can leave the new trained adapter
in its temporary GGUF, and the old adapter unchanged.

The same native training code saves a separate
<adapter-filename>.best file when it observes a new best
validation loss. That file may also contain the learned weights and
does not collide with the pre-copied main adapter.

There is no guarantee either file exists or is valid until inspected.

## V8.1 read-only investigation

V8.1 checks only the two stranded artifact paths:

- continuation-v8/qwen-fibonacci-resumed.lora.gguf.best
- continuation-v8/qwen-fibonacci-resumed.lora.gguf.tmp

It verifies the V5 official model and adapter SHA-256, that V8's
main checkpoint remains identical to the starting V5 adapter, the
native log shows the V5 resume and V8 training/validation, and for
each optional candidate, the GGUF layout, qwen3 LoRA metadata,
32-bit tensor values, rank-two query/value tensor names, nonzero
LoRA B matrices and differences from V5's B stats.

It emits one classification per candidate:
- VALID_DIFFERENT_LEARNED_LORA_CANDIDATE_NOT_DEPLOYED
- NOT_FOUND
- HOLD_GGUF_AUDIT_FAILED
- HOLD_FILE_SIZE_OUTSIDE_EXPECTED_RANGE
- HOLD_ADAPTER_IDENTICAL_OR_NO_MEASURABLE_B_UPDATES

No generated GGUF is renamed, copied, deleted or overwritten by
this audit. It does not retrain the model or run inference, install
packages, start/stop a service, or access Elektron. It never labels
behavioral improvements as proven.

## One read-only invocation

From the updated and clean FunIndustrial-FISRE-Live checkout:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Audit-Fun-Qwen-V8-Recovery-V81.ps1

It runs six offline tests and prints a complete result record.
If valid, the top-level status is
RECOVERABLE_V8_TRAINED_LORA_FOUND_NOT_DEPLOYED.

If no valid stranded candidate is found, status is
HOLD_NO_VERIFIED_RECOVERABLE_ADAPTER. Keep all V8 files.
A later Windows save fix should be restricted to a new independent
build source/binary and fresh training directory, with explicit
approval. Do not run V8 again or overwrite this failed run.

## Next decision

If a valid candidate exists, it may be safely compared
with the baseline and V5 LoRA in a separately approved
read-only paired inference experiment, using its exact file path
and SHA-256. The .best candidate is selected by training
validation loss, not by any independent held-out test, and
must not be called proven generalization.
