# V12G — General-purpose Layout Intelligence, first increment

This is a domain-independent structural audit over table JSON (`{"tables":[{"id":"...","rows":[["header"],["value"]]}]}`). It flags empty/ragged tables, unclear first-row headers, non-text cells, and numeric rows without explicit units. It emits targeted second-pass candidates with source/page/bbox pointers and SHA-256 of the input. No AI, FastAPI, pdfplumber, Docling or alternative parser is launched in this increment.

These are **heuristic warnings**, not proof of error: numeric tables may legitimately have no units, and units may be in column headings. A clean structural audit does not prove correct semantics. Output never marks meaning verified. Re-running the same input against an existing output is idempotent; a changed report fails rather than overwrites.

Next increments: normalized document schema across PDF/DOCX/XLSX/HTML; region-level alternative parser comparison; cached per-page hashes; bounded correction proposals; independent evidence tests. Do not rewrite source files or run extra engines without explicit operator approval.
