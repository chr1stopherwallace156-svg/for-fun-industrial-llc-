# FIAL — Fun Industrial Autonomous Language, v0.1

## What was built

This is **a real, deliberately small domain-specific programming language**, not a natural-language prompt or a wrapper around a Python script.

The implementation has a lexical grammar and parser, compiler into validated FIAL bytecode, deterministic rule-selection semantics, budget-limited interpreter, transactional SQLite persistent memory, proof of grant-source integrity, and a standalone Windows runner. The first backend is JavaScript/Node.js because the existing Fun Industrial ML hub already uses Node 22; the language itself is not JavaScript, Python, or Go. A future compiler could target Go or a standalone native VM.

**Status:** source committed and checked for parser behavior; needs full Windows tests and real grants integration execution. Running the one-command activation is an explicitly authorized operation.

## First FIAL program

```fial
FIAL 1
MISSION "Investigate California business funding and prepare evidence-based drafts"
SOURCE GRANTS
BUDGET 3
RULE "new-grant" WHEN new SCORE 98 ACTION BRIEF
RULE "changed-grant" WHEN changed SCORE 95 ACTION BRIEF
RULE "resume-deferred" WHEN deferred SCORE 90 ACTION BRIEF
RULE "urgent-deadline" WHEN urgent SCORE 85 ACTION BRIEF
RULE "missing-evidence" WHEN missing_evidence SCORE 70 ACTION HOLD
RULE "stable-candidate" WHEN always SCORE 10 ACTION REMEMBER
END
```

Compiler implementation: `src/fial/compiler-v1.mjs`

Bytecode interpreter and state: `src/fial/interpreter-v1.mjs`

Editable source program: `src/fial/programs/grant-research.fial`

The program is compiled; only supported statements can be executed. Any unexpected token, unknown statement, unsupported operation, extra trailing code, oversized source, or privilege-creating action (such as `SHELL`, `SUBMIT`, `EMAIL`, `REA`) is a **syntax error**. No JavaScript `eval`, dynamic imports of user code, plugins, shell invocation, or general language interop is provided.

## Grammar (EBNF-like)

```text
program    := "FIAL 1" NL mission NL source NL budget NL rule{1..12} "END"
mission    := "MISSION" quoted_string(max=120)
source     := "SOURCE GRANTS"
budget     := "BUDGET" integer(0..5)
rule       := "RULE" quoted_identifier(max=40)
              "WHEN" condition "SCORE" integer(0..100) "ACTION" action
condition  := "new" | "changed" | "deferred" | "urgent" | "missing_evidence" | "always"
action     := "BRIEF" | "HOLD" | "REMEMBER"
```

A default `WHEN always` rule is required. Blank lines and lines beginning `#` are comments.

## Execution semantics

Given the **already captured, SHA-256-confirmed** California Grants Offered source and previous local report:
- For each qualified record, evaluate supported conditions.
- Choose the matching rule with highest numeric `SCORE` (ties resolve in source-line order).
- `BRIEF`: write a versioned local Markdown brief using actual grant fields. Constrained by the budget. The brief is **not** an agency form, signature, or submission.
- When the budget has been exhausted, record `DEFER` in SQLite so a future cycle can resume it without losing evidence.
- `HOLD`: write a no-action decision for insufficient evidence; retain state for review.
- `REMEMBER`: persist observation without preparing a document.
- Each cycle updates SQLite `memory` and `decisions` tables in an explicit transaction and stores a JSON receipt.

The language is deterministic and bounded. It does not yet generate new goals, change its own grammar, or learn neural weights. It enables constrained agency; it does not demonstrate literal free will, consciousness, or personhood.

## Files it creates on your PC

The first live test reads the existing
`%LOCALAPPDATA%\FunIndustrial\RealApplicationWorkerV1\last-run.json` and the
`business-profile.json`, verifies the local evidence source file's SHA-256, and writes:

```text
%LOCALAPPDATA%\FunIndustrial\RealApplicationWorkerV1\fial\
  fial-memory-v1.sqlite
  fial-memory-v1.sqlite-wal       # optional SQLite write-ahead log
  fial-memory-v1.sqlite-shm       # optional SQLite shared-memory file
  briefs\<grant-hash>-<revision-hash>.md
  last-run.json
```

It does not overwrite existing briefs and does not change the current grant-worker state or operating schedule.

## One-command first real execution

Run on the actual Windows PC via PowerShell/Termius:

```powershell
& {$ErrorActionPreference='Stop';$r=Join-Path $HOME 'FunIndustrial-MLHub-V3';$b='feature/fun-ml-unified-dashboard-v3-20261113';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if((git -C $r remote get-url origin) -cne $u -or (git -C $r branch --show-current) -cne $b){throw 'SOURCE_IDENTITY_HOLD'};if(@(git -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'LOCAL_CHANGES_HOLD'};git -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'UPDATE_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Run-Fun-FIAL-V1.ps1');if($LASTEXITCODE -ne 0){throw 'FIAL_EXECUTION_HOLD'}}
```

The activation must first pass `node --test intelligence-checks/fial-v1-case.mjs`. Then it runs the compiler and interpreter against the existing source. If the evidence file is missing, moved outside its trusted directory or no longer matches the source hash, the execution refuses to proceed.

## Present limitations and boundaries

- No arbitrary code, network access, REA tools, payments, emails, account sessions, or application submissions.
- SQLite is provided by Node.js 22's built-in `node:sqlite`; it may emit an ExperimentalWarning. No additional database server or Python/Golang installation is required.
- Program uses a current `last-run.json` grant report and its referenced source evidence. It is **not yet incorporated into the existing recurring 6-hour Windows task**, so the first upgrade cannot silently change that mission controller.
- `BRIEF` is an independent local research summary, not an official complete grant application.
- Offline tests use synthetic data; the first PC run is what verifies live captured source compatibility.
- Deterministic, transparent rule selection is intentional for initial qualification. A future revision may add planned actions, goal decomposition, model-assisted proposals, and separate independent evaluation, but only after proven behavior and with unchanged authority boundaries.
