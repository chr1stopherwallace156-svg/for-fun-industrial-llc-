# V10 read-only vehicle workspace

Separate local service for Fun Industrial only; does not touch or restart existing dashboard, AI, REA, compute, or Elektron. Uses V9 vehicle registry and graph.

## Run
From V10 checkout: `node --test test/vehicle-workspace-v10.test.mjs` and `node src/vehicle-library/workspace-v10.mjs`; open `http://127.0.0.1:8798`.

## Features
- Read-only configuration explorer for F-450, F-550, E-450, year 2026.
- Graph SVG of vehicle/configuration/source/artifact relationships.
- Artifact download by registered hash, not user-supplied filesystem path.
- No source files exposed via browser until a separate safe source-preview implementation.
- Dedicated loopback listener port 8798; no existing dashboard files patched.
- No 3D viewer yet: STEP/FCStd remains accessible through FreeCAD. Future preview requires verified GLB conversion and local Three.js integration.
- No CAD generation, AI recall, OCR, manufacturer data extraction, wiring authoring or engineering approval.
- No operator actions or mutations through HTTP. Graph JSON is refreshed from registry on GET.
- The server is a separate opt-in process; terminate it independently when desired.
