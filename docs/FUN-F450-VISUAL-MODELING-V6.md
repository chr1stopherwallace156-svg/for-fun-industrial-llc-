# F-450 V6 — detailed visual mesh import

V6 introduces a Blender import path for a user-supplied detailed F-450 mesh in GLB, GLTF, OBJ or FBX format. The operator must provide source file and a nonempty local text record describing provenance/license; the tool hashes both and saves a separate `.blend` and receipt. License text is recorded, not independently authenticated. Imported mesh identity, scale, OEM accuracy, suitability for conversion engineering, and geometry clearances remain unverified. No automatic download or unauthorized redistribution.

Discovery: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File src/ev-conversion/Start-F450-Visual-V6.ps1`.

Import after sourcing a suitably licensed mesh: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File src/ev-conversion/Start-F450-Visual-V6.ps1 -SourceMesh 'C:\path\truck.glb' -LicenseEvidence 'C:\path\license.txt'`. Existing FreeCAD V5 STEP is not modified. V7 should register a validated coordinate system and link visual body to FreeCAD STEP via explicit scale/landmark checks, not automatically fuse unverified meshes into engineering solids.
