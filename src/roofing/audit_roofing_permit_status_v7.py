#!/usr/bin/env python3
"""Independent, bounded read-only LA roof permit status-evidence sample (V7).

Archive status labels are *not* proof that a new roof was installed. Reports
aggregate evidence only; no homeowner identifiers, raw notes, or contacts.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from contextlib import closing
from pathlib import Path

import roofing_bulk_v2 as importer
from audit_roofing_permit_descriptions_v6 import (
    SOURCES, ZIPS, check_inputs, date_before
)

VERSION="fun-roofing-status-evidence-v7"
EXTRA_FIELDS=("status_desc","status_date","cofo_date")
CATEGORIES=(
    "PERMIT_FINALED_STATUS_RECORDED",
    "COFO_ISSUED_STATUS_RECORDED",
    "ISSUED_NOT_FINALED",
    "EXPIRED_CANCELLED_OR_REVOKED",
    "OTHER_OR_UNRECOGNIZED_STATUS",
    "STATUS_MISSING",
)
STATS=(
    "selected","matched_original","source_record_not_reconciled",
    "missing_required_status_columns",
    "status_date_present","status_date_not_parseable",
    "status_date_before_permit_issue",
    "cofo_date_present","cofo_date_not_parseable",
    "cofo_date_before_permit_issue","cofo_with_nonfinal_status",
    "replacement_like_sample","other_roof_related_sample",
)+CATEGORIES

def status_category(s):
    status=re.sub(r"\s+"," ",str(s or "").upper().replace("_"," ").strip())
    if not status:return "STATUS_MISSING"
    if status in ("PERMIT FINALED","FINALED","FINAL INSPECTION APPROVED",
                  "FINAL APPROVED","PERMIT FINAL"):return CATEGORIES[0]
    if status in ("COFO ISSUED","CERTIFICATE OF OCCUPANCY ISSUED",
                  "CERTIFICATE OF OCCUPANCY GRANTED"):return CATEGORIES[1]
    if status in ("PERMIT ISSUED","ISSUED","ACTIVE","PERMIT ACTIVE",
                  "ISSUED PERMIT"):return CATEGORIES[2]
    if status in ("PERMIT EXPIRED","EXPIRED","CANCELLED","CANCELED",
                  "PERMIT CANCELLED","PERMIT CANCELED","PERMIT REVOKED",
                  "REVOKED","PERMIT WITHDRAWN","WITHDRAWN"):return CATEGORIES[3]
    return CATEGORIES[4]

def parse_date_safe(value):
    raw=str(value or "").strip()
    if not raw:return None,False
    match=re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})(?:T|(?:\s+)|$)",raw)
    if match:pieces=[int(match.group(1)),int(match.group(2)),int(match.group(3))]
    else:
        match=re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+|$)",raw)
        if not match:return None,True
        pieces=[int(match.group(3)),int(match.group(1)),int(match.group(2))]
    try:return dt.date(*pieces),False
    except ValueError:return None,True

def audit_status(db,root,*,zips=ZIPS,per_group=30,recent_years=5,
                 min_building_age=25,today=None):
    zips=tuple(zips)
    check_inputs(zips,per_group,recent_years,min_building_age)
    today=today or dt.date.today()
    db,root=Path(db),Path(root)
    if not db.is_file():raise ValueError("STATUS_AUDIT_LOCAL_DATABASE_MISSING")
    conn=sqlite3.connect(db.resolve().as_uri()+"?mode=ro",uri=True,timeout=30)
    conn.row_factory=sqlite3.Row
    try:
        conn.execute("PRAGMA query_only=ON")
        conn.execute("PRAGMA busy_timeout=30000")
        selections={}
        for z in zips:
            for kind in ("REPLACEMENT_LIKE","ROOF_RELATED_NOT_PROVEN_REPLACED"):
                sql="""SELECT DISTINCT e.source_id,e.permit_id,e.roof_class,e.apn,e.issue_date
                  FROM roofing_selection_candidates_v3 s
                  JOIN permits e ON e.county=s.county AND e.apn=s.apn
                  WHERE s.disposition='KEEP' AND s.county='Los Angeles'
                  AND s.zip=? AND s.year_built<=?
                  AND e.source_id IN (?,?,?)
                  AND e.issue_date>=? AND e.issue_date<=?
                  AND e.roof_class=?
                  ORDER BY e.issue_date DESC,e.permit_id ASC LIMIT ?"""
                matches=conn.execute(sql,(
                    z,today.year-min_building_age,*SOURCES,
                    date_before(today,recent_years).isoformat(),today.isoformat(),
                    kind,per_group)).fetchall()
                for row in matches:
                    key=(row["source_id"],row["permit_id"])
                    detail={"zip":z,"kind":row["roof_class"],
                            "apn":str(row["apn"]),"date":row["issue_date"]}
                    if key in selections and selections[key]!=detail:
                        raise ValueError("STATUS_AUDIT_DUPLICATE_PERMIT_MULTI_PARCEL_HOLD")
                    selections[key]=detail
        if not selections:raise ValueError("STATUS_AUDIT_NO_RECENT_MATCHED_PERMITS")
        archives={}
        for source in sorted(set(key[0] for key in selections)):
            r=conn.execute(
                "SELECT state,file_sha256,filename FROM source_runs WHERE source_id=?",
                (source,)).fetchone()
            if not r or r["state"]!="INGESTED_NOT_COMPLETENESS_VERIFIED":
                raise ValueError("STATUS_AUDIT_SOURCE_NOT_COMPLETED_"+source)
            if r["filename"]!=source+".csv":
                raise ValueError("STATUS_AUDIT_SOURCE_FILENAME_HOLD_"+source)
            if not re.fullmatch(r"[0-9a-fA-F]{64}",r["file_sha256"] or ""):
                raise ValueError("STATUS_AUDIT_SOURCE_HASH_NOT_VERIFIED_"+source)
            path=root/"official_downloads"/(source+".csv")
            if path.is_symlink() or not path.is_file() or path.resolve().parent!=(
                    root/"official_downloads").resolve():
                raise ValueError("STATUS_AUDIT_LOCAL_CSV_MISSING_OR_UNSAFE_"+source)
            if importer.sha(path).lower()!=r["file_sha256"].lower():
                raise ValueError("STATUS_AUDIT_LOCAL_CSV_HASH_MISMATCH_"+source)
            archives[source]=path
        rows={}
        skipped_status_sources=[]
        for source,path in archives.items():
            targets={id for sr,id in selections if sr==source}
            with path.open("rb") as stream:
                with closing(importer.csv_rows(stream,additional_fields=EXTRA_FIELDS)) as records:
                    for row_number,original in enumerate(records,1):
                        # Fail closed when the status columns are genuinely absent.
                        if row_number==1:
                            if not all(k in original for k in EXTRA_FIELDS):
                                skipped_status_sources.append(source)
                                break
                        permit_id=importer.clean(importer.field(original,importer.PERMIT_FIELDS),120)
                        if permit_id and permit_id not in targets:continue
                        parsed=importer.parse_permit(
                            original,"Los Angeles","Los Angeles",source,row_number)
                        if parsed is None:continue
                        key=(source,parsed[1])
                        if key not in selections:continue
                        wanted=selections[key]
                        if str(parsed[4])!=wanted["apn"] or parsed[7]!=wanted["date"] or parsed[-1]!=wanted["kind"]:
                            raise ValueError("STATUS_AUDIT_SOURCE_INDEX_MISMATCH_HOLD")
                        # Last duplicate row is retained by importer INSERT OR REPLACE.
                        rows[key]={
                            "status":importer.clean(original.get("status_desc",""),150),
                            "status_date":importer.clean(original.get("status_date",""),64),
                            "cofo_date":importer.clean(original.get("cofo_date",""),64),
                        }
        if skipped_status_sources:
            raise ValueError("STATUS_AUDIT_MISSING_STATUS_COLUMNS_HOLD")
        counts=defaultdict(Counter)
        overall=Counter({key:0 for key in STATS})
        per_kind=defaultdict(Counter)
        for key,record in selections.items():
            c=counts[record["zip"]]
            c["selected"]+=1
            c["replacement_like_sample" if record["kind"]=="REPLACEMENT_LIKE"
               else "other_roof_related_sample"]+=1
            observed=rows.get(key)
            if observed is None:
                c["source_record_not_reconciled"]+=1
                continue
            c["matched_original"]+=1
            cat=status_category(observed["status"])
            c[cat]+=1
            per_kind[record["kind"]][cat]+=1
            issued=dt.date.fromisoformat(record["date"])
            status_date,bad_status=parse_date_safe(observed["status_date"])
            cofo_date,bad_cofo=parse_date_safe(observed["cofo_date"])
            if observed["status_date"]:c["status_date_present"]+=1
            if bad_status:c["status_date_not_parseable"]+=1
            if status_date and status_date<issued:c["status_date_before_permit_issue"]+=1
            if observed["cofo_date"]:c["cofo_date_present"]+=1
            if bad_cofo:c["cofo_date_not_parseable"]+=1
            if cofo_date and cofo_date<issued:c["cofo_date_before_permit_issue"]+=1
            if observed["cofo_date"] and cat not in CATEGORIES[:2]:
                c["cofo_with_nonfinal_status"]+=1
        for z in zips:overall.update(counts[z])
        holds=("source_record_not_reconciled","status_date_not_parseable",
               "cofo_date_not_parseable","status_date_before_permit_issue",
               "cofo_date_before_permit_issue")
        state="STATUS_SAMPLE_RECONCILED" if not any(overall[k] for k in holds) else "STATUS_EVIDENCE_REVIEW_HOLD"
        return {
            "version":VERSION,"state":state,
            "sample_method":"purposeful_most_recent_per_zip_per_keyword_class_not_random",
            "zips":list(zips),"sample_per_zip_per_class_max":per_group,
            "archives_sha256_match_import_receipts":True,
            "official_sources_checked":sorted(archives),
            "totals":{k:int(overall[k]) for k in STATS},
            "zip_counts":{z:{k:int(counts[z][k]) for k in STATS} for z in zips},
            "status_by_import_class":{kind:{c:int(per_kind[kind][c]) for c in CATEGORIES}
                for kind in ("REPLACEMENT_LIKE","ROOF_RELATED_NOT_PROVEN_REPLACED")},
            "status_is_not_inspection_verified":True,
            "cofo_date_is_not_roof_completion_proof":True,
            "no_roof_age_or_property_damage_inferred":True,
            "no_private_data_or_permit_ids_output":True,
            "database_modified":False,
        }
    finally:conn.close()

def main():
    ap=argparse.ArgumentParser(description="Read-only LA issued roof permit status evidence")
    ap.add_argument("--db",required=True)
    ap.add_argument("--root",required=True)
    ap.add_argument("--zips",default=",".join(ZIPS))
    ap.add_argument("--per-zip-kind",type=int,default=30)
    ap.add_argument("--recent-years",type=int,default=5)
    ap.add_argument("--min-building-age",type=int,default=25)
    args=ap.parse_args()
    result=audit_status(args.db,args.root,zips=args.zips.split(","),
                        per_group=args.per_zip_kind,recent_years=args.recent_years,
                        min_building_age=args.min_building_age)
    print(json.dumps(result,sort_keys=True,separators=(",",":")))
    if result["state"]!="STATUS_SAMPLE_RECONCILED":sys.exit(2)

if __name__=="__main__":
    try:main()
    except (OSError,ValueError,sqlite3.Error) as exc:
        print("FUN_ROOFING_STATUS_AUDIT_HOLD="+str(exc)[:220],file=sys.stderr)
        sys.exit(1)
