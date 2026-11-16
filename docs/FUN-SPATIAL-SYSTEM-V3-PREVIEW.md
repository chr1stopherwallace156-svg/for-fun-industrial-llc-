# Fun Industrial Spatial System V3 — Preview 1

Standalone **read-only** preview on Windows loopback port 8807. The running V2 port 8802, private iPhone voice gateway on 8443, local Qwen/Cognee, ML, REA, other services, schedules, and Elektron are NOT restarted, replaced, or redirected.

## Design

- Open-source rendering: `3d-force-graph@1.80.2` by Vasco Asturiano (MIT), based on Three.js. Installed separately under the operator's LOCALAPPDATA, never downloaded from a third-party browser CDN at runtime. Exactly the 1.80.2 package version is requested. Transitive dependencies remain npm-resolved at install time; this preview does not claim a fully integrity-locked dependency graph.
- Real topology: central core, AI/memory, Tools/REA, compute/ML, business intelligence, voice, and security. Nodes and descriptions are a **curated map**, not an automatic discovery of every PC process.
- Status: 10 predefined local GET endpoints; short timeouts; 64 KiB caps each. No model prompts, REA calls, writes, network research, autonomous polling, or system process changes.
- Render: rotate, pinch/scroll zoom, node selection, camera focus, inspector, 2D SVG fallback, accessible node list, reduced-motion preference, mobile DPR budget.
- Unverified is the default. A green node means one specifically checked status contract answered; NOT customer revenue, open bids, tool permission, or successful business operation.

## Activation

Use the separate feature branch `feature/spatial-system-v3-preview-20261115`.
Clone it into a NEW folder and run `Start-Fun-Spatial-V3-Preview.ps1` with Windows PowerShell. The script validates the git identity, clean tree, local Node syntax and tests; acquires just this preview's own published npm dependency; confirms the bundle is present, and starts only the unused 127.0.0.1:8807 listener. Existing 8807 processes are adopted only after owner / HTTP identity checks. No blanket taskkill and no alteration of your existing checkout.

PC: `http://127.0.0.1:8807/`.

On iPhone, the existing HTTPS voice gateway on `100.109.4.20:8443` is STILL connected to 8789 and cannot serve this preview. For a temporary private test, use an authenticated Termius **Local** SSH forward from iPhone port **18807** to PC `127.0.0.1:8807`; then visit `http://127.0.0.1:18807/` in iPhone Safari while the tunnel is active. A persistent, authenticated iPhone path is a separate subsequent deployment and requires explicit gateway review and testing.

The existing 8802 V2 dashboard remains the fallback. No production home page is replaced in this milestone.

## Verification

`node --test intelligence-checks/spatial-system-v3-preview-case.mjs`

The `GET /api/spatial-v3/topology` endpoint returns the complete static, unverified topology without reaching other services. `GET /api/spatial-v3/status` reads fixed local health endpoints once, with no writes or automatic refresh.

Security: loopback bind, fixed Host allowlist for PC and the specific local SSH-forward address, deny all POST and other methods, fixed asset paths and CSP. The iPhone/private gateway cannot be inferred healthy from localhost-only observations.

## Next qualification

1. Verify interactive 3D on the Windows PC and touch/fallback on iPhone Safari.
2. Review exact provenance and what statuses truly mean, then add additional confirmed relationships.
3. Separately implement authenticated HTTPS routing for the preview using the existing NetBird iPhone peer restriction without breaking 8789 voice or changing REA/tool authority.
4. Promote to V2 UI only with operator approval after visual acceptance and rollback test.
