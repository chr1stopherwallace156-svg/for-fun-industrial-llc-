#!/usr/bin/env python3
"""Fun Industrial: bounded, read-only public-property review pilot.

Never infers roof age, replacement need, personal contact details, or consent.
No scraping, network, marketing, REA, AI/model calls, or database modification.
"""
from __future__ import annotations
import argparse
import csv
import datetime as dt
import json
import os
import sqlite3
import sys
from pathlib import Path

VERSION = "fun-roofing-public-review-pilot-v1"
PILOT_ZIPS = ("90011", "90049", "90731", "90037")
REQUIRED_SOURCES = (
    "la_assessor_2021_2025", "la_permits_pre2010",
    "la_permits_2010_2019", "la_permits_2020_present",
)
CSV_COLUMNS = (
    "zip", "apn", "address", "city", "year_built",
    "last_roof_related_permit", "evidence_bucket",
    "research_priority_not_probability", "roof_condition",
    "permit_coverage", "recommended_next_verification",
)


def csv_safe(value):
    """Prevent public-data strings from becoming spreadsheet formulas."""
    result = str(value if value is not None else "").replace("\x00", "").replace("\r", " ").replace("\n", " ").strip()
    if result and result[0] in "=+-@":
        return "'" + result
    return result


def twenty_year_cutoff(today):
    try:
        return today.replace(year=today.year - 20).isoformat()
    except ValueError:  # Leap-day cutoff.
        return today.replace(year=today.year - 20, day=28).isoformat()


def require_source_evidence(c):
    expected = set(REQUIRED_SOURCES)
    present = {row[0]: row[1] for row in c.execute(
        "SELECT source_id,state FROM source_runs WHERE source_id IN (?,?,?,?)",
        REQUIRED_SOURCES
    )}
    if any(present.get(item) != "INGESTED_NOT_COMPLETENESS_VERIFIED" for item in expected):
        raise ValueError("FOUR_OFFICIAL_IMPORTS_NOT_COMPLETE_HOLD")
    receipt = c.execute(
        "SELECT selected,held,source_count FROM roofing_selection_receipt_v3 WHERE id=1"
    ).fetchone()
    if not receipt or int(receipt[0]) < 500 or int(receipt[2]) < 4:
        raise ValueError("VERIFIED_ROOFING_SELECTION_INDEX_REQUIRED_HOLD")


def produce_rows(db, *, today, per_zip=125, old_per_zip=65):
    """Read only the approved four markets, with independent evidence strata."""
    if not 1 <= per_zip <= 250 or not 0 <= old_per_zip <= per_zip:
        raise ValueError("PILOT_QUOTAS_INVALID")
    if not Path(db).is_file():
        raise ValueError("ROOFING_DATABASE_MISSING")
    file_uri = Path(db).resolve().as_uri() + "?mode=ro"
    c = sqlite3.connect(file_uri, uri=True, timeout=30)
    c.row_factory = sqlite3.Row
    try:
        c.execute("PRAGMA query_only=ON")
        c.execute("PRAGMA busy_timeout=30000")
        require_source_evidence(c)
        cutoff = twenty_year_cutoff(today)
        oldest_building_year = today.year - 25
        rows = []
        summary = []
        for zipcode in PILOT_ZIPS:
            totals = {}
            for bucket, quota in (
                ("OLD_ROOF_RELATED_PERMIT_RECORDED", old_per_zip),
                ("NO_MATCH_IN_IMPORTED_LA_CITY_PERMITS", per_zip - old_per_zip),
            ):
                if not quota:
                    continue
                sql = """SELECT zip,apn,address,city,year_built,last_roof_permit,priority
                    FROM roofing_selection_candidates_v3
                    WHERE county='Los Angeles' AND zip=?
                      AND disposition='KEEP'
                      AND year_built IS NOT NULL AND year_built <= ?
                      AND address IS NOT NULL AND address!=''
                      AND apn IS NOT NULL AND apn!=''
                      AND """
                if bucket == "OLD_ROOF_RELATED_PERMIT_RECORDED":
                    sql += "last_roof_permit IS NOT NULL AND last_roof_permit <= ?"
                    params = (zipcode, oldest_building_year, cutoff)
                else:
                    sql += "last_roof_permit IS NULL"
                    params = (zipcode, oldest_building_year)
                sql += " ORDER BY priority DESC,year_built ASC,apn ASC LIMIT ?"
                found = c.execute(sql, (*params, quota)).fetchall()
                if len(found) != quota:
                    raise ValueError("PILOT_INSUFFICIENT_VERIFIED_COHORT_" + zipcode + "_" + bucket)
                totals[bucket] = len(found)
                for record in found:
                    rows.append({
                        "zip": record["zip"],
                        "apn": record["apn"],
                        "address": record["address"],
                        "city": record["city"],
                        "year_built": record["year_built"],
                        "last_roof_related_permit": record["last_roof_permit"],
                        "evidence_bucket": bucket,
                        "research_priority_not_probability": record["priority"],
                        "roof_condition": "UNVERIFIED",
                        "permit_coverage": "LA_CITY_ONLY_INCOMPLETE_NOT_PROOF_OF_ROOF_AGE",
                        "recommended_next_verification": "CHECK_ORIGINAL_PERMIT_DETAILS_AND_PROPERTY_HISTORY",
                    })
            summary.append({"zip": zipcode, "rows": per_zip, "old_permit": old_per_zip,
                            "no_match": per_zip - old_per_zip})
        if len(rows) != len(PILOT_ZIPS) * per_zip:
            raise ValueError("PILOT_TOTAL_COUNT_MISMATCH")
        if len({(r["zip"], r["apn"]) for r in rows}) != len(rows):
            raise ValueError("PILOT_DUPLICATE_PARCEL_HOLD")
        return rows, summary
    finally:
        c.close()


def export_pilot(db, folder, *, today=None, per_zip=125, old_per_zip=65):
    today = today or dt.date.today()
    rows, summary = produce_rows(db, today=today, per_zip=per_zip, old_per_zip=old_per_zip)
    output_dir = Path(folder).expanduser().resolve()
    if output_dir.is_symlink():
        raise ValueError("PILOT_OUTPUT_DIRECTORY_LINK_HOLD")
    output_dir.mkdir(parents=True, exist_ok=True)
    name = "LA-roofing-review-pilot-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S-%f") + ".csv"
    output = output_dir / name
    try:
        with output.open("x", encoding="utf-8-sig", newline="") as writer:
            csv_writer = csv.DictWriter(writer, fieldnames=CSV_COLUMNS, extrasaction="raise")
            csv_writer.writeheader()
            for row in rows:
                csv_writer.writerow({k: csv_safe(row.get(k)) for k in CSV_COLUMNS})
    except Exception:
        output.unlink(missing_ok=True)
        raise
    return {
        "version": VERSION, "state": "LOCAL_READ_ONLY_PILOT_EXPORTED",
        "properties": len(rows),
        "market_breakdown": summary,
        "output_file": str(output),
        "only_public_property_research_fields": True,
        "person_contact_fields_exported": 0,
        "automated_outreach": False,
        "roof_replacement_or_need_verified": False,
        "no_permit_is_proof_of_no_roof_work": False,
        "source_data_or_production_dashboard_changed": False,
    }


def main():
    parser = argparse.ArgumentParser(description="Read-only, 500-record LA roofing research pilot")
    parser.add_argument("--db", required=True)
    parser.add_argument("--output-dir", default=str(Path(
        os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) /
        "FunIndustrial" / "RoofingBulkV2" / "research_exports"))
    args = parser.parse_args()
    print(json.dumps(export_pilot(args.db, args.output_dir),sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, sqlite3.Error) as error:
        print("FUN_ROOFING_PILOT_HOLD=" + str(error)[:220], file=sys.stderr)
        sys.exit(1)
