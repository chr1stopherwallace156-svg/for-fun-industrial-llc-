# Fun Industrial Autonomy V2

A **code-driven, local-first** Sidequest.js + SQLite background coordinator for Fun Industrial on Windows. Not an AI wrapper. Run its installer after cloning this branch; do **not** unpack a ZIP.

## One-command setup (from a cloned checkout)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\autonomy-v2\Install-And-Start.ps1
```

This stages the module to `%LOCALAPPDATA%\FunIndustrial\AutonomyLab\autonomy-v2`, runs tests, starts the independent read-only service on `http://127.0.0.1:8792/`, verifies health, and enables current-user login restart. It requires existing `sidequest` and `@sidequest/sqlite-backend` installed in the parent AutonomyLab. If missing, the installer installs those *only in AutonomyLab*, not in your live checkout.

## Milestones

1. Persistent SQLite job queue, schedules re-registered at startup, and Windows user-login launch.
2. Discovery → Analysis → Verification workers; findings enqueue immutable, deduplicated operator-review tasks.
3. REA registry polling and risk *triage*, without any REA tools/call or implied execution authorization.
4. Official GitHub release API monitoring of two electronics projects, plus *operator-entered* product snapshots and change detection. No CAPTCHA bypass or live retailer prices.
5. A separate read-only dashboard on `127.0.0.1:8792`. Existing unified dashboard is untouched; remote iPhone access would require a separately secured gateway.

## Safety and scope

No REA tool execution, Aider modifications, Qwen/Ollama restart, VPN change, app patch, firewall change, login secret, or broad network bind. Background work stops if Windows sleeps or is powered off. `approved:true` sent by another process is **not** an authority token. The only autonomous network research is the explicitly allowlisted GitHub release API (rate limits may apply).

Logs, research snapshots, queued jobs, and operator review tasks are saved under the staged module's `data` directory. `research-sources.json` and `products.json` are user-editable seed inputs. The risk triage is heuristic; "not flagged" is **not** an authorization classification.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\FunIndustrial\AutonomyLab\autonomy-v2\Status.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\FunIndustrial\AutonomyLab\autonomy-v2\Stop.ps1"
```

Stop.ps1 does not stop the pre-existing PID 5992 background monitor, REA, or the Fun Industrial dashboard. Login startup uses `HKCU\...\Run` and only runs after the Windows user signs in.
