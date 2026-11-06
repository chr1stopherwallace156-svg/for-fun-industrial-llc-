# Fun Industrial: On-Demand Open-Source Aider Coding Integration V1

Status: **GitHub candidate, Windows activation and live edit qualification pending.**

This adds the open-source [Aider](https://github.com/Aider-AI/aider) coding agent to the **existing Fun Industrial unified chat**, without new modes or replacing local Qwen, web research, REA discovery, or the local memory database. This is **only a Fun Industrial software coding capability**. It does not integrate or modify Elektron's separate contextual architecture.

## Workflow

1. The operator asks the usual local Qwen chat to fix/refactor/implement a change and names relevant source files. Existing read-only retrieval and model explanation continue as before.
2. When the question has an explicit code-write intent and local code files are retrieved, the current iPhone-friendly chat offers **Prepare coding approval**. This step reads the named files and returns an expiring intent ID/token; **no agent process or test executes**.
3. The UI displays the exact requested file names. **Approve isolated Aider edit** is a separate explicit action. Only then the system runs Aider, with local `openai/local-model` over `http://127.0.0.1:<LLAMA_CPP_PORT>/v1`, inside a fresh disposable local Git clone. It snapshots only the selected active files into that clone; it never edits the active checkout.
4. It records a bounded patch diff, changed paths, source commit and SHA-256, agent log, and candidate status. Any out-of-scope edit or Aider process failure is a HOLD and cannot be qualified as a candidate.
5. **Approve isolated node --test** is a further explicit step. It checks that the cloned package test script is exactly `node --test` before running tests inside the disposable clone. It never merges/pushes changes into the live repository, never restarts compute/model, and never executes REA automatically.

## Safety boundaries

- Operator input required for each new coding run and each test run. No autonomous code execution or auto-write authority.
- Local files limited to **one or two validated source paths**, each a regular, non-symlink file <= 48 KB, no traversal, executable/secret/dependency paths, and no outside-root symlinks.
- Tasks limited to 800 characters; obvious shell command injection and credential assignments rejected.
- Aider is installed in its **own Python 3.12 virtual environment** under LocalAppData, not the Fun Industrial Python or Ollama environment.
- Aider flags disable auto-commits, auto-tests/lint, update checks, shell suggestions, analytics and automatic config/env-file loading. Local model main, weak and editor roles are explicitly selected.
- Clone edits are isolated **by worktree only, not by OS security boundary**. Do not approve untrusted code execution/tests; Python scripts, Node tests and model-driven tools may still run with the user's Windows privileges.
- Aider and its dependencies require an initial external package download. Code is sent to local llama.cpp; no cloud model is configured. Do not store secrets in source; no heuristic redaction is a guarantee against malicious packages.
- Candidate edits and receipts are retained in LocalAppData; this release does not delete previous evidence, merge PRs, or modify Elektron.
- Runtime failure holds and preserves source; a guarded installer restores source and dashboard on post-restart failure. No other process is deliberately stopped.

## Activation requirements

- Windows PowerShell 5.1, Git, Node 26, Python 3.12 and the existing Fun Industrial dashboard on `127.0.0.1:8789`.
- Existing REA catalog: 229 tools, running Qwen3 GGUF through llama.cpp, model listening at configured `LLAMA_CPP_PORT` (default 8088).
- Aider installed to `%LOCALAPPDATA%\FunIndustrial\CodingAgent\venv\Scripts\aider.exe`.

## Verification

Run candidate tests in fresh GitHub branch:
```powershell
node --test test/coding-agent.test.mjs test/aider-installer.test.mjs test/code-answer-routing.test.mjs
```

Run the guarded installer from a fresh clone with `-Root` pointing at the active checkout. It backs up the active router/UI and rejects drift, validates Aider's CLI switches, qualifies candidate and active tests, restarts only the dashboard, reactivates REA, and verifies model, unified and coding endpoints. It prints `AIDER_CODING_READY=PASS` only after readiness checks.

Test read-only activation:
```powershell
Invoke-RestMethod http://127.0.0.1:8789/api/unified/coding/status
```

Successful status includes `provider=Aider`, `installed=true`, `model_ready=true`, `available=true`, and `authority=operator-approval-isolated-clone-only`. This **does not** prove that the 4B quantized model can reliably produce correct Aider patches: that requires one explicit, user-approved disposable-clone edit and reviewed test evidence.

## Upgrades still separate

No general autonomous agent, self-modifying code, live checkout patch, auto PR submission or automatic REA tool execution is supplied by this release. Future independent qualification of Aider edit quality, tool selection, reproducible tests and source provenance is appropriate only after evidence from a real local run.
