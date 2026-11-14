# Fun Industrial V9 — Vehicle configuration registry

Scope: Fun Industrial only. No Elektron access, processes, writes, or integration.

## Delivered
- Local immutable-by-hash source copies and manifest with original filename, SHA-256, import time and optional provenance URL.
- Separate 2026 Ford F-450, F-550, E-450 directories; configurable model year.
- Per-configuration registry with cab and wheelbase metadata, deliberately unverified until supported by evidence.
- CAD/wiring/component/simulation/evidence artifact association; graph JSON with vehicle→configuration→source/artifact edges.
- No model execution, network requests, CAD generation, background service, or automatic engineering approval.

## CLI (Node 22+, PowerShell)
Run from repository root. Each command is independently executable:
```powershell
node src/vehicle-library/cli-v9.mjs init
node src/vehicle-library/cli-v9.mjs register --vehicle F-450 --id F450-2026-001 --cab RegularCab
node src/vehicle-library/cli-v9.mjs import --vehicle F-450 --id F450-2026-001 --file 'C:\path\FordLayout.pdf' --url 'https://official-source.example/'
node src/vehicle-library/cli-v9.mjs attach --vehicle F-450 --id F450-2026-001 --kind CAD --file 'C:\path\model.step'
node src/vehicle-library/cli-v9.mjs graph --vehicle F-450
node src/vehicle-library/cli-v9.mjs inspect --vehicle F-450
node --test test/vehicle-library-v9.test.mjs
```
Replace placeholder paths and URLs with verified values. To attach specific source hashes use `--sources hash1,hash2`.

## Holds and limitations
- This is a registry and graph-data foundation, not an interactive 3D viewer, Ford-accurate 3D geometry, OCR, wiring editor, or graph-retrieval AI.
- No Ford documents were obtained or imported by this change.
- Do not use a generated conceptual CAD model for fabrication or safety-critical design without qualified engineering validation.
- Local library is outside Git and must be backed up independently.
- Graph JSON is rebuildable from the registry. File hashes identify content, not manufacturer authenticity.
- Imported content is untrusted. Avoid automatic execution of any attached file.
- Existing FreeCAD V8 and all unrelated runtimes remain untouched.

## Next integration
Expose read-only registry and graph endpoints in the existing dashboard after separate compatibility review; add a Three.js STEP-to-glTF visualization pipeline with verified geometry provenance and explicit operator controls; add Ford document page-level extraction and citations; add WireViz/QElectroTech file adapters.
