#!/usr/bin/env python3
"""Operator-visible, auto-discovered local roofing research offers (V10).

Read the latest *matching quartet* of already-generated V9 public-record CSVs.
No source/network/model execution, writes, sales contacts, or roof-need claims.
HTTP backend may invoke on page load; no background polling or disk scans beyond
the user's bounded roofing research_exports directory.
"""
from __future__ import annotations
import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

VERSION="fun-roofing-opportunity-offers-v10"
KINDS=("zip_market_summary","ranked_street_blocks",
       "qualified_property_research","recent_permit_locations")
PATHWAYS=("HISTORICAL","NO_MATCH","OTHER")
PREFIX="roofing_qualified_property_research_"
STAMP=re.compile(r"^\d{8}-\d{6}-\d{6}$")
ZIP=re.compile(r"^\d{5}$")
MAX_FILE_BYTES=12*1024*1024
MAX_ROWS=20000
MAX_EXAMPLES=25
EXPECTED={
    "zip_market_summary":("zip","qualified_100_number_street_blocks",
                          "qualified_unique_properties","permit_kind",
                          "historical_x_years","recent_years","min_house_age",
                          "age_cohort_tolerance"),
    "ranked_street_blocks":("rank","zip","street_number_block",
                             "qualified_properties",
                             "recent_permit_parcels_in_street_block"),
    "qualified_property_research":("zip","street_number_block","address","apn",
                                   "construction_year","formula_a_existing_priority",
                                   "last_recorded_exact_apn_roof_permit",
                                   "historical_permit_x_years_or_more",
                                   "no_exact_apn_permit_in_imported_sources",
                                   "other_properties_with_recent_exact_apn_permit"),
    "recent_permit_locations":("zip","street_number_block","apn",
                               "latest_recent_permit_issue_date"),
}

def _file_rows(file,folder,kind):
    if file.is_symlink() or not file.is_file() or file.resolve().parent!=folder.resolve():
        raise ValueError("OPPORTUNITIES_UNSAFE_OR_MISSING_REPORT")
    if file.stat().st_size>MAX_FILE_BYTES:
        raise ValueError("OPPORTUNITIES_REPORT_SIZE_HOLD")
    with file.open("r",encoding="utf-8-sig",newline="") as stream:
        reader=csv.DictReader(stream)
        if not reader.fieldnames or not set(EXPECTED[kind])<=set(reader.fieldnames):
            raise ValueError("OPPORTUNITIES_REQUIRED_REPORT_COLUMNS_MISSING")
        rows=[]
        for row in reader:
            if len(rows)>=MAX_ROWS:
                raise ValueError("OPPORTUNITIES_REPORT_ROW_LIMIT_HOLD")
            rows.append(row)
        return rows

def _integer(value):
    try:
        if not re.fullmatch(r"\d{1,8}",str(value or "")):
            raise ValueError()
        return int(value)
    except (ValueError,TypeError) as exc:
        raise ValueError("OPPORTUNITIES_INVALID_COUNT_OR_SCORE") from exc

def _pathway(row):
    h=row.get("historical_permit_x_years_or_more")
    n=row.get("no_exact_apn_permit_in_imported_sources")
    if h not in ("True","False") or n not in ("True","False"):
        raise ValueError("OPPORTUNITIES_BOOLEAN_FIELD_INVALID")
    if h=="True" and n=="True":
        raise ValueError("OPPORTUNITIES_INCONSISTENT_HISTORY_FLAGS")
    return "HISTORICAL" if h=="True" else "NO_MATCH" if n=="True" else "OTHER"

def read_offers(root,*,pathway=None):
    if pathway is not None and pathway not in PATHWAYS:
        raise ValueError("OPPORTUNITIES_PATHWAY_NOT_SUPPORTED")
    root=Path(root)
    folder=root/"research_exports"
    empty={"version":VERSION,"state":"AWAITING_LOCAL_V9_REPORTS",
           "auto_discovered":True,"read_only":True,
           "source":"LOCAL_V9_REPORTS_ONLY",
           "no_outreach_or_model_execution":True}
    if folder.is_symlink():
        raise ValueError("OPPORTUNITIES_REPORT_FOLDER_SYMLINK_HOLD")
    if not folder.is_dir():
        return empty
    files=sorted(folder.glob(PREFIX+"*.csv"),reverse=True)
    if not files:return empty
    latest=files[0].name
    stamp=latest[len(PREFIX):-4]
    if not STAMP.fullmatch(stamp):
        raise ValueError("OPPORTUNITIES_REPORT_FILENAME_INVALID")
    names={kind:folder/("roofing_"+kind+"_"+stamp+".csv") for kind in KINDS}
    # Never mix old or partial snapshots under different timestamps.
    if any(not path.is_file() for path in names.values()):
        return {**empty,"state":"LOCAL_V9_REPORT_INCOMPLETE_HOLD"}
    data={kind:_file_rows(path,folder,kind) for kind,path in names.items()}
    zips=data["zip_market_summary"]
    blocks=data["ranked_street_blocks"]
    properties=data["qualified_property_research"]
    recent=data["recent_permit_locations"]
    if not zips or not blocks or not properties:
        raise ValueError("OPPORTUNITIES_EMPTY_READY_REPORT_HOLD")
    valid_zips={row["zip"] for row in zips}
    if len(valid_zips)!=len(zips) or len(valid_zips)>10 or any(
            not isinstance(z,str) or not ZIP.fullmatch(z) for z in valid_zips):
        raise ValueError("OPPORTUNITIES_ZIP_SET_INVALID")
    filters=("permit_kind","historical_x_years","recent_years",
             "min_house_age","age_cohort_tolerance")
    expected_filters=tuple(zips[0].get(f) for f in filters)
    if zips[0]["permit_kind"] not in ("replacement_like","roof_related") or any(
            tuple(row.get(f) for f in filters)!=expected_filters for row in zips[1:]):
        raise ValueError("OPPORTUNITIES_INCONSISTENT_ZIP_FILTERS_HOLD")
    block_map={}
    for row in blocks:
        key=(row["zip"],row["street_number_block"])
        if key in block_map or key[0] not in valid_zips:
            raise ValueError("OPPORTUNITIES_INVALID_BLOCK_ID")
        block_map[key]=row
    seen_apn=set()
    groups=defaultdict(Counter)
    zipgroups=defaultdict(Counter)
    members={kind:[] for kind in PATHWAYS}
    for row in properties:
        key=(row["zip"],row["street_number_block"])
        pkey=(row["zip"],row["apn"])
        if key not in block_map or pkey in seen_apn or not row["address"]:
            raise ValueError("OPPORTUNITIES_PROPERTY_RELATION_HOLD")
        seen_apn.add(pkey)
        kind=_pathway(row)
        groups[key][kind]+=1
        zipgroups[row["zip"]][kind]+=1
        members[kind].append(row)
    for key,block in block_map.items():
        if sum(groups[key].values())!=_integer(block["qualified_properties"]):
            raise ValueError("OPPORTUNITIES_BLOCK_PROPERTY_TOTAL_HOLD")
    seen_recent=set()
    rec_counts=Counter()
    for row in recent:
        key=(row["zip"],row["street_number_block"])
        pkey=(row["zip"],row["apn"])
        if key not in block_map or pkey in seen_recent:
            raise ValueError("OPPORTUNITIES_RECENT_PERMIT_RELATION_HOLD")
        rec_counts[key]+=1
        seen_recent.add(pkey)
    for key,block in block_map.items():
        if rec_counts[key]!=_integer(block["recent_permit_parcels_in_street_block"]):
            raise ValueError("OPPORTUNITIES_BLOCK_RECENT_PERMIT_TOTAL_HOLD")
    for z in zips:
        code=z["zip"]
        if (sum(1 for b in blocks if b["zip"]==code)!=
                _integer(z["qualified_100_number_street_blocks"])
           or sum(zipgroups[code].values())!=_integer(z["qualified_unique_properties"])):
            raise ValueError("OPPORTUNITIES_ZIP_RECONCILIATION_HOLD")
    total={kind:len(members[kind]) for kind in PATHWAYS}
    def ranked_for(target=None,limit=10):
        candidates=[]
        for (zip_code,street),block in block_map.items():
            count=(sum(groups[(zip_code,street)].values()) if target is None
                   else groups[(zip_code,street)][target])
            if not count:continue
            candidates.append({
                "zip":zip_code,
                "street_number_block":street,
                "qualified_properties":count,
                "recent_permit_parcels":rec_counts[(zip_code,street)],
                "historical_permit_properties":groups[(zip_code,street)]["HISTORICAL"],
                "no_matching_permit_properties":groups[(zip_code,street)]["NO_MATCH"],
                "other_permit_properties":groups[(zip_code,street)]["OTHER"]
            })
        candidates.sort(key=lambda b:(
            -b["qualified_properties"],-b["recent_permit_parcels"],
            b["zip"],b["street_number_block"]))
        return candidates[:limit]
    # This report can become outdated if the local import database changes.
    # Do not silently present a cached report as a new recomputation.
    db=root/"roofing.sqlite3"
    db_newer=(db.is_file() and not db.is_symlink() and
              db.stat().st_mtime>min(file.stat().st_mtime for file in names.values())+1)
    summary={
        "version":VERSION,"state":"READY_FROM_RECONCILED_LOCAL_V9_REPORTS",
        "auto_discovered":True,"read_only":True,
        "source":"LOCAL_V9_REPORTS_ONLY",
        "report_snapshot":stamp,
        "local_import_db_newer_than_report":bool(db_newer),
        "freshness":"CHECK_SOURCE_CHANGES_AND_REGENERATE_V9" if db_newer
                    else "CACHED_LOCAL_REPORT_NO_LIVE_REFRESH",
        "filters":{
            "historical_x_years":_integer(zips[0]["historical_x_years"]),
            "min_building_age":_integer(zips[0]["min_house_age"]),
            "recent_years":_integer(zips[0]["recent_years"]),
            "permit_kind":zips[0]["permit_kind"],
            "age_cohort_tolerance":_integer(zips[0]["age_cohort_tolerance"]),
        },
        "totals":{
            "qualified_street_blocks":len(blocks),
            "qualified_properties":len(properties),
            "recent_permit_locations":len(recent),
            "historical":total["HISTORICAL"],
            "no_match":total["NO_MATCH"],
            "other":total["OTHER"]
        },
        "zips":[{
            "zip":z["zip"],
            "qualified_blocks":_integer(z["qualified_100_number_street_blocks"]),
            "qualified_properties":_integer(z["qualified_unique_properties"]),
            "historical":zipgroups[z["zip"]]["HISTORICAL"],
            "no_match":zipgroups[z["zip"]]["NO_MATCH"],
            "other":zipgroups[z["zip"]]["OTHER"]
        } for z in zips],
        "top_street_blocks":ranked_for(),
        "top_historical_blocks":ranked_for("HISTORICAL",8),
        "top_no_match_blocks":ranked_for("NO_MATCH",8),
        "pathway":pathway,
        "not_verified_roof_condition_or_replacement":True,
        "no_matching_permit_is_not_no_roof_work":True,
        "street_number_block_is_not_measured_distance":True,
        "no_outreach_or_model_execution":True,
        "offers":["HISTORICAL","NO_MATCH","OTHER"],
    }
    if pathway is not None:
        rows=sorted(members[pathway],key=lambda r:(
            -_integer(r["other_properties_with_recent_exact_apn_permit"]),
            -_integer(r["formula_a_existing_priority"]),
            r["zip"],r["street_number_block"],r["address"]))
        summary["property_examples"]=[{
            "zip":r["zip"],"street_number_block":r["street_number_block"],
            "address":r["address"],"year_built":_integer(r["construction_year"]),
            "formula_a_existing_priority":_integer(r["formula_a_existing_priority"]),
            "last_exact_apn_permit":r["last_recorded_exact_apn_roof_permit"] or None,
            "recent_peer_permit_parcels":_integer(r["other_properties_with_recent_exact_apn_permit"]),
            "research_pathway":pathway
        } for r in rows[:MAX_EXAMPLES]]
        summary["pathway_total"]=total[pathway]
        summary["examples_capped"]=len(rows)>MAX_EXAMPLES
    return summary

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",required=True)
    parser.add_argument("--pathway",choices=PATHWAYS,default=None)
    args=parser.parse_args()
    print(json.dumps(read_offers(args.root,pathway=args.pathway),
                     sort_keys=True,separators=(",",":")))

if __name__=="__main__":
    try:main()
    except (ValueError,OSError,csv.Error) as exc:
        # File names and embedded CSV values must not leak through errors.
        reason=str(exc) if isinstance(exc,ValueError) else type(exc).__name__
        print("FUN_OPPORTUNITIES_REPORT_HOLD="+reason[:140],file=sys.stderr)
        sys.exit(1)
