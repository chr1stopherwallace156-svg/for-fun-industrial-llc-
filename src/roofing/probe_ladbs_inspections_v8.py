#!/usr/bin/env python3
"""V8 fixed-official-source, read-only LADBS inspection permit-join probe.

Small newest-permit research sample, NOT a completion census. No addresses,
permit numbers, original work descriptions, names, or contact data emitted.
No mutation, persistent exports, downloads, scheduled work or background jobs.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import re
import sqlite3
import ssl
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
from audit_roofing_permit_descriptions_v6 import date_before

SOURCE="la_permits_2020_present"
DATASET="9w5z-rg2h"
API="https://data.lacity.org/resource/"+DATASET+".json"
ZIPS=("90037","90049","90731","90011")
ALLOWED_TYPES=frozenset(("FINAL","FINAL INSPECTION","BUILDING FINAL","BUILDING FINAL INSPECTION"))
ALLOWED_APPROVAL=frozenset(("APPROVED","PASSED"))
MAX_PER_ZIP=5
MAX_RESULTS=500
MAX_BYTES=1_500_000
VERSION="fun-roofing-inspection-permit-join-probe-v8"

def canonical_permit(value):
    value=str(value or "").strip().upper()
    return value if re.fullmatch(r"[A-Z0-9][A-Z0-9 \-]{4,44}",value) else None

def _official_fetch(url):
    req=urllib.request.Request(url,headers={
        "Accept":"application/json",
        "User-Agent":"FunIndustrialOfficialInspectionV8/1.0 (read-only)"
    },method="GET")
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,req,fp,code,msg,hdrs,newurl):
            raise ValueError("INSPECTION_REMOTE_REDIRECT_REFUSED")
    opener=urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
        NoRedirect())
    with opener.open(req,timeout=24) as resp:
        if resp.geturl().split("?")[0]!=API:
            raise ValueError("INSPECTION_REMOTE_ORIGIN_CHANGED")
        data=resp.read(MAX_BYTES+1)
    if len(data)>MAX_BYTES:raise ValueError("INSPECTION_REMOTE_RESPONSE_TOO_LARGE")
    try: return json.loads(data.decode("utf-8"))
    except (UnicodeError,json.JSONDecodeError) as exc:
        raise ValueError("INSPECTION_REMOTE_INVALID_JSON") from exc

def probe(db,*,zips=ZIPS,per_zip=3,today=None,fetch=None):
    today=today or dt.date.today()
    if not isinstance(per_zip,int) or not 1<=per_zip<=MAX_PER_ZIP:
        raise ValueError("INSPECTION_SAMPLE_PER_ZIP_LIMIT")
    if not 1<=len(zips)<=4 or len(zips)!=len(set(zips)) or any(
        z not in ZIPS for z in zips):
        raise ValueError("INSPECTION_ZIPS_NOT_APPROVED")
    db=Path(db)
    if not db.is_file():raise ValueError("INSPECTION_DATABASE_NOT_FOUND")
    conn=sqlite3.connect(db.resolve().as_uri()+"?mode=ro",uri=True,timeout=30)
    conn.row_factory=sqlite3.Row
    try:
        conn.execute("PRAGMA query_only=ON")
        r=conn.execute("SELECT state FROM source_runs WHERE source_id=?",(SOURCE,)).fetchone()
        if not r or r["state"]!="INGESTED_NOT_COMPLETENESS_VERIFIED":
            raise ValueError("INSPECTION_PERMIT_SOURCE_NOT_COMPLETE")
        chosen={}
        for z in zips:
            rows=conn.execute("""SELECT DISTINCT e.permit_id,e.issue_date
                FROM roofing_selection_candidates_v3 p
                JOIN permits e ON e.county=p.county AND e.apn=p.apn
                WHERE p.disposition='KEEP' AND p.county='Los Angeles' AND p.zip=?
                AND e.source_id=? AND e.roof_class='REPLACEMENT_LIKE'
                AND e.issue_date>=? AND e.issue_date<=?
                ORDER BY e.issue_date DESC,e.permit_id ASC LIMIT ?""",
                (z,SOURCE,date_before(today,5).isoformat(),
                 today.isoformat(),per_zip)).fetchall()
            for r in rows:
                number=canonical_permit(r["permit_id"])
                if number is None:continue
                if number in chosen and chosen[number]!=z:
                    raise ValueError("INSPECTION_PERMIT_NUMBER_MULTI_ZIP_CONFLICT")
                chosen[number]=z
    finally:conn.close()
    if not chosen:raise ValueError("INSPECTION_NO_VALID_MATCHABLE_PERMIT_IDS")
    q="'"+ "','".join(sorted(chosen))+"'"
    params=urllib.parse.urlencode({
        "$select":"permit,permit_status,inspection,inspection_result,inspection_date",
        "$where":"permit in ("+q+")",
        "$limit":str(MAX_RESULTS),
    })
    url=API+"?"+params
    payload=(fetch or _official_fetch)(url)
    if not isinstance(payload,list):
        raise ValueError("INSPECTION_REMOTE_FORMAT_UNEXPECTED")
    if len(payload)>=MAX_RESULTS:
        raise ValueError("INSPECTION_QUERY_TRUNCATION_HOLD")
    if any(not isinstance(row,dict) for row in payload):
        raise ValueError("INSPECTION_ROW_FORMAT_INVALID")
    aggregate=Counter()
    by_zip={z:Counter() for z in zips}
    matched=set()
    candidate_final_approvals=set()
    for row in payload:
        number=canonical_permit(row.get("permit"))
        if number is None or number not in chosen:
            raise ValueError("INSPECTION_REMOTE_UNEXPECTED_PERMIT_HOLD")
        z=chosen[number]
        matched.add(number)
        aggregate["inspection_rows"]+=1
        by_zip[z]["inspection_rows"]+=1
        kind=re.sub(r"\s+"," ",str(row.get("inspection") or "").strip().upper())
        result=re.sub(r"\s+"," ",str(row.get("inspection_result") or "").strip().upper())
        date=str(row.get("inspection_date") or "").strip()
        # A syntactically valid, real calendar date is necessary; a result
        # with no inspection date must never become "approved final" evidence.
        date_match=re.match(r"^(\d{4}-\d{2}-\d{2})(?:T.*)?$",date)
        date_valid=False
        if date_match:
            try:
                dt.date.fromisoformat(date_match.group(1))
                date_valid=True
            except ValueError:pass
        if kind in ALLOWED_TYPES and result in ALLOWED_APPROVAL and date_valid:
            candidate_final_approvals.add(number)
        elif kind in ALLOWED_TYPES:
            aggregate["final_type_without_verified_approval"]+=1
            by_zip[z]["final_type_without_verified_approval"]+=1
    for z in zips:
        selected=sum(1 for zip_ in chosen.values() if zip_==z)
        matched_in_zip=sum(1 for k in matched if chosen[k]==z)
        final_in_zip=sum(1 for k in candidate_final_approvals if chosen[k]==z)
        by_zip[z].update({
            "selected_exact_permit_ids":selected,
            "found_in_official_inspection_dataset":matched_in_zip,
            "not_found_in_bounded_query":selected-matched_in_zip,
            "has_final_inspection_type_with_approved_result":final_in_zip,
        })
    aggregate["selected_exact_permit_ids"]=len(chosen)
    aggregate["found_in_official_inspection_dataset"]=len(matched)
    aggregate["not_found_in_bounded_query"]=len(chosen)-len(matched)
    aggregate["has_final_inspection_type_with_approved_result"]=len(candidate_final_approvals)
    return {
       "version":VERSION,"state":"BOUNDED_INSPECTION_JOIN_OBSERVED",
       "official_dataset":DATASET,"sample_method":"latest_replacement_like_exact_APN_matched_issued_2020_source_not_random",
       "zips":list(zips),"aggregate":dict(aggregate),
       "zip_counts":{z:dict(by_zip[z]) for z in zips},
       "exact_permit_number_matching":True,
       "source_is_full_county_coverage":False,
       "no_match_is_not_proof_of_no_inspection":True,
       "approved_final_type_is_not_proof_roof_replacement":True,
       "no_personal_data_or_permit_ids_emitted":True,
       "database_modified":False,
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--db",required=True)
    p.add_argument("--per-zip",type=int,default=3)
    a=p.parse_args()
    print(json.dumps(probe(a.db,per_zip=a.per_zip),sort_keys=True,separators=(",",":")))

if __name__=="__main__":
    try:main()
    except (ValueError,OSError,sqlite3.Error,urllib.error.URLError) as exc:
        # Avoid echoing URLs, permit IDs or filesystem paths in errors.
        reason=str(exc) if isinstance(exc,ValueError) else type(exc).__name__
        print("FUN_INSPECTION_V8_HOLD="+reason[:120])
        raise SystemExit(1)
