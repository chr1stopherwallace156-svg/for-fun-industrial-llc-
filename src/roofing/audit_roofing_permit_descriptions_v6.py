#!/usr/bin/env python3
"""Bounded, read-only audit of local official LA City roofing-permit descriptions.

This is a *purposefully selected sample* of recent, exact-APN permit matches,
not a random sample or verified roof-replacement count. Source CSV SHA-256
must equal the hash recorded at the original import. No names, homeowner
contacts, raw descriptions, or individual addresses are emitted or stored.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import re
import sqlite3
import sys
from collections import Counter,defaultdict
from contextlib import closing
from pathlib import Path

import roofing_bulk_v2 as importer

VERSION="fun-roofing-permit-description-audit-v6"
ZIPS=("90037","90049","90731","90011")
SOURCES=("la_permits_pre2010","la_permits_2010_2019","la_permits_2020_present")
REPAIR=re.compile(r"\b(?:REPAIR(?:S|ED|ING)?|PATCH(?:ING|ED)?|LEAK(?:S|ING)?|MAINTENANCE|ROOF\s*COAT(?:ING)?|FLASHING)\b",re.I)
COMPLETE_NOTE=("No completion status is verified. A permit description mentioning "
               "replacement is not evidence a new roof was installed.")

def date_before(today,years):
    try:return today.replace(year=today.year-years)
    except ValueError:return today.replace(year=today.year-years,day=28)

def classify_description(desc):
    replacement=bool(importer.REPLACED.search(desc))
    repair=bool(REPAIR.search(desc))
    if replacement and repair:return "MIXED_REPLACEMENT_AND_REPAIR_TERMS"
    if replacement:return "EXPLICIT_REROOF_OR_REPLACEMENT_TERMS"
    if repair:return "REPAIR_MAINTENANCE_OR_LEAK_TERMS"
    return "OTHER_ROOF_RELATED_LANGUAGE"

def check_inputs(zips,per_group,recent_years,min_building_age):
    if not isinstance(zips,(tuple,list)) or not 1<=len(zips)<=10 or len(set(zips))!=len(zips):
        raise ValueError("AUDIT_REQUIRE_1_TO_10_DISTINCT_ZIPS")
    if any(not isinstance(z,str) or not re.fullmatch(r"\d{5}",z) for z in zips):
        raise ValueError("AUDIT_FIVE_DIGIT_ZIP_REQUIRED")
    if not isinstance(per_group,int) or not 1<=per_group<=30:
        raise ValueError("AUDIT_PER_ZIP_KIND_SAMPLE_MAX_30")
    if not isinstance(recent_years,int) or not 1<=recent_years<=10:
        raise ValueError("AUDIT_RECENT_YEARS_REQUIRE_1_TO_10")
    if not isinstance(min_building_age,int) or not 20<=min_building_age<=100:
        raise ValueError("AUDIT_MINIMUM_AGE_REQUIRE_20_TO_100")

def local_audit(db,root,*,zips=ZIPS,per_group=12,recent_years=5,
                min_building_age=25,today=None):
    zips=tuple(zips)
    check_inputs(zips,per_group,recent_years,min_building_age)
    today=today or dt.date.today()
    db=Path(db)
    root=Path(root)
    if not db.is_file():raise ValueError("AUDIT_LOCAL_DATABASE_MISSING")
    conn=sqlite3.connect(db.resolve().as_uri()+"?mode=ro",uri=True,timeout=30)
    conn.row_factory=sqlite3.Row
    try:
        conn.execute("PRAGMA query_only=ON")
        conn.execute("PRAGMA busy_timeout=30000")
        selected={}
        # Equal number of most recent available exact-APN indexed records
        # per ZIP and category. Not an unbiased estimate of category prevalence.
        for z in zips:
            for kind in ("REPLACEMENT_LIKE","ROOF_RELATED_NOT_PROVEN_REPLACED"):
                query="""SELECT DISTINCT e.source_id,e.permit_id,e.roof_class
                  FROM roofing_selection_candidates_v3 s
                  JOIN permits e ON e.county=s.county AND e.apn=s.apn
                  WHERE s.disposition='KEEP' AND s.county='Los Angeles'
                    AND s.zip=? AND s.year_built<=?
                    AND e.source_id IN (?,?,?)
                    AND e.issue_date>=? AND e.issue_date<=?
                    AND e.roof_class=?
                  ORDER BY e.issue_date DESC,e.permit_id ASC
                  LIMIT ?"""
                rows=conn.execute(query,(
                    z,today.year-min_building_age,*SOURCES,
                    date_before(today,recent_years).isoformat(),today.isoformat(),
                    kind,per_group)).fetchall()
                for row in rows:
                    key=(row["source_id"],row["permit_id"])
                    if key in selected and selected[key]["zip"]!=z:
                        raise ValueError("AUDIT_SAME_PERMIT_ASSOCIATED_MULTIPLE_ZIPS_HOLD")
                    selected[key]={"zip":z,"stored_class":row["roof_class"]}
        if not selected:
            raise ValueError("AUDIT_NO_VERIFIED_RECENT_PARCEL_PERMITS_TO_REVIEW")
        active_sources=sorted(set(source for source,_ in selected))
        receipts={}
        for source in active_sources:
            receipt=conn.execute(
              "SELECT state,file_sha256,filename FROM source_runs WHERE source_id=?",
              (source,)).fetchone()
            if not receipt or receipt["state"]!="INGESTED_NOT_COMPLETENESS_VERIFIED":
                raise ValueError("AUDIT_SOURCE_NOT_COMPLETED_"+source)
            filename=source+".csv"
            if receipt["filename"]!=filename:
                raise ValueError("AUDIT_SOURCE_FILENAME_NOT_PINNED_"+source)
            digest=receipt["file_sha256"]
            if not isinstance(digest,str) or not re.fullmatch(r"[0-9a-fA-F]{64}",digest):
                raise ValueError("AUDIT_SOURCE_HASH_UNVERIFIED_"+source)
            path=root/"official_downloads"/filename
            if path.is_symlink() or not path.is_file() or path.resolve().parent!=(
                root/"official_downloads").resolve():
                raise ValueError("AUDIT_ARCHIVE_NOT_FOUND_OR_UNSAFE_"+source)
            if importer.sha(path).lower()!=digest.lower():
                raise ValueError("AUDIT_ARCHIVE_SHA256_MISMATCH_"+source)
            receipts[source]=path
        audit_counts=defaultdict(Counter)
        by_source=defaultdict(Counter)
        retrieved={}
        for source,path in receipts.items():
            source_targets={permit_id for (src,permit_id) in selected if src==source}
            with path.open("rb") as inp:
                with closing(importer.csv_rows(inp)) as rows:
                    for rownum,row in enumerate(rows,1):
                        raw_id=importer.clean(importer.field(row,importer.PERMIT_FIELDS),120)
                        if raw_id and raw_id not in source_targets:continue
                        parsed=importer.parse_permit(row,"Los Angeles","Los Angeles",source,rownum)
                        if not parsed:continue
                        key=(source,parsed[1])
                        if key not in selected:continue
                        # Consume complete CSV in case same permit ID appears
                        # again: the importer retains its last occurrence.
                        desc=importer.clean(importer.field(row,importer.DESC_FIELDS),500)
                        retrieved[key]={
                            "original_category":classify_description(desc),
                            "original_import_class":parsed[-1],
                        }
            by_source[source]["sampled"]+=sum(1 for k in selected if k[0]==source)
            by_source[source]["matched_original"]+=sum(1 for k in retrieved if k[0]==source)
        for key,record in selected.items():
            z=record["zip"]
            out=audit_counts[z]
            out["sample_requested"]+=1
            out["sample_stored_"+record["stored_class"]]+=1
            original=retrieved.get(key)
            if original is None:
                out["source_record_not_reconciled"]+=1
                continue
            out["matched_original"]+=1
            out[original["original_category"]]+=1
            if original["original_import_class"]!=record["stored_class"]:
                out["classification_disagreement"]+=1
            if record["stored_class"]=="REPLACEMENT_LIKE" and original["original_category"] not in (
                  "EXPLICIT_REROOF_OR_REPLACEMENT_TERMS","MIXED_REPLACEMENT_AND_REPAIR_TERMS"):
                out["replacement_keyword_inconsistency"]+=1
        total=Counter()
        for c in audit_counts.values():total.update(c)
        complete=(total["source_record_not_reconciled"]==0
                  and total["classification_disagreement"]==0
                  and total["replacement_keyword_inconsistency"]==0)
        return {
           "version":VERSION,
           "state":"SAMPLED_IMPORT_KEYWORDS_RECONCILED" if complete else "AUDIT_INCONSISTENCY_HOLD",
           "sample_method":"purposeful_latest_recent_exact_APN_per_zip_and_import_class_not_random",
           "requested_zips":list(zips),
           "parameters":{"per_zip_and_class_max":per_group,
                         "recent_years":recent_years,
                         "min_building_age":min_building_age},
           "official_archive_sha256_verified":True,
           "verified_sources":active_sources,
           "source_counts":{s:dict(by_source[s]) for s in active_sources},
           "zip_counts":{z:dict(audit_counts[z]) for z in zips},
           "aggregate":dict(total),
           "replacement_keyword_is_not_completion_proof":True,
           "unmatched_permit_means_no_roof_work":False,
           "no_contact_details_or_raw_descriptions_emitted":True,
           "database_modified":False,
           "interpretation":COMPLETE_NOTE,
        }
    finally:conn.close()

def main():
    p=argparse.ArgumentParser(description="Read-only official roofing permit description audit")
    p.add_argument("--db",required=True)
    p.add_argument("--root",required=True)
    p.add_argument("--zips",default=",".join(ZIPS))
    p.add_argument("--recent-years",type=int,default=5)
    p.add_argument("--per-zip-kind",type=int,default=12)
    p.add_argument("--min-building-age",type=int,default=25)
    a=p.parse_args()
    result=local_audit(a.db,a.root,zips=a.zips.split(","),
       per_group=a.per_zip_kind,recent_years=a.recent_years,
       min_building_age=a.min_building_age)
    print(json.dumps(result,sort_keys=True,separators=(",",":")))
    if result["state"]!="SAMPLED_IMPORT_KEYWORDS_RECONCILED":sys.exit(2)

if __name__=="__main__":
    try:main()
    except (OSError,ValueError,sqlite3.Error) as error:
        print("FUN_ROOFING_PERMIT_DESCRIPTION_AUDIT_HOLD="+str(error)[:220],file=sys.stderr)
        sys.exit(1)
