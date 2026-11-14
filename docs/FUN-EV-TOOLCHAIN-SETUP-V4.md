# Fun Industrial EV Toolchain V4 — Optional, Version-Pinned Installation

Status: source staged. The operator's V3 Windows test was **16/16 PASS**, with no native CAD or wiring tools found in the scoped locations. V4 has not been executed on the operator's PC.

## Read-only plan
```powershell
.\Setup-Fun-EV-Toolchain-V4.ps1 -Action Plan
```
Reports Python 3.12 and WinGet availability, proposed versions, output location, primary WireViz PyPI wheel checksum, and warns of potential system-wide installs. No install occurs.

## Explicit install action
```powershell
.\Setup-Fun-EV-Toolchain-V4.ps1 -Action Install -Approval INSTALL_FUN_EV_TOOLCHAIN
```
Installs via official Microsoft WinGet package catalog (exact IDs/versions): Graphviz 16.1.0, FreeCAD 1.1.4, QElectroTech 0.100.0. **These are conventional Windows apps, may install system-wide, and may require UAC elevation.** App registration/PATH updates can affect the Windows installation; the script does not restart or inspect running services.

Uses Python 3.12 (if already installed) to make a NEW WireViz venv at `%LOCALAPPDATA%\FunIndustrial\EVEngineering\Tools\WireViz\venv`. Downloads the `wireviz==0.4.1` wheel without dependencies, enforces PyPI SHA256 `5dfdfec91e5d26e4f27f0f9d031672da7fb3c133d127167d233f4742f01873a2`, installs dependencies using wheel-only pip in the isolated venv and records pip freeze. **The venv is built at its permanent path** because moving Python launcher executables after installation can break their interpreter paths.

**Not transactionally atomic**: if WinGet succeeds but a later step fails, packages may be installed. A failed venv remains under the dedicated `WireViz` target folder for inspection; the next installation attempt fails closed if that target already exists. Existing WireViz target folder is never overwritten. Dependency versions are recorded but not yet independently hash-locked: qualification is pending. WinGet may request license acceptance or elevated approval.

## Native qualification after installation
- Run the existing Fun-only `Run-Fun-EV-Native-V3.ps1 -Action probe` and verify paths, hashes, signatures and actual versions.
- Validate WireViz+Graphviz on a synthetic unpowered harness via the V3 explicit hash-pinned render action.
- Open the V2 FreeCAD macro in the installed GUI and independently check geometry; open QElectroTech separately for an operator-created schematic.
- Do not treat installation or source unit tests as automotive safety authorization.

## Sources (Nov 14 2026)
https://pypi.org/project/wireviz/0.4.1/
https://www.graphviz.org/download/
https://github.com/FreeCAD/FreeCAD/releases
https://github.com/qelectrotech/qelectrotech-source-mirror/releases
