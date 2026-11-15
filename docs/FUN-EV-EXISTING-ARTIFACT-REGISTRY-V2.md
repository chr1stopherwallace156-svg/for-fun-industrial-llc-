# EV existing artifact registry V2

Registers nine exact SHA-256-pinned files observed in the owner's successful reconciliation output: FreeCAD FCStd/STEP and source macro/manifest; WireViz SVG, BOM, YAML, pinout and native manifest. The files remain in place and are never copied, overwritten or regenerated. Missing/modified artifacts fail closed. Only explicit --out writes a new registry directly under %LOCALAPPDATA%/FunIndustrial, refusing conflicting existing output.

This is a bench artifact registry, not an engineering qualification: it does not execute FreeCAD, KiCad or WireViz; verify electrical schematics, full manifest semantics, OEM applicability, safety, purchasing or manufacturing. It registers mechanical_cad and harness_documentation contracts only, and does not mark any adapter as installed or engineering-approved.

Run `python src/ev-conversion/register-existing-v2.py --root %LOCALAPPDATA%/FunIndustrial --out %LOCALAPPDATA%/FunIndustrial/ev-artifact-registry-v2.json` using an appropriate Python 3.12 interpreter. Source tests are separate. The next step is actual artifact-to-contract adapter qualification and source provenance verification.
