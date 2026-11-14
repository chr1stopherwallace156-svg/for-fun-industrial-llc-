# Fun Industrial V3 — Native Tool Probe and Operator-Pinned WireViz Renderer

**Scope:** Fun Industrial only. No cross-project queries or changes. Native runtime is opt-in, not automatically installed. The V2 Windows test result is 12/12 PASS, including source file generation and manifest checks; V3 native execution must be qualified separately.

## Native V3 on Windows
The read-only probe checks a narrow set of usual locations:
- WireViz executable under %LOCALAPPDATA%\FunIndustrial\EVEngineering\Tools\WireViz\venv\Scripts\wireviz.exe
- Graphviz dot.exe in a Graphviz folder under Program Files
- FreeCAD.exe and QElectroTech.exe in their named Program Files folders

Run from a clean checkout:
\`\`\`powershell
.\Run-Fun-EV-Native-V3.ps1 -Action probe
node --test test/ev-native-v3.test.mjs
\`\`\`
CANDIDATES_UNQUALIFIED means an executable candidate was found and locally hashed, **not** that its version, publisher, license, dependencies or behavior are qualified. NOT_FOUND_IN_SCOPED_PATHS does not prove absence from the entire PC.

## Native harness render, only after trusted installations and approval
WireViz supports \`wireviz -f st -o <output-dir> -O bench-harness <file.yml>\`, producing SVG and BOM TSV. It uses Graphviz dot during SVG generation. Source: https://github.com/wireviz/WireViz/blob/master/src/wireviz/wv_cli.py and https://github.com/wireviz/WireViz/blob/master/docs/README.md.

V3 does **not install** tools. If the probe locates WireViz and Graphviz executables, separately verify their versions and provenance. An operator may then explicitly run:
\`\`\`powershell
.\Run-Fun-EV-Native-V3.ps1 -Action render -ProjectId bench-EXACTID -WireVizSha256 VERIFIED64HEX -DotSha256 VERIFIED64HEX
\`\`\`
The exact SHA-256 hex values must be copied from the real probe and independently approved. The renderer rechecks every V2 input and output hash, refuses repeated exports, creates a new Fun-only \`native-wireviz-v3\` directory, then calls **only** the approved WireViz executable with fixed arguments, no shell, a 30-second timeout and bounded output. Graphviz's pinned directory is the sole added rendering dependency on PATH. It checks the resulting SVG and BOM TSV against size and basic content constraints and produces a new manifest, while preserving explicit engineering HOLD status.

The probe does not create files, execute applications, invoke installers, query ports, or start any services. The render action creates only output files in the named Fun Industrial V2 concept project and starts only the approved native renderer and its Graphviz dependency.

## Installation plan (NOT performed by this branch)
For an operator-approved, isolated setup:
1. Review upstream license/dependency versions and choose a pinned WireViz release. The WireViz Python package is GPLv3; this does not automatically license any future combined distributed product.
2. Create a Python venv under FunIndustrial\EVEngineering\Tools\WireViz\venv and install the selected pinned package using reviewed wheel artifacts/hashes.
3. Install Graphviz through its official package (e.g., Windows package manager Graphviz.Graphviz) after inspecting the version and package signature; Graphviz is separate from the Python graphviz library.
4. Check versions and hashes, repeat the read-only probe, then explicitly authorize rendering a **synthetic unpowered bench harness** only.
5. Open the V2 FreeCAD macro manually in a separately verified FreeCAD GUI and measure the generated plate; V3 does not automatically open FreeCAD or create a reviewed CAD model.

Safety: The generated wiring is not approved electrical work, has no voltage specifications, and must not be connected to a vehicle or power source. No manufacturing, CAN writes or hardware control authority.

## Pending qualifications
- Run V3 tests on the actual Windows owner PC.
- Independently observe FreeCAD macro geometry and WireViz native renderer output.
- Verify latest tool licensing, provenance and the subprocess dependency chain.
- If a renderer attempts to access unexpected external paths or network, use an OS sandbox/security policy; this Node wrapper alone is not an operating-system sandbox.
