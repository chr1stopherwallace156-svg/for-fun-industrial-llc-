# V12N — Spatial relationship candidates

Consumes only V12M word-position results. Groups nearby words into approximate lines, detects possible numbered captions, footnote patterns and unit mentions, and flags lines proposed for more than one distinct table on the same page. The graph is intentionally heuristic: line grouping by top-coordinate tolerance can split wrapped lines, and the same physical line extracted through overlapping primary and secondary regions is not considered a cross-table conflict unless different table IDs are involved.

No PDF reread, model call, source modification or service restart. All relationships remain unverified. Output conflicts fail closed. Next milestone: coordinate calibration, multi-line grouping, explicit header/table association and annotated evaluation data.
