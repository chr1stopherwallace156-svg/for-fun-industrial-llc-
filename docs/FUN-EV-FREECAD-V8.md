# Fun Industrial EV V8 — native FreeCAD preflight

## Scope and qualification
V7c passed 10/10 owner Windows tests and the original bench SVG/BOM audit. V8 is the next CAD milestone, **preflight only**. It is NOT a native FreeCAD render or geometric BREP validation.

The V8 read-only command verifies V2 project and macro SHA-256, exact generated FreeCAD macro source, bounded plate dimensions, hole bounds and collisions, and computes the *analytical expected plate volume* in mm³. It scans narrowly for installed FreeCAD executables under Windows Program Files, hashes any discovered executable and reports it as **unqualified candidate**.

```powershell
node --test test/ev-freecad-preflight-v8.test.mjs
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\Run-Fun-EV-FreeCAD-V8.ps1 -ProjectId bench-4d5012c1
```

There is no automatic installation, execution of FreeCAD, macro execution, CAD export, file modification, network call, process lifecycle operation or other-project access. No operator approval to execute a candidate is inferred from discovery. Even successful preflight retains engineering hold.

## Native render stage, subsequent separate approval
If FreeCAD is absent, verify the current signed installer and exact version with a new approval-gated installer plan. If present, separately pin the exact executable hash, prepare a bounded temporary FreeCAD macro that produces a native FCStd/BREP export and independent volume/dimension checks, and require operator approval before launching. Keep outputs in a new, non-overwriting Fun-only folder and never energize hardware or infer structural safety from CAD geometry.
