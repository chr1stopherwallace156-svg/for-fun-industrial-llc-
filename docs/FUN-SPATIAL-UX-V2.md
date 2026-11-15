# Fun Industrial — Spatial UX V2 (local-only)

## What changed

Upgrades the already-running single-address `http://127.0.0.1:8802/` dashboard. **No additional user-facing port**, backend process, new model, streaming connection or external asset server is added.

The home page includes an original CSS-built layered orbital scene with a glass industrial interface, floating AI/OPS/ML/DATA chips and gradient hierarchy. Desktop pointers interact through **real vendored open-source VanillaTilt 1.8.1**, MIT licensed, from https://github.com/micku7zu/vanilla-tilt.js with the preserved original license. This visual is **Spline-style**, not a claimed Spline scene, not a Spline design project, and not React or a .splinecode asset. Its design does not imply Spline source licensing.

The same effect applies subtly to overview cards. The code initializes it **only for precise hover-capable pointer devices** when `prefers-reduced-motion` is not requested. Touch devices and users requesting reduced motion get a static, attractive layout. No canvas, WebGL, high-frame-rate loop, external CDN/fonts, trackers or API tokens are needed.

There is a new **Ctrl+K / Cmd+K keyboard command palette**. Type a module name (AI chat, tool approval, operations, fleet buyers, procurement, commercial fit, regulatory, commerce or machine learning), use arrows and Enter, or click the result. It only changes the existing URL hash. No fetch, REA call, mail or process action occurs from command search. Existing navigation, original tools, automatic Cognee contextual memory and operator approval remain intact.

## Localhost routes and security

- `GET /` returns the polished command center with version `fun-industrial-one-port-spatial-ux-v2`.
- `GET /api/oneport/style.css` and `GET /api/oneport/client.js` serve the new reviewed CSS and client from the existing port.
- `GET /api/oneport/vendor/vanilla-tilt.js` serves the pinned MIT VanillaTilt source on the **same origin**. The license is bundled in `src/ui/vendor/VANILLA-TILT-LICENSE.txt`. HTTP POST to this asset route remains blocked.
- Legacy Qwen, Tools/REA approval, Operations and ML routes use the exact same reviewed 8802 endpoint. They are mounted on demand, with no change to their authority rules.

### Controlled rollout and rollback

Use the reviewed **V1 one-port Windows checkout** as the rollback. The new `Deploy-Fun-Spatial-UX-V2.ps1` checks the exact previous branch, Git blob `89f94b83153e9a13af1d9690dcc9376e9db12e3e`, pinned vendor and license, Node 24/26 syntax, complete business regression tests, current four-trigger scheduler (still FIAL 5.14), Qwen/Cognee/ML health and all protected PIDs before touching any listener.

Only the verified current `8802` dashboard `node.exe` process may be stopped and replaced. If the new instance fails validation, the installer restores the **original V1 checkout and dashboard**, not Elektron or other processes. Existing ML, Cognee, REA, gateway, Qwen, and Elektron Ollama remain unchanged.

The operator entry script is `Activate-Fun-Spatial-UX-V2.ps1`. This is a one-time upgrade after the V1 one-port dashboard was confirmed running on the PC. It does not make new vendor commitments or automatically authorize any third-party tool execution.

## Windows deployment

Run in PowerShell as a single command:

```powershell
& {$ErrorActionPreference='Stop';$r=Join-Path $HOME 'FunIndustrial-SpatialUX-V2';$b='feature/fun-oneport-spatial-ux-v2-20261115';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r -PathType Container)){git.exe clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'SPATIAL_V2_CLONE_HOLD'}};$remote=(& git.exe -C $r remote get-url origin|Out-String).Trim();$current=(& git.exe -C $r branch --show-current|Out-String).Trim();if($remote -cne $u -or $current -cne $b){throw 'SPATIAL_V2_SOURCE_HOLD'};if(@(& git.exe -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'SPATIAL_V2_DIRTY_HOLD'};git.exe -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'SPATIAL_V2_UPDATE_HOLD'};& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $r 'Activate-Fun-Spatial-UX-V2.ps1');if($LASTEXITCODE -ne 0){throw 'SPATIAL_V2_ACTIVATION_HOLD'}}
```

Expected markers include `FIAL58_PRIMARY_DASHBOARD_TESTS=PASS`, `FUN_SPATIAL_UX_V2_DASHBOARD=PASS`, `FUN_SPATIAL_UX_V2=PASS`, `FUN_SPATIAL_OPEN_SOURCE_TILT=PINNED_MIT_LOCAL`, and `FUN_ONEPORT_ACTIVATION=PASS`. The user can then refresh `http://127.0.0.1:8802/`, optionally Ctrl+F5 to clear the old cached CSS.

## Verification boundaries

GitHub Windows Node 24 and Node 26 test qualification covers local asset safety, keyboard navigation source, reduced-motion source, exact local route, existing FIAL modules, and process protection scripts. It is **not** a direct observation of your browser, physical machine, screen, or actual GPU performance. The user's own terminal must confirm a successful guarded restart.

If your browser shows the old UI despite a successful terminal result, hard-refresh the one-port dashboard first. If an operation or tool is unexpectedly unavailable, check its service health rather than starting additional ports automatically.
