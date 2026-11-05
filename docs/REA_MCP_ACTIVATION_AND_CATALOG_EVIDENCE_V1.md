# REA MCP Activation and Catalog Evidence (Fun Industrial LLC)

**Record date:** 2026-11-04  
**Repository:** `chr1stopherwallace156-svg/for-fun-industrial-llc-`  
**Working branch:** `feature/rea-only-start-installer-v1`  
**Local project:** `C:\Users\alxar\FunIndustrial`  
**Scope:** Fun Industrial LLC only. This record is not part of Elektron.

## 1. Activation evidence

The REA-only startup endpoint was implemented and locally qualified before activation.

### Verified code path

- Local-only route: `POST /api/rea/start` in `src/server.mjs`.
- Route calls `platform.startRea()` directly.
- `platform.startRea()`:
  - returns disabled if `config.rea.enabled` is false;
  - checks the NetBird peer through `vpnConnected()` when `config.vpnRequired` is true;
  - returns blocked if the required VPN peer is not connected;
  - otherwise calls only `rea.start()`.
- This path does not intentionally start AI, compute, or VPN.
- The route deliberately does not call the general `requireVpnGate()` helper, because that helper calls `platform.status()` and status applies fail-closed lifecycle behavior to services.

### Local qualification

The following checks were reported from the Windows project checkout:

- `node --check src/server.mjs`: passed.
- `node --check src/platform.mjs`: passed.
- `node --test src/platform.test.mjs`: **8 tests passed, 0 failed**.
- Tests include:
  - connected NetBird peer is sufficient when exit-node routing is not required;
  - explicit exit-node policy remains enforceable;
  - allowlisted REA tool path and peer-disconnect service-stop behavior;
  - REA-only startup does not start AI, compute, or VPN;
  - REA-only startup is blocked when the NetBird peer is disconnected;
  - compute-only startup and disconnect/reconnect isolation cases.

### Runtime activation

Before the activation request, NetBird CLI reported:

- Management: Connected
- Signal: Connected
- Relays: 4/4 available
- Peers: 1/1 connected
- NetBird IP: `100.109.4.20/16`
- Interface type: Userspace

The dashboard was initially absent on port 8787. It was subsequently brought up, and the following checks succeeded:

- `Test-NetConnection 127.0.0.1 -Port 8787`: `TcpTestSucceeded : True`.
- `POST http://127.0.0.1:8787/api/rea/start` returned:

```json
{
  "result": {
    "state": "ready",
    "detail": "MCP initialize/initialized and tools/list completed.",
    "server": {
      "name": "rea",
      "version": "6.8.0"
    },
    "tool_count": 229
  }
}
```

- `GET http://127.0.0.1:8787/api/rea/catalog` returned `REA_CATALOG_COUNT=229`.

**Activation conclusion:** REA MCP reached `ready`; MCP initialize/initialized and tools/list completed; server version was `6.8.0`; 229 tool definitions were returned by catalog discovery.

## 2. Authority and safety boundary

**Catalog discovery is not tool-execution authorization.**

At the time of this record:

- `REA_ALLOWED_TOOLS` is empty.
- No REA tool has been authorized for execution.
- The catalog was read for discovery only.
- Do not execute tools merely because they appear in the catalog.
- Any future tool execution requires explicit selection and authorization, followed by a deliberate allowlist change.
- Do not use general lifecycle endpoints (`/api/start`, `/api/activate`, `/api/stop`, `/api/shutdown`) as a substitute for the REA-only endpoint.
- Preserve unrelated local working-tree changes; do not reset, clean, rebase, squash, or overwrite them.

## 3. Catalog capabilities recovered from the observed tool descriptions

The operator supplied a long terminal-rendered excerpt of catalog descriptions. Its columns and line wrapping were damaged/interleaved by terminal output. The following is the **recoverable information** from that excerpt, not a claim that this is the complete 229-tool inventory or a byte-exact transcription of every description.

### 3.1 `inspect_rust_binary`

Described as inspecting the Cargo-auditable crate dependency list embedded in an explicit local ELF, PE, or thin Mach-O image, or a selected architecture slice of a universal Mach-O.

Recoverable behavior and output:

- Reads a selected universal Mach-O slice without requiring `lipo`; the artifact remains the universal file, while `selected_slice` records the chosen slice and offsets remain file offsets.
- Reports artifact SHA-256, `.dep-v0` section file offset and size, compressed and uncompressed sizes, format version, packages in original order, root package index, and dependency edges by index.
- Omitted or explicit complete detail preserves the full report.
- Optional summary retains complete Evidence and returns source ranges, counts, and `parent_evidence_id`.
- Optional view can select packages or edges in the same call; explicit complete detail cannot be combined with view.
- Retained facts can be queried with `inspect_analysis_view` using kind `rust`, including exact package names/versions or package indices, edge from/to indices, fields, and matching-row pagination.
- Row indices remain original and scoped to parent Evidence. Empty filters select no rows.
- Default package fields omit dependency vectors; explicitly select dependencies for direct index references.
- Every matching observed version is retained.
- Historical reads do not infer current runtime state.
- Reads zlib-compressed Evidence records.

The description explicitly cautions that static/structural agreement does not prove runtime behavior or prove that two artifacts are a same-build pair.

### 3.2 Static executable / binary inspection excerpt (tool name not recoverable)

A separate, partially interleaved description concerned static inspection of executable bytes and metadata. Recoverable constraints and caveats:

- Static-table links are derived.
- An x86-64/arm64 executable-byte fallback is inferred and does not verify instruction boundaries.
- Input guards included 256 MiB metadata / 1 GiB binary, 64 MiB encoded report, and one active inspection.
- Unsupported layouts, pointer encodings, and resource limits return typed reasons.
- Full Evidence remains available with detail `complete`.
- Static analysis does not establish runtime behavior or a same-build pair.

The tool name and exact mapping of all interleaved sentences to this capability were not recoverable from the pasted terminal excerpt.

### 3.3 Bytecode / executable inspection excerpt (tool name not recoverable)

Another damaged description referred to inspection of local flat executable-bytecode data without target execution. Recoverable details:

- Can select imports, exports, or both explicitly.
- Retained references can resolve explicit local flat executable-bytecode data without target execution.
- Returns SHA-256 and a compact schema inventory.
- Mentions a 32 MiB execution manifest, 16 MiB generation heap, 20-second deadline, 4 MiB map, and 32 MiB reply limits.
- Returns complete Evidence or an actionable resource failure.
- Cleanup may extend the deadline.
- Supports a capture view such as preview or complete to avoid repeated decoding.
- Exposes exact reported binary bytes inline.
- The excerpt warns against interpreting static inspection as observed runtime behavior.

Because the terminal output interleaved several descriptions, these limits are preserved as excerpted facts but should be checked against a fresh catalog response before operational use.

### 3.4 `list_adb_packages`

Described as listing installed packages on one device, including each base APK's device path. The remainder of this description was too damaged/interleaved to reconstruct reliably. Do not infer additional fields or actions from the fragment.

### 3.5 Browser/CDP tools

Names visible in the excerpt:

- `list_browser_targets`
- `inspect_web_page`
- `observe_web_session`

Recoverable behavior:

- Browser targets are listed from targets exposed by the browser/CDP provider.
- `observe_web_session` passively observes a browser session for a requested duration and arms an observation window.
- `inspect_web_page` passively inspects one Electron/browser page using supplied loopback CDP endpoint and target identifiers (the exact provider-specific distinction was partially garbled).
- The excerpt describes rechecking that a target currently exists at the endpoint and is of an accepted path/type before inspection.
- It mentions stable binding until close or explicit switch, with no failure fallback.
- Some details about network comparison, normalization policy, storage/artifacts, timeout handling, and target validation were interleaved and cannot safely be assigned verbatim to a specific tool without a fresh catalog read.

These are observation/inspection descriptions; do not infer permission to navigate, click, modify page state, or execute browser actions unless the exact tool schema and authorization are separately reviewed.

### 3.6 Electron inspection tools

Names visible in the excerpt:

- `inspect_electron_fuses`
- `inspect_electron_page`

Recoverable behavior:

- `inspect_electron_fuses` inspects packaged Electron fuse bytes, canonicalized after symlink resolution.
- `inspect_electron_page` passively inspects one Electron file/page using an explicitly supplied endpoint/target context.
- The excerpt mentions path, suffix, and basename property coverage, including unresolved static values.
- It mentions projecting an environment manifest with default hints and path-based N-API bridge hypotheses.
- It explicitly does not decode Ark/bytecode, parse manifest semantics, or claim observed runtime calls.

### 3.7 Evidence bundle import/export and retained Evidence

A tool named `import_evidence_bundle` was visible.

Recoverable behavior:

- Reads a JSON bundle at a supplied local path.
- Validates every record in the bundle.
- The excerpt mentions deterministic, canonical, byte-stable ordering for analysis/evidence records.
- Existing files require `overwrite: true` before replacement.
- The excerpt also mentions preserving records and manifests and requiring all resize/scrollback output to fit the same evidence budget.

A related export/bundle capability was present in the pasted excerpt, but its exact tool name and several details were corrupted. Do not invent the missing name or schema.

## 4. Evidence interpretation rules

The supplied descriptions repeatedly distinguish static observations from runtime proof:

- Static links, inferred byte ranges, dependency metadata, and structural agreement are not proof of runtime behavior.
- Inferred x86-64/arm64 executable-byte fallback does not verify instruction boundaries.
- Historical reads do not establish current runtime state.
- Static analysis does not prove two files are a same-build pair.
- Unsupported layouts and resource limits should remain typed unavailable/failure outcomes, not be silently guessed around.
- Preserve complete Evidence and parent Evidence references when a view/summary is used.

## 5. Follow-up capture needed for a complete catalog record

The terminal excerpt is not a complete or reliable 229-tool export. To make this documentation exhaustive, retrieve the catalog again from the live local REA MCP and save the complete tool names, descriptions, and input schemas as a versioned evidence artifact. Keep that capture read-only. Do not call any discovered tool during catalog collection.

Suggested read-only catalog request:

```powershell
$c=Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8787/api/rea/catalog" -TimeoutSec 90
"REA_CATALOG_COUNT=$(@($c.tools).Count)"
$c.tools | ConvertTo-Json -Depth 30 | Set-Content -Encoding utf8 .\.runtime\evidence\rea-tool-catalog-2026-11-04.json
```

Before running this suggested command, ensure `.runtime\evidence` exists and choose a unique filename if one already exists. This command only reads the catalog and writes a local JSON snapshot; it does not execute REA tools. A future GitHub evidence upload should be reviewed for secrets, local paths, and sensitive data before publication.

---

**Status:** REA activated and catalog discovery verified. Tool execution remains unauthorized. This document records observed evidence and explicitly labels damaged/incomplete catalog descriptions rather than filling gaps by assumption.
