# FIAL 5.3 — Corrected Cognee–Qwen chat inside the primary Fun Industrial dashboard

## What changes

- Consolidates the **live-verified** FIAL5.2 grounded Qwen-and-Cognee chat into the **existing integrated dashboard port 8802**, at `/unified/?view=chat`.
- The Qwen Chat navigation item now shows a new built-in conversation panel. It sends one local model request per operator click to Qwen on 8088 with read-only contextual Cognee recall from 8789.
- The original unified 8798 conversation and tool-review DOM remains in the source. Its buttons, handlers, allowlists, REA approval and staged binary inspections are preserved in the **Tools & Review** view.
- Existing commerce, Google Trends, Shopify, ML, FIAL4, original dashboard, status and legacy API paths remain available.
- This upgrade is NOT a rewrite of the original 8789 chat API: that protected endpoint remains unchanged and may retain the prior misleading placeholder. The primary 8802 Qwen Chat view no longer relies on it for ordinary chat.
- Neither FIAL5.2 port 8806 nor REA port 8797 is required for chat: the model and Cognee recall run through their already existing local services.
- Memory is read-only. An empty model reply is reported as empty or an explicitly labeled unverified memory excerpt, not fabricated as an actual tool proposal or a Qwen answer.

## Deployment contract

Use `Deploy-Fun-FIAL53-PrimaryDashboard.ps1 -VerifyLive` from a fresh clean checkout of branch `feature/fial5-3-primary-dashboard-grounded-chat-20261114`. A previous clean checkout of `feature/fun-ml-unified-dashboard-v3-20261113` in `$HOME\FunIndustrial-MLHub-V3` is required as a trusted rollback source.

The deployment checks repo identity and pinned previous source bytes, runs focused Windows tests before mutations, requires healthy 8088 Qwen, read-only Cognee 8789, unified tool service 8798, and ML 8801, then verifies the current 8802 owner. It replaces **only** the original 8802 Node process with a separately staged runner from the new checkout. It checks both HTML pages, chat/commerce/ML/status endpoints, legacy controls, same-origin chat and REA authority policy. `-VerifyLive` authorizes one live Qwen memory-grounded question. If validation fails after replacement, the script stops its own new 8802 child and restarts the exact pinned old dashboard from its untouched checkout, then verifies rollback health.

Healthy services on other ports, notably **11434 Elektron Ollama, 8088 Qwen, 8789, 8791, 8796, 8797, 8798, 8801, 8803, 8804, 8805, 8806, 8443**, are not stopped, started or modified by this deployment.

## One-line PowerShell

```powershell
$r=Join-Path $HOME 'FunIndustrial-FIAL53-PrimaryHub';$b='feature/fial5-3-primary-dashboard-grounded-chat-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r)){git.exe clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL53_CLONE_HOLD'}};if((git.exe -C $r remote get-url origin) -cne $u -or (git.exe -C $r branch --show-current) -cne $b){throw 'FIAL53_SOURCE_IDENTITY_HOLD'};if(@(git.exe -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL53_LOCAL_CHANGES_HOLD'};git.exe -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL53_UPDATE_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Deploy-Fun-FIAL53-PrimaryDashboard.ps1') -VerifyLive;if($LASTEXITCODE -ne 0){throw 'FIAL53_PRIMARY_DEPLOYMENT_HOLD'}
```

Expected if live qualification passes:

```
FIAL53_PRIMARY_DASHBOARD_TESTS=PASS
FIAL53_STARTING_CONTROLLED_8802_HANDOFF=TRUE
FIAL53_UPGRADED_PRIMARY_8802_PID=...
FIAL53_LIVE_STATE=ANSWERED_BY_QWEN
FIAL53_MEMORY_STATE=included EXCERPTS=1
FIAL53_PRIMARY_CHAT_LIVE_QUALITY=PASS
FIAL53_PRIMARY_DASHBOARD_CONSOLIDATION=PASS
FIAL53_TOOLS_AND_REA_APPROVAL_UI=PRESERVED
FIAL53_OTHER_SERVICES_RESTARTED=0 ELEKTRON=UNTOUCHED
```

Afterward open `http://127.0.0.1:8802/unified/?view=chat` from the PC, or access port 8802 via your existing authenticated iPhone Termius local port forward.

## Boundaries

This is a controlled replacement of **only the 8802 dashboard Node process**, not a restart of other workers. The user's prior dashboard checkout is not edited and remains the rollback source. CI tests qualify source code and startup safety checks, **not** the live Windows process handoff. Only the explicit operator-run command and its Windows output can confirm full deployment.