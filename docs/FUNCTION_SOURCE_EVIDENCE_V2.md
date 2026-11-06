# Function Source Evidence V2 — Qualify Before Claiming Code Understanding

## Problem and observed evidence
The live Qwen code inspection correctly retrieved 3 files with ~267 estimated context tokens and made zero tool calls, but responded that the requested `selectCapabilities` implementation was missing. The earlier retrieval algorithm assembled scattered matching lines, so a model answer about the whole function could not be justified.

## Bounded repair
- Prefer explicitly named top-level JavaScript/Python function spans over dispersed token matches.
- Preserve source filename, symbol name and line numbers.
- Run with a 2300-character bound for the 4096-token Qwen3-4B context.
- Report `code_focus_symbol` and `code_source_complete` in the unified endpoint.
- Mark incomplete spans explicitly and prohibit speculative explanation of missing logic.
- Preserve 229 REA approvals, SQLite memory, DDGS research, model process and everything outside the dashboard.

**Limit:** Function-span recognition is a *heuristic*, not an AST parser or proof of semantic comprehension. The spans can fail for unsupported syntax, deeply nested constructs or huge functions. Later improve with a scoped Tree-sitter parser after separate qualification, without replacing existing code.

## Strict deployment and safety
- Installer `scripts/Upgrade-FunIndustrial-FunctionSpan.ps1` requires the active `src/code-context.mjs` to equal the frozen pre-upgrade baseline (normalizing line endings), otherwise `CODE_CONTEXT_BASELINE_DRIFT_HOLD_NO_OVERWRITE`.
- Clone runs function-span, existing code context and read-only routing unit tests **before any live edits**.
- Installer backs up three active files to LocalAppData, adds one test, runs `npm test`, then restarts **only** the verified Node dashboard PID on port 8789.
- REA must be `ready` with exactly 229 tools before and after. The endpoint check runs **after** `POST /api/rea/start`.
- Fail-closed rollback attempts to restore the previous source and restart the previous dashboard; check actual console receipts, do not claim success if a hold is printed.
- No Git merge, `.env` modification, model restart, REA tool execution, arbitrary shell tool, automatic code edit, or self-training.

## Qualification commands from the active working root
```powershell
node --test test/function-span.test.mjs
npm test
node --input-type=module -e 'import {buildCodeContext} from "./src/code-context.mjs";const r=await buildCodeContext(process.cwd(),"Explain the selectCapabilities function in src/unified-agent.mjs",{maxChars:2300});console.log("FOCUS="+r.focus_symbol+" COMPLETE="+r.source_span_complete+" FILES="+r.files.join(","));if(!r.source_span_complete)process.exit(1)'
```

## Qualification acceptance
- Unit tests PASS, no existing platform regressions.
- `FOCUS=selectCapabilities`, `COMPLETE=true`, `FILES=src/unified-agent.mjs`.
- Live unified chat reports `code_source_complete=true`, `ROUTING=read-only-code-analysis-v1`, `TOOLS_SENT=0`, `PROPOSALS=0`, `EXECUTED=0`.
- Qwen explains the actual scoring (tool-name match, description match, exact-name preference), web intent and two-definition cap **with line evidence**. A plausible but unsupported answer is a FAIL, not success.

## Suggested later development
Controlled, isolated software patching needs explicit operator approval, branch/worktree isolation, AST-informed symbol mapping, deterministic diff checks, regression tests and GitHub evidence. No editing authority is granted by this source-retrieval upgrade.
