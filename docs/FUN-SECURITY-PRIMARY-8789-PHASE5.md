# Fun Industrial — Security integration into the primary dashboard (Phase 5)

## Ports and scope
- 8789 is the EXISTING Fun Industrial dashboard, AI chat, voice, automatic memory, web and workflows. The new security button is added inside its existing chat panel.
- 8443 is the EXISTING private NetBird/HTTPS gateway to 8789. Its process, TLS configuration, client allowlist and routing are not changed.
- 8794 is the temporary Phase 4 security preview. This release does not stop it; it may be closed separately by the operator after successful primary validation.
- Existing llama.cpp (8088), Python API (8791), optional DDGS (4479) and REA permissions must be preserved.

## Capabilities
Original English-only defensive implementation, not downloaded Fscan, Fscan exploit modules, or Ollama. The fixed localhost TCP scan covers 8088, 8443, 8788, 8789, 8790, 8791, 8794. Port 8443 is checked ONLY on loopback, so a gateway bound exclusively to a NetBird IP will not appear there. A closed loopback TCP port is not evidence the NetBird gateway is offline.

Passive HTTP metadata uses HEAD (without redirects or credentials); 404 or 405 may mean the endpoint does not accept HEAD. Static source review excludes comment-only lines and PyTorch-style .eval() methods, and ranks findings as high/medium *review indicators*, not verified vulnerabilities.

The fixed, zero-argument security tool is named fi_security_local_audit. The new 'Approve local security audit' button sits in the EXISTING chat panel, uses its same-origin backend, asks for confirmation, and sends an explicit operator-reviewed header. The generic old model-proposal approval flow does NOT supply this header: use the dedicated button. No model-supplied addresses/commands, credential attacks, exploits, external network scan, REA execution, background scheduler, auto-repair, or malware execution.

Phase 2 offline binary comparison and Phase 3 tracked-file drift monitor remain separately invoked. The existing 204-file baseline is still PROVISIONAL; deployment preflight requires its exact fingerprint and a clean comparison. Source changes made by deployment will cause expected drift. Do NOT silently rebaseline or trust it without review.

## Windows rollout commands

In a NEW PowerShell window (leave the existing 8789 and 8794 processes as they are), clone the Phase 5 branch:

~~~powershell
git clone --depth 1 --single-branch --branch feature/fun-security-primary-8789-phase5-20261110 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git "$HOME\FunIndustrial-SecurityPrimary-V1"; if($LASTEXITCODE -ne 0){throw 'CLONE_FAILED'}; Set-Location "$HOME\FunIndustrial-SecurityPrimary-V1"
~~~

First stage and qualify with NO LIVE CHANGES:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Deploy-Fun-Security-Primary-8789.ps1
~~~

This stages additive server, registry and UI patches in a private local backup folder; validates the existing 8789 Node owner, 204-file baseline, 229 REA catalogue, permission-filtered allowlist, voice, automatic memory, AI and independent service ports; and runs synthetic tests. It refuses missing protected markers, symlinks, stale autostart policy hashes, or changed baseline. Expect a STAGE=PASS and DEPLOY=NOT_PERFORMED.

After reviewing a successful staging output, explicitly authorize a short restart of ONLY the 8789 Node dashboard:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Deploy-Fun-Security-Primary-8789.ps1 -Apply
~~~

The guarded Apply path stages again, backs up three existing dashboard files and the autostart policy (if installed), makes only additive updates to the LIVE deployment, then briefly restarts the verified 8789 Node process. It preserves 8443 gateway and independent llama.cpp, Python and DDGS listeners, and checks 229 REA tools and previously permission-filtered allowed names. It runs one approved local audit, verifies approval denial without header, updates the existing autostart pins only after postflight, and attempts rollback on a failed health check. Rollback is not a guarantee; independently verify any HOLD.

After PASS, independently check the local service on Windows:

~~~powershell
$U='http://127.0.0.1:8789'; $S=Invoke-RestMethod "$U/api/security/status"; $T=Invoke-RestMethod "$U/api/ai/tools"; Write-Host "SECURITY=$($S.state) PRIMARY_PORT=$($S.port) CHAT_TOOL=$([bool]($T.tools|Where-Object {$_.function.name -eq 'fi_security_local_audit'}))"
~~~

On iPhone Safari use your EXISTING SSH forward to 8789 or your existing authenticated private HTTPS 8443 gateway; the phone cannot access Windows loopback directly without a forwarding tunnel.

## Guardrails and known limitations
- Do not copy the repository's older whole server or HTML over your live deployment. The patcher operates on the current installed code with strict anchors.
- The current gateway and Windows machine do not provide strong per-user authentication against a malicious local process. A confirmation button and special header are operator controls, not cryptographic identity proof.
- A Node dashboard restart may reconnect its managed REA process; no REA tool execution permission is added.
- Never bypass a HOLD or change watchdog hashes by hand. The script refuses an incompatible autostart policy; it only refreshes verified server/HTML hashes after qualified deployment.
- This is not a full Fscan replacement, vulnerability database, anti-malware certification, host firewall policy, or arbitrary-target scanner.
