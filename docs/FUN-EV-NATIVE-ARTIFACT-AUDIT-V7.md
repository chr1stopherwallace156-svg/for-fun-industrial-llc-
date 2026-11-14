# Fun Industrial EV V7 — Native SVG/BOM independent structural audit

**Evidence input:** Owner's Windows V3 native renderer succeeded for `bench-4d5012c1`, resulting in `NATIVE_RENDERED_ENGINEERING_HOLD`. Manifest: 8747-byte SVG, 154-byte BOM TSV, valid SHA-256 hashes and exact pinned WireViz and Graphviz executable SHA-256. This is successful native *rendering*, but design and diagram meaning have not been independently checked.

## What V7 verifies (read-only)
- Rechecks V2 input SHA-256, V2 source file SHA-256 and lengths; native manifest hashes; native output SVG and BOM bytes, lengths and SHA-256, and V2-to-V3 manifest lineage.
- For the recorded owner project `bench-4d5012c1`, checks the **published actual native output digests** (SVG `fbb8bbff9cbfca2f5c19fc04c965623caa35af728802d3627aa8a77b9479afca`, BOM `cb23ceea14fc9288a56a512ac9fa64e9f1f42101425989c139461bf4c28f96f4`), the verified native executable hashes and the original V2 manifest SHA-256.
- Independently reconstructs the intended **bounded V2 WireViz YAML** from the input and refuses different pin wiring, unsupported extra fields or changed components.
- Checks every pinout CSV row, including sequential X1 pin → W1 conductor → X2 pin and expected color.
- Scans rendered SVG for expected connector/cable titles and pin labels, and rejects scripts, event handlers, and obvious external references. This is **text/structure evidence**, not human visual inspection or SVG sandboxing.
- Parses the native BOM TSV and reconciles its explicit connector designators and conductor cable quantity/length with V2 input. Supports a single merged connector BOM row or separate connector rows.
- Produces a *JSON report on stdout only*. Does not write any evidence file, start any tool, access other projects, install packages, open browsers or change Windows services.
- All statuses remain ENGINEERING_HOLD, approval false, production release false. Electrical continuity, measured geometry, physical wiring and independent visual review remain pending.

## Windows command
```powershell
node --test test/ev-native-artifact-audit-v7.test.mjs
.\Run-Fun-EV-Native-Audit-V7.ps1 -ProjectId bench-4d5012c1
```
The native audit runs on the existing `%LOCALAPPDATA%\FunIndustrial\EVEngineering\Prototypes\bench-4d5012c1` evidence. It requires no network or application installation and does not change that directory.

## Qualification ceiling
Even a V7 PASS means *file integrity, specific pin/connector labels and BOM fields are consistent*, NOT complete schematic semantic equivalence or independent electrical design qualification. A malicious or inaccurate renderer could draw the wrong connections while printing correct labels; independent graphical review and electrical test remain necessary. Existing output evidence is preserved; no forced fix or rerender.

## Next stages
1. Manual visual review of SVG diagram against the pinout CSV and original YAML, signed by a qualified reviewer, then optional separate read-only evidence receipt.
2. Native FreeCAD and QElectroTech installation/qualification, if the operator independently approves, with low idle resource impact.
3. Only then consider a Fun Industrial dashboard integration, without restarting existing services or granting REA write/tool authority.

This repository change is Fun Industrial only. No cross-project imports, process inspection, or modifications.
