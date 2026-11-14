# Fun Industrial — FIAL 2 Semantic Understanding Engine (SUE) v0.2

## What this actually does
FIAL 1 already compiles a custom rule language, evaluates grant records and saves memory to SQLite. FIAL 2 adds a **different language grammar** and a standalone **evidence-grounded semantic review engine**. Its goal is to reduce unsupported grant conclusions, not to claim artificial consciousness, universal instant understanding, or verified grant eligibility.

The engine reads the original California Grants Offered CSV that the existing grant worker captured on the user's Windows PC. It validates the CSV SHA-256 with the existing FIAL 1 evidence verifier and checks each candidate's grant ID, source title and agency against the original source row **before** asking local Qwen to extract meanings.

Qwen is instructed to output a JSON `claims` array containing only exact quoted spans of the actual dataset columns and provisional interpretations. Every model quote must match a contiguous substring in the corresponding field of the original state data. Fabricated or cross-field quotes are rejected. Matching an actual quote **does not prove the interpretation is correct**, and matching a published applicant category **does not establish program eligibility**. Program-specific official application instructions still require independent verification.

The engine never opens a remote government site, emails anyone, fills official government application forms, logs into websites, executes REA tools, spends money or submits an application. It only sends up to three bounded requests to the already running **local** llama.cpp/Qwen service on `127.0.0.1:8088`. It does **not start or restart** the local model.

## FIAL 2 source program

```text
FIAL 2
MISSION "Interpret grant requirements and flag missing proof before application preparation"
SOURCE GRANTS
UNDERSTAND applicant_type,purpose,description,geography,deadline,funding
MODEL LOCAL_QWEN
GROUND QUOTES
POLICY UNKNOWN_IS_HOLD
BUDGET 3
END
```

Its grammar is deliberately limited and compiler-validated. Free-form shell, file reads, network destinations, arbitrary models, financial transactions, account authorizations or agency submissions **cannot be expressed** by FIAL 2 code. The compiler permits only fixed source fields, a local-model target, exact quote grounding and unknown-is-hold policy.

The program is at `src/fial/programs/grant-understanding.fial`. The compiler, source validator and SQLite-backed engine are at `src/fial/semantic-compiler-v2.mjs` and `src/fial/semantic-engine-v2.mjs`.

## What qualifies as 'understanding' in this prototype

- **Input comprehension:** model proposes plain-language interpretations of published applicant type, purposes, descriptions, geography, deadlines, and amounts
- **Grounding:** quotes are accepted only if they appear exactly in the verified government snapshot field
- **Epistemic humility:** `eligibility=UNKNOWN` even with supported quotes; missing registration or project evidence creates a review requirement
- **Contradiction resistance:** unsupported quotes are rejected and logged; candidate/report mismatches cannot be used as model evidence
- **Evidence and continuity:** immutable versioned Markdown and JSON cases, SQLite run/decision ledger and separate receipts

This is an incremental semantic extractor, not a full theorem prover, Bayesian program-learning implementation, trainable new language model or proof of subjective awareness. A future version could add logical contradiction checks across multiple cited documents, calibrated uncertainty estimates, and cross-run outcome evaluation after this one is qualified.

## Standalone operation and outputs

The original FIAL 1 and six-hour grants worker remain **untouched**. FIAL 2 runs only when the operator invokes it. A failed or unreachable Qwen server produces `MODEL_UNAVAILABLE_OR_UNVERIFIED` with zero accepted interpretations, not a fabricated pass.

Windows PC output:

```text
%LOCALAPPDATA%\FunIndustrial\RealApplicationWorkerV1\fial\semantic-v2\
  cases\<content-id>.md
  cases\<content-id>.json
  semantic-memory-v2.sqlite
  last-run.json
```

Markdown documents are written with `wx` create-only semantics to preserve human edits. Model proposals are stored separately in evidence JSON. Each SQLite transaction records observed facts about a run; no autonomous authority is written into the database.

### One-command qualification

From PowerShell on the Windows PC, in the existing checkout:

```powershell
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\FunIndustrial-MLHub-V3\Run-Fun-FIAL-Semantic-V2.ps1"
```

The script checks repository identity, unchanged working tree, source presence, Node syntax, offline tests, compiler and the live cached-government-evidence review. The user must first update the existing Git branch to the new source. No existing worker, Qwen or Elektron service will be started or stopped.

Expected:

```text
FIAL2_SEMANTIC_OFFLINE_TESTS=PASS
FIAL2_COMPILER=PASS VERSION=fial-semantic-bytecode-v0.2
FIAL2_RUNTIME=PASS STATE=EVIDENCE_GROUNDED_SEMANTIC_REVIEW_COMPLETE
FIAL2_CANDIDATES_REVIEWED=<0..3>
FIAL2_EXACT_SOURCE_QUOTES=<actual accepted quote count>
FIAL2_PERMISSIONS=NO_SUBMISSIONS_NO_SPENDING_NO_EMAIL_NO_REA
FIAL2_REAL_SEMANTIC_TEST=PASS REPORT_VERIFIED
```

A positive accepted-quote count requires a running, compatible local Qwen service **and** exact source quotes. A cycle with no accepted quotes still completes safely but does not demonstrate successful model interpretation. The report exposes the real per-grant status, evidence and unknown/hold decision.

## How this differs from the previous FIAL 1 test

- FIAL 1: deterministic `RULE WHEN ... SCORE ... ACTION`; grants were prioritized by prewritten rules.
- FIAL 2: declarative `UNDERSTAND ... GROUND QUOTES ... POLICY UNKNOWN_IS_HOLD`; the engine attempts bounded semantic extraction but independently refuses unsupported claims.
- Both: original state data is hash checked, local outputs are auditable, operators must separately authorize all outward applications and commitments.
