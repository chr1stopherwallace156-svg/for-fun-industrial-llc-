# Fun Industrial — Automatic Local Tool Use in Existing 8789 Dashboard

**State: new guarded deployment candidate, not yet activated on the user's Windows host.**

The user independently verified two local Qwen tool-selection and execution tasks through the CLI: `fi_graph_analyze` (3 nodes, 2 edges, density 0.6667) and `fi_tensor_contract` (2×2 result [[19,22],[43,50]]). This change makes an explicit equivalent operator-started task available from the existing browser dashboard, while keeping the ordinary chat and its approval prompts unchanged.

## UI and HTTP design

- Adds a separate **Run AI tools automatically** button next to **Send message** in the existing local AI conversation panel. Ordinary chat continues to use the established Cognee/cognition/voice/network integrations and approval handling.
- New `GET /api/ai/auto-local/status`: in-process metadata, busy flag, completed/failed sessions. Does not run inference.
- New `POST /api/ai/auto-local/run` with JSON `{ "prompt": "...", "rounds": 2 }`: explicitly starts one finite local session; no further confirmation prompts on each selected local function. The button is disabled during the request and shows tool names/results as DOM text, not interpreted markup.
- Uses the existing, verified local 19 tool registry. Offers a maximum of six relevant schemas to the model per round. Model calls are sent through normal `/api/ai/chat`; on the known Python-adapter placeholder with no structured calls, one additional inference uses existing `127.0.0.1:8088/v1/chat/completions`. Local functions are executed through existing `/api/ai/tool-call`. Validating the current fixed registry does not create new operating-system privileges.
- Max three rounds server-side (UI uses two), up to eight calls per round, no daemon, no automatic retry on failed execution, and one concurrent session per dashboard process.
- The separate raw-model fallback does not carry the dashboard's full memory/cognitive prompt context. It is explicitly an execution-mode diagnostic, not a substitute for normal chat.

## REA, model, and CPU boundaries

The historical 229 REA tools are still unavailable because the running REA MCP session is stopped. This change does not initialize them, grant REA execution, enable Windows shell or arbitrary FS access, or interfere with Elektron's Ollama. Some of the 19 local functions mutate in-memory compute/universe state; the auto-run button intentionally executes them without per-call confirmation only within the user-started session.

## Installation safety

`Deploy-Fun-Auto-Local-Dashboard8789.ps1` is **stage-only by default**. Its explicit `-Apply` mode preflights the known localhost 8789 Node owner, protected listener PID/port snapshots (8088, 8791 and others), existing Qwen and compute readiness, Cognee and voice status, local-first identity, REA stopped+403, no extra tool grants, source and UI baselines, the identity of installed Cognitive Kernel and capability index, and a full offline test suite. It stages complete server/UI patches in a unique AppData folder; source and UI backups are saved before changes.

The Cognitive Kernel's claims, checks, predictions and history are in process memory. The script refuses a dashboard restart if ANY cognitive records exist, rather than discarding them. If preflight passes and memory is empty, only the known 8789 dashboard is restarted. Postflight verifies unchanged local tool registry, protected ports, the cognitive and index APIs, new auto-local metadata, local AI health, stopped REA, and unchanged server/UI hashes.

On a HOLD after source mutation, the script attempts best-effort rollback: stop only its own newly started dashboard PID if still owned, restore each server/UI file independently only if its bytes still equal the staged version, remove only modules installed by this run if unchanged, and restart the previous dashboard only when the restored originals and port vacancy are verified. A rollback warning always requires a manual health check.

## Qualification and limits

Offline Windows and Linux tests cover auto-local execution, no tool calls, server source composition with cognition and capability patches, real base HTML UI compatibility, JavaScript syntax, source preservation, reentrancy and no REA execution. Passing CI and staging is not evidence that a live deployment occurred or that the 4B model will always choose the right function.

**Next operator sequence:** first stage-only from a new checkout, review PASS and backup path; then separately apply with -Apply, inspect live endpoints; then test using an initial graph-only task in the UI. Do not merge blindly into active release or overwrite the live dashboard without these checks.
## Compatibility repair after November 11 Windows stage HOLD

The operator ran stage-only against an evolved live 8789 dashboard. The original 25 offline tests passed, but the UI patch stopped with `FUN_AUTO_DASH_UI_STAGE=HOLD AUTO_DASH_UI_EXISTING_CHAT_MISSING_id="chat-history"` and `FUN_AUTO_DASH_HOLD=UI_STAGING_FAILED`. **The dashboard was not modified and no processes restarted.** This was a wrong assumption in our patch, not a failure of the Cognitive Kernel or llama.cpp.

The revised UI adapter (V2) no longer depends on `chat-history`, `chat-input`, `chat-send` or any original chat IDs. It inserts an independent `fi-auto-local-panel` section immediately before the single closing `</body>`. Its JavaScript lives in `src/experimental/auto-local-client.js`, served from the same-origin `GET /api/ai/auto-local/client.js` route; there are no added inline scripts or dependencies on existing chat variables. The server checks same-origin/loopback through `localRequest`. All old document text and script bodies remain identical. Reject missing or ambiguous body/ID collisions rather than force replacements.

The guarded deployer now stages and (only with operator `-Apply`) copies the new client module along with the existing two experimental modules. The previous preflight, backup/rollback, verified-owner restarts, no-REA execution rule, and prevention of volatile Cognitive Kernel data loss remain in force.

Targeted qualification after the change: 26/26 Windows + Ubuntu PASS; Windows PowerShell parse PASS. This includes a mocked evolved page that has no legacy chat elements and confirms its existing text remains. This is not a confirmation of a live deployment on the operator's Windows host.

The next action is to `git pull --ff-only` the existing `FunIndustrial-AutoDashboard-V1` checkout and run the deployer **without** `-Apply`. Only consider guarded activation if the actual Windows stage emits `FUN_AUTO_DASH_STAGE=PASS` and `FUN_AUTO_DASH_LIVE_DEPLOY=NOT_PERFORMED`. After activation, visit the root dashboard `http://127.0.0.1:8789/`, where the new standalone panel will appear. The normal chat remains unaffected.

## November 11: live REA 229 tools READY, preserve the existing dashboard process

A new operator diagnostic from their Windows host confirms:
- REA service state `ready`, handshake complete, 229 tools available
- `GET /api/rea/tools` returns HTTP 200
- `GET /api/ai/tools` includes 19 fixed local tools and 229 REA entries
- llama.cpp AI remains `ready`
- the automatic dashboard routes have NOT been installed

The previous guarded `-Apply` held at `REA_STATE_CHANGED` because its REA-stopped preflight no longer matches reality. **Do not relax that check and restart the 8789 Node process.** The active REA MCP adapter owns a child process and stores the tool session in the existing Node process; restarting it would destroy the initialized session.

### Safe non-restarting alternative: standalone dashboard at 127.0.0.1:8796

Use `Start-Fun-Auto-Sidecar8796.ps1` from the feature checkout. It runs 32 isolated tests, validates file/module syntax, exact model/cognitive/index identities, local 19+229 tool counts, REA ready, and checks owner snapshots on 8789, 8088, 8791, 8794, 4479. If 8796 is already in use, the launcher refuses to replace the owner. It starts **only** a new Node sidecar at 127.0.0.1:8796; it does NOT edit the existing dashboard files or restart anything. Successful startup reads the new UI, client, and status endpoints, compares protected PIDs, and verifies REA still reports ready with all 229 exposed.

The sidecar's root page has a self-contained "Automatic Local Tools" panel. Its client JavaScript is CSP-compatible and accepts a click from that page only. The same-origin JSON run endpoint requires a matching browser Origin and `x-fi-auto-local: operator-click`, preventing ordinary cross-site forms from triggering execution. It has no shell or REA execution routes and no background jobs.

The auto-local bridge filters the combined 248-tool registry to the **19** fixed `fi_*` entries before passing any function schema to Qwen. The runner automatically executes selected local tools during a bounded operator-started task, without per-call prompts. The 229 REA tool definitions remain visible on the original 8789 dashboard but are never passed to this executor, and the existing `/api/ai/tool-call` endpoint still rejects `rea__*` executions. **Catalogue visibility is not execution permission.**

Open **http://127.0.0.1:8796/** on the Windows host for the new panel, leaving **http://127.0.0.1:8789/** unchanged. To halt the standalone sidecar after testing, use only its recorded PID; never call `/api/stop` on the parent or kill Node processes by name. No install-on-start, autostart, or automatic recurring task is added.

Offline qualification: 32/32 targeted tests PASS on Windows and Ubuntu. The tests include mixed REA-ready 19+229 catalogues, one automatic local graph action, same-origin/CSRF checks, independent HTTP status/UI/client, and Windows bootstrap parser. The user's actual Windows sidecar has NOT been started yet; only their prior 8789 process and REA health have been observed.

**Important:** legacy `Deploy-Fun-Auto-Local-Dashboard8789.ps1 -Apply` remains incompatible with REA ready by design; never run it on the current 229-ready host. The new sidecar is the supported path for this exact host state.
