# V12A: local Ford PDF evidence extraction

This is a bounded, offline **PyMuPDF** worker, not an AI engineering approval system. It consumes already-imported PDFs from V9, checks every PDF's SHA-256 against the source registry, extracts page-numbered text, and writes page JSON under `Ford/F-450/2021/Evidence/ExtractedPagesV12A/F450-2021-REFERENCE/`.

No OCR, engineering table validation, dimension interpretation, CAD generation, or automated engineering promotion is implemented. Scanned PDFs may yield little or no text. Pages can be truncated when max character limits are exceeded; such output is marked. Extraction outputs never overwrite existing files.

Windows isolated Python setup: `py -3 -m venv <temporary-directory>`, `<venv>\Scripts\python.exe -m pip install PyMuPDF==1.26.6` (requires access to package index), then `<venv>\Scripts\python.exe src\vehicle-library\extract-v12a.py --root <VehicleLibrary> --vehicle F-450 --year 2021 --id F450-2021-REFERENCE`.

The worker does not launch, stop, or modify V10, REA, llama.cpp, compute, FreeCAD or Elektron. It does not modify source PDFs or V9 configuration records. Extraction results are **unverified evidence** and cannot be consumed as manufacturing dimensions without review.
