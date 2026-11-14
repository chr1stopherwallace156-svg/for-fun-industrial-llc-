# V12H — Selective cross-engine verification

Generic comparison functions operate on any table cells and geometry. The Ford library is only the current data adapter. The tool reads V12G audit flags, selects distinct source PDF pages, verifies PDF SHA256 and V12G input provenance, extracts selected pages with pdfplumber, and compares bounding-box IoU and normalized cell-text multisets against V12C PyMuPDF tables. The multiset metric is order-insensitive: **matching cell text does not prove matching row/column meaning**. No corrections are applied and no engineering values are approved.

Cache keys include source SHA, page and pdfplumber version. A repeated run refuses to overwrite the final report; page cache can be reused after deleting or moving the output manually. Cached JSON is not cryptographically authenticated, and performance results are observations, not guaranteed speedups. The implementation processes at most `--max-pages` selected pages; it may consume memory for all original table JSON and per-page PDF extraction.

Dependencies: pdfplumber installed into the existing isolated V12A Python environment by explicit operator action. No running services touched. Future: page-region comparison, header semantics, correction proposals, robust authenticated cache, and generic document adapters.
