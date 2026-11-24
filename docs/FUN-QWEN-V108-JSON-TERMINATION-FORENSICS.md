# Fun Industrial V10.8 — forensic replay of actual Qwen JSON termination

## Grounded outcome from user-run V10.7, November 23 2026

V10.7 ran:
- 20/20 offline tests PASS;
- seven real CPU-only original Qwen3-4B GGUF inference requests, one from
  each seven minimum-error winner patterns in verified V10 validation;
- seven invalid raw JSON proposals, all rejected by the strict V10.6 host;
- zero actual V10.7 math tool dispatches;
- zero successful valid model-generated tool requests;
- the 84-example V10 final test split remained unopened.

Example from the REAL Qwen output, validation-8:
  {"schema": "fun-math-tool-proposal-v1",
   "tool": "verify_window_math",
   "source_id": "V107Val8",
   "arguments": {"e3": 236, "e5": 240, "e8": 238}}}

Note the THIRD closing curly brace: valid nested JSON needs only TWO.
All seven responses displayed by the user contained the same
visible trailing "}" excess. The model seems to have copied all
necessary fields correctly, but a pasted terminal preview alone
cannot establish that all seven are otherwise valid.

The strict JSON parser was CORRECT to reject the malformed raw texts.
Do NOT change V10.7's historical scores or label those requests
successfully dispatched.

## V10.8 goal

V10.8 performs NO NEW MODEL INFERENCE. It analyzes only the original
V10.7 saved report and SHA-verified original source evidence.

For each existing raw Qwen output:
1. Verify historical V10.7 report identity/state/model SHA and 0/7
   actual host dispatch score.
2. Check all seven case IDs and SHA-256 hashes of raw model text.
3. Recheck the source data, input prompt, prior V10.1/V10.5 reports,
   case correctness and original V10.6 rejection reasons.
4. Independently identify whether the ONLY apparent recoverable
   corruption is one extraneous trailing "}".
5. In a *diagnostic-only* in-memory simulation, remove EXACTLY ONE
   final "}" and run the unchanged V10.6 strict parser, exact source
   ID check, exact integer equality, and deterministic V10.4 oracle.
6. If anything else is missing, forged, ambiguous, invalid, or
   inconsistent, the candidate remains rejected.
7. Keep the original malformed output, SHA, and 0/7 actual dispatch
   count unchanged. Never mutate saved reports or user model data.

The in-memory call to V10.6 dispatch is a local pure-arithmetic
simulation, not a historical Qwen call, not a production registration,
and not authorized evidence that Qwen emitted valid JSON.

## Metrics and interpretation

- raw_valid_tool_requests = **0** (from historical V10.7)
- raw_host_dispatches = **0** (from historical V10.7)
- single_trailing_brace_shape_count = number of cases with the
  precise malformed shape and general parse error;
- hypothetical_host_valid_after_one_brace_removal = number that
  *would* pass all trusted-host checks after removing one character.
- no inference, training, adapter update or live registration.

Even if hypothetical_host_valid_after_one_brace_removal = 7,
Qwen's ORIGINAL raw success rate is still 0/7. The result would
support investigating a dedicated constrained JSON generation
method or a separately evaluated, tightly bounded postprocessor.
Never allow freeform "repair" to bypass the host trust boundary.

## Test coverage

Fifteen offline unit tests include:
- exact, one trailing brace diagnosis;
- raw valid case not normalized;
- two extra braces, prose and malformed surrounding text rejected;
- forged source values, wrong IDs, duplicate keys, unauthorized
  tool names rejected even if a final brace is removed;
- non-attribution of simulated calls to the original model;
- source fingerprints, original 0/7 score and report integrity;
- no model execution, persistent file writes or frozen test reads.

## Run

From a clean, updated FunIndustrial-FISRE-Live checkout:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Audit-Fun-Qwen-Tool-JSON-V108.ps1

No operator approval is required because this is read-only analysis.
Expected terminal markers (ONLY if local tests/evidence succeed):

    FUN_QWEN_V108_OFFLINE_TESTS=PASS
    FUN_QWEN_V108_SUMMARY=...
    FUN_QWEN_V108_CASE=... [7 diagnostics]
    FUN_QWEN_V108=READONLY_SAVED_JSON_FORENSICS_COMPLETE_NO_DEPLOYMENT

There are no source file writes and no new V10.8 output directory.
Keep V10.7's original tool-requests-report.json intact.

## After audit (not performed here)

If the V10.8 diagnostics confirm all seven failures are ONLY due
to a single extra brace, next evaluate either:
- constrained JSON generation using a verified pinned llama.cpp
  grammar/format facility in an ISOLATED benchmark, or
- a tightly specified host-side one-character normalization
  immediately followed by unchanged V10.6 schema, source-ID and
  integer validation, with a separate label for model-corrected syntax.

Any new isolated inference needs separate consent. Live Fun,
REA/MCP registration, main dashboards, Elektron and model weights
remain untouched until separately authorized and tested.


## V10.8.1 local test repair

The first operator run reported 3 failed unit tests out of 13; the
read-only saved-report audit was not executed because the launcher
stopped on unit-test failure.

Root cause A: The V10.6 synthetic fixture serializes JSON with
sort_keys=True, so the last top-level field is a SCALAR and valid
JSON ends with one "}". Appending one invalid extra "}" yields
two closing braces. The initial V10.8 forensic check mistakenly
required "}}}" in all cases, assuming the last field would be
the nested arguments object as it was in Qwen's actual V10.7
generated requests. That assumption is incorrect because JSON key
ordering is not semantically meaningful.

Fixed: The raw body must start with "{" and end in "}", be
rejected by the existing V10.6 strict parser with the specific
V106_PROPOSAL_NOT_STRICT_JSON error, and then the forensic audit
tries removing exactly ONE final character IN MEMORY. The unchanged
strict parser, exact source identity, exact integer checks and
deterministic math dispatcher must ALL accept the resulting candidate.
This is analysis only: V10.7's raw requests remain invalid and 0/7.

Root cause B: A duplicate-key test expected the specific underlying
reason in the forensic summary, but the generic diagnostic hid it.
Fixed: The diagnostic reports the strict parser's rejection reason
without treating it as a salvageable trailing-brace case.

Two regression tests now cover (1) the sorted fixture ending in one
valid brace and (2) the actual Qwen field ordering where nested
arguments are last. Total offline unit tests: 15.

This does not modify the V10.6 strict contract, V10.7 model output,
previous results, frozen test, model weights, production tools or
Elektron. The changed source and tests require execution on the
operator's Windows PC to confirm successful completion.
