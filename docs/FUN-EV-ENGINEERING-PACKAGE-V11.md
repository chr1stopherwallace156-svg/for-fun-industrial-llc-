# V11 engineering package evidence gate

V11 adds a real, read-only evidence package compiler to the V9 vehicle library and V10 browser foundation. It evaluates whether a selected Ford configuration has source documents, CAD, wiring, BOM, simulations, and independent engineering evidence. SHA-256 integrity is rechecked on each run.

## Example
`node src/vehicle-library/cli-v9.mjs register --vehicle F-450 --id F450-2026-001`

`node src/vehicle-library/package-cli-v11.mjs --vehicle F-450 --id F450-2026-001`

Optionally add `--output C:\path\package.json` to write a new immutable-by-no-overwrite report. Existing files are never overwritten.

## Safety and boundaries
- Package reports are NOT engineering approvals. The compiler always marks manufacturingReady=false and engineeringApproved=false.
- File hash verification proves bytes were preserved, not that a Ford source is authentic or geometry is correct.
- The package does not execute CAD tools, simulations, installers, or any third-party files.
- No Ford source documents are automatically downloaded; no proprietary source bypass.
- Does not modify or restart V10, dashboard, REA, Ollama, FreeCAD or Elektron.
- Source import and artifact association remain explicit operator actions through V9 CLI.
- This is an evidence and gap report, not the completed EV engineering system.
