# Fun Industrial — Spatial System V3.1, Immersive iPhone Preview

## What changed
The architecture visualization is the entire screen. There is no external navigation, separate dashboard grid, iframe, or WebGL-dependent fallback. The iPhone Safari view uses touch-controlled Canvas2D perspective (rotate, pinch zoom, tap nodes), glow fibers forming a branching neural/spinal silhouette, expanded named subsystems, and slide-up context sheets. Controls are limited to view manipulation, node inspection, and manual read-only evidence refresh.

The organic graphic is **artistic architecture visualization**, not real-time brain imaging, neural activity, actual process telemetry, or evidence of system execution. A verified status ring is added only for a checked local status contract. Unverified remains default. No repeated polling, external actions, model calls, tool calls, executable tool route or network exposure.

Existing V2 port 8802, V3 port 8807, private voice HTTPS gateway 8443, Qwen 8088, ML 8801, executive schedules, REA permission policies and Elektron are untouched.

## PC activation
Clone branch `feature/spatial-system-v31-immersive-iphone-20261115` into a NEW clean folder and launch `Start-Fun-Spatial-V31-Immersive.ps1`. It validates branch/origin/clean checkout, syntax, tests, then adopts only its exact listener or starts 127.0.0.1:8808. It does not need npm/CDN. It does not restart services. It reports a HOLD if 8808 belongs to an unknown process.

PC: `http://127.0.0.1:8808/`.

## Temporary iPhone preview
In Termius on iPhone, create a **Local** SSH port forward from iPhone `127.0.0.1:18808` to Windows PC `127.0.0.1:8808`; open Safari `http://127.0.0.1:18808/` while the SSH tunnel remains connected. The gateway `https://100.109.4.20:8443` STILL points at the older 8789 service, so that URL is not this preview. A permanently authenticated HTTPS path is a separate reviewed milestone.

## Validation
`node --test intelligence-checks/spatial-system-v3-preview-case.mjs`

Read-only API:
- `GET /api/spatial-v3/topology` — named nodes and relationships with all nodes unverified.
- `GET /api/spatial-v3/status` — bounded local GET observations. The Qwen node additionally requires independent llama.cpp health `127.0.0.1:8088/health`, not only the dashboard adapter.

One known limitation: this is a **first interactive spatial shell**, not yet a complete replacement for every workflow. An inspector can navigate the named architecture in the full-screen visualization, but it cannot run Qwen chat, payments, REA, voice training, or business actions. Any future in-scene interactive controls will need individually reviewed authentication, approval and provenance contracts. Promotion to the default site should happen only after iPhone visual qualification and rollback verification.

## Mobile resource protection
Uses native Canvas2D projection, capped device pixel ratio, 24 fps mobile target, paused motion on reduced-motion devices, hidden-tab drawing suppression, manual-only evidence refresh. No third-party rendering library needs to load on iPhone.
