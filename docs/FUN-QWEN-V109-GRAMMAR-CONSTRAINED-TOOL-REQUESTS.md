# Fun Industrial V10.9 — real Qwen GBNF-constrained math tool requests

## Grounded previous evidence

The operator's Nov 23, 2026 V10.7 original Qwen3-4B CPU evaluation
produced 7 raw JSON tool request strings, all 7 rejected by the
unchanged strict V10.6 host JSON contract. No tool dispatch occurred.
All seven contained a trailing excess closing curly brace.

V10.8 forensic replay of the original SHA-verified V10.7 report then
confirmed:
- 15 / 15 offline tests PASS after two test compatibility fixes;
- raw V10.7 requests remain 0 / 7 accepted;
- all 7 / 7 would meet the full unchanged V10.6 schema,
  source ID and integer authority checks IF exactly one final
  extra closing brace were removed in a hypothetical replay;
- no original model inference, training, data mutation, frozen
  test access or production registration occurred.

Thus JSON termination is a grounded immediate issue in the tested
requests. Nothing so far proves model-intrinsic numeric reasoning
improved or Qwen can use a native MCP tool call.

## V10.9 hypothesis and one-factor comparison

The pinned llama-tq v2026.10.31 source supports:
  --grammar-file FNAME
  --grammar GRAMMAR
  --json-schema-file FILE
in common/arg.cpp. Runtime preflight checks whether the
already-built llama-completion.exe itself advertises
--grammar-file. It will HOLD if this option is absent; it will
not compile, replace, modify, download, or install anything.

V10.9 deliberately uses the SAME SEVEN cases from V10.7 to
compare the constrained grammar against the historical raw 0/7
result under matched conditions. This is a controlled
within-question comparison (NOT new holdout generalization).
The precise experiment change is one sampling flag:

  --grammar-file intelligence-checks/fun-qwen-v109-typed-request.gbnf

Keep unchanged:
- original pretrained GGUF SHA:
  7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5
- existing isolated pinned llama-completion.exe;
- V10.7 tool_request_prompt(case) exact text;
- Qwen3 nonthinking ChatML prefill;
- seed 6427, --temp 0, --ngl 0, --t 4;
- 512 context, batch 128, 160 generated tokens;
- the SHA-verified operator/host values, source IDs, and cases;
- the EXACT V10.6 strict JSON and host-value checks;
- the seven-case selection and raw success criteria.

The static GBNF only enforces:
- valid, nested JSON object closure with no third brace;
- the schema/tool fixed allowlisted names and top-level keys;
- three integer fields e3/e5/e8 with correct names;
- a string source ID following a limited character pattern.

The grammar DOES NOT embed correct numeric values or source IDs.
The model must still copy them correctly. The trusted host
authenticates the input tuple independently of model output.
A candidate with incorrect numbers, forged IDs, truncated output
or other mismatches remains rejected, even if it parses as JSON.

Because this is one narrow grammar shape (with a fixed key order),
successful decoding demonstrates constrained tool-request
generation, not broad freeform structured tool use or autonomous
tool choice.

## Experimental execution boundary

- Seven real Qwen CPU inference processes sequentially.
- Existing V7.1 RAM reserve, commit headroom, private
  commit and per-process timeout watchdogs apply to each.
- Preflight verifies original V10/V10.1/V10.5/V10.7 reports,
  SHA-256 source files and all seven original validation cases.
- Original V10.7 output files stay untouched.
- Fresh V10.9 output directory with no-overwrite semantics:
  %LOCALAPPDATA%\FunIndustrial\QwenActualGGUFLoRAV5\math-grammar-constrained-tool-requests-v109\
- New independent stdout/stderr logs + JSON summary.
- Explicit operator approval required for real inference.
- No training, LoRA, REA tool registration, live Qwen-server
  restart/attachment, Fun dashboard modification, or Elektron action.
- The reserved V10 final test split is never opened.

## Measurements

The report distinguishes:
- original_v107_valid_requests = 0 / 7 (historical)
- v109_raw_valid_model_generated_requests = measured original
  constrained generation accepted by strict V10.6 host
- v109_invalid_model_requests_rejected = remaining count
- v109_actual_host_math_dispatches = accepted requests
- v109_correct_tool_outputs = verified answers among
  accepted requests

There is no post-hoc insertion of a closing brace, no JSON
substring extraction, no fabricated accepted fixture, and no
relabeling of earlier rejected outputs. If a constrained request
fails, the strict host rejects it and the report retains the raw
generation.

The grammar may permit positive integers up to ten digits; any
values outside the exact host numbers and 1-billion bound are
still rejected by the V10.6 host check.

## Safe commands

Read-only preflight:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Fun-Qwen-GBNF-Tool-Requests-V109.ps1

New explicitly approved isolated experiment:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Fun-Qwen-GBNF-Tool-Requests-V109.ps1 -Execute -Approval I_APPROVE_ISOLATED_QWEN_V109_GBNF_TOOL_REQUEST_EVALUATION

The runner first performs 17 offline unit tests then, if explicitly
approved, checks native binary support, memory headroom and
unmodified source evidence before invoking original Qwen.
It compares protected live listener identity before and after.

The expected completion marker ONLY if the local run succeeds is:

    FUN_QWEN_V109=CONSTRAINED_QWEN_TOOL_REQUESTS_MEASURED_NOT_DEPLOYED

A successful run can still have fewer than seven accepted
requests. Always inspect the actual request counts and failures.

If preflight fails because the pinned executable does not
advertise --grammar-file, preserve previous evidence and do
not silently substitute another build or modify live Fun.

## Interpretation and further work

Even if V10.9 produces seven valid accepted JSON requests,
this establishes grammar-constrained output in an isolated
evaluation, not Qwen's intrinsic arithmetic accuracy,
native model-integrated MCP function calling or production
deployment. The next proposed experiment would return an
actual host tool result to Qwen in a controlled two-turn test
and grade whether its final prose faithfully follows the
verified numbers rather than inventing arithmetic.

That would require distinct operator approval and new
isolated safety tests. Fun Industrial and Elektron remain
untouched until any separate production integration is
explicitly requested and authorized.
