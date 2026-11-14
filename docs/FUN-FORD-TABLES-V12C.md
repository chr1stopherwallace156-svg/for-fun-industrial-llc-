# V12C — Ford PDF table discovery

Runs PyMuPDF `page.find_tables()` against V9 SHA256-verified PDFs already extracted in V12A. Captures cells, table bounding boxes, PDF page numbers, document hashes, unit mentions, model mentions **within the table**, and proposed review destinations. Model applicability remains UNDETERMINED; unit mentions are not normalized measurements. No CAD, wiring, simulation, BOM, source or approval writes.

Output: `Evidence/ExtractedPagesV12A/<id>/engineering-tables-v12c.json`.

Page extraction failures are recorded and return a nonzero exit code. No OCR is performed; complex drawings and scanned pages may have no extractable tables. The static Node test is a guard, not a live PDF parser validation. A full Windows execution is needed.

Example: `python src/vehicle-library/tables-v12c.py --root <VehicleLibrary> --vehicle F-450 --year 2021 --id F450-2021-REFERENCE`.

Future work: verify model applicability using page context and source-specific headings, normalize unit/value pairs, human review, and only then export approved values to CAD and simulation.
