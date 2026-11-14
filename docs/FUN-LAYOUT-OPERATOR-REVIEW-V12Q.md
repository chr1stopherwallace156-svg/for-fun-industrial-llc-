# V12Q — Operator evidence review

Commands: `list --limit 5`, `verify`, and `decide --source-sha256 HASH --page N --line-key KEY --decision DEFER --operator ID --reason TEXT`. Decisions are limited to `CONFIRM_RELATIONSHIP`, `REJECT_RELATIONSHIP`, or `DEFER`. **Confirmation refers only to the operator's judgment of a proposed document relationship; it is not engineering approval.**

V12Q checks the V12P queue provenance, displays ranked pending records, and appends one immutable hash-linked JSONL journal entry per reviewed line. Journal writes use an exclusive lock, flush and fsync. The journal is located at `V12Q-OperatorReview/review-journal-v12q.jsonl` under the evidence folder. A corrupted/incomplete journal fails closed. There is no automatic approval, PDF rewriting, model invocation, or service restart.

Limitations: This is an operator-attested journal, **not cryptographically signed identity or tamper-proof storage**; an attacker able to rewrite all files could recompute hashes. Operator identity is a supplied label, not authenticated. The original PDF page should be inspected before a CONFIRM decision. A stale lock after interruption must be investigated rather than automatically removed.
