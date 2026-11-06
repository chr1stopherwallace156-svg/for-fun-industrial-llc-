# Fun Industrial Cognitive V1 — isolated qualification candidate

## Purpose

An **open-source, Python-standard-library-only** evidence-first cognitive memory and feedback-based learning component. SQLite-backed, fully offline, review-gated and bounded. It is NOT an autonomous agent, code self-rewriter, foundation-model trainer, or unapproved web/REA executor.

## Lifecycle

`propose` (untrusted/quarantined) → explicit human CLI `review` (approve/reject once) → `recall` (only approved, scope-isolated, original provenance retained) → `feedback` (-1/0/+1 operator feedback) → deterministic preference-adjusted ranking at next recall.

No unreviewed observation enters recall. Web/REA/model text is always untrusted evidence even if human-approved for recall. Human approval is a CLI action on the host, not a remotely authenticated identity; keep the database private. Do not record secrets or private personal data.

## Quick qualification (PowerShell, from cloned branch root)

```powershell
& 'C:\Users\alxar\AppData\Local\Programs\Python\Python312\python.exe' -m unittest discover -s tests -p test_cognitive_core.py -v
```

## Offline operation (PowerShell)

```powershell
$py='C:\Users\alxar\AppData\Local\Programs\Python\Python312\python.exe'
$db=Join-Path $env:LOCALAPPDATA 'FunIndustrial\Cognitive\memory-v1.sqlite3'
& $py -m cognitive.cli --db $db propose --origin web --scope fleet --evidence 'https://example.org/source' --text 'Example observation about fleet battery health'
# Record the returned id; approve it explicitly as operator, then recall.
& $py -m cognitive.cli --db $db review 'ID_FROM_PROPOSE' --decision approved --reviewer operator
& $py -m cognitive.cli --db $db recall --scope fleet --query 'fleet battery health'
& $py -m cognitive.cli --db $db feedback 'ID_FROM_PROPOSE' --rating 1 --reason 'Verified against actual outcome'
```

## Boundaries

- Data storage: SQLite in an **explicitly supplied** DB path; no OS processes, networks, or model API calls.
- Max observation: 4000 chars; evidence: 1024 chars; recall scans at most 500 approved observations in scope and emits at most 10 matches.
- Scope names are constrained. All SQL is parameterized. Review is single-use, feedback does not modify the source text.
- A SHA-256 fingerprint ties content, origin, scope and evidence for later evidence inspection (not an authentication signature).
- Ranking uses deterministic lexical term weighting plus bounded average human feedback; this is *lightweight online preference learning*, not neural fine-tuning.
- No API, REA tools, UI controls or model-memory injection wired yet. The module is intentionally staged; later integration requires separate approval, an authenticated policy boundary, and hostile tests.
- The repository is licensed Apache-2.0. The component requires no additional open-source dependencies.
