# Fun Industrial Unified Capability Index V1 (staged, not installed)

The user's host already reported FUN_COGNITION_LIVE_DEPLOY=PASS, FUN_COGNITIVE_KERNEL_VERIFIED=PASS, external/unmanaged llama.cpp ready and REA stopped. This is separate feature development; do not alter working live cognition without a separate deployment review.

## Goal
Help Qwen3-4B discover relevant local or REA capabilities without injecting every full schema into the model context.

- Local registered capability names come only from the existing fixed platform tool registry.
- REA names come from the existing live REA catalogue only upon an explicit read-only refresh; this never initializes or grants execution.
- When REA is stopped, report unavailable/not loaded with zero REA catalogue entries. Do not claim all 229 tools are available.
- Returned entries are short untrusted reference descriptions, not callable tools. Search limit is 12 and result-character budget defaults to 1200.
- A bounded chat decorator appends at most four short matches while preserving max_tokens, actual tool definitions, memory and existing execution permissions.

## Future routes (only after a separate guarded live deployment)

- GET /api/cognition/catalogue/status: informational current fixed registry and cached REA index status.
- POST /api/cognition/catalogue/search with JSON {"query":"analyze graph","limit":4}: short ranked reference data.
- POST /api/cognition/catalogue/refresh-rea with JSON {}: user-initiated catalogue refresh; when REA is stopped, returns unavailable rather than starting it.

## Qualification
Stage-Fun-Capability-Index8789.ps1 verifies the installed cognitive marker, local AI health, verified 8789 Node process, syntax, isolated tests, and staged server syntax; it saves an unchanged copy of original server.mjs and a staged patch under AppData. It does not stop/restart processes or overwrite live files. A separately reviewed apply and rollback routine is still necessary for a live deployment.

## Boundaries
The original /api/ai/tool-call and /api/rea/call routes, any operator approval controls, Cognee, voice, compute 8791, llama.cpp 8088, and separate Elektron Ollama are unchanged.

Capability catalogue presence does not mean availability, authorization or executable support. Voice, web, optimization and other subsystem adapters require their own verified connections and scoped permissions. This phase does NOT give unrestricted agent execution or enable REA.

## Validation
Windows and Ubuntu CI run deterministic local tests for 229 synthetic REA catalogue entries, wrong/duplicate metadata, unavailable REA, injection as untrusted reference, bounded ranking and unchanged chat tools. No real REA MCP, network or model operations are executed in CI.
## Guarded live installation (new, separate from staging)

`Deploy-Fun-Capability-Index8789.ps1` now exists. It defaults to stage-only and requires the explicit `-Apply` switch for live activation. It validates the installed cognitive release marker and verified 8789 Node owner, patch syntax, module syntax, 12 isolated tests, exact staged source bytes, no conflicting module installs, current AI/voice/default-on Cognee, local-first configuration, REA stopped plus HTTP 403, and zero REA execution grants. It hashes the original server and backs it up before any live writes.

A special safety stop is important: cognitive knowledge lives in process memory. A dashboard restart erases its current in-memory claims, checks, predictions and event history. The script therefore rejects `-Apply` if the Cognitive Kernel snapshot reports ANY claims, predictions, or events. Do not bypass that gate to force deployment.

If preflight passes and cognitive state is empty, the script installs the staged server and two capability modules, restarts ONLY the verified Node dashboard on localhost:8789, and verifies the health and ownership of 8789, 8088, 8791, plus any other protected listeners, status consistency of Cognee, voice, model, REA stopped and local tools, and one live graph capability query. On an error, it tries to stop only its own newly started 8789 process, restore the exact original server from the run's backup, remove only its own new modules, and restart the previous dashboard. This rollback is a best-effort action and its service health must be checked independently if it reports HOLD.

Neither the staging nor the live deployment initializes REA, starts or stops llama.cpp, changes Elektron Ollama, grants tool execution, or modifies any persistent REA allowlist. REA remains stopped and catalogue entries remain unavailable until separately initialized by the operator.

Offline GitHub Actions on Windows and Ubuntu: 12/12 target tests PASS; PowerShell parser checks PASS for both stage and live deploy scripts. **This does not mean the live upgrade has run on the user's PC.** Only an operator-command `FUN_CAPABILITY_LIVE_DEPLOY=PASS` followed by independent live endpoint checks can confirm installation.

The broader repository Node suite still has two unrelated sourcing/selection tests failing in some CI runs; this change does not claim to repair them.
