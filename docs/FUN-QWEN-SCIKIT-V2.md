# Fun Industrial: Qwen + scikit-learn V2

## Capabilities

New isolated local ML interface on 127.0.0.1:8801. Does not replace or restart dashboard 8789/8798, REA 8797, llama.cpp 8088, compute 8791, or Elektron.

The interface automatically routes **validated** user tasks to the previously installed scikit-learn Python bridge:
- Analyze 8–250 supplied deals, estimate profit, flag unusual prices.
- Train a sales model on 16–1000 chronological rows with explicit operator approval. Saves a local, inspectable JSON model.
- Predict sales from 1–100 candidates using that trained model.
- Ask local Qwen to explain the verified computation. If Qwen is offline, return the ML computation without inventing an explanation.

This is a separate local task interface, NOT automatically part of the existing 8798 chat UI and NOT a continuous Shopify autonomous worker. It does not browse, purchase, publish, or use REA.

## One command from Termius PowerShell

Use a new checkout, leaving other running working trees unchanged. Paste:

    $r=Join-Path $HOME 'FunIndustrial-QwenML-V2';$b='feature/fun-scikit-qwen-bridge-v2-20261113';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path $r)){git clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'GIT_CLONE_FAILED'}};if((git -C $r remote get-url origin) -ne $u -or (git -C $r branch --show-current) -ne $b){throw 'SOURCE_IDENTITY_MISMATCH'};if(@(git -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'DIRTY_WORKTREE'};git -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'GIT_UPDATE_FAILED'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Start-Fun-Qwen-ML-V2.ps1');if($LASTEXITCODE -ne 0){throw 'FUN_QWEN_ML_INSTALL_HOLD'}

Launcher performs Node syntax checks, offline tests, and Python health. It starts a new 8801 listener only if preflight passes. Existing healthy 8801 process is adopted without restart. It never alters other running services. If verification fails, the script refuses startup and displays a HOLD error.

Success message: FUN_QWEN_ML_V2_START=PASS

## Access

Windows browser: http://127.0.0.1:8801/

iPhone via Termius: create local TCP forwarding from iPhone port 8801 to Windows 127.0.0.1:8801, then open http://127.0.0.1:8801/ in Safari. Existing HTTPS gateway 8443 is not modified and does not automatically expose the new tool.

Initial page has synthetic deal observations only. Real research and Shopify integration are separate next steps.

## API

- GET /api/ml/status: read only.
- POST /api/ml/run: requires exact same-origin Origin and x-fi-ml: operator-click header, JSON object with prompt, data, and optional operatorConfirmed.
- Data must contain exactly one of deals, history, or candidates, with exact allowed fields of the verified Python bridge.
- Training requires operatorConfirmed=true, because it may overwrite the local sales-model JSON file.

## Limits and model authority

- Single active ML task; Python maximum 60 seconds.
- Bounded JSON input and output; maximum two BLAS/OpenMP threads in Python.
- No arbitrary Python, shell, REA, purchases, supplier account creation, Shopify changes, or permanent scheduling.
- Qwen only receives concise, clearly untrusted evidence for explanation and cannot execute tools.
- Existing REA tool permissions and Elektron processes are unchanged.
