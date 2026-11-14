# V12R — PDF text integrity and review eligibility

Consumes V12P queue and validates its provenance against V12O. Classifies each unique candidate line as READABLE_REVIEW_CANDIDATE, TEXT_RECOVERY_REQUIRED, or LOW_INFORMATION_REVIEW. Flags CID glyph artifacts, replacement characters, control/surrogate characters and blank strings. Non-ASCII writing systems are valid and not penalized. The original text and bounding box are preserved, with no automatic repair or removal.

**Limitations:** A readable string is only a candidate for operator inspection, not proof of faithful extraction or an accurate table relationship. The V12P exampleLineText is truncated to 500 characters, so this gate checks that excerpt only. CID tokens can also appear literally in documents; this is a conservative hold for review. No journal decisions are made and no original PDF or running services are modified.

Output: `layout-text-integrity-v12r.json` in the existing evidence directory, immutable across reruns.
