# V12D: source-backed engineering parameter candidates

Reads V12C's 372-table baseline, re-verifies original PDF hashes, then identifies label/value cells in the same row for wheelbase, cab-to-axle, length, frame width, GVWR, GAWR, curb weight, payload and voltage. Preserves original raw cells, source SHA, page, table ID, row/column indices and potential unit mentions. Model/cab applicability and normalized values remain **UNDETERMINED / null**. It does not infer dimensions from nearby unrelated numbers or feed CAD/simulation.

No external process starts, restarts, or stops. Output: `engineering-parameters-v12d.json` next to the V12C table index. Existing different output is held rather than overwritten.

`pymupdf_layout` is **not installed or enabled** by this phase. It is a separately evaluated optional enhancement, because introducing a new layout engine can alter tables and must be benchmarked against the 372-table baseline first. This implementation uses only the existing V12C output and Python standard library.

Limitations: same-row heuristic will miss multi-row/merged headers and can generate false positives. Tests are static guards; live validation on Windows is required. Do not use candidates as manufacturing data without engineering review.
