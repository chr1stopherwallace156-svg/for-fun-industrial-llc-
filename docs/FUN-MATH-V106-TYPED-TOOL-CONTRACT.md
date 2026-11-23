# Fun Industrial V10.6 — isolated typed math tool proposal and host trust boundary

## Verified prior milestone

On November 23, 2026, the operator ran V10.5 successfully:
- 14/14 offline unit tests passed;
- seven new SHA-verified V10 validation questions evaluated with the
  original local Qwen3-4B Q4_K_M GGUF in seven isolated CPU runs;
- the pretrained Qwen responses selected the correct window set in 7/7;
- only 2/7 complete mathematical proofs were correct;
- five Qwen answers required deterministic reconstruction;
- the independent V10.4 oracle computed 7/7 exact reference proofs;
- frozen V10 test examples were not opened;
- no training, LoRA deployment, live service modification or
  Elektron operations occurred.

V10.5 proved EXTERNAL Python orchestration around local inference.
It did NOT prove native tool calling by Qwen, or production integration.

## Goal of V10.6

V10.6 defines a strict, typed, host-authorized **prototype contract**
that an AI may eventually REQUEST. The model is not authorized to
supply the source values of the calculation.

Trust separation:

    Trusted operator / host data: source_id and e3,e5,e8
          |
          +--> canonical SHA-256 source fingerprint (audit identity only)
          |
    Untrusted model proposes JSON-only verify_window_math request
          |
          v
    JSON duplicate-key rejection, schema/version/tool allowlist
          |
          v
    Validate source_id and ALL numbers EXACTLY match host-held values
          |
          v
    Reuse V10.4 deterministic calculation
          |
          v
    Verified answer with explicit proof provenance

The prototype allows exactly one operation, verify_window_math.
There are no filesystem, process, browser, email, code execution,
database mutation, REA or administrative actions.

The synthetic proposal format:

    {
      "schema": "fun-math-tool-proposal-v1",
      "tool": "verify_window_math",
      "source_id": "OperatorDemoV106",
      "arguments": {
        "e3": 236,
        "e5": 230,
        "e8": 235
      }
    }

The exact fields above are required, and all extras rejected.
Arguments must be genuine Python JSON integers (not booleans, floats,
strings or numeric expressions) within [0,1000000000].
Source identifiers have a tightly constrained ASCII pattern.
Duplicate JSON keys are rejected even if a generic parser would
otherwise accept the later value. Unknown versions, tools, extra
parameters, missing fields, invalid JSON, NaN/Infinity and claims
that differ from trusted host values all produce a HOLD.

The host's SHA-256 digest identifies a canonical source tuple.
**It is not a MAC, signature, proof of external data authenticity,
replay defense or model authentication.** The trust boundary assumes
the caller and trusted host source values remain outside untrusted
model control. If integrated later, this must be enforced by the
actual host/app architecture and independently tested.

An accepted request returns:
  V106_HOST_AUTHORIZED_READONLY_MATH_EXECUTED

with:
- exact input-match attestation,
- independently computed MIN_ERROR/BEST_WINDOWS/TIE,
- signed PROOF_D35/D38/D58,
- a canonical verified answer,
- explicit booleans stating no model, tool runtime or production
  registration was involved.

## What is tested

The prototype has **17 offline standard-library unit tests** for:
- exact tool manifest and absence of live registration;
- successful host-authorized calculation;
- every tied-winner pattern;
- altered/forged numbers and source identifiers;
- stale/tampered host object fingerprints;
- duplicate keys at top-level or inside arguments;
- unknown tool names or schema versions;
- extra parameters and malformed JSON;
- booleans, floats, strings, negative or oversized numbers;
- nonfinite numeric constants;
- explicit statement that source SHA is NOT authentication;
- synthetic fixtures never described as Qwen output;
- no network, model invocation, writes, REA or deployment.

This is a software trust-boundary unit test, NOT evidence of an
actual Qwen-generated structured tool request.

## Invoke safely

From clean, current FunIndustrial-FISRE-Live checkout:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Verify-Fun-Math-Tool-Contract-V106.ps1

The runner executes the 17 tests then demonstrates a SYNTHETIC
permitted request using trusted inputs 236,230,235. You can specify
other values with -E3, -E5 and -E8 and a -SourceId that identifies
an operator-owned input.

Expected if tests succeed locally:

    FUN_MATH_V106_OFFLINE_TESTS=PASS
    FUN_MATH_V106_MANIFEST=...
    FUN_MATH_V106_RESULT=...
    FUN_MATH_V106=HOST_AUTHORIZED_MATH_TOOL_CONTRACT_PASS_NOT_DEPLOYED

The Python script can separately accept --proposal '<JSON text>'
to demonstrate rejection of invalid requests; the PowerShell runner
uses a synthetic allowed fixture by default.

No downloads, packages, compilation, new training, inference,
local port changes, file mutations, dashboard edits, or access to
Elektron are required for this prototype.

## Next milestones — NOT completed by V10.6

1. Once V10.6 local tests pass, decide whether to develop a
   genuine isolated Qwen function-call / routing experiment:
   record the raw model-generated request, validate JSON and
   source authority, and require explicit operator approval before
   letting even the allowlisted read-only tool execute.
2. Validate malicious and ambiguous prompt injection and provenance
   claims separately, including side effects and failure modes.
3. Only after operator approval and demonstrated isolation should
   any production MCP / REA or dashboard integration be planned.
4. Keep future direct arithmetic-training experiments distinct
   from tool-assisted correctness. Frozen V10 test data remain
   reserved for an independent evaluation.

V10.6 does NOT call Qwen or integrate a live MCP service.
