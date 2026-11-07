# One interface: Fun Industrial 8789 + private Autonomy 8792

The original 8792 listener is now **a private loopback worker backend**, not a second interface the operator must use. The proposed integrated UI is served by the existing Fun Industrial dashboard on `127.0.0.1:8789`.

## Deploy to the existing Windows checkout

From the cloned branch `%USERPROFILE%\FunIndustrial-Autonomy-V2-GitHub`:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\autonomy-v2\Deploy-8789.ps1
```

`Deploy-8789.ps1` does all of the following:

- Verifies the 8789 Node dashboard, unified agent, live 229 REA tool registry, and 8792 worker backend before changing source.
- Backs up the current `src/server.mjs` and `public/index.html`.
- Adds a read-only same-origin bridge `/api/autonomy/*` and an **Autonomy** view in the existing navigation, preserving existing routes and the live UI.
- Checks server and inline JavaScript syntax, and runs the existing Node regression tests before restart.
- Briefly restarts **only** the 8789 dashboard Node host and reinitializes its REA MCP child. Does **not** stop the independent Qwen/llama.cpp, compute engine, NetBird or Ollama.
- Validates the new 8789 route, new tab, unified agent, and complete 229-tool REA registry.
- On deployment failure, restores backed-up files and attempts recovery of the old dashboard and REA connection.

Open **http://127.0.0.1:8789/** and select **Autonomy**. All user-facing data requests remain on port 8789; 8792 is a private loopback-only service.

The installation is intentionally not unattended: the operator must run this script, allowing the temporary dashboard/REA reconnection. If the guard detects unexpected live changes or tests fail, the deployment stops without a forced overwrite. This module is read-only with respect to REA: it does not authorize or call REA tools automatically.

## Verification

```powershell
Invoke-RestMethod http://127.0.0.1:8789/api/autonomy/status
```

The existing dashboard must display the **Autonomy** tab after a refresh. If deployment fails, examine the backup path in its output before making further changes.
