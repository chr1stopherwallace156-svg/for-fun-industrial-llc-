# Fun Industrial — Conventional Cognitive Kernel v1

## Purpose

Introduce **ordinary, deterministic software** for a first slice of cognitive functionality, before integrating neural learning, graph-neural models, or teaching another agent. This is an additive, offline Node.js module; it does **not** modify the existing model, model service, compute service, Cognee memory, REA, scheduler, gateways, or operator workflow.

## Implemented behavior

- **Who / what / why / how / where / when:** claims have an explicit question type, subject, predicate, and object.
- **Evidence/provenance:** every claim has a source and starts `proposed`. A supplied observation may agree (`supported`), disagree (`refuted`), or conflict with another observation (`proposed` again). The system does **not** independently authenticate external observations: `supported` means consistent with submitted checks, **not established ground truth**.
- **Relational reasoning:** bounded graph search supports only explicitly transitive predicates (`is_a`, `part_of`, `before`), and returns the evidence-path fact IDs. Causal relationships are deliberately **not** treated as transitive.
- **Prediction vs. outcome:** record a prediction before supplying an observed outcome; compare once; retain errors and accuracy. A failed outcome can generate one **unverified correction proposal**; it never silently rewrites established knowledge.
- **Self-assessment:** count supported, proposed, refuted, conflicting claims, question coverage, and resolved prediction accuracy. A user-supplied confidence is a label only, not calibrated probability.
- **Data-only export:** in-memory snapshot available for future versioned storage. Persistence/import and Cognee ingestion are intentionally **not** in v1.

## Run

From Fun Industrial repository root:

```powershell
node --test intelligence-checks/cognitive-kernel-case.mjs
node src/cognition/demo.mjs
```

No Python installation, external model, node modules, or service activation is required to run these two commands.

## Boundaries

No network calls, file writes, process spawning, model downloads, shell operations, REA tool calls, or approval grants. This is a research prototype, not sentience or proof of general understanding. The synthetic demonstration checks a claim against an intentionally supplied matching observation; it is **not an independent measurement**. Real deployments need trustworthy measurement adapters, authenticated provenance, bounded persistence, disagreement resolution, and blind tests before using results for consequential decisions.

## Next development phases (not in v1)

1. Connect to an authenticated observation and knowledge-source adapter, and implement explicit evidence quality grades.
2. Integrate RDFLib/NetworkX graphs and River online learning in an isolated Python compute worker with strict CPU/RAM budgets.
3. Add pgmpy probabilistic models when justified by data, and PyTorch Geometric only with sufficient suitable training examples; use quimb only for justified tensor-network tasks.
4. Build an independent student with a separate store and hidden pre/post teaching exams. Require demonstrated improvement on held-out tasks before claiming teaching worked.
5. Expose cognition to llama.cpp through read-only, bounded inputs; keep existing operator approval for any action outside the cognitive sandbox.

## Design note

This module intentionally avoids importing existing `src/intelligence/rules.mjs` or the Cognee bridge. Neither a plain fact nor a purported observation can grant tool authority. It can later feed *informational* summaries to those existing services without changing their protected action policy.
