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
