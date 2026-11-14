# V12K — Candidate evidence relationship graph

Builds a deterministic JSON graph from the V12J context report. Nodes: source pages, disputes, exact cited source lines, caption candidates, footnote candidates, unit tokens. Edges: page/dispute membership, nearby-text candidates, possible captions/footnotes/units, and line provenance. All candidate relationships are explicitly **unverified**; a unit mention is not a unit-to-cell assignment and a caption mention is not proof that it governs a table.

No PDF re-extraction, no LLM invocation, no service restart, no change to existing evidence. Checks V12J SHA link to V12I and record count, bounds output size, and refuses to overwrite conflicting output.

Run `python src/layout-intelligence/evidence-graph-v12k.py --folder <configuration evidence folder>`.

Next phase: use page geometry, header spans and caption ordering to evaluate scope, and validate with labeled test documents. The present graph cannot assert document semantics or engineering specifications.
