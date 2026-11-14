# Fun Industrial EV Engineering V6 — Native Graphviz

## Verified predecessor
The owner explicitly approved Fun Industrial V5 recovery. V5 receipt state `WIREVIZ_NATIVE_BINARY_INSTALLED_RENDER_NOT_QUALIFIED`: isolated Python 3.12 venv, WireViz 0.4.1, click 8.5.1, Python graphviz 0.21, Pillow 13.0.0 and PyYAML 6.0.3, pip check PASS, WireViz version PASS, signed-off wheel inventory and hashes. **The Python graphviz library is NOT the native `dot.exe` renderer.** Native SVG/BOM rendering remains unqualified. This V6 does not modify the working WireViz install.

## Commands
```powershell
.\Run-Fun-EV-Graphviz-V6.ps1 -Action Audit
# Only after separately reviewing Audit:
.\Run-Fun-EV-Graphviz-V6.ps1 -Action Install -Approval APPROVE_FUN_EV_GRAPHVIZ_INSTALL
```

`Audit` is read-only and default; it checks the V5 WireViz receipt and executable and enumerates **only** Graphviz-named first-level folders under standard Windows Program Files and LocalAppData Programs locations. It fingerprints `bin\dot.exe` candidates using SHA-256, without running them, installing anything, creating any files or checking any other project.

`Install` is separately approved, exact-package-only WinGet: `Graphviz.Graphviz` version `16.1.0`. It rechecks existing candidates and refuses if one already exists. Before install it checks the WinGet show response has the correct ID and Version, and refuses generic help. WinGet may install system-wide, prompt for UAC elevation, and change environment/package registrations. The installer does not itself start/stop services, modify unrelated projects or install FreeCAD/QElectroTech. WinGet is not transactionally atomic; unexpected partial installation needs its own read-only audit.

If the installed Graphviz executable is found, V6 returns `GRAPHVIZ_CANDIDATE_FOUND_RENDER_NOT_QUALIFIED`; actual rendering through WireViz and SHA-pinned Graphviz must pass the independent V3 native renderer. An absent result is a HOLD, not a claim that the package was not installed elsewhere. Do not run Install as part of unit tests.

## Next native render qualification
Use `Run-Fun-EV-Native-V3.ps1 -Action probe` to inspect both executable hashes, then explicitly invoke `-Action render -ProjectId <existing V2 bench id> -WireVizSha256 <verified hash> -DotSha256 <verified hash>` against the already generated **synthetic unpowered** V2 example. The V3 renderer writes SVG/BOM TSV and a separate manifest while retaining engineering HOLD. It does not validate a real automotive wiring design.

## Sources
- https://graphviz.org/download/ (native Windows Graphviz 16.1.0)
- https://github.com/microsoft/winget-pkgs
- https://github.com/wireviz/WireViz/blob/master/docs/README.md
