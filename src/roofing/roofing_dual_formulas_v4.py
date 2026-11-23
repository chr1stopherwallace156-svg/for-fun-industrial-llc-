#!/usr/bin/env python3
"""Parallel formulas for Fun Industrial's existing local roofing research index.

Formula A is the unchanged Selective V3 score. Formula B checks recorded
roof-permit *intervals* on the same assessor APN, compares recent activity
by ZIP, and never equates a permit with a completed roof replacement.

This module reads only completed official data; it cannot write to SQLite,
send outreach, search the web, or access identity/contact fields.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import re
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

VERSION = "fun-roofing-parallel-formulas-v4"
DEFAULT_ZIPS = ("90011", "90049", "90731", "90037")
REQUIRED_SOURCES = (
    "la_assessor_2021_2025", "la_permits_pre2010",
    "la_permits_2010_2019", "la_permits_2020_present",
)
PERMIT_SOURCES = REQUIRED_SOURCES[1:]
DATA_LIMITATION = (
    "LA City permit sources are not LA County-wide; a roof-related permit "
    "is not proof of completed replacement; an unmatched APN does not "
    "prove no roof work. Repeated permits do not prove roof lifespan."
)


def cutoff(today: dt.date, years: int) -> dt.date:
    try:
        return today.replace(year=today.year - years)
    except ValueError:  # Feb 29
        return today.replace(year=today.year - years, day=28)


def validate(zips, years, recent_years, min_building_age, kind, city):
    if not isinstance(years, int) or not 10 <= years <= 50:
        raise ValueError("CYCLE_YEARS_REQUIRE_10_TO_50")
    if not isinstance(recent_years, int) or not 1 <= recent_years <= 10 or recent_years >= years:
        raise ValueError("RECENT_WINDOW_MUST_BE_1_TO_10_AND_SHORTER_THAN_CYCLE")
    if not isinstance(min_building_age, int) or not 20 <= min_building_age <= 100:
        raise ValueError("BUILDING_AGE_MUST_BE_20_TO_100")
    if kind not in ("roof_related", "replacement_like"):
        raise ValueError("PERMIT_KIND_UNRECOGNIZED")
    if not isinstance(city, str) or not re.fullmatch(r"[A-Za-z0-9 \-]{3,70}", city):
        raise ValueError("CITY_FILTER_NOT_SUPPORTED")
    if not isinstance(zips, (list, tuple)) or not 1 <= len(zips) <= 10:
        raise ValueError("REQUIRE_1_TO_10_ZIPS")
    if any(not isinstance(z, str) or not re.fullmatch(r"\d{5}", z) for z in zips):
        raise ValueError("FIVE_DIGIT_ZIP_REQUIRED")
    if len(set(zips)) != len(zips):
        raise ValueError("DUPLICATE_ZIP_NOT_ALLOWED")


def require_receipts(conn):
    names = {r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    )}
    required = {"source_runs", "properties", "permits",
                "roofing_selection_candidates_v3", "roofing_selection_receipt_v3"}
    if not required <= names:
        raise ValueError("DUAL_FORMULA_SOURCE_TABLES_MISSING")
    source_states = dict(conn.execute(
        "SELECT source_id,state FROM source_runs WHERE source_id IN (?,?,?,?)",
        REQUIRED_SOURCES))
    if any(source_states.get(name) != "INGESTED_NOT_COMPLETENESS_VERIFIED"
           for name in REQUIRED_SOURCES):
        raise ValueError("DUAL_FORMULA_ALL_FOUR_COMPLETED_IMPORTS_REQUIRED")
    receipt = conn.execute(
        "SELECT selected,source_count FROM roofing_selection_receipt_v3 WHERE id=1"
    ).fetchone()
    if not receipt or receipt["selected"] < 1 or receipt["source_count"] < 4:
        raise ValueError("DUAL_FORMULA_VERIFIED_V3_INDEX_REQUIRED")


def analyze(db, *, zips=DEFAULT_ZIPS, years=20, recent_years=5,
            min_building_age=25, kind="roof_related", city="LOS ANGELES CA",
            today=None):
    """Return independent V3 property-age and V4 empirical permit-cycle results.

    V4 only counts same-APN permit matches. Address-only joins are excluded
    from its repeat-event calculation (even when the older V3 engine used
    an address match), to avoid falsely linking two different parcels.
    """
    zips = tuple(zips)
    validate(zips, years, recent_years, min_building_age, kind, city)
    today = today or dt.date.today()
    if not isinstance(today, dt.date):
        raise ValueError("TODAY_DATE_INVALID")
    if not Path(db).is_file():
        raise ValueError("DUAL_FORMULA_LOCAL_DB_MISSING")
    conn = sqlite3.connect(Path(db).resolve().as_uri()+"?mode=ro", uri=True, timeout=35)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA query_only=ON")
        conn.execute("PRAGMA busy_timeout=35000")
        require_receipts(conn)
        placeholders = ",".join("?" for _ in zips)
        params = ("Los Angeles", city, today.year - min_building_age, *zips)
        # Existing formula A is untouched. Read its stored V3 scores directly,
        # instead of recomputing or replacing the user's proven index.
        base_sql = f"""SELECT zip,COUNT(*) AS selected_properties,
              ROUND(AVG(priority),1) AS formula_a_mean,
              MIN(priority) AS formula_a_min,MAX(priority) AS formula_a_max
              FROM roofing_selection_candidates_v3
              WHERE disposition='KEEP' AND county=? AND city=?
                AND year_built <= ? AND zip IN ({placeholders})
              GROUP BY zip"""
        base = {r["zip"]: dict(r) for r in conn.execute(base_sql, params)}
        # Exact parcel match only, using existing (county,APN) permit index.
        # Complete-permit source IDs are pinned. No owner/contact fields.
        event_sql = f"""SELECT s.zip,s.apn,s.priority,e.source_id,e.permit_id,
               e.issue_date,e.roof_class
              FROM roofing_selection_candidates_v3 s
              JOIN permits e ON e.county=s.county AND e.apn=s.apn
                 AND e.source_id IN (?,?,?)
              WHERE s.disposition='KEEP' AND s.county=? AND s.city=?
                AND s.year_built <= ? AND s.zip IN ({placeholders})
              ORDER BY s.zip,s.apn,e.issue_date"""
        events = defaultdict(list)
        formula_a_scores = {}
        seen = set()
        for row in conn.execute(event_sql, (*PERMIT_SOURCES, *params)):
            if kind == "replacement_like" and row["roof_class"] != "REPLACEMENT_LIKE":
                continue
            key = (row["zip"], row["apn"])
            formula_a_scores[key] = row["priority"]
            evidence_key = (row["source_id"], row["permit_id"], *key)
            if evidence_key in seen:
                continue
            seen.add(evidence_key)
            try:
                date = dt.date.fromisoformat(row["issue_date"])
            except (TypeError, ValueError):
                continue
            if date > today or date.year < 1900:
                continue
            events[key].append(date)
        old_cutoff = cutoff(today, years)
        recent_cutoff = cutoff(today, recent_years)
        grouped = defaultdict(lambda: {
            "apn_exact_permit_matches":0, "gap_at_least_x_years":0,
            "recent_permit_properties":0, "historical_permit_properties":0,
            "recent_long_gap_repeat_properties":0, "unmatched_apn_properties":0,
        })
        samples = []
        for (z, apn), dates in events.items():
            if not dates or not base.get(z, {}).get("selected_properties"):
                continue
            dates.sort()
            stats=grouped[z]
            stats["apn_exact_permit_matches"] += 1
            last = dates[-1]
            gap = (today-last).days / 365.2425
            if last <= old_cutoff:
                stats["gap_at_least_x_years"] += 1
            recent = [d for d in dates if d >= recent_cutoff]
            historical = [d for d in dates if d <= old_cutoff]
            if recent:
                stats["recent_permit_properties"] += 1
            if historical:
                stats["historical_permit_properties"] += 1
            repeat = any(
                older <= cutoff(newer, years)
                for newer in recent for older in historical
            )
            if repeat:
                stats["recent_long_gap_repeat_properties"] += 1
            if len(samples) < 12 and (repeat or last <= old_cutoff):
                samples.append({
                    "zip": z, "apn": apn,
                    "formula_a_existing_priority":formula_a_scores.get((z,apn)),
                    "last_roof_related_permit":last.isoformat(),
                    "years_since_last_recorded_permit":round(gap,1),
                    "recent_long_gap_repeat_observed":repeat,
                    "not_proof_of_replacement":True,
                })
        markets=[]
        for z in zips:
            b=base.get(z, {})
            n=int(b.get("selected_properties",0))
            g=grouped[z]
            matched=g["apn_exact_permit_matches"]
            hist=g["historical_permit_properties"]
            rpt=g["recent_long_gap_repeat_properties"]
            g["unmatched_apn_properties"]=max(0,n-matched)
            markets.append({
                "zip":z, "formula_a_existing":{
                    "method":"existing_selective_v3_property_age_and_evidence",
                    "selected_older_residential_properties":n,
                    "mean_review_priority":b.get("formula_a_mean"),
                    "not_roof_condition_or_probability":True,
                },
                "formula_b_permit_cycle":{
                    "method":"same_parcel_observed_roof_related_permit_intervals",
                    "years_threshold":years,
                    "recent_window_years":recent_years,
                    "permit_kind":kind,
                    "exact_apn_match_properties":matched,
                    "without_exact_apn_permit_match":g["unmatched_apn_properties"],
                    "last_roof_permit_at_least_x_years_ago":g["gap_at_least_x_years"],
                    "recent_permit_properties":g["recent_permit_properties"],
                    "historical_permit_properties":hist,
                    "recent_repeat_with_gap_at_least_x_years":rpt,
                    "historical_to_recent_repeat_share_pct":
                       round(100*rpt/hist,2) if hist else None,
                    "recent_roof_permit_activity_per_1000":
                       round(1000*g["recent_permit_properties"]/n,2) if n else None,
                    "rate_not_a_replacement_probability":True,
                }})
        return {
            "version":VERSION, "state":"PARALLEL_INDEPENDENT_FORMULAS_READY",
            "read_only":True, "sources_verified":len(REQUIRED_SOURCES),
            "as_of_date":today.isoformat(), "city":city,
            "parameters":{"years":years,"recent_years":recent_years,
                          "min_building_age":min_building_age,
                          "permit_kind":kind,"zips":list(zips)},
            "formula_a_unchanged":True,
            "formula_b_equations":{
               "gap_indicator":"I(last APN-exact roof-related permit date <= today minus X years)",
               "recent_activity_per_1000":"1000 * parcels with APN-exact roof permits within R years / selected parcels",
               "long_gap_repeat":"same parcel has newer roof-related permit within R years and an older permit at least X years before newer",
               "historical_repeat_share":"100 * parcels with recent long-gap repeat / parcels with any permit at least X years old",
            },
            "markets":markets, "public_parcel_id_examples":samples,
            "no_contact_information":True,"no_roof_age_asserted":True,
            "permit_history_not_complete_countywide":True,
            "interpretation":DATA_LIMITATION,
        }
    finally:
        conn.close()


def main():
    parser=argparse.ArgumentParser(description="Two parallel read-only roofing research formulas")
    parser.add_argument("--db",required=True)
    parser.add_argument("--zips",default=",".join(DEFAULT_ZIPS))
    parser.add_argument("--years",type=int,default=20)
    parser.add_argument("--recent-years",type=int,default=5)
    parser.add_argument("--min-building-age",type=int,default=25)
    parser.add_argument("--permit-kind",choices=["roof_related","replacement_like"],
                        default="roof_related")
    parser.add_argument("--city",default="LOS ANGELES CA")
    args=parser.parse_args()
    result=analyze(args.db,zips=args.zips.split(","),years=args.years,
                   recent_years=args.recent_years,
                   min_building_age=args.min_building_age,
                   kind=args.permit_kind,city=args.city)
    print(json.dumps(result,sort_keys=True,separators=(",",":")))


if __name__=="__main__":
    try:main()
    except (OSError,ValueError,sqlite3.Error) as error:
        print("FUN_ROOFING_DUAL_FORMULA_HOLD="+str(error)[:220],file=sys.stderr)
        sys.exit(1)
