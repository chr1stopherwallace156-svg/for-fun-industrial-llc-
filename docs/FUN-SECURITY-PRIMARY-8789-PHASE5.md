# Fun Industrial — Security integration into the primary dashboard (Phase 5)

> **November 10 deployment update — this section supersedes previous instructions requiring stale source pins, periodic read-only policy reconciliations, or the 204-file provisional baseline as an installation gate.**
>
> The previous exact-hash autostart watchdog is being **removed**, not repaired again. The actual security scanner is original English-only local defensive code; this does not install the third-party Chinese-language Fscan project. Existing REA operator permissions, localhost binding, voice, Cognee memory, llama.cpp, compute and the NetBird 8443 gateway remain protected.

## One actual deployment command (legacy autostart removal + Phase 5 apply)

For an existing checkout, run this **single** Windows PowerShell command after reviewing the changes:

~~~powershell
git -C "$HOME\FunIndustrial-SecurityPrimary-V1" pull --ff-only origin feature/fun-security-primary-8789-phase5-20261110; if($LASTEXITCODE -ne 0){throw 'PHASE5_SOURCE_UPDATE_FAILED'}; powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\FunIndustrial-SecurityPrimary-V1\Retire-Legacy-Pins-And-Deploy.ps1"
~~~

This does real work, not just preview: backs up policy/watchdog/scheduled task, stops and unregisters **only** FunIndustrial-Dashboard8789-Autostart, archives its source-PID policy, confirms 8789 is still owned by the original Node dashboard, performs compatibility tests and staged patching, then applies the English-only security chat patch to the primary dashboard and briefly restarts **only** its 8789 Node process. It checks voice, memory, AI, the REA catalogue and exact approved tool names and protected service port ownership. The previously installed fi_security_local_audit tool is reused where it is already a zero-argument local-only tool instead of duplicated.

**Consequence:** the old watchdog's automatic start at Windows logon is also removed. The dashboard will **not autostart at the next Windows login** until a separate simple, pin-free autostart is requested and installed. The gateway service is not restarted by this script, but it cannot serve the dashboard during 8789's brief restart or while the dashboard is offline after reboot. The backed-up original watchdog and policy are retained under AppData for recovery, never reactivated automatically.

If an individual compatibility test fails, the installer stops rather than deleting user data or starting other services. It attempts an 8789-only rollback if postflight fails after a restart. Rollback is best effort, and live success requires FUN_PHASE5_ONE_RUN=PASS, not merely CI passing.

## Historical troubleshooting below

The older instructions following this paragraph describe the legacy guarded rollout and remain as an audit trail; **do not use the old -Approve / -Apply sequence** now that the source-pin supervisor is being retired.


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

## Fix an existing 8789 autostart policy HASH/PID mismatch (November 10 repair)

If the stage-only deployment refuses with AUTOSTART_SOURCE_PIN_MISMATCH, **do not manually edit policy.json**, rerun -Apply, or disable the scheduled watchdog. The November 9 policy may refer to the old source and PID while the November 10 dashboard has updated source. A 204/204 provisional baseline PASS alone does not authorize trusting new source.

The guarded reconciliation helper is located at Reconcile-Fun-Dashboard8789-Policy.ps1 in this branch.

First update your already-cloned Phase 5 checkout and verify it is the expected branch:

~~~powershell
git -C "$HOME\FunIndustrial-SecurityPrimary-V1" pull --ff-only origin feature/fun-security-primary-8789-phase5-20261110; if($LASTEXITCODE -ne 0){throw 'SECURITY_RECONCILE_SOURCE_PULL_HOLD'}
~~~

Run the **read-only, no-file-change** review first:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\FunIndustrial-SecurityPrimary-V1\Reconcile-Fun-Dashboard8789-Policy.ps1"
~~~

The review confirms: exact original 204-file pinned baseline, a single verified Node owner of 127.0.0.1:8789, executable identity matching original supervisor nodePath, process start time **not earlier** than the modified deployed code, live HTML matching installed HTML, source syntax and voice/memory markers, healthy existing AI/voice/memory endpoints, current REA catalogue identical to original 229 names, same approved REA tool set as original policy, and protected independent service listeners. It then displays the current SHA-256 source hashes and a **POLICY_REVIEW_DIGEST**. No service/process/task/policy changes occur.

If any HOLD appears, stop. In particular, RUNNING_PROCESS_PREDATES_DEPLOYED_FILES_REVIEW_RESTART_REQUIRED means the source on disk may differ from code the running process loaded. An external dashboard-only, independently reviewed restart/qualification is required. Do not re-pin that process.

**Only after reviewing the installed source changes and accepting that exact report** may the operator run:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\FunIndustrial-SecurityPrimary-V1\Reconcile-Fun-Dashboard8789-Policy.ps1" -Approve -ExpectedReviewDigest PASTE_THE_VERIFIED_64_HEX_REVIEW_DIGEST
~~~

Replace PASTE_THE_VERIFIED_64_HEX_REVIEW_DIGEST with the exact 64-character digest from the preview. The script reruns verification and refuses any changed process/files/policy. It backs up the previous policy and its review evidence, then updates **only** the exact server/HTML hash pins and observed PID/start-time fields in the policy. It preserves other policy contents, REA permissions, the dashboard process, 8443 gateway, llama.cpp and Python API. It waits for the EXISTING supervisor to report running/EXISTING_DASHBOARD_PRESERVED. On failure it attempts to restore the prior policy and reports the backup location. **This is a permission-controlled policy update, not evidence of malware-free code.**

After FUN_DASHBOARD_POLICY_RECONCILE=PASS, rerun the Phase 5 stage-only command, check STAGE=PASS, and only then the separate operator-authorized -Apply deployment. The primary deployment may legitimately change the 204-file baseline; that requires a separately reviewed new candidate and pin.

## November 10 operator-dashboard HTML compatibility fix

The first read-only reconciliation report returned LIVE_CHAT_OR_VOICE_UI_MISSING even though the 204/204 integrity check passed. GitHub's original iPhone voice UI patcher explicitly documents that the actual deployed operator dashboard may not contain the old sample chat-input ID. The mismatch was in a **stale selector assumption**, not proof that the live voice or chat service was missing.

The reviewed policy script now checks the stable FI_VOICE_MOBILE_PANEL_V1 marker, its same-origin mobile voice client script, one closing body element, actual live chat API route definitions, a responsive AI tool catalogue, and the rest of the original supervisor/health/process identity requirements. The primary security UI patcher likewise checks for the actual installed voice panel rather than demanding old sample chat-input or chat-send elements. The security client tries to mount within a recognizable chat panel and otherwise uses the already-installed voice panel as a visible fallback, always showing its own audited result region.

After updating this same GitHub branch, rerun the **read-only** reconciliation command. Never skip to -Approve or Phase 5 -Apply merely because the old selector check has been repaired. The next HOLD, if any, must be investigated on its own merits.

## Critical policy review digest fix — November 10

A Windows operator review returned POLICY_REVIEW_DIGEST=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855. This is the SHA-256 hash of EMPTY INPUT, not a valid review digest. The source used a PowerShell function parameter named $input, which collides with PowerShell's automatic pipeline variable. That old output is **invalid for any -Approve invocation**. No policy change was made by the review-only run.

This repair renames the function parameter, rejects empty or unreasonably small serialized review JSON, verifies SHA-256('abc') against the known answer, and refuses the empty-string digest. Windows CI runs the isolated pure function to check the known answer, varying input and empty-string rejection without executing reconciliation or changing host state.

Operator:
1. Pull the same Phase 5 branch with git pull --ff-only.
2. Run Reconcile-Fun-Dashboard8789-Policy.ps1 **without -Approve** again.
3. Confirm FUN_DASHBOARD_POLICY_REVIEW=PASS; POLICY_REVIEW_INPUT_UTF8_BYTES should be a positive realistic value; POLICY_REVIEW_DIGEST must **not** be e3b0c442...b855.
4. Do not execute -Approve until reviewing changed source, verifying that the digest is genuine, and agreeing to update the stored policy.

## November 10 — supervisor refused the reconciled policy (read-only diagnosis)

The operator-authorized policy review was valid, but the supervisor did not report EXISTING_DASHBOARD_PRESERVED within the 28-second qualification window; the reconciliation script attempted rollback from the backed-up policy file.

Do **not** run reconciliation -Approve again, change the scheduled task, or run deployment -Apply. The new Diagnose-Fun-Dashboard8789-Supervisor.ps1 script inspects the installed and repository supervisor file fingerprints, verifies the local Node 8789 owner, records original policy and supervisor status, and invokes **only** the canonical read-only functions Policy-Ready, Endpoint-Ready and Confirm-Owner with a proposed in-memory candidate policy. There are no changes to policy, status.json, services, task, protected ports or REA permissions. If the installed supervisor source does not match the reviewed canonical version, it stops rather than executing unfamiliar instructions.

After pulling the same feature branch, run:
~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\FunIndustrial-SecurityPrimary-V1\Diagnose-Fun-Dashboard8789-Supervisor.ps1"
~~~
Report all SUPERVISOR_*, SIMULATED_* and FUN_DASHBOARD_SUPERVISOR_DIAGNOSTIC values. A read-only diagnostic PASS means the report completed, **not** that the supervisor currently accepts the policy. The repair must address the exact observed failed check. Any later policy change needs a fresh explicit review, independent backup and acceptance.

## November 10 — watchdog reconciliation evidence hardening after task-context check

A read-only task-context inspection confirmed: current operator, scheduled task principal and one running PowerShell watchdog owner all match the policy SID; the scheduled watchdog polls at ~20-second intervals; prior policy rollback matches its backup. This excludes a stopped task and owner mismatch but does not establish why the previous candidate was rejected.

The subsequent revised Reconcile-Fun-Dashboard8789-Policy.ps1 **still defaults to read-only review**. When given a fresh, independently approved digest, it now checks the last watchdog timestamp is fresh; verifies the exact proposed policy bytes on disk after replacement; re-reads policy data and permissions; and records each genuinely new watchdog status tick for up to about 83 seconds. It needs a *fresh* running:EXISTING_DASHBOARD_PRESERVED report, not a stale file or a guessed timeout. If rejected, it reports the observed status reason and confirms rollback by comparing to the saved original policy hash. It never stops or restarts the watchdog, dashboard, gateway, llama.cpp or compute.

Do not reuse a digest from before changing sources or process states without rerunning the **read-only** review. Do not run -Apply until the reconciled policy is accepted. Read-only review:

~~~powershell
git -C "$HOME\FunIndustrial-SecurityPrimary-V1" pull --ff-only origin feature/fun-security-primary-8789-phase5-20261110; if($LASTEXITCODE -ne 0){throw 'FUN_POLICY_SOURCE_PULL_HOLD'}; powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\FunIndustrial-SecurityPrimary-V1\Reconcile-Fun-Dashboard8789-Policy.ps1"
~~~
