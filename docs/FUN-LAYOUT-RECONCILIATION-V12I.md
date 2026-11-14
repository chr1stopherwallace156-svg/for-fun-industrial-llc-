# V12I — General-purpose evidence reconciliation

Consumes the existing V12C primary table JSON, V12G audit, V12H cross-engine report and the already extracted V12H pdfplumber page cache. No PDF is reopened, no model is invoked, and no process is restarted.

For matched tables, compares normalized row/column grids, cell-text multisets, and preserves both original grids plus bounding boxes. Distinguishes identical grids, identical cell text arranged differently, high textual overlap, and material textual differences. Unmatched tables remain explicit segmentation-review cases. Outputs immutable review candidates, never silent corrections. Source, audit and comparison hashes are checked; cached page keys and table counts are checked, but cached content is not independently signed.

**Limitations:** V12H's geometric match threshold may pair unrelated overlapping tables. Row normalization can hide whitespace differences. No caption/footnote reasoning or semantic validation yet. The generated evidence JSON can be large. V12I is the first reconciliation layer, not automatic verified repair.

Run: `python src/layout-intelligence/reconcile-v12i.py --folder <ExtractedPagesV12A/configuration>`.
