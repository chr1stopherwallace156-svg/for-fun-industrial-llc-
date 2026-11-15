# F-450 Concept Assembly V5

Native FreeCAD macro creates a conceptual assembly with 12+ solid objects: two frame rails, crossmembers, cab, front/rear axle envelopes, two battery enclosures, drive unit and junction box. Coordinates are arbitrary **placeholder millimetres**, not OEM measurements, not a vehicle-accurate model. Outputs FreeCAD FCStd, STEP and a SHA256 receipt in a new isolated folder. No existing CAD/wiring outputs are changed. Wiring integration and geometry/collision verification are not yet implemented.

Run `powershell -ExecutionPolicy Bypass -File src/ev-conversion/Start-F450-Concept-V5.ps1` on the Windows host with FreeCAD installed under Program Files. The launcher opens FreeCAD and returns without claiming native completion; inspect `F450-Concept-V5-receipt.json` for success. The macro fails if output already exists; never overwrite a prior run. V5 is visual concept only and cannot support procurement, manufacturing or HV engineering decisions.
