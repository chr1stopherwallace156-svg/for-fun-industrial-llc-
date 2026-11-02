# Fun Industrial — Host Activation and Six-Stage Qualification Runbook (v1)

**Status:** execution runbook; host preflight, Stage 2 dependency installation and first qualification attempt recorded 2026-11-02.
**Current source HEAD:** `7165d91a23d537c9390e18505c5040eef1c0c589`.  
**Repository:** `feature/open-source-ai-multi-universe-v1`  
**Reported host HEAD:** `67d0a0d2b068e58480036dd9ba8f0900914c8b2f`  
**Windows clone:** `C:\\Users\\alxar\\FunIndustrial`  
**NetBird Windows peer:** `100.109.4.20` (`oxytalkin.netbird.cloud`)  
**NetBird iPhone peer:** `100.109.87.100` (confirmed in prior operator testing)  
**NetBird:** CLI/daemon 0.82.0, management and signal connected, 1/1 peer connected.  
**Preflight:** no Fun Industrial ports listening; `scripts/Remove-FunIndustrial.ps1` exists; gateway installer, gateway/supervisor source and successor deployment doc are absent on the reported checkout. Stage 2 later installed Python/Node dependencies and passed the Python suite, but the first Node suite stopped activation (details below).

## Safety boundary and current truth

This feature branch is the current integrated platform path. It is **not** the older successor gateway branch. The current app is designed to bind only to `127.0.0.1:8787`; compute is loopback-only on `127.0.0.1:8790`. Do not change HOST to a NetBird address, create a broad firewall rule, or expose the dashboard directly.

The existing NetBird peer connection and Termius-over-NetBird SSH route are confirmed operator results. They do not prove an approved NetBird exit-node/default route. The activation script sets `VPN_REQUIRE_EXIT_NODE=true`; AI, compute and REA remain blocked until the platform's VPN policy sees the required route. A connected peer alone is not sufficient. Startup is observation-only: adapter startup reads NetBird status and does not issue `netbird up`. VPN connection changes require the explicit Connect VPN action. A new `.env` defaults `NETBIRD_AUTOCONNECT=false`.

**Safari access is not yet implemented by this checkout.** No `src/gateway.mjs`, `src/supervisor.mjs`, or `scripts/Install-FunIndustrialGateway.ps1` was present in the reported host preflight. Do not attempt a direct Safari connection to port 8787. A separately reviewed HTTPS gateway, trusted iPhone certificate, exact peer allowlist and reboot recovery qualification must be completed before remote browser access.

No command in this runbook stops, edits, or reconfigures Elektron, Ollama, Tailscale, or unrelated host services. The activation script only performs a guarded shutdown on port 8787 when its process command line proves it is this checkout's `src/server.mjs`.

## Stage 1 — Verify checkout and source identity (read-only)

Run from PowerShell/Termius:

```powershell
Set-Location C:\Users\alxar\FunIndustrial; $ErrorActionPreference='Stop'; $expected='7165d91a23d537c9390e18505c5040eef1c0c589'; $branch=(git branch --show-current).Trim(); $head=(git rev-parse HEAD).Trim(); Write-Host "BRANCH=$branch"; Write-Host "HEAD=$head"; if($head -ne $expected){throw "HEAD mismatch; stop and reconcile the checkout before activation."}; if($branch -ne 'feature/open-source-ai-multi-universe-v1'){throw "Unexpected branch; stop."}; if(-not (Test-Path .\scripts\Activate-FunIndustrial.ps1)){throw 'Activation script missing.'}; if(-not (Test-Path .\scripts\Qualify-FunIndustrial.ps1)){throw 'Qualification script missing.'}; if(-not (Test-Path .\docs\WINDOWS_ACTIVATION.md)){throw 'Activation documentation missing.'}; git status --short; Write-Host 'SOURCE_PREFLIGHT=PASS'
```

**Expected:** exact branch and HEAD above, required scripts/docs present, `SOURCE_PREFLIGHT=PASS`. If HEAD differs, do not force-reset or overwrite local work. Record actual branch, HEAD and status.

## Stage 2 — Activate the platform (mutating; one run)

Only proceed after Stage 1 passes. Keep NetBird connected. The script installs missing prerequisites via winget, creates repository-private `.venv` and `.runtime`, installs pinned dependencies/CPU PyTorch and private REA 6.8.0, runs tests, creates/preserves `.env`, starts the local controller and calls its activation endpoint.

```powershell
Set-Location C:\Users\alxar\FunIndustrial; $ErrorActionPreference='Stop'; Set-ExecutionPolicy -Scope Process RemoteSigned -Force; .\scripts\Activate-FunIndustrial.ps1 -SkipNetBirdInstall -SkipNetBirdLogin; if($LASTEXITCODE -ne 0){throw 'ACTIVATION_FAILED: preserve the complete terminal output and reports; do not continue.'}
```

The two Skip switches are intentional: NetBird 0.82.0 is already installed and authenticated on this host. This avoids rerunning SSO or a package installation. It does **not** bypass the app's VPN/exit-node policy. Startup does not invoke `netbird up`; if the required exit-node route is absent, all functional services remain blocked until the operator explicitly connects/configures the approved route.

**Observed first attempt (2026-11-02 09:00):** source update to `56fd15720a199274ea139a4054f606ebf6aba06c` passed. Node `v26.13.0`, Python `3.12.10`, Python dependency installation, CPU-only PyTorch `2.7.0+cpu`, and Python tests passed (`22 passed`, one Starlette/httpx deprecation warning). Node syntax checks passed. Initial Node suite reported 11 passed / 4 failed; activation stopped before REA installation, `.env` creation, server startup, or service activation. Report: `reports\\windows-activation-20261102-090025.json`.

**Repair qualification changes committed after that attempt:** stale tests were aligned with the current VPN fail-closed defaults and exact REA allowlist error; disabled-integration fixtures now disable every integration explicitly; the NetBird connect test now begins disconnected. Platform lifecycle reports `idle` when no integration is enabled. A new test asserts that NetBird startup only reads status and never issues `up`. Platform activation no longer attempts a VPN connection automatically. These changes preserve the VPN/exit-node gate and do not disable it.

**Expected on rerun:** prerequisite, compute, Node, REA package and configuration steps PASS; Python tests should remain `22 passed`; Node suite should pass after the targeted test/code corrections. Platform API returns the Fun Industrial identity; dashboard opens locally. Final report should be `READY` or `READY_WITH_ACTIONS_REQUIRED`. A warning for missing exit-node route, optional local model, or empty REA allowlist is not a full-ready result. `FAILED` means stop and preserve report/logs.

## Stage 3 — Verify local dashboard, ownership and VPN gate (read-only)

```powershell
Set-Location C:\Users\alxar\FunIndustrial; $ErrorActionPreference='Stop'; $s=Invoke-RestMethod http://127.0.0.1:8787/api/status -TimeoutSec 10; if($s.application -ne 'Fun Industrial Platform'){throw 'Unexpected application identity.'}; $c=Get-NetTCPConnection -State Listen -LocalPort 8787,8790 -ErrorAction SilentlyContinue; $c | ForEach-Object { $p=Get-CimInstance Win32_Process -Filter ("ProcessId="+$_.OwningProcess); [pscustomobject]@{Port=$_.LocalPort;Address=$_.LocalAddress;PID=$_.OwningProcess;CommandLine=$p.CommandLine} }; $ai=Invoke-RestMethod http://127.0.0.1:8787/api/ai/status -TimeoutSec 10; $tools=Invoke-RestMethod http://127.0.0.1:8787/api/ai/tools -TimeoutSec 10; Write-Host "LIFECYCLE=$($s.lifecycle)"; Write-Host "VPN_STATE=$($s.vpn_policy.state)"; Write-Host "VPN_DETAIL=$($s.vpn_policy.detail)"; Write-Host "AI_STATE=$($ai.state)"; Write-Host "BUILTIN_TOOL_COUNT=$($tools.local_tool_count)"; Write-Host "REA_TOOL_COUNT=$($tools.rea_tool_count)"
```

**Expected:** listeners only on loopback; port 8787 owned by this checkout's Node server; compute port 8790 appears only if compute service started. Built-in tool registry should be populated. VPN state must be `connected` with the required default route before AI/compute/REA operations can be considered enabled. Do not manually call tool endpoints while blocked.

## Stage 4 — Optional local model installation and integrated chat

The base activation does not download model weights or llama.cpp. Follow the exact release/hash instructions in `docs/WINDOWS_QUALIFICATION.md`. Use an official Windows x64 **CPU** llama.cpp archive and independently verify its release SHA-256. Never paste a placeholder hash.

After obtaining the verified archive, run the documented sequence, replacing only the archive filename and official SHA-256:

```powershell
Set-Location C:\Users\alxar\FunIndustrial; .\scripts\Install-LlamaCpp.ps1 -ArchivePath "$HOME\Downloads\llama-cpp-windows-x64-cpu.zip" -ExpectedSha256 "PASTE_OFFICIAL_RELEASE_SHA256"; if($LASTEXITCODE -ne 0){throw 'llama.cpp verification failed; stop.'}; .\scripts\Download-QwenModel.ps1; if($LASTEXITCODE -ne 0){throw 'Model download/hash verification failed; stop.'}; $exe=Get-ChildItem .\.runtime\llama.cpp -Recurse -File -Filter llama-server.exe | Select-Object -First 1 -ExpandProperty FullName; if(-not $exe){throw 'Verified llama-server.exe not found.'}; .\scripts\Configure-LocalModel.ps1 -LlamaServerPath $exe -ModelPath "$PWD\.runtime\models\Qwen3-4B-Q4_K_M.gguf" -Threads 4 -Context 4096; if($LASTEXITCODE -ne 0){throw 'Local model configuration failed.'}; .\scripts\Activate-FunIndustrial.ps1 -SkipNetBirdInstall -SkipNetBirdLogin; if($LASTEXITCODE -ne 0){throw 'Model-integrated activation failed; preserve evidence.'}
```

**Expected:** archive verification passes; pinned model file hash passes; local model reports ready after second activation. If the host lacks sufficient memory/speed, do not increase context or threads blindly. Keep CPU-only configuration; no GPU acceleration is claimed.

## Stage 5 — Run full qualification and preserve evidence

```powershell
Set-Location C:\Users\alxar\FunIndustrial; .\scripts\Qualify-FunIndustrial.ps1; if($LASTEXITCODE -ne 0){throw 'QUALIFICATION_FAILED: preserve qualification JSON and all logs; do not proceed to remote access.'}; Get-ChildItem .\reports -File | Sort-Object LastWriteTime -Descending | Select-Object -First 12 Name,Length,LastWriteTime
```

**Expected:** `QUALIFICATION_FINAL=PASS` only when all required checks pass. `PASS_WITH_ACTIONS_REQUIRED` is an honest partial result when optional model, exit-node route, REA allowlist or Ghidra is not ready. `FAILED` blocks advancement. The report must state `sample_execution_performed=false`; malware samples are never executed.

REA starts deny-by-default. Review MCP tool names/schemas and side effects before allowlisting exact read-only tools. Only then use the documented `Set-REAAllowlist.ps1 -ToolNames ...` command and rerun activation/qualification. Do not allowlist write-capable or broad filesystem/network tools by default.

## Stage 6 — Persistence/recovery and remote Safari gate

This stage is **not yet executable as a single approved install command** because the HTTPS gateway/supervisor files were absent in the supplied host inventory. First retain the local-only app and qualify restart behavior without exposing it:

```powershell
Set-Location C:\Users\alxar\FunIndustrial; $ErrorActionPreference='Stop'; $before=Invoke-RestMethod http://127.0.0.1:8787/api/status -TimeoutSec 10; $pid=(Get-NetTCPConnection -State Listen -LocalPort 8787 -ErrorAction Stop | Select-Object -First 1 -ExpandProperty OwningProcess); $proc=Get-CimInstance Win32_Process -Filter ("ProcessId="+$pid); if(-not $proc.CommandLine.Contains((Join-Path $PWD 'src\server.mjs'))){throw 'Process ownership not proven; no restart.'}; Invoke-RestMethod http://127.0.0.1:8787/api/shutdown -Method Post -ContentType 'application/json' -Body '{}' -TimeoutSec 10 | Out-Null; Start-Sleep 3; if(Get-NetTCPConnection -State Listen -LocalPort 8787 -ErrorAction SilentlyContinue){throw 'Port 8787 did not release; inspect process before proceeding.'}; $log=Join-Path $PWD 'reports\manual-restart.log'; Start-Process node.exe -ArgumentList (Join-Path $PWD 'src\server.mjs') -WorkingDirectory $PWD -RedirectStandardOutput $log -RedirectStandardError ($log+'.err') -WindowStyle Hidden; Start-Sleep 3; $after=Invoke-RestMethod http://127.0.0.1:8787/api/status -TimeoutSec 10; if($after.application -ne 'Fun Industrial Platform'){throw 'Restart health check failed.'}; Write-Host "MANUAL_RESTART=PASS"; Write-Host "OLD_LIFECYCLE=$($before.lifecycle)"; Write-Host "NEW_LIFECYCLE=$($after.lifecycle)"; Write-Host "RESTART_LOG=$log"
```

**Expected:** `MANUAL_RESTART=PASS`, service identity correct, logs written under reports. This is a manual process restart test, **not** a reboot-persistence test. Do not create a scheduled task until its exact command, user-session behavior, bounded restart policy, ownership checks and removal path are reviewed and tested.

### Safari/HTTPS remains blocked pending gateway work

Before Safari can reach Fun Industrial through NetBird, implement and review a separate gateway that:
- listens only on the Windows NetBird IPv4 `100.109.4.20`;
- allows only the enrolled iPhone peer `100.109.87.100`;
- terminates HTTPS with a certificate trusted by iOS for the exact DNS name;
- proxies only to `127.0.0.1:8787`;
- rejects unexpected Host/Origin values and request targets;
- uses authenticated access and bounded request sizes/timeouts;
- has an independently supervised process, PID/state/log evidence and a tested uninstall/rollback;
- is verified from Safari while NetBird is active and Tailscale is disconnected;
- is reboot/recovery tested before being called persistent.

Do not create firewall rules or expose port 8787 directly. NetBird transport being encrypted does not itself provide a trusted HTTPS certificate or a browser-facing gateway. Also, NetBird peer connectivity does not prove whole-device kill-switch, IPv6 or DNS no-leak behavior.

## Rollback

Use the repository's removal script only after reviewing its target paths. Default invocation removes repository-private runtime data and retains source; it does not uninstall system prerequisites by default:

```powershell
Set-Location C:\Users\alxar\FunIndustrial; .\scripts\Remove-FunIndustrial.ps1 -WhatIf
```

Review the WhatIf output before any actual removal. Do not use `-RemoveOwnedPrerequisites` or `-DeleteRepository` unless intentionally requested and the ownership manifest has been inspected. This project remains independent of Elektron.

## Evidence to return

After each stage, return the complete output including:
- stage marker and exit code;
- current branch and HEAD;
- report/log paths and contents of relevant final-state fields;
- listener address/port/PID/command line;
- NetBird VPN policy state and exact route detail (do not share private keys or setup keys).

Never commit `.env`, private keys, setup keys, model weights, local reports containing secrets, or runtime artifacts. Summarize qualification outcomes in a sanitized GitHub evidence document/commit.
