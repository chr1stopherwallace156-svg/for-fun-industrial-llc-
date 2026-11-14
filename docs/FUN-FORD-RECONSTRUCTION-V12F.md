# V12F: conservative multi-engine table reconstruction

Primary engine: existing V12C PyMuPDF table cells (372-table baseline). Extracts same-row numeric cells and associates unit evidence from row label or preceding same-column headers. Associates model only from unambiguous preceding same-column headers. Converts explicitly matched length/weight/voltage values with Decimal. All interpretations remain UNVERIFIED, NEEDS_HUMAN_REVIEW, and ineligible for CAD.

Optional second engine: `--compare-pdfplumber` if already installed. This **only compares detected table counts per source PDF**; it does not yet reconcile cell geometry or validate numbers. No package is installed automatically. `pymupdf_layout` is not integrated in this phase and needs separate compatibility/accuracy evaluation.

No model/cab applicability is approved; same-column headers may be misleading in complex merged tables. The script preserves prior artifacts and writes a new non-overwriting JSON. Static tests are guardrails, not numerical accuracy benchmarks.

Run: `python src/vehicle-library/reconstruct-v12f.py --root <VehicleLibrary> --vehicle F-450 --year 2021 --id F450-2021-REFERENCE`.
