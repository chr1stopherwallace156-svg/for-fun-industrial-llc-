# Fun Industrial — One Localhost Dashboard V1

## What changed

A cleaner, cohesive **single user-facing web address** is now the default:
**http://127.0.0.1:8802/**

The home screen has a persistent workspace sidebar, unified overview, source-grounded health indicators, and these functional sections in one page:

- Overview and live read-only service health
- Local AI Chat with Qwen and automatic Cognee memory
- Tools & REA review, preserving approval boundaries
- Operations and executive business queue
- Fleet Buyers, Procurement, Commercial Fit and Regulatory research
- Commerce trends and Shopify research
- Machine Learning
- Original Workspace for backward compatibility

Switching sections is single-page navigation, using URL hashes such as `#chat` or `#procurement`. Each feature opens inside a **same-origin localhost iframe on port 8802**, not in another browser tab or at another user-facing port. Original functionality and event handlers stay mounted within compatible internal pages.

**Important architectural distinction:** this consolidates the *UI and public browser entry point*, not every backend service into one process. The original Qwen, REA, compute, ML, Cognee and gateway listeners retain their private loopback ports as internal dependencies. The dashboard's existing same-port APIs and the inspected fixed-loopback proxy provide the integration. A genuine one-process merger would introduce risk and is not required for one dashboard.

The default page is new. Backward-compatible same-port routes remain:
- `/unified/?view=chat`, `/unified/?view=tools`
- `/operations/`
- `/workspace/?view=workspace`, `/workspace/?view=ml`, `/workspace/?view=commerce`
- Existing `/api/operator/*`, `/api/fial/*`, `/api/unified/*`, `/api/ml/*`, `/api/commerce/*`.

The UI uses self-contained CSS, responsive sidebar and a restrained dark/teal palette; no external fonts, third-party scripts, internet image dependencies, synthetic business data or telemetry. iPhone-compatible navigation and reduced-motion handling are included.

## Boundaries

Only port **8802** is permitted to restart or be replaced. The exact FIAL5.14 dashboard process must match the pinned reviewed source and running PID. The existing Windows task's four daily triggers remain unchanged; the installer cannot add, remove, replace or run those tasks. Qwen 8088, Cognee 8789, ML 8801, REA, gateway, and Elektron Ollama 11434 are protected and are not stopped.

The previous FIAL5.14 source checkout is retained for tested **8802 rollback** if the new process fails. If an unrelated or modified 8802 owner is detected, the deployment HOLDS and does not kill it. The upgrade probes earlier operations, executive work, fleet, commercial, bid, buyer, regulatory, commerce, ML and live Qwen quality before PASS.

Using the dashboard does not grant REA execution, send email, submit bids, create vendor accounts, initiate model training, file grants or spend money. Existing explicit one-use operator approval flows remain.

## One Windows PowerShell command

On the PC previously confirmed running FIAL5.14, paste the following **single command**:

```powershell
& {$ErrorActionPreference='Stop';$r=Join-Path $HOME 'FunIndustrial-OnePort-Dashboard';$b='feature/fun-one-port-dashboard-v1-20261115';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r -PathType Container)){git.exe clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'ONEPORT_CLONE_HOLD'}};$remote=(& git.exe -C $r remote get-url origin|Out-String).Trim();$current=(& git.exe -C $r branch --show-current|Out-String).Trim();if($remote -cne $u -or $current -cne $b){throw 'ONEPORT_SOURCE_IDENTITY_HOLD'};if(@(& git.exe -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'ONEPORT_DIRTY_WORKTREE_HOLD'};git.exe -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'ONEPORT_FAST_FORWARD_HOLD'};& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $r 'Activate-Fun-OnePort-Dashboard-V1.ps1');if($LASTEXITCODE -ne 0){throw 'ONEPORT_ACTIVATION_HOLD'}}
```

Expected terminal markers:

```
FIAL58_PRIMARY_DASHBOARD_TESTS=PASS
FIAL58_STARTING_CONTROLLED_8802_HANDOFF=TRUE
FIAL58_UPGRADED_PRIMARY_8802_PID=...
FIAL58_PRIMARY_CHAT_LIVE_QUALITY=PASS
FUN_ONEPORT_PRIMARY_DASHBOARD=PASS
FUN_ONEPORT_DASHBOARD=http://127.0.0.1:8802/
FUN_ONEPORT_USER_FACING_PORTS=1
FUN_ONEPORT_MODULES=CHAT_TOOLS_OPERATIONS_FLEET_PROCUREMENT_COMMERCE_ML
FUN_ONEPORT_SCHEDULE_TRIGGERS=4
FUN_ONEPORT_QWEN_TOOL_AUTHORITY=UNCHANGED
FUN_ONEPORT_ELEKTRON_AND_OTHER_SERVICES=UNTOUCHED
FUN_ONEPORT_ACTIVATION=PASS
```

No success is claimed until the user's own Windows PC prints `FUN_ONEPORT_ACTIVATION=PASS`. GitHub Windows CI tests code safety and compatibility but does not remotely control or restart the user's PC.

If the dashboard loads without the updated design due to browser cache, navigate explicitly to `http://127.0.0.1:8802/` and refresh. The status, actions and data are still grounded in the same existing local engines.
