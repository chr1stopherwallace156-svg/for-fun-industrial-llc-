"""Local read-only V8 sample permit-ID shape diagnostic.

Uses the same exact-APN, recent, replacement-like selection as V8.
Never prints raw permit numbers, APNs, addresses, or homeowner details.
No network request, file export, or data mutation.
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sqlite3
from collections import Counter
from pathlib import Path

from audit_roofing_permit_descriptions_v6 import date_before
from probe_ladbs_inspections_v8 import (
    MAX_PER_ZIP, SOURCE, ZIPS, canonical_permit, max_eligible_issue_date
)

def permit_shape(value):
    """Redacted structure only: digits 9, letters A, hyphens, spaces _, other ?."""
    return "".join(
        "9" if ch in "0123456789" else
        "A" if ch.isascii() and ch.isalpha() else
        "-" if ch=="-" else
        "_" if ch==" " else "?"
        for ch in str(value or "")[:80]
    )

def report(db, *, per_zip=3, today=None, issued_before=None):
    if not isinstance(per_zip,int) or not 1<=per_zip<=MAX_PER_ZIP:
        raise ValueError("INSPECTION_SHAPE_INVALID_SAMPLE_LIMIT")
    today=today or dt.date.today()
    max_issue_date=max_eligible_issue_date(today,issued_before)
    path=Path(db)
    if not path.is_file():
        raise ValueError("INSPECTION_SHAPE_DATABASE_MISSING")
    conn=sqlite3.connect(path.resolve().as_uri()+"?mode=ro",uri=True,timeout=30)
    conn.row_factory=sqlite3.Row
    try:
        conn.execute("PRAGMA query_only=ON")
        receipt=conn.execute(
            "SELECT state FROM source_runs WHERE source_id=?",(SOURCE,)
        ).fetchone()
        if not receipt or receipt["state"]!="INGESTED_NOT_COMPLETENESS_VERIFIED":
            raise ValueError("INSPECTION_SHAPE_SOURCE_NOT_COMPLETED")
        results=[]
        for z in ZIPS:
            rows=conn.execute("""SELECT DISTINCT e.permit_id,e.issue_date
                FROM roofing_selection_candidates_v3 p
                JOIN permits e ON e.county=p.county AND e.apn=p.apn
                WHERE p.disposition='KEEP' AND p.county='Los Angeles'
                AND p.zip=? AND e.source_id=?
                AND e.roof_class='REPLACEMENT_LIKE'
                AND e.issue_date>=? AND e.issue_date<=?
                ORDER BY e.issue_date DESC,e.permit_id ASC LIMIT ?""",
                (z,SOURCE,date_before(today,5).isoformat(),
                 max_issue_date.isoformat(),per_zip)).fetchall()
            months=sorted({str(row["issue_date"])[:7] for row in rows})
            shapes=Counter(permit_shape(row["permit_id"]) for row in rows)
            accepted=sum(canonical_permit(row["permit_id"]) is not None
                         for row in rows)
            results.append({
                "zip":z,"selected":len(rows),
                "v8_valid_format":accepted,
                "issue_months":months,
                "permit_shapes":dict(sorted(shapes.items()))
            })
        return results
    finally:
        conn.close()

def main():
    parser=argparse.ArgumentParser(
        description="Read-only permit number shape check for unmatched V8 records")
    parser.add_argument("--db",required=True)
    parser.add_argument("--per-zip",type=int,default=3)
    parser.add_argument("--issued-before",default=None)
    args=parser.parse_args()
    for result in report(args.db,per_zip=args.per_zip,
                         issued_before=args.issued_before):
        shapes=";".join(
            f"{shape}:{count}"
            for shape,count in result["permit_shapes"].items()
        ) or "NONE"
        months=",".join(result["issue_months"]) or "NONE"
        print(
            f"ZIP={result['zip']} SELECTED={result['selected']} "
            f"V8_FORMAT_ACCEPTED={result['v8_valid_format']} "
            f"ISSUE_MONTHS={months} MASKED_SHAPES={shapes}"
        )

if __name__=="__main__":
    try:main()
    except (OSError,ValueError,sqlite3.Error) as error:
        print("V8_PERMIT_SHAPE_DIAGNOSTIC_HOLD="+(
            str(error) if isinstance(error,ValueError) else type(error).__name__
        )[:100])
        raise SystemExit(1)
