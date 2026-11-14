# V12L — Table geometry assessment

V12L evaluates bounding-box overlap for each V12I comparison record, using source evidence already on disk. It checks the V12I→V12J→V12K provenance chain, classifies high/partial/low/no overlap and explicitly reports missing or invalid geometry. All results are review-only. No PDF reread, model call, process restart or correction.

**Scope limitation:** Text-line coordinates were not carried into V12J/V12K, so this stage **cannot** verify caption-to-table or unit-to-cell relationships. Bounding-box intersection also does not prove a correct table match; different engines can use different coordinate systems. Before any scope assertion, implement independently grounded page-text geometry and coordinate-system calibration.

Run: `python src/layout-intelligence/geometry-v12l.py --folder <evidence configuration directory>`.
