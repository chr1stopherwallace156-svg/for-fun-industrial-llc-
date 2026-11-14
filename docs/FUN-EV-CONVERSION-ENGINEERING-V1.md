# Fun Industrial EV Conversion Engineering Workspace V1

Status: **source-staged; external tools NOT installed or qualified; no production or high-voltage authorization.**

## Purpose and isolation
Create an independent **Fun Industrial-only** research and engineering workspace for vehicle electrification. Scope is restricted to Fun Industrial source, data, and separately approved tool installations. This branch has no dashboard/REA/chat registration, makes no cross-project runtime inquiries, and opens no network ports.

## What is actually delivered in V1
- Structured, inspectable source catalog of 18 upstream CAD, wiring, vehicle data, simulation, parts, safety and manufacturing repositories. Listing is not installation or readiness.
- Read-only executable candidate discovery from PATH only; PATH detection is not a verification of integrity, version or fitness.
- Explicit creation of an isolated vehicle-project folder containing vehicle profile, BOM, requirements, connector-pinout, analysis assumptions, and test evidence skeletons. No invented vehicle measurements, wiring connections, costs, or safety approvals.
- Structure verification which always retains an engineering HOLD. No external commands, API calls, Git operations, downloads, package installs, live runtime changes, or vehicle-control authority.
- Offline Node tests.

## Commands
From a clean checkout of this *Fun Industrial branch* in PowerShell:
```powershell
.\Run-Fun-EV-Engineering-V1.ps1 -Action status
.\Run-Fun-EV-Engineering-V1.ps1 -Action catalog
.\Run-Fun-EV-Engineering-V1.ps1 -Action init -ProjectId e450-concept
.\Run-Fun-EV-Engineering-V1.ps1 -Action verify -ProjectId e450-concept
node --test test/ev-engineering-v1.test.mjs
```
Only `init` writes, to `%LOCALAPPDATA%\FunIndustrial\EVEngineering\Projects\<project-id>`. IDs are lowercase alphanumerics/hyphens. Existing project directories are never overwritten. The optional FUN_EV_WORKSPACE_ROOT override is for isolated tests/operators; ensure it's trustworthy.

## Tool sequencing
1. CAD: FreeCAD. Workbench plugins only after separate code/license review.
2. Wiring: QElectroTech and WireViz; KiCad where custom electronics/PCB are justified.
3. Vehicle inputs: verified OEM service sources and measured weights/dimensions; use cantools/python-can only on authorized bench interfaces, never to issue control commands.
4. Simulation: FASTSim first, then PyBaMM/OpenModelica/T3CO as needed, with independent measured-data validation.
5. Parts: InvenTree. Manufacturing ERPNext later, once approval and production processes exist.
6. Safety: Capella/SCRAM/FEA only as engineering decision-support. Licensed professionals must independently validate HV safety, braking, structure, thermal behavior and regulatory compliance.

## Next development gates (not claimed complete)
- Pin each selected upstream commit/version and verify supply chain, dependencies, permissions and license compatibility.
- On a test machine only, operator-approve installations, then construct an opt-in file-based exporter/importer for FreeCAD, WireViz and QElectroTech.
- Generate real CAD, wiring and powertrain artifacts from sourced configuration data and compare outputs to independent engineering calculations. Avoid autonomous installations, live CAN writes, or hidden subprocesses.
- Add optional Fun Industrial dashboard panel after existing runtime tests; do not alter the running 8789/8798/8802 or HTTPS gateway without a distinct change review.
- Require engineer-signoff before procurement, fabrication, energizing an HV system or vehicle release.
