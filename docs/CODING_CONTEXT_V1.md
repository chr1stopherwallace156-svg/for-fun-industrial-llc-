# Fun Industrial — Token-Aware Software Engineering V1

## What this changes

Adds **read-only codebase retrieval** to the already-qualified unified Qwen3-4B chat. No new heavyweight coding agent, Docker, WSL, Python dependency, API service, or additional network listener is required. This release borrows the *repository-map/context-selection pattern* from [Aider](https://github.com/Aider-AI/aider) and is compatible with later investigation of [Qwen Code](https://github.com/QwenLM/qwen-code). **Neither package is installed or vendored.**

The local AI can answer questions such as:
- "Inspect the `analyzeFleetGraph` function in `src/graph.mjs` and explain the bug."
- "Show which file implements the API response and propose a minimal code change."
- "Review the source code responsible for tool routing and describe a test."

## Implementation

- `src/code-context.mjs`: traverses the current Fun Industrial repository **without executing anything**. Selects at most 3 relevant files and bounded, line-numbered excerpts (800 chars by default in live chat).
- Skips symlinks, common secret/dependency/runtime directories, files above 48 KB, and more than 140 scanned source files. Scans no more than 1 MB of candidate source bytes.
- Obvious secret-assignment lines are redacted; **no heuristic is a guarantee of secret detection**. Keep secrets out of source.
- `src/unified-agent.mjs` integration: only coding-intent questions trigger source retrieval; selected snippets are appended as **untrusted code data** and passed to the existing local Qwen endpoint; the model does not receive the full repository.
- Unified chat response additionally returns `code_files` and a coarse `code_context_tokens_estimate`. This estimate is **not a tokenizer count**.
- `public/unified-control-center.html`: displays which local files were consulted.
- `test/code-context.test.mjs`: isolated tests for relevant selection, safe bounded retrieval, secret/dependency exclusion, symlink isolation, and read-only behavior.

## Deployment

Use a fresh clone of `feature/token-aware-software-engineering-v1-20261106`. Its guarded installer updates the **existing active checkout** at `C:\Users\alxar\FunIndustrial-REA-MCP-Activation` without touching unrelated source changes, .env, model, compute, DDGS, Ollama, or NetBird. It backs up `src/unified-agent.mjs` and `public/index.html`, then patches known anchors only. If these anchors or added-file paths differ, it stops instead of guessing.

Run:

```powershell
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\Install-FunIndustrial-CodingContext.ps1' -Root 'C:\Users\alxar\FunIndustrial-REA-MCP-Activation' -Port 8789
```

After local tests, the installer restarts **only** the verified Node dashboard PID on port 8789, reconnects REA, and checks the served UI and enablement count.

## What it does NOT do

- Does not increase the server's actual 4096-token context window or change the GGUF quantization.
- Does not install Aider or Qwen Code, fine-tune Qwen3, generate an authenticated GitHub pull request, or edit files.
- Does not run arbitrary shell commands or execute generated patches.
- Does not make all 229 REA tool schemas fit at once; unified routing still selects at most two candidates.
- Does not make code snippets or web pages authoritative instructions. Require explicit review, isolated testing, and a controlled branch for future editing.

## Token terminology

1. **Tokenization** maps text to model tokens. Reduce token count by source selection, retrieval, or compact tool schemas.
2. **Weight quantization** (e.g. Q4_K_M GGUF) reduces model-weight memory but does not change an explicit 4096-token context limit.
3. **KV-cache quantization** may reduce the active-context memory footprint; increasing `n_ctx` still requires a benchmark of RAM use, prompt capacity, and accuracy. No changes to llama.cpp launch parameters in this release.
4. **Qwen3 non-thinking mode** may save generation tokens for ordinary questions but requires controlled tests against the deployed chat template and tool calling before activation.

## Qualification commands

```powershell
node --test test/code-context.test.mjs
npm test
```

Live verification: ask the unified chat to inspect `src/unified-agent.mjs`; check response `code_files`, `code_context_tokens_estimate`, and `executed_tools: 0`. Next phase is **proposed patch → human review → isolated test → GitHub PR**, with explicit authorization and more security controls before any write access.
