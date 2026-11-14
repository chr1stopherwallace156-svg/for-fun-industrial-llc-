# V12E — Conservative engineering parameter review

V12E consumes V12D's 711 candidates. It rechecks original source PDF hashes and registry linkage, then converts **only** a value cell consisting of exactly one number and an explicit supported unit. Length becomes mm, weight becomes kg, voltage remains V. It never guesses units from headings or nearby cells.

Potential conflicts are grouped by parameter and canonical unit, but **may be different legitimate Ford variants**, not genuine contradictions. Model, cab and wheelbase applicability remain UNDETERMINED. All candidates remain NEEDS_HUMAN_REVIEW. No approval workflow or FreeCAD export is implemented. No files are modified except the new immutable review report.

Run: `python src/vehicle-library/review-v12e.py --root <VehicleLibrary> --vehicle F-450 --year 2021 --id F450-2021-REFERENCE`.

Next: table-column model resolution, page-context checking, reviewer signoff with independently validated source, then a separate gated CAD input exporter. No 2021 measurements may be assumed valid for the 2026 vehicle.
