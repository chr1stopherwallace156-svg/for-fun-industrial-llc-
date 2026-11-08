# Fun Industrial — Cognee persistent memory + json-rules-engine

Additive integration, **not** Elektron. Existing 8789 Fun Industrial, 8792 Sidequest, 229 REA tools/permissions and the retirement of domestic and international sourcing remain unchanged.

## What is installed

- Node `json-rules-engine` **7.3.1**, isolated in `src/intelligence/node_modules`. It evaluates fixed safety/context facts locally with zero LLM calls and zero tool execution.
- Python `cognee[gliner]==1.6.7` in a dedicated Python 3.12 venv. It builds/queries memory with small CPU-capable models, SQLite + embedded vector/graph stores. Storage is under `%LOCALAPPDATA%\FunIndustrial\CognitiveMemory`. No cloud credentials passed to the subprocess.
- APIs on the existing local 8789 app: `GET /api/intelligence/status`, `POST /api/intelligence/evaluate`, `POST /api/intelligence/memory/remember`, and `POST /api/intelligence/memory/recall`. No automatic file/chat ingestion or REA execution.

**Disk-space warning:** Cognee's GLiNER extractor may download about **750 MB** on first remember/recall, with additional embedding weights, pip packages and venv data. Nothing downloads a memory model merely by checking status. There is no connection to Elektron's Ollama; the existing Fun Industrial llama.cpp GGUF is not automatically reused by Cognee.

## One-line install on Windows (both projects)

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';if(-not(Test-Path $d)){& git clone --depth 1 --single-branch --branch feature/fun-local-cognee-rules-20261108 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git $d;if($LASTEXITCODE -ne 0){throw 'CLONE_FAILED'}}else{& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'PULL_FAILED'}};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'Install-Fun-Intelligence.ps1') -InstallCognee -EnableMemoryWrites;if($LASTEXITCODE -ne 0){throw 'INTELLIGENCE_INSTALL_HOLD'}
```

The installer checks the already retired sourcing endpoints, REA 229 tools and current 8789 process identity, stages and syntax-checks a server patch, installs isolated npm and Python packages, runs rules/patcher tests, restarts only the verified 8789 Node process, verifies the new policy route and previous REA/sourcing state, and attempts rollback if something fails. Cognee memory writes are enabled only for explicit operator requests; background ingestion remains off.

## Test after installation

Read-only status:

```powershell
Invoke-RestMethod http://127.0.0.1:8789/api/intelligence/status | ConvertTo-Json -Depth 8
```

Evaluate deterministic conditions (the output should be `PROPOSE_FOR_OPERATOR_REVIEW`, with `executeAuthorized=false`):

```powershell
$facts=@{mode='propose';risk_level='low';source_trusted=$true;context_complete=$true;service_ready=$true;evidence_verified=$true;emergency_stop=$false}|ConvertTo-Json;Invoke-RestMethod http://127.0.0.1:8789/api/intelligence/evaluate -Method POST -ContentType 'application/json' -Body $facts|ConvertTo-Json -Depth 5
```

Remember one text manually (first memory use can download large models):

```powershell
Invoke-RestMethod http://127.0.0.1:8789/api/intelligence/memory/remember -Method POST -ContentType 'application/json' -Body '{"text":"The operator requires review before any external execution."}'
```

Recall a stored text (returns evidence, not a generative answer):

```powershell
Invoke-RestMethod http://127.0.0.1:8789/api/intelligence/memory/recall -Method POST -ContentType 'application/json' -Body '{"query":"What is the operator review policy?"}' | ConvertTo-Json -Depth 5
```

Measure model+venv storage usage:

```powershell
$p=Join-Path $env:LOCALAPPDATA 'FunIndustrial\CognitiveMemory';$b=(Get-ChildItem -LiteralPath $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum;"COGNEE_TOTAL_MIB=$([math]::Round($b/1MB,2))"
```

## Boundaries

Rules do not make decisions involving physical devices or execute API tools. All `execute` scenarios HOLD, even if input claims `operator_approved=true`. Missing/risky/untrusted facts HOLD. Cognee retrieval does not authorize actions and is not automatically injected into Qwen chat prompts. REA remains governed by its existing permissions. This is a reviewed integration surface, **not a claim of universal reasoning** or autonomously learning from every interaction.

Cognee keyless GLiNER graph extraction is still described by its creators as a demo and has not been independently qualified for a production-critical decision process. The stored graph may contain mistakes. The Windows installer and real memory model retrieval have not yet been tested on the user's PC; no activation is claimed until the install output says `FUN_INTELLIGENCE=PASS`.

Upstream: https://github.com/topoteretes/cognee (Apache-2.0), https://github.com/CacheControl/json-rules-engine (MIT).

## Recovery after Cognee pip installed, Python import failed (November 8, 2026)

The operator's Windows transcript shows `Successfully installed ... cognee-1.6.7 ...` followed by a failing `import cognee` immediately after Cognee initialized logging. At that stage the installer **had not replaced** the Fun Industrial 8789 platform or enabled the intelligence routes. Do not reinstall hundreds of dependencies.

### One-line GitHub repair; reuse installed Python 3.12 venv

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'Repair-Fun-Intelligence.ps1');if($LASTEXITCODE -ne 0){throw 'COGNEE_REPAIR_HOLD'}
```

`Repair-Fun-Intelligence.ps1` performs an import-only diagnostic first, displaying the complete Python traceback on failure. It pins Cognee's `.env` selection to a zero-byte file under `%LOCALAPPDATA%\FunIndustrial\CognitiveMemory`, configures isolated storage roots, disables file logs and telemetry, and does **not** call `remember`, `recall`, or install/download models. If this probe fails, the command **stops without changing** the active 8789 dashboard, and the Python traceback is the diagnostic needed for a targeted repair.

If the import probe passes, the script runs the full guarded installer with `-SkipCogneePip`, reusing the existing Python packages instead of repeating the multi-hundred-megabyte installation. It still stages/qualifies the local Node rules package, checks REA 229 scope, and restarts only 8789 after passing preflight.

Probe-only option (does not patch 8789):

```powershell
$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'Repair-Fun-Intelligence.ps1') -ProbeOnly
```

Probe success looks like `COGNEE_IMPORT=PASS VERSION=1.6.7` and `COGNEE_STORAGE_ISOLATED=PASS`. Full deployment requires the separate `FUN_INTELLIGENCE=PASS` output. Neither of those has been observed on the user's PC yet.

Memory status now reports separate `storageBytes`, `modelCacheBytes`, and `pythonEnvironmentBytes`; note that the installed Cognee Python environment alone can be large. The memory API rejects URLs and file paths and uses a fixed dataset of operator-provided literal text.

## Recovery after 8/8 tests and `INTELLIGENCE_STATUS_NOT_READY` (November 8, 2026)

The operator's second Windows run verified Cognee 1.6.7 imports twice, local database isolation, 8 Node tests, pip skip, and `INTELLIGENCE_INSTALLED=STAGED`. The live 8789 intelligence status timed out; the installer's rollback was attempted. **This is not proof of successful runtime activation.**

The repair removes a specific synchronous bottleneck: the status function previously walked the entire Python virtual environment (with thousands of installed files), blocking Node's event loop while the readiness poll allowed only 3 seconds. The status response is now constant-time; an optional separate async disk audit is available at `GET /api/intelligence/storage`. It also fixes PowerShell's BOM-encoded `settings.json`: the runtime can now read BOM input, and the installer writes future settings as UTF-8 *without BOM*. If the next live startup still fails, the installer prints the last HTTP error and the stderr log path before attempting rollback.

### One-line repair, no reinstallation of Cognee packages

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'Repair-Fun-Intelligence.ps1');if($LASTEXITCODE -ne 0){throw 'COGNEE_REPAIR_HOLD'}
```

The repair checks Cognee import with no model downloads and reuses existing 3.12 venv via `-SkipCogneePip`. Rule package installation is isolated in the stage and uses only small npm packages. Activation is confirmed **only** by `FUN_INTELLIGENCE=PASS` plus unchanged REA 229 and SOURCE_RETIRED checks.

After successful activation, disk usage (operator-requested async audit, may need time):

```powershell
Invoke-RestMethod http://127.0.0.1:8789/api/intelligence/storage | ConvertTo-Json -Depth 5
```

Fast status has `storageBytes`, `modelCacheBytes`, and `pythonEnvironmentBytes` set to null until the explicit audit. This avoids blocking AI/REA requests with a recursive venv size calculation.

## Recovery after 10/10 tests and a post-restart HTTP 403 (November 8, 2026)

The third Windows installer attempt passed all **10 intelligence tests**, re-used Cognee's existing Python environment (no pip), and verified the local Cognee import and storage isolation. After staging the new 8789 app, a required API returned **HTTP 403 Forbidden**, and the installer attempted rollback. The precise URL was not printed in that run.

The likely reason is that the new 8789 Node process did not yet have a live REA MCP session. The earlier successful sourcing-retirement installer explicitly called `POST /api/rea/start` after each 8789 restart; the intelligence installer previously omitted that step and immediately checked `/api/rea/tools`, which returns 403 when REA is not ready.

The installer now calls only **`POST /api/rea/start`** (initialize MCP + list tools) before checking 229 tools after the restart. It also recovers an uninitialized REA catalog at preflight if `/api/rea/tools` returns HTTP 403 due to the earlier rollback, and attempts the same catalog reinitialization after rollback. It does **not** call the generic platform `/api/start` or `/api/activate` endpoints, invoke `tools/call`, or change the REA allowlist, llama.cpp, Elektron's Ollama, VPN, or the retired sourcing APIs.

### One-line repair (existing GitHub checkout; reuse installed Cognee)

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'Repair-Fun-Intelligence.ps1');if($LASTEXITCODE -ne 0){throw 'COGNEE_REPAIR_HOLD'}
```

On success, the script should print `INTELLIGENCE_STATUS=PASS`, `INTELLIGENCE_DETERMINISTIC_RULES=PASS`, `REA_READ_ONLY_CATALOG_RECONNECT=PASS`, and `FUN_INTELLIGENCE=PASS`. If a 403 persists, report the more specific `REA_PREFLIGHT_HTTP_HOLD`, `REA_CATALOG_RECONNECT_HTTP_HOLD`, or `REA_229_SCOPE_HOLD` message; those are live diagnostics and **do not** justify broad service activation.

Status: the source repair is committed, but has **not** been tested on the operator's running Windows host. Cognee remember/recall has not yet been exercised; its model download cost remains separate.

## Diagnostics after valid API serialization but both Cognee operations return `{}`

Operator observed `INTELLIGENCE_HTTP=200`, `MEMORY_AVAILABLE=true ENABLED=true WRITES_ENABLED=true`, invalid HTTP 400 produced `{"error":"COGNEE_INPUT_INVALID"}`, and a separate recall request returned HTTP 400 with body `{}`. This establishes that input validation and error serialization work, but does **not** establish whether a memory record was previously stored or that retrieval works.

The initial remember and recall failure may share a Python setup issue. Do **not** repeat a real `remember` while storage status is unknown. A new read-only *deployed-bridge* diagnostic uses the exact whitelisted child process environment (no imported cloud credentials) and invokes `setup()` and inspects the published `remember`/`recall` signatures without making either API call. It may initialize ordinary Cognee log/config files; it does not request local model inference or send a memory note.

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_HOLD'};& node (Join-Path $d 'scripts\diagnose-cognee-bridge.mjs');if($LASTEXITCODE -ne 0){throw 'DEPLOYED_BRIDGE_DIAGNOSTIC_HOLD'}
```

Expected success: `BRIDGE_STAGE_PASS=bridge_setup` and `DEPLOYED_BRIDGE_DIAGNOSTIC=PASS`, with API signatures printed. On failure report `BRIDGE_STAGE_HOLD`, `ERROR_TYPE`, and `ERROR_DETAIL`. No production server restart, Python package reinstall, REA call, memory write, or repeat recall is performed.

## After deployed bridge setup PASS but memory requests still return HTTP 400

Cognee 1.6.7 import, isolated config, bridge import and `bridge_setup` all passed in the operator's Windows run. `remember` and `recall` via HTTP still returned `400`/`{}` in earlier tests. The bridge's function signatures exist and are compatible; this is not yet proof that the memory dataset exists or that either operation has succeeded.

To capture the actual Python exception, use the **separate diagnostic direct-recall program**. It uses the exact deployed bridge, isolated environment and existing Cognee venv, with the original test query but no `remember`, REA tools, generic activation, or platform restart. It may download local embedding/model weights and create Cognee cache/search history entries. It prints the exception and traceback but not retrieved memory text.

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_HOLD'};& node (Join-Path $d 'scripts\trace-cognee-recall.mjs');if($LASTEXITCODE -ne 0){throw 'DIRECT_RECALL_TRACE_HOLD'}
```

Important markers: `BRIDGE_SETUP=PASS`, `RECALL_SIGNATURE_BIND=PASS`, then either `RECALL_DIRECT=PASS RESULT_COUNT=N` or `RECALL_DIRECT=HOLD EXCEPTION_TYPE=... EXCEPTION_DETAIL=...` plus a Python traceback. If it fails, diagnose the precise Python exception before making any edits to persistent dataset files or retrying remember.

## Direct Python recall succeeded; isolate the deployed Node adapter (Nov 8, 2026)

The operator verified that `BRIDGE_SETUP=PASS`, `RECALL_SIGNATURE_BIND=PASS`, and direct Cognee `recall` completed with `RECALL_DIRECT=PASS RESULT_COUNT=1` using the isolated FastEmbed local model BAAI/bge-small-en-v1.5. This proves the Python recall path works, **not** that the original test note was stored or matched. The 8789 HTTP memory endpoints previously returned 400 with `{}` and remain unqualified.

Next diagnostic, with **no server restart, new remember operation or REA tool invocation**, imports the *deployed* `src/intelligence/memory.mjs` (not the GitHub checkout copy) and performs the existing recall query through its Node -> Python adapter. It prints status, result count or the actual JavaScript error type/message, and never prints retrieved content. Cognee may update local caches or search-history entries.

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_HOLD'};& node (Join-Path $d 'scripts\diagnose-cognee-node-adapter.mjs');if($LASTEXITCODE -ne 0){throw 'NODE_ADAPTER_RECALL_HOLD'}
```

Observe `NODE_ADAPTER_RECALL=PASS RESULT_COUNT=...` or `NODE_ADAPTER_RECALL=HOLD ERROR_TYPE=... ERROR_MESSAGE=...`. The exact result distinguishes a Node subprocess/protocol bug from server HTTP error handling. Do not reinstall Cognee or retry remember until that boundary is understood.

## Node adapter returned plain Object, not Error (Nov 8, 2026)

The operator ran `scripts/diagnose-cognee-node-adapter.mjs` and got `NODE_ADAPTER_RECALL=HOLD`, `ERROR_TYPE=Object`, `ERROR_MESSAGE=[object Object]`, no Error stack, even though direct Python recall passed. The committed `src/intelligence/memory.mjs` uses native `Error(...)` for its rejection paths, so do not assume the deployed adapter matches GitHub or assume a Python failure.

**No-write attestation:** `scripts/attest-cognee-node-adapter.mjs` reports SHA-256 for the checkout and deployed `src/intelligence/memory.mjs`, checks exact byte equivalence, and triggers intentionally invalid `memoryAction('recall',{diagnostic_only:true})` — rejected before spawning Python. The default invocation never starts Cognee Python or recalls memory, and does not restart services or invoke REA tools.

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_HOLD'};& node (Join-Path $d 'scripts\attest-cognee-node-adapter.mjs');if($LASTEXITCODE -ne 0){throw 'NODE_ADAPTER_ATTESTATION_HOLD'}
```

Expected: `ADAPTER_SOURCE_MATCH=true`, `VALIDATION_REJECTION=PASS`, `ADAPTER_ATTESTATION_ONLY=PASS_NO_PYTHON_RECALL`. If files differ, do not overwrite the live installed adapter automatically—inspect differences and preserve current source. If errors are unexpectedly objects, examine `EXCEPTION_KEYS` etc. A separate explicit `--replay-recall` mode is offered for later troubleshooting but is **not** used by the default command. Real remember remains unverified; avoid duplicate writes.

## Root cause confirmed: successful Cognee response rejected as a plain object (Nov 8, 2026)

After verifying deployed adapter SHA-256 `852ee00ac535536f3a91828c01383143d8c8461a0c16a4fc9962bc24235bbd6b` equals the GitHub version, and malformed recall correctly rejects with a native `Error`, the adapter's subprocess completion handler was examined. It called `finish({engine:'cognee',action,...data})` on a successful `FI_MEMORY_RESULT`. `finish(error,result)` interprets its *first* argument as an error, causing the promise to reject with a plain object. The top-level HTTP error handler serialized `error.message` (undefined) to `{}` with HTTP 400. Thus **a successful memory operation was being reported as an error**.

The fix is `finish(null,{engine:'cognee',action,...data})`, exposed via `settleMemoryBridgeResult` with four regression tests covering successful remember, successful recall, real Python operation failures, and exit-code failure. The bridge's existing 1.6.7 API arguments and standalone Python environment are unchanged. **Do not repeat the original `remember`**: its original 400 may have followed a successful write.

### Guarded live fix (not the original installation script)

`Repair-Live-Cognee-Node.ps1` requires the observed original SHA-256, the approved source patch, working 8789 process identity, 229 original REA tools, active intelligence status, and retired sourcing endpoints; tests the new callback; backs up deployed adapter; replaces only `src/intelligence/memory.mjs`; restarts **only** Fun Industrial 8789; reinitializes the REA catalog with `/api/rea/start` but executes **zero** tools; verifies 229 scopes and sourcing retirement; performs **recall-only** verification of the original note; prints count and exact-text match Boolean without printing retrieved content. On HOLD it attempts to restore the old adapter/dashboard and REA catalog. Does not install/reinstall Python or npm, modify data files, or touch Elektron/Ollama/Sidequest.

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'Repair-Live-Cognee-Node.ps1');if($LASTEXITCODE -ne 0){throw 'COGNEE_NODE_MEMORY_FIX_HOLD'}
```

Required success markers: `COGNEE_NODE_FIX_PREFLIGHT=PASS`, `PATCHED_DASHBOARD=PASS`, `REA_CATALOG=PASS COUNT=229 TOOLS_EXECUTED=0`, `COGNEE_NODE_MEMORY_FIX=PASS HTTP_RECALL=200 RESULT_COUNT=N ORIGINAL_NOTE_TEXT_MATCH=True/False`. An HTTP recall result count >0 is not proof of matching the original text; exact-text matching Boolean is reported separately. Do not claim full memory persistence qualification until a successful remember + exact recall pair is established.

## Next milestone — operator-opt-in Cognee memory in local llama.cpp chat

**Code staged in GitHub; do not claim live activation until the Windows deployment proves it.** This milestone adds an optional checkbox to the existing Fun Industrial dashboard's local AI conversation. The checkbox starts unchecked; ordinary `/api/ai/chat` behavior and its existing operator approval workflow are not modified when unchecked.

When the checkbox is enabled, the dashboard sends a text-only request to `POST /api/ai/memory-chat`. The 8789 Node service validates the existing user/assistant text conversation (maximum 20 messages, a limited total text budget), checks the same VPN gate as ordinary local chat when enabled, invokes only `memoryAction('recall', {query})` against the existing isolated Cognee dataset, and injects at most 2 short quoted snippets as explicitly **untrusted reference data** into the final user message. The result is proxied only to the existing loopback local FastAPI `/ai/chat` connected to llama.cpp. No model configuration, weights, or runtime is replaced; Elektron's Ollama remains untouched.

**Authority boundaries:** The memory-aware route rejects client-supplied `tools` and unexpected fields, never forwards tool definitions or calls REA or stores memory, and returns `tool_calls: []` with `toolExecutionAuthorized: false` regardless of model output. It returns generic 503 and does not call llama.cpp if Cognee recall fails. The deterministic rules engine and standalone, operator-triggered remember/recall APIs remain unchanged. No automatic ingestion or persistent transcript storage. Memory excerpt text is not sent back to the browser as raw context; only counts and policy metadata are returned.

### Guarded live Windows activation

The new `Activate-Fun-Memory-Chat.ps1` checks the existing deployed server and memory bridge, local llama.cpp readiness, REA 229 tools and scope, retired domestic/international sourcing on dashboard/Sidequest; runs focused regression and JavaScript syntax tests; backs up the original 8789 server and dashboard; applies an anchored patch to live copies; restarts **only** the verified 8789 Node process; reconnects the read-only REA catalog; verifies unchanged REA scope and sourcing retirement; rejects a deliberately unauthorized chat `tools` field; and performs one text-only llama.cpp chat with existing Cognee recall. On failure, it attempts to restore the previous server and dashboard with REA reconnection. No npm/pip, no Cognee remember, no generic platform activation, no REA `tools/call`.

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'GIT_PULL_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'Activate-Fun-Memory-Chat.ps1');if($LASTEXITCODE -ne 0){throw 'FUN_MEMORY_CHAT_ACTIVATION_HOLD'}
```

Expected success includes `MEMORY_CHAT_PREFLIGHT=PASS`, `MEMORY_CHAT_DASHBOARD=PASS`, `MEMORY_CHAT_REA=PASS COUNT=229`, `MEMORY_CHAT_LIVE=PASS HTTP=200`, and `MEMORY_CHAT_UI=CHECKBOX_DEFAULT_OFF`. The smoke test prints excerpt count and zero-tool/write proofs, not the response text or retrieved memory content. The smoke test still runs local llama.cpp inference, so it requires that service to be ready before deployment and may use local compute resources. If llama.cpp is not ready, preflight halts without changing files; start the existing model in the Fun Industrial dashboard first.

### API contract

`GET /api/ai/memory-chat/status` reports availability, `enabledByDefault:false`, and tool/REA/write restrictions. `POST /api/ai/memory-chat` takes only `{messages:[{role:'user'|'assistant',content:'...'}], max_tokens?:number, temperature?:number}`; other fields (including tools, actions, role system) are rejected. The response includes `reply`, `tool_calls:[]`, `toolExecutionAuthorized:false`, and `memory` metadata (`excerptsIncluded`, `recallResults`, `memoryWrites:0`, `toolsForwarded:0`, `reaToolsExecuted:0`). A failed Cognee recall does not become a text-only fallback or automatically invoke a tool.

Qualified source tests in `intelligence-checks/memory-chat-case.mjs` cover malicious tool field rejection, invalid messages, untrusted quoting, bounded context, fail-closed errors, patch markers, and real dashboard JavaScript parse. This is a **bounded memory augmentation**, not autonomous knowledge verification or approval delegation.
