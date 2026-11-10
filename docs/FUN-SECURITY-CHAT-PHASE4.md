# Fun Industrial Security Chat — Phase 4 (English-only, original code)

## Status

Staged integration on a separate GitHub branch. Not a full Fscan port. No original Fscan code, executable, credential attack plugin, payload, malicious module or dependency was included. Never describe this as equivalent to the original scanner's complete capabilities.

## Available in the staged branch

- Original Node.js TCP connection scanner with operator approval, loopback or private IPv4 inputs, 16 port cap, 4 connection cap.
- Original Phase 4 fixed **loopback-only** audit uses ports 8788, 8790, 8088, 8791. Does not accept targets or ports from model/tool arguments.
- Passive HTTP metadata inspection on those ports, using HEAD requests, bounded timeouts, no body downloads, no redirects, no credentials. A reply is evidence of a web endpoint, **not independently verified service identity**.
- Bounded static source risk indicators: dynamic eval, script/command execution, TLS bypass settings, remote-script pipe-to-shell and encoded PowerShell. Paths/line numbers reported without copying source contents. Indicators are **not proof of malware**.
- Maintains separate Phase 2 offline binary-identity verification and Phase 3 selected-file drift verification. Those run manually and are not silently re-baselined or run by chat.
- Registers `fi_security_local_audit` in the existing Fun Industrial local model tool catalog with an empty argument schema. The current chat UI already displays model tool proposals and requests a confirmation click before the `/api/ai/tool-call` submission. REA execution remains blocked and unmodified.

## Important limits

- Not a full vulnerability scanner: no live CVE catalog, exploit validation, SSH/SMB credential checks, packet capture, LAN-wide discovery, firmware inspection, or arbitrary-target network scan.
- No background scheduler or agent is added.
- Local AI may decide not to propose the available function. Availability as a tool does not guarantee autonomous invocation.
- The existing platform has loopback-based access control but no true local-user authentication. UI confirmation is not a cryptographically authenticated approval; a local process could directly call local endpoints. **Do not expose this platform to untrusted local users or networks**.
- This is a prospective code integration: changes to the repository do not activate the tool on the current Windows host. The user's live installed `src/server.mjs` has received other independent patches, so blindly replacing it with this branch file would destroy features. A compatibility-checked staging/deployment process is necessary.
- The pinned Phase 3 baseline covers the currently deployed files; applying approved code modifications will legitimately cause drift and must generate a new separately reviewed candidate, never overwrite the old baseline or silently approve a new one.

## Local development verification (read-only)

```powershell
node --test .\intelligence-checks\security-chat-phase4-case.mjs .\intelligence-checks\local-security-scan-case.mjs .\src\platform-tools.test.mjs
node .\src\security\defensive-audit.mjs preview "$HOME\FunIndustrial-REA-MCP-Activation"
```

## Manual local CLI execution (bounded offensive-looking but defensive behavior)

After reviewing the exact source and target directory, to run the scanner directly on the Windows machine without installing it into chat:

```powershell
node .\src\security\defensive-audit.mjs run "$HOME\FunIndustrial-REA-MCP-Activation"
```

This performs a local TCP connect inventory, HEAD requests to selected responding localhost ports and static inspection of the specified code directory. It does not run REA tools, models, malware, or exploits and does not install itself. It can produce holds if access, source size, or symlink guards are violated.

## Chat integration after a separately qualified deployment

Ask the local AI: `Propose a local security audit of Fun Industrial`. If it offers `fi_security_local_audit`, review the empty tool arguments and click approval. The response will list TCP results, HTTP headers, and source-code risk indicators. If the model does not propose it, do not treat the scan as activated.

## Phase 4 release conditions

1. Pass CI on Windows and Linux plus user-host offline tests.
2. Stage and inspect changes against the **actual live host** without overwriting existing memory, web, voice, compute, REA or workflow files.
3. Separately approve any deployment or process restart, preserving llama.cpp and Ollama separation.
4. Verify actual chat proposal and operator-gated invocation, REA=0 and external targets=0.
5. Review expected Phase 3 source drift and explicitly pin a new trusted baseline only after source and behavior review.

## Activate the isolated Windows chat preview

This does **not** patch or restart the existing production dashboard, and does not install the original Fscan.

From PowerShell, clone the exact security chat branch into a separate folder:

```powershell
git clone --depth 1 --single-branch --branch feature/fun-english-security-chat-phase4-20261110 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git "$HOME\FunIndustrial-SecurityChat-V1"; if($LASTEXITCODE -ne 0){throw 'SECURITY_CHAT_CLONE_FAILED'}; Set-Location "$HOME\FunIndustrial-SecurityChat-V1"
```

Start the isolated security chat dashboard (foreground window; Ctrl+C stops only this preview):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Fun-SecurityChat-Preview.ps1
```

The launcher checks that the existing compute service on 8791 is listening, that 8794 is free, and that llama.cpp and its model files exist. It runs local Node test suites, starts a *new* dashboard at http://127.0.0.1:8794, disables REA and auto-start, and fixes the scan source to the existing `FunIndustrial-REA-MCP-Activation` folder via `FI_SECURITY_SOURCE_ROOT`.

On the **Windows computer's own browser** visit http://127.0.0.1:8794. In the Local AI conversation panel, click **Approve local security audit**, read the confirmation, and affirm. The result appears in that chat panel. You can also ask Qwen to propose `fi_security_local_audit` and approve its tool proposal. An iPhone's `127.0.0.1` is not the Windows computer.

Do not press the overall platform Activate/Stop buttons in this preview; they are unrelated to the security audit. Do not expose the preview via VPN, LAN, or gateway while authorization and origin controls are still under review.

Only the fixed local scanner, passive HTTP metadata, and source indicators run through the chat bridge. Phase 2 official binary verification and Phase 3 hash-drift monitoring remain their existing separate local commands; they are not invoked automatically by chat.

## Production promotion hold

The current live dashboard may contain additional voice/memory/web patches not reflected in this branch. Do **not** copy this branch's entire `server.mjs`, `public/index.html`, or `platform-tools.mjs` over production. A separate compatible, diff-reviewed migration is required to activate the feature inside the existing running dashboard. Replacing the live source would also change the 204-file baseline and trigger expected drift. Never auto-rebaseline.
