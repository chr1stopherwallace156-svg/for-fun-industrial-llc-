# Fun Industrial — Platform Activate controls Autonomy V2

## Fix

Previously, `Platform Control > Activate services` called `POST /api/activate` which only ran `platform.start()`. The autonomous Sidequest coordinator stayed down if its local process had stopped or the PC had restarted, and the Autonomy tab reported it as unavailable.

This change adds an idempotent local activator to the **same backend endpoint** and surfaces its current state in `GET /api/status`:

- **Running**: return the existing worker PID; do not launch a duplicate.
- **Unavailable**: launch only the fixed, locally installed `Start.ps1` from `%LOCALAPPDATA%\FunIndustrial\AutonomyLab\autonomy-v2-github`, then verify the worker's loopback health and identity.
- **Not installed or launch failed**: report an explicit `autonomy.state=unavailable` and reason, without claiming the overall activation succeeded.
- On the existing dashboard, **Activate** refreshes the platform service list and the **Autonomy** tab immediately afterward.

The worker remains a separate local background service internally on 8792; **the only user-facing dashboard stays on 8789**.

## Deploy on your existing Windows installation

From the previously cloned GitHub feature branch, run:

```powershell
$d=Join-Path $env:USERPROFILE 'FunIndustrial-Autonomy-V2-GitHub'; git -C $d pull --ff-only; powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'autonomy-v2\Deploy-Platform-Activate.ps1')
```

Then in the main dashboard open the System section, use `Activate platform services`, and check the Autonomy tab. The browser confirms the action before the request.

## Verification

```powershell
$s=Invoke-RestMethod 'http://127.0.0.1:8789/api/status';$s.services|Where-Object id -eq 'autonomy'|Format-List
```

The deployment script runs six new activation tests and the local platform regression suite, backs up the live `src/server.mjs` and `public/index.html`, patches only the known route and button, and restarts only the 8789 dashboard Node host. It also attempts REA reconnection and rollback if verification fails.

**Caution:** activating the main platform still has the preexisting behavior of starting platform integrations (including AI and REA) according to the existing configuration. The new recovery code itself never executes REA tools, runs Aider, restarts Ollama or changes NetBird policy. `approved:true` is not sufficient for external tool authorization.
