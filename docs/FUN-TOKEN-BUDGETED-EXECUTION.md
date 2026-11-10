# Fun Industrial — Token-Budgeted Software Execution

## Goal

Complete useful multi-step work with a small local GGUF model by moving deterministic steps into code. Do not treat character reduction as token reduction, model memory expansion, or proof of deeper reasoning.

## Phase 1 — Web evidence adapter (implemented in GitHub, live Windows deployment must be separately verified)

- User's last public web-search request is turned into concise DDGS query; no Cognee memory is sent to DDGS.
- Only up to three valid HTTP(S) source URLs are accepted. URLs remain stored in software; Qwen receives bounded numbered titles, domain, and excerpts, not full links.
- Sources are marked as untrusted content, not instructions or tool authority.
- /no_think is a Qwen3 prompt hint for short factual synthesis; its behavior requires live runtime verification. It is not a universal tokenizer or reasoning fix.
- llama.cpp's original `usage` object is retained. Additional `web.token_budget` reports exact prompt/completion/total/cached tokens when present; missing values are null. `near_output_limit` is an indicator, not a verified finish reason.
- `evidence_chars` and `original_evidence_chars` track deterministic character trimming. Do not report these as actual token savings.
- Existing operator approval, REA allowlists, external llama.cpp, Cognee read-only memory, and Windows service boundaries are unchanged.

## Benchmark contract

Record a repeatable query set (e.g., 10–20 source-backed questions with factual checks). For each version, measure: percent completed without truncation; supported-citation correctness; returned source quality; actual `usage.prompt_tokens` and `usage.completion_tokens`; wall-clock latency; and process CPU/RAM via Windows performance counters if desired.

Use identical requests and separate warm/cold runs to evaluate cache effects. An improvement counts only when completion and factual quality do not degrade. Keep raw search provenance and the noncompressed answer separate from model context.

## Phase 2 — Deterministic task coordinator (proposed, not yet deployed)

- Store immutable task ID, objective, inputs, operator authorization, state, and step-level results outside the model.
- Prefer ordinary TypeScript/Python state machines first; consider LangGraph checkpointing only if its runtime and dependency costs outperform the smaller state machine.
- Execute only known, approved operations through bounded schemas. Model suggestions are proposals and never grant execution permission.
- Use Optuna/OR-Tools directly for numerical optimization, with no model call per trial. Return compact metrics, constraint violations, and winning configurations.
- Retrieve a small Cognee context only for relevant decisions. Memory is reference evidence, never policy or operator authorization.
- Use prompt caching where the installed llama.cpp server version actually supports it, and benchmark warm vs cold latency.
- Add a transparent result ledger, retry policy, failure analysis, and cancellation; no silent autonomous system edits.

## Non-goals

No re-encoding of an arbitrary number of tokens into one exact token, no claim of infinite context, no model replacement or Ollama dependency, no unreviewed Python/code execution, and no REA permission expansion.
