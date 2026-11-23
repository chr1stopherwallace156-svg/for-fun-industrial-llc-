#!/usr/bin/env python3
"""Local, read-only roofing ZIP/street-block/property research report.

Only official imported assessor and LA City permit evidence and existing
Formula A/B/C calculations. No model-generated roof-condition or sales
probability, no contact data, no outreach. CSV files are created solely in
the user's local research_exports directory.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import sqlite3
import sys
from pathlib import Path

from roofing_dual_formulas_v4 import (
    DEFAULT_ZIPS, PERMIT_SOURCES, require_receipts, validate, cutoff
)
from roofing_neighbor_context_v5 import neighbor_context, street_block

VERSION="fun-roofing-location-research-report-v9"
ROOT=Path(os.environ.get("LOCALAPPDATA",str(Path.home()/"AppData"/"Local")))/"FunIndustrial"/"RoofingBulkV2"
BLOCK_FIELDS=(
    "rank","zip","street_number_block","qualified_properties",
    "recent_permit_parcels_in_street_block",
    "selected_older_parcels_in_street_block",
    "min_construction_year","max_construction_year",
    "permit_kind","recent_years","min_house_age","age_cohort_tolerance",
    "min_similar_age_neighbors","interpretation",
)
PROPERTY_FIELDS=(
    "zip","street_number_block","address","apn","construction_year",
    "construction_age_years","formula_a_existing_priority",
    "last_recorded_exact_apn_roof_permit","last_permit_years_ago_rounded",
    "historical_permit_x_years_or_more",
    "no_exact_apn_permit_in_imported_sources",
    "last_v3_observed_roof_permit",
    "other_age_similar_properties",
    "other_properties_with_recent_exact_apn_permit",
    "permit_kind","recent_years","historical_x_years",
    "research_label",
)
RECENT_PERMIT_FIELDS=(
    "zip","street_number_block","address","apn",
    "construction_year","latest_recent_permit_issue_date",
    "permit_description_class","research_label",
)
ZIP_FIELDS=(
    "zip","selected_older_residential_properties",
    "qualified_100_number_street_blocks",
    "qualified_unique_properties",
    "recorded_recent_permit_parcels_in_qualified_blocks",
    "permit_kind","historical_x_years","recent_years",
    "min_house_age","age_cohort_tolerance",
)

def analyze_locations(db,*,zips=DEFAULT_ZIPS,years=20,recent_years=5,
                      min_building_age=25,kind="replacement_like",
                      city="LOS ANGELES CA",peer_years=5,min_peers=5,
                      today=None):
    zips=tuple(zips)
    validate(zips,years,recent_years,min_building_age,kind,city)
    if not isinstance(peer_years,int) or not 0<=peer_years<=15:
        raise ValueError("LOCATION_PEER_YEARS_OUT_OF_RANGE")
    if not isinstance(min_peers,int) or not 3<=min_peers<=30:
        raise ValueError("LOCATION_MIN_PEERS_OUT_OF_RANGE")
    today=today or dt.date.today()
    if not isinstance(today,dt.date):
        raise ValueError("LOCATION_TODAY_MUST_BE_DATE")
    path=Path(db)
    if not path.is_file():
        raise ValueError("LOCATION_LOCAL_DATABASE_MISSING")
    conn=sqlite3.connect(path.resolve().as_uri()+"?mode=ro",uri=True,timeout=60)
    conn.row_factory=sqlite3.Row
    try:
        conn.execute("PRAGMA query_only=ON")
        conn.execute("PRAGMA busy_timeout=60000")
        require_receipts(conn)
        # Reuse existing Formula C cohort logic. Default 5-block preview is
        # unchanged; this explicit export reads every qualifying block.
        neighbor=neighbor_context(
            conn,zips=zips,today=today,recent_years=recent_years,
            min_building_age=min_building_age,kind=kind,city=city,
            peer_years=peer_years,min_peers=min_peers,
            max_blocks_per_zip=1000,
            include_property_candidates=True,max_property_candidates=20000,
        )
        zstats=neighbor["formula_c_neighborhood_context"]["zips"]
        blocks=[]
        for z in zips:
            reported=zstats[z]["unique_street_blocks_with_two_or_more_age_matched_recent_peer_permits"]
            entries=neighbor["distinct_block_research_examples"][z]
            if len(entries)!=reported:
                raise ValueError("LOCATION_BLOCK_COVERAGE_TRUNCATED_OR_INCONSISTENT")
            for row in entries:
                blocks.append({
                    "zip":z,
                    "street_number_block":row["street_number_block"],
                    "qualified_properties":int(row["subjects_with_two_or_more_recent_peer_permits"]),
                    "recent_permit_parcels_in_street_block":int(row["distinct_recent_exact_apn_permit_parcels_in_block"]),
                    "selected_older_parcels_in_street_block":int(row["distinct_selected_old_parcels_in_block"]),
                    "min_construction_year":int(row["construction_year_min"]),
                    "max_construction_year":int(row["construction_year_max"]),
                    "permit_kind":kind,
                    "recent_years":recent_years,
                    "min_house_age":min_building_age,
                    "age_cohort_tolerance":peer_years,
                    "min_similar_age_neighbors":min_peers,
                    "interpretation":"RESEARCH_ONLY_NOT_ROOF_CONDITION_OR_CONFIRMED_REPLACEMENT",
                })
        # Research locations ordered by count of qualifying properties, then
        # number of distinct recorded recent peer-permit parcels. No new
        # probabilistic scoring formula is invented.
        blocks.sort(key=lambda b:(
            -b["qualified_properties"],-b["recent_permit_parcels_in_street_block"],
            b["zip"],b["street_number_block"]))
        for i,row in enumerate(blocks,1):row["rank"]=i
        block_index={(r["zip"],r["street_number_block"]):r for r in blocks}
        candidates=neighbor["qualified_property_research_rows"]
        if len(candidates)!=sum(zstats[z]["candidates_with_two_or_more_recent_peer_roof_permits"] for z in zips):
            raise ValueError("LOCATION_PROPERTY_COHORT_TOTAL_MISMATCH")
        seen=set()
        properties=[]
        old=cutoff(today,years).isoformat()
        src_placeholders=",".join("?" for _ in PERMIT_SOURCES)
        sql=f"""SELECT MAX(e.issue_date) FROM permits e
            WHERE e.county='Los Angeles' AND e.apn=?
              AND e.source_id IN ({src_placeholders})
              AND e.issue_date<=?"""
        if kind=="replacement_like":
            sql+=" AND e.roof_class='REPLACEMENT_LIKE'"
        for row in candidates:
            key=(row["zip"],row["apn"])
            if key in seen:raise ValueError("LOCATION_DUPLICATE_PARCEL_HOLD")
            seen.add(key)
            bk=(row["zip"],row["street_number_block"])
            if bk not in block_index:
                raise ValueError("LOCATION_PROPERTY_BLOCK_NOT_QUALIFIED")
            last=conn.execute(sql,(row["apn"],*PERMIT_SOURCES,today.isoformat())).fetchone()[0]
            if last and not re.fullmatch(r"\d{4}-\d{2}-\d{2}",str(last)):
                raise ValueError("LOCATION_INVALID_RECORDED_PERMIT_DATE")
            history=("RECORDED_OLD_PERMIT_RESEARCH" if last and last<=old else
                     "RECENT_OR_INTERMEDIATE_PERMIT_REVIEW" if last else
                     "NO_EXACT_APN_PERMIT_IN_IMPORTED_SOURCES")
            age=int(today.year-int(row["construction_year"]))
            since=(round((today-dt.date.fromisoformat(last)).days/365.2425,1)
                   if last else "")
            properties.append({
                "zip":row["zip"],
                "street_number_block":row["street_number_block"],
                "address":row["address"],
                "apn":row["apn"],
                "construction_year":row["construction_year"],
                "construction_age_years":age,
                "formula_a_existing_priority":row["formula_a_existing_priority"],
                "last_recorded_exact_apn_roof_permit":last or "",
                "last_permit_years_ago_rounded":since,
                "historical_permit_x_years_or_more":bool(last and last<=old),
                "no_exact_apn_permit_in_imported_sources":not bool(last),
                "last_v3_observed_roof_permit":row["last_v3_observed_roof_permit"] or "",
                "other_age_similar_properties":row["other_age_similar_properties"],
                "other_properties_with_recent_exact_apn_permit":row["other_properties_with_recent_exact_apn_permit"],
                "permit_kind":kind,
                "recent_years":recent_years,
                "historical_x_years":years,
                "research_label":history+"_NOT_PROOF_OF_ROOF_NEED",
            })
        properties.sort(key=lambda row:(
            block_index[(row["zip"],row["street_number_block"])]["rank"],
            -row["other_properties_with_recent_exact_apn_permit"],
            -int(row["formula_a_existing_priority"] or 0),
            row["address"],row["apn"]))
        # The permit-side location list is distinct from candidate properties:
        # it shows which exact-APN parcels have recorded recent permit activity
        # *within* the qualifying blocks. No homeowner/person fields.
        places=",".join("?" for _ in zips)
        src_places=",".join("?" for _ in PERMIT_SOURCES)
        evidence_sql=f"""SELECT s.zip,s.apn,s.address,s.year_built,
                   e.issue_date,e.roof_class
            FROM roofing_selection_candidates_v3 s
            JOIN permits e ON e.county=s.county AND e.apn=s.apn
            WHERE s.disposition='KEEP' AND s.county=? AND s.city=?
              AND s.year_built<=? AND s.zip IN ({places})
              AND e.source_id IN ({src_places})
              AND e.issue_date>=? AND e.issue_date<=?"""
        evidence_args=("Los Angeles",city,today.year-min_building_age,*zips,
                      *PERMIT_SOURCES,cutoff(today,recent_years).isoformat(),
                      today.isoformat())
        if kind=="replacement_like":
            evidence_sql+=" AND e.roof_class='REPLACEMENT_LIKE'"
        activity={}
        for item in conn.execute(evidence_sql,evidence_args):
            block_key=street_block(item["address"])
            if block_key is None:continue
            named=f"{block_key[1]*100}-{block_key[1]*100+99} {block_key[0]}"
            group_key=(item["zip"],named)
            if group_key not in block_index:continue
            apn_key=(item["zip"],item["apn"])
            if (apn_key in activity and
                    activity[apn_key]["latest_recent_permit_issue_date"]>=item["issue_date"]):
                continue
            activity[apn_key]={
                "zip":item["zip"],"street_number_block":named,
                "address":item["address"],"apn":item["apn"],
                "construction_year":item["year_built"],
                "latest_recent_permit_issue_date":item["issue_date"],
                "permit_description_class":item["roof_class"],
                "research_label":"RECORDED_RECENT_ROOF_PERMIT_NOT_PROOF_OF_COMPLETED_REPLACEMENT",
            }
            if len(activity)>20000:
                raise ValueError("LOCATION_RECENT_ACTIVITY_REPORT_LIMIT_EXCEEDED")
        recent_locations=sorted(activity.values(),key=lambda row:(
            block_index[(row["zip"],row["street_number_block"])]["rank"],
            -int(row["latest_recent_permit_issue_date"].replace("-","")),
            row["address"],row["apn"]))
        zip_rows=[]
        for z in zips:
            b=[x for x in blocks if x["zip"]==z]
            zip_rows.append({
                "zip":z,
                "selected_older_residential_properties":conn.execute(
                    """SELECT COUNT(*) FROM roofing_selection_candidates_v3
                    WHERE county=? AND city=? AND disposition='KEEP'
                      AND zip=? AND year_built<=?""",
                    ("Los Angeles",city,z,today.year-min_building_age)
                ).fetchone()[0],
                "qualified_100_number_street_blocks":len(b),
                "qualified_unique_properties":sum(1 for x in properties if x["zip"]==z),
                "recorded_recent_permit_parcels_in_qualified_blocks":
                   sum(x["recent_permit_parcels_in_street_block"] for x in b),
                "permit_kind":kind,
                "historical_x_years":years,
                "recent_years":recent_years,
                "min_house_age":min_building_age,
                "age_cohort_tolerance":peer_years,
            })
        return {
            "state":"ROOFING_LOCATION_RESEARCH_READY",
            "version":VERSION,
            "zips":list(zips),"parameters":{
                "historical_x_years":years,"recent_years":recent_years,
                "minimum_construction_age":min_building_age,
                "permit_kind":kind,"age_cohort_tolerance":peer_years,
                "min_similar_age_neighbors":min_peers},
            "zip_rows":zip_rows,"blocks":blocks,"properties":properties,
            "recent_permit_locations":recent_locations,
            "total_qualified_street_blocks":len(blocks),
            "total_qualified_unique_properties":len(properties),
            "total_recent_permit_locations_in_qualified_blocks":len(recent_locations),
            "source_permit_coverage_not_complete_countywide":True,
            "no_recorded_permit_does_not_mean_no_roof_work":True,
            "construction_year_is_not_actual_roof_age":True,
            "roof_replacement_or_damage_not_verified":True,
            "street_block_is_not_geocoded_distance":True,
            "formula_a_stored_scores_unchanged":True,
            "no_property_owner_contacts_or_automated_outreach":True,
            "read_only_database":True,
        }
    finally:
        conn.close()

def write_reports(result,output_dir):
    folder=Path(output_dir)
    if folder.exists() and not folder.is_dir():
        raise ValueError("LOCATION_EXPORT_DESTINATION_NOT_FOLDER")
    folder.mkdir(parents=True,exist_ok=True)
    stamp=dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    files={}
    created=[]
    datasets=(
        ("zip_market_summary",ZIP_FIELDS,result["zip_rows"]),
        ("ranked_street_blocks",BLOCK_FIELDS,result["blocks"]),
        ("qualified_property_research",PROPERTY_FIELDS,result["properties"]),
        ("recent_permit_locations",RECENT_PERMIT_FIELDS,result["recent_permit_locations"]),
    )
    try:
        for title,fields,rows in datasets:
            path=folder/(f"roofing_{title}_{stamp}.csv")
            with path.open("x",encoding="utf-8-sig",newline="") as handle:
                created.append(path)
                writer=csv.DictWriter(handle,fieldnames=fields,extrasaction="raise")
                writer.writeheader()
                writer.writerows(rows)
            files[title]=str(path)
    except Exception:
        # Only remove report files successfully created by this invocation.
        for name in created:
            name.unlink(missing_ok=True)
        raise
    return files

def main():
    p=argparse.ArgumentParser(description="Read-only A/B/C roofing ZIP + street-block + property research")
    p.add_argument("--db",required=True)
    p.add_argument("--output-dir",default=str(ROOT/"research_exports"))
    p.add_argument("--zips",default="90037,90049,90731,90011")
    p.add_argument("--years",type=int,default=20,
                   help="X years for last exact-parcel historical roof permit")
    p.add_argument("--recent-years",type=int,default=5)
    p.add_argument("--min-building-age",type=int,default=25)
    p.add_argument("--permit-kind",choices=("roof_related","replacement_like"),
                   default="replacement_like")
    p.add_argument("--peer-years",type=int,default=5)
    p.add_argument("--min-peers",type=int,default=5)
    args=p.parse_args()
    result=analyze_locations(
        args.db,zips=args.zips.split(","),years=args.years,
        recent_years=args.recent_years,min_building_age=args.min_building_age,
        kind=args.permit_kind,peer_years=args.peer_years,
        min_peers=args.min_peers)
    files=write_reports(result,args.output_dir)
    print(f"ROOFING_LOCATION_REPORT={result['state']}")
    print(f"QUALIFYING_STREET_BLOCKS={result['total_qualified_street_blocks']}")
    print(f"QUALIFYING_UNIQUE_PROPERTIES={result['total_qualified_unique_properties']}")
    print(f"RECENT_PERMIT_LOCATIONS={result['total_recent_permit_locations_in_qualified_blocks']}")
    print(f"FILTER_X_YEARS={args.years} BUILDING_MIN_AGE={args.min_building_age} "
          f"RECENT_PERMIT_YEARS={args.recent_years} PERMIT_KIND={args.permit_kind}")
    for row in result["zip_rows"]:
        print(f"ZIP={row['zip']} BLOCKS={row['qualified_100_number_street_blocks']} "
              f"UNIQUE_PROPERTY_CANDIDATES={row['qualified_unique_properties']}")
    for key,path in files.items():
        print(f"REPORT_{key.upper()}={path}")
    print("LIMITATION=Construction_age_not_roof_age;permit_not_replacement_proof;no_match_not_no_work;street_block_not_geodistance")

if __name__=="__main__":
    try:main()
    except (OSError,ValueError,sqlite3.Error) as exc:
        print("FUN_ROOFING_LOCATION_RESEARCH_HOLD="+(
            str(exc) if isinstance(exc,ValueError) else type(exc).__name__
        )[:160],file=sys.stderr)
        sys.exit(1)
