# Fun Industrial - ML Unified Dashboard V3

## What it does

Single integrated dashboard on http://127.0.0.1:8802/

The control center at / reuses your existing, running 8789 original dashboard.
Unified Qwen Chat at /unified/ reuses your existing, running 8798 chat.
Both pages have the new scikit-learn V2 task panel with verified data validation and a same-origin bridge to the running 8801 ML service.

No existing dashboard service, 8443 HTTPS gateway, Qwen, REA, Elektron, Python installation or dashboard source is replaced or restarted. Model training requires separate explicit user consent. Deal prices in the example are synthetic, not sourced market data.

The new panel does not automatically appear at your old addresses 8789, 8798 or the existing HTTPS iPhone URL. It is displayed through the merged 8802 hub. The existing 8443 gateway still goes to 8789; re-pointing it requires a separately approved gateway change and controlled restart.

## Windows Termius launch in one PowerShell command

$r=Join-Path $HOME 'FunIndustrial-MLHub-V3';$b='feature/fun-ml-unified-dashboard-v3-20261113';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path $r)){git clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'HUB_CLONE_FAILED'}};if((git -C $r remote get-url origin) -ne $u -or (git -C $r branch --show-current) -ne $b){throw 'HUB_SOURCE_MISMATCH'};if(@(git -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'HUB_LOCAL_CHANGES_REQUIRE_REVIEW'};git -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'HUB_UPDATE_FAILED'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Start-Fun-ML-Dashboard-V3.ps1');if($LASTEXITCODE -ne 0){throw 'HUB_START_FAILED'}

## Expected result

FUN_ML_DASHBOARD_V3=PASS
FUN_ML_INTEGRATED_CONTROL_CENTER=http://127.0.0.1:8802/
FUN_ML_INTEGRATED_QWEN_CHAT=http://127.0.0.1:8802/unified/

## Access from iPhone

Use Termius SSH local port forwarding:
- local iPhone port: 8802
- remote Windows destination host: 127.0.0.1
- remote Windows destination port: 8802

Then open Safari at http://127.0.0.1:8802/ (with the SSH tunnel connected). The HTTP page is accessed through the authenticated SSH tunnel, not through public network exposure.

## Security and operational boundaries

- Hub listens on loopback 127.0.0.1:8802 only.
- GET status and dashboard pages never perform ML computation.
- ML POST requires an operator click and same-origin, strict typed JSON data, and verified Python result from V2.
- Training writes a local JSON model only when user approval is provided.
- REA execution approvals remain unchanged; the ML bridge cannot run REA tools or shell.
- Qwen explains verified ML output, not account creation or purchases.
- Preflight validates the parent and unified dashboards, the existing scikit V2 service, Node source and offline unit tests.
- No process restarts are attempted. If required services are unavailable the script stops with a HOLD result.
- The hub forwards only existing dashboard API routes to fixed local ports; requests larger than 12 MiB are refused.
- Original iPhone voice upload through the existing gateway is unchanged; larger uploads may need the original gateway.
- It is not a Shopify live connector or continuously running e-commerce agent; those are separate development milestones.
