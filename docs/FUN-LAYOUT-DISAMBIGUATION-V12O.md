# V12O — Spatial conflict disambiguation

V12O reads immutable V12N line associations and V12L table bounding boxes. For each unique positioned line it compares *distinct comparison records* (not the primary/secondary engine representations of the same record). It marks possible duplicate-region artifacts only when all cross-record bounding-box IoUs meet the configured threshold (default 0.85). Disjoint or mixed regions and missing geometry remain separately visible. Reports unique-line states and association-weighted counts.

**Important limitations:** High overlap is not proof of duplicate tables; different overlapping tables may exist. Identical line keys are inherited from V12N's coordinate rounding. This module does not remove candidates, rank semantic relationships, assert caption scope or approve engineering values. It never modifies source evidence, starts processes, or calls models. Output is immutable; reruns check byte-for-byte consistency.

Run: `python src/layout-intelligence/disambiguation-v12o.py --folder <evidence folder>`.
