# V12P — Evidence-bound review priority

Consumes V12O disambiguation and V12N spatial records, validates their provenance, and builds a stable sorted queue. Priority score is **work scheduling**, not probability, correctness, semantic confidence or authority. Reasons include unresolved region overlap, multiple competing records, nearby positioned lines, and simple text patterns. The complete source hash and page are retained. No candidates are discarded, no PDFs reopened, and no external action is authorized.

Queue includes all 2,369 unique candidate-line groups in the reference run (actual count determined by input); unresolved groups sort ahead of same-comparison candidates. Priority scores are intentionally heuristic and require evaluation against manually reviewed examples before use in automatic decision-making. Output is immutable and deterministic.
