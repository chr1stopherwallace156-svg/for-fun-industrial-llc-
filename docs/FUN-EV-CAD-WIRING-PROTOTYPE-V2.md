# Fun Industrial EV Engineering V2 — CAD and Harness Draft Artifacts

## Scope
Fun Industrial-only, source-staged. The first executable integration is a **file exporter**, not an installed CAD or harness engine, and never touches other systems. A human must explicitly invoke it. It performs no networking, application launches, installers, powertrain control, CAN writes, purchases, or live vehicle operations.

## Why a bench prototype
We have no independently verified vehicle, motor, enclosure, load-bearing or high-voltage specifications. This V2 generates a non-vehicle plate macro (FreeCAD) and an **unpowered, synthetic two-connector harness drawing** (WireViz), along with a CSV pinout and a SHA-256 manifest. Do not fabricate automotive hardware or energize wiring from these samples.

## Usage (PowerShell, from this V2 checkout)
\`\`\`powershell
.\Run-Fun-EV-Prototype-V2.ps1 -Action demo -ProjectId bench-demo-01
.\Run-Fun-EV-Prototype-V2.ps1 -Action inspect -ProjectId bench-demo-01
\`\`\`
The demo creates a fresh project in \`%LOCALAPPDATA%\FunIndustrial\EVEngineering\Prototypes\bench-demo-01\`. Existing names refuse overwrite. Alternatively run \`prepare\`, edit \`prototype.json\`, then \`export\`. Every output is immutable after first export; use another project id for a revised version. Optional \`FUN_EV_V2_ROOT\` is for controlled tests.

## Generated files
- \`prototype.json\`: user-editable dimensions, drilled hole centers and simple bench cable data; values are bounded, with geometric clearances and schema checks.
- \`output/bench-plate.FCMacro\`: **FreeCAD macro source**, creates geometry when a human opens it in a verified FreeCAD GUI. It does not automatically save or fabricate anything.
- \`output/bench-harness.yml\`: WireViz YAML patterned after its upstream \`examples/demo01.yml\` and \`demo02.yml\`. It is **not** an SVG/PNG schematic until independently processed by a qualified WireViz installation.
- \`output/bench-pinout.csv\`: conductor mapping with explicit NOT_ENGINEER_REVIEWED markers.
- \`output/manifest.json\`: SHA-256 input/output file evidence; retains engineering HOLD.

## Verification
\`\`\`powershell
node --test test/ev-prototype-v2.test.mjs
\`\`\`
Includes positive output tests, explicit changed-input demonstration, unsafe geometry and injection refusal, overwrite refusal, hash-tampering detection, and filesystem path hostility.

## Unmet gates
- Verify actual local FreeCAD and WireViz installation, identity, version and licenses. V1 PATH-only NOT_VERIFIED is not proof that packages are absent elsewhere.
- Run the FreeCAD macro in a *separate trusted sandbox* and inspect resulting geometry against a known mechanical oracle. Run WireViz YAML through a version-pinned WireViz tool and independently review the harness rendering. This V2 does not claim such native results.
- Only after native execution should an operator-approved resource-aware launcher be considered. No background service, port binding, dashboard/API registration, or autonomous execution included.
- For future true vehicle work, replace all synthetic inputs with verified measurements, qualified components and independent engineering review. Safety and regulatory release remain separate.

Sources: https://github.com/FreeCAD/FreeCAD ; https://github.com/wireviz/WireViz ; https://github.com/wireviz/WireViz/blob/master/examples/demo01.yml
