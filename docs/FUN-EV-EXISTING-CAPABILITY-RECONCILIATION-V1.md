# Existing EV capabilities reconciliation V1

Do not reinstall CAD or wiring before inventorying the previous native artifacts. Earlier operator evidence: WireViz/Graphviz V7c 10/10 test pass and native SVG/BOM; FreeCAD 1.1.4 V8 native FCStd/STEP and STEP reimport of a small bench model. See historical GitHub PR #69 (V8 preflight), #60 (V2 source), and branch repair/fun-ev-v7b-wireviz-bom-conductors-20261114. Those bench results are not full EV conversion engineering approval.

This read-only scanner inventories SHA-256 hashes of scoped CAD, STEP, harness and receipt files under %LOCALAPPDATA%/FunIndustrial, without running native tools, installing anything, changing processes, accessing Elektron, or asserting that a file's existence proves tool qualification. Output to console only; the operator may save the output explicitly if desired.

Next step: reconcile exact existing native artifact paths and receipts with the eight contracts from PR #92, then build adapters only for gaps. This tool does not yet establish current runtime availability, provenance of all artifacts, or completion of the five business capabilities.
