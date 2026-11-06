# Unified Cognitive Chat V1 (isolated, opt-in)

This branch adds a single natural-language chat for the existing Fun Industrial iPhone dashboard. It **does not** deploy itself and does not alter Qwen3-4B, llama.cpp, compute, DDGS, NetBird, Ollama, or REA processes in GitHub.

## What is implemented

- `src/unified-agent.mjs`: deterministic, bounded **capability discovery** over all allowlisted REA tools plus the local fixed tool registry. Filters to **zero, one, or two schemas** for the 4K-context Qwen model.
- Safe **automatic DDGS web lookup** when a prompt explicitly signals research/current-information intent, with up to three untrusted source snippets and URLs returned to the chat. **Queries go to third-party search engines**, so do not include private data.
- Automatic `general`-scope recall of up to three **human-approved** memories from SQLite. Memory is treated as data, never as new policy or trusted instructions.
- The existing Qwen compute `/ai/chat` chooses whether to propose a relevant `fi_*` or `rea__*` function. This V1 is *lexical prefilter + model tool proposal*, **not a fully semantic agent planner**.
- REA and other tool executions remain behind the existing user-facing review and approve control. No REA tools are executed by `/api/unified/chat`.
- `public/unified-control-center.html`: one chat, no Chat/Web/REA/Combined selector. Other tabs remain as optional reference/manual tool views. Operator can propose and explicitly approve or reject memories, and give +/- retrieval feedback.
- Persistent SQLite database: `%LOCALAPPDATA%\FunIndustrial\Cognitive\unified-memory.sqlite3`. This state survives dashboard restarts; model weights are **not** fine-tuned.

## Source / open-source architecture reference

Inspired by the dynamic tool-discovery pattern of [Tool Search Tools MCP](https://github.com/fussraider/tool-search-tools-mcp) and Qwen tooling patterns from [Qwen-Agent](https://github.com/QwenLM/Qwen-Agent). These packages are **not vendored or installed**. This V1 has no new npm dependencies and reuses the Apache-2.0 Fun Industrial project and its Python-standard-library cognitive memory.

## Windows installation

From a fresh clone of branch `feature/unified-cognitive-agent-v1-20261106`, run:

```powershell
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\Install-FunIndustrial-UnifiedAgent.ps1' -Root 'C:\Users\alxar\FunIndustrial-REA-MCP-Activation' -Port 8789
```

The guarded installer:
1. Verifies current `src/server.mjs` anchors and the exact Node dashboard process before changing the running service.
2. Runs isolated Node router and Python cognitive unit tests.
3. Backs up the active HTML and server source, copies **new** memory/router files, and injects the unified endpoint into the current, locally customized server.
4. Validates JS and runs local `npm test` before stopping anything.
5. Restarts **only** the verified dashboard process. It re-establishes REA after restart and checks the new endpoint. No `.env` changes or model restart.

If validation fails, the source patch is restored. If the restarted dashboard fails early, the installer attempts to restore the old files and restart the old dashboard. Review error logs if the process cannot be recovered.

## Safety boundaries

- Memory proposals are **pending** until the operator explicitly clicks approval.
- Web and model output does not auto-approve memories or make executable instructions.
- REA tool calls always require manual review of exact arguments. The current `approved:true` endpoint flag **does not constitute strong authentication**; use a private, access-controlled local forward only.
- Tool schemas and chat context are bounded for 4096 tokens; exceptionally complex schemas are excluded from automatic routing. Some tool queries may need explicit REA-library selection.
- This module provides retrieval preference learning, **not autonomous self-training, general semantic understanding, code self-modification or autonomous multi-step REA execution**.
- No chat transcripts are automatically saved: only explicit memory proposals are persisted. Operator-approved memory cannot be automatically revoked by the v1 UI; review database controls before storing sensitive data.

## Qualification

```powershell
npm test
& 'C:\Users\alxar\AppData\Local\Programs\Python\Python312\python.exe' -m unittest discover -s tests -p test_cognitive_core.py -v
```

The user must run the Windows installer and verify `UNIFIED_INSTALLED`, REA 229/229, model chat and actual web lookup before treating the integrated system as qualified.
