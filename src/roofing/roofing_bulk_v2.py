#!/usr/bin/env python3
"""Fun Industrial Roofing Bulk V2: official full exports -> local SQLite; no sales outreach.

All downloads are explicit commands to fixed official URLs. No API key is needed for
public SODA3 full exports. Use SOCRATA_APP_TOKEN from environment if one was issued.
This tool does not guess missing permit coverage or roof condition.
"""
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import os
import re
import shutil
import sqlite3
import sys
import time
import urllib.request
import zipfile
from pathlib import Path
from selective_extract_v3 import select as materialize_roof_targets

VERSION = "fun-roofing-bulk-v2"
DEFAULT_ROOT = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "FunIndustrial" / "RoofingBulkV2"
SOURCES = {
    "la_assessor_2021_2025": ("https://apps.gis.lacounty.gov/static/hub/Assessor/Assessor_Parcel_Roll_2021_2025.zip", "la_properties"),
    "la_permits_pre2010": ("https://data.lacity.org/api/v3/views/e67z-kt2n/export.csv", "la_permits"),
    "la_permits_2010_2019": ("https://data.lacity.org/api/v3/views/dyxf-7hc4/export.csv", "la_permits"),
    "la_permits_2020_present": ("https://data.lacity.org/api/v3/views/pi9x-tg5x/export.csv", "la_permits"),
    "sb_assessor_characteristics": ("https://arc.sbcounty.gov/wp-content/uploads/sites/70/arcforms/PIMSPropertyCharacteristics_20260617_7928_205.zip", "sb_properties"),
    "sb_arcgis_parcels": ("https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/Parcels_for_San_Bernardino_County/FeatureServer/0/query", "sb_properties"),
}
ROOF = re.compile(r"\b(?:REROOF(?:ING)?|RE[\s-]ROOF(?:ING)?|ROOF(?:ING)?|SHINGLE|SHINGLES)\b", re.I)
REPLACED = re.compile(r"\b(?:REROOF(?:ING)?|RE[\s-]ROOF(?:ING)?|ROOF\s*(?:REPLACEMENT|REPLACE)|REPLACE\s*(?:THE\s*)?ROOF)\b", re.I)
RESIDENTIAL = re.compile(r"(?:SINGLE[\s_-]*FAMILY|^SFR$|^R1$|RESIDENTIAL|1[\s_-]*FAMILY|ONE[\s_-]*FAMILY)", re.I)
COUNTY_MAP = {"LA": "Los Angeles", "LOS ANGELES": "Los Angeles",
              "SB": "San Bernardino", "SAN BERNARDINO": "San Bernardino"}
ADDRESS_FIELDS = ("address", "situs", "site_address", "property_location", "primary_address", "street_address", "rec_parsit_street_name")
APN_FIELDS = ("apn", "ain", "assessor_id", "assessor_parcel_number", "rec_parcel_nbr", "pin_nbr", "property_id")
YEAR_FIELDS = ("year_built", "rec_sfrs_const_year", "building_year_built", "year_property_was_built")
ZIP_FIELDS = ("zip", "zip_code", "zipcode", "site_address_zip_code", "rec_parsit_zip1")
CITY_FIELDS = ("city", "site_city", "rec_parsit_city")
USE_FIELDS = ("classification", "use_code_1st_digit", "property_use_type", "use_type", "property_type", "rec_land_type", "property_use_code")
DATE_FIELDS = ("issue_date", "issue_dt", "issue_date_1", "issued", "permit_issue_date", "issue_date_or_first_status")
DESC_FIELDS = ("work_desc", "work_description", "description", "permit_description", "work_type")
PERMIT_FIELDS = ("permit_nbr", "permit_number", "permit_no", "permit_id")

def emit(obj):
    print(json.dumps(obj, sort_keys=True, ensure_ascii=True, separators=(",", ":")))

def clean(s, limit=240):
    return re.sub(r"[\x00-\x1f\x7f]+", " ", str(s or "")).strip()[:limit]

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9 ]", " ", clean(s).upper())).strip()

def header(s):
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", str(s).lower())).strip("_")

def field(row, names):
    for name in names:
        v = row.get(name, "")
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""

def int_year(s):
    text = clean(s, 20).replace(",", "")
    if not re.fullmatch(r"\d{4}", text):
        return None
    n = int(text)
    return n if 1800 <= n <= dt.date.today().year else None

def parse_date(s):
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", clean(s, 32))
    if match:
        try:
            return dt.date(int(match[1]), int(match[2]), int(match[3])).isoformat()
        except ValueError:
            pass
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s|$)", clean(s, 32))
    if m:
        try:
            return dt.date(int(m[3]), int(m[1]), int(m[2])).isoformat()
        except ValueError:
            pass
    return None

def parse_site(value, row):
    address = clean(value, 240)
    city = clean(field(row, CITY_FIELDS), 90)
    zipcode = re.match(r"\d{5}", clean(field(row, ZIP_FIELDS), 20))
    zipvalue = zipcode.group(0) if zipcode else ""
    # Assessor field may contain: 123 MAIN ST, LOS ANGELES, CA 90001.
    m = re.match(r"^(.+?),\s*([^,]+?),?\s+CA\s+(\d{5})(?:-\d{4})?$", address, re.I)
    if m:
        address, city, zipvalue = m.group(1), city or m.group(2), zipvalue or m.group(3)
    elif "," in address:
        parts = [p.strip() for p in address.split(",")]
        if len(parts) >= 2 and re.search(r"\d", parts[0]):
            address = parts[0]
            if not city:
                city = parts[1].replace(" CA", "").strip()
    if not zipvalue:
        z = re.search(r"\b(\d{5})(?:-\d{4})?\s*$", address)
        if z:
            zipvalue = z.group(1)
            address = address[:z.start()].strip(" ,")
    return clean(address, 180), clean(city, 90), zipvalue

def db_open(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(path), timeout=60)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA busy_timeout=60000")
    c.execute("PRAGMA temp_store=FILE")
    c.execute("PRAGMA synchronous=NORMAL")
    c.executescript("""
      CREATE TABLE IF NOT EXISTS properties(
        county TEXT NOT NULL, apn TEXT NOT NULL, city TEXT, zip TEXT,
        address TEXT, address_key TEXT, year_built INTEGER, residential INTEGER,
        use_label TEXT, roll_year INTEGER, source_id TEXT NOT NULL,
        PRIMARY KEY(county,apn));
      CREATE INDEX IF NOT EXISTS properties_market ON properties(county,city,zip);
      CREATE INDEX IF NOT EXISTS properties_address ON properties(county,zip,address_key);
      CREATE TABLE IF NOT EXISTS permits(
        source_id TEXT NOT NULL, permit_id TEXT NOT NULL, county TEXT NOT NULL,
        jurisdiction TEXT NOT NULL, apn TEXT, zip TEXT, address_key TEXT,
        issue_date TEXT NOT NULL, roof_class TEXT NOT NULL,
        PRIMARY KEY(source_id,permit_id));
      CREATE INDEX IF NOT EXISTS permits_apn ON permits(county,apn,issue_date);
      CREATE INDEX IF NOT EXISTS permits_address ON permits(county,zip,address_key,issue_date);
      CREATE TABLE IF NOT EXISTS source_runs(
        source_id TEXT PRIMARY KEY, kind TEXT NOT NULL, county TEXT NOT NULL,
        jurisdiction TEXT NOT NULL, state TEXT NOT NULL, ingested INTEGER NOT NULL DEFAULT 0,
        skipped INTEGER NOT NULL DEFAULT 0, file_sha256 TEXT, filename TEXT,
        updated TEXT, coverage TEXT NOT NULL DEFAULT 'NOT_VERIFIED');
      CREATE TABLE IF NOT EXISTS candidates(
        county TEXT NOT NULL, apn TEXT NOT NULL, city TEXT, zip TEXT, address TEXT,
        year_built INTEGER, residential INTEGER, last_roof_permit TEXT,
        status TEXT NOT NULL, priority INTEGER NOT NULL, evidence TEXT NOT NULL,
        PRIMARY KEY(county,apn));
      CREATE INDEX IF NOT EXISTS candidates_market ON candidates(county,city,zip,status,priority);
    """)
    return c

def input_members(path):
    if path.suffix.lower() == ".csv":
        # Keep file handles scoped to the consumer. Windows refuses to delete
        # a TemporaryDirectory if one of its CSV handles remains open.
        with path.open("rb") as stream:
            yield path.name, stream
    elif zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            members = [m for m in z.infolist() if m.filename.lower().endswith(".csv") and not m.is_dir()]
            if not members:
                raise ValueError("ZIP_HAS_NO_CSV_MEMBER: source needs a documented fixed-width or GIS adapter")
            if len(members) > 100 or sum(m.file_size for m in members) > 12 * 1024**3:
                raise ValueError("ZIP_UNCOMPRESSED_LIMIT")
            for item in members:
                if item.file_size > 12 * 1024**3 or ".." in item.filename or item.filename.startswith("/"):
                    raise ValueError("ZIP_MEMBER_UNSAFE")
                with z.open(item) as data:
                    yield item.filename, data
    else:
        raise ValueError("SUPPORTED_INPUT_IS_CSV_OR_ZIP_CONTAINING_CSV")

# Preserve just the small, auditable set of public fields used for research.
# Large county exports can have hundreds of irrelevant or repeated headers.
REQUIRED_CSV_FIELDS = frozenset(
    ADDRESS_FIELDS + APN_FIELDS + YEAR_FIELDS + ZIP_FIELDS + CITY_FIELDS +
    USE_FIELDS + DATE_FIELDS + DESC_FIELDS + PERMIT_FIELDS +
    ("roll_year", "tax_year", "rollyear")
)

def csv_rows(binary):
    """Project relevant columns from very wide CSVs in bounded memory.

    Duplicate irrelevant headers are ignored. Two relevant columns with the
    same normalized header must agree (or be empty) on *every* row; otherwise
    reject the source rather than invent a property location, age, or permit.
    """
    # TextIOWrapper owns the binary stream; scoped context also avoids Windows
    # file locks during test cleanup, including on exceptions.
    with io.TextIOWrapper(binary, encoding="utf-8-sig", errors="replace", newline="") as text:
        reader = csv.reader(text)
        raw_headers = next(reader, None)
        if not raw_headers:
            raise ValueError("CSV_HEADER_MISSING")
        if len(raw_headers) > 2048:
            raise ValueError("CSV_HEADER_ABOVE_SAFE_COLUMN_LIMIT")
        positions = {}
        for index, original in enumerate(raw_headers):
            normalized = header(original)
            if normalized in REQUIRED_CSV_FIELDS:
                positions.setdefault(normalized, []).append(index)
        if not positions:
            raise ValueError("CSV_NO_SUPPORTED_PROPERTY_OR_PERMIT_COLUMNS")
        width = len(raw_headers)
        for line_number, cells in enumerate(reader, 2):
            if len(cells) > width:
                raise ValueError("CSV_ROW_EXCEEDS_HEADER_COLUMNS_AT_LINE_" + str(line_number))
            # Some legitimate CSV exporters omit empty *trailing* columns.
            if len(cells) < width:
                cells.extend([""] * (width - len(cells)))
            projected = {}
            for name, indices in positions.items():
                chosen = ""
                for index in indices:
                    value = cells[index].strip()
                    if not value:
                        continue
                    if chosen and value != chosen:
                        raise ValueError("CSV_CRITICAL_DUPLICATE_CONFLICT_" + name)
                    chosen = value
                projected[name] = chosen
            yield projected

def parse_property(row, county, source_id, fallback_roll):
    address, city, zipcode = parse_site(field(row, ADDRESS_FIELDS), row)
    apn = norm(field(row, APN_FIELDS)).replace(" ", "")
    if not apn and (not address or not zipcode):
        return None
    if not apn:
        apn = "ADDRESS-" + hashlib.sha256((county+"|"+zipcode+"|"+norm(address)).encode()).hexdigest()[:32]
    year = int_year(field(row, YEAR_FIELDS))
    roll = int_year(field(row, ("roll_year", "tax_year", "rollyear"))) or fallback_roll
    use = clean(field(row, USE_FIELDS), 80)
    classification = 1 if RESIDENTIAL.search(use) else 0
    # 0 means unclassified, NOT 'known nonresidential'.
    return county, apn, city, zipcode, address, norm(address), year, classification, use, roll, source_id

def parse_permit(row, county, jurisdiction, source_id, row_num):
    desc = clean(field(row, DESC_FIELDS), 500)
    if not ROOF.search(desc):
        return None
    issued = parse_date(field(row, DATE_FIELDS))
    if not issued:
        return None
    address, city, zipcode = parse_site(field(row, ADDRESS_FIELDS), row)
    apn = norm(field(row, APN_FIELDS)).replace(" ", "")
    if not apn and not (address and zipcode):
        return None
    permit_id = clean(field(row, PERMIT_FIELDS), 120)
    if not permit_id:
        permit_id = hashlib.sha256((county+"|"+issued+"|"+zipcode+"|"+norm(address)+"|"+desc+"|"+str(row_num)).encode()).hexdigest()
    return source_id, permit_id, county, jurisdiction, apn, zipcode, norm(address), issued, "REPLACEMENT_LIKE" if REPLACED.search(desc) else "ROOF_RELATED_NOT_PROVEN_REPLACED"

def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as inp:
        while block := inp.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()

def ingest(args):
    path = Path(args.file).expanduser().resolve()
    if not path.is_file():
        raise ValueError("INPUT_FILE_MISSING")
    if args.source_id not in SOURCES and not re.fullmatch(r"municipal_[a-z0-9_-]{3,50}", args.source_id):
        raise ValueError("SOURCE_ID_MUST_BE_VERIFIED_OR_EXPLICIT_MUNICIPAL_ID")
    kind = args.kind or (SOURCES.get(args.source_id) or (None,))[1] if args.source_id in SOURCES else args.kind
    if kind not in ("la_properties", "sb_properties", "la_permits", "municipal_permits"):
        raise ValueError("INGEST_KIND_INVALID")
    county = "Los Angeles" if kind.startswith("la_") else args.county
    county = COUNTY_MAP.get(clean(county).upper())
    if not county:
        raise ValueError("COUNTY_REQUIRED")
    jurisdiction = "Los Angeles" if kind == "la_permits" else clean(args.jurisdiction, 90)
    if kind == "municipal_permits" and not jurisdiction:
        raise ValueError("JURISDICTION_REQUIRED")
    if args.source_id in SOURCES and kind != SOURCES[args.source_id][1]:
        raise ValueError("SOURCE_KIND_MISMATCH")
    if kind.startswith("la_") and county != "Los Angeles":
        raise ValueError("COUNTY_MISMATCH")
    conn = db_open(Path(args.db))
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    conn.execute("INSERT INTO source_runs(source_id,kind,county,jurisdiction,state,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET state=excluded.state,updated=excluded.updated,ingested=0,skipped=0,coverage='NOT_VERIFIED'",
                 (args.source_id,kind,county,jurisdiction,"INGEST_IN_PROGRESS",started))
    conn.commit()
    # Do not retain obsolete source rows across a full-file refresh.
    if kind.endswith("_properties"):
        conn.execute("DELETE FROM properties WHERE source_id=?", (args.source_id,))
    else:
        conn.execute("DELETE FROM permits WHERE source_id=?", (args.source_id,))
    conn.commit()
    inserted = skipped = 0
    members = 0
    try:
        for name, data in input_members(path):
            members += 1
            for row_num, row in enumerate(csv_rows(data), 1):
                if row_num == 1:
                    cols=set(row)
                    has_location=bool(cols.intersection(APN_FIELDS)) or bool(cols.intersection(ADDRESS_FIELDS))
                    if kind.endswith("_properties"):
                        if not has_location:
                            raise ValueError("PROPERTY_SCHEMA_MISSING_PARCEL_AND_LOCATION_FIELDS")
                        if kind=="la_properties" and not cols.intersection(YEAR_FIELDS):
                            raise ValueError("LA_ASSESSOR_YEAR_BUILT_COLUMN_NOT_RECOGNIZED")
                    elif (not cols.intersection(DATE_FIELDS) or
                          not cols.intersection(DESC_FIELDS) or not has_location):
                        raise ValueError("PERMIT_SCHEMA_MISSING_DATE_DESCRIPTION_OR_LOCATION_FIELDS")
                if kind.endswith("_properties"):
                    parsed = parse_property(row,county,args.source_id,args.roll_year)
                    if parsed:
                        conn.execute("""INSERT INTO properties VALUES(?,?,?,?,?,?,?,?,?,?,?)
                          ON CONFLICT(county,apn) DO UPDATE SET
                          city=excluded.city,zip=excluded.zip,address=excluded.address,
                          address_key=excluded.address_key,year_built=excluded.year_built,
                          residential=excluded.residential,use_label=excluded.use_label,
                          roll_year=excluded.roll_year,source_id=excluded.source_id
                          WHERE coalesce(excluded.roll_year,0)>=coalesce(properties.roll_year,0)""",parsed)
                else:
                    parsed = parse_permit(row,county,jurisdiction,args.source_id,row_num)
                    if parsed:
                        conn.execute("INSERT OR REPLACE INTO permits VALUES(?,?,?,?,?,?,?,?,?)",parsed)
                if parsed: inserted += 1
                else: skipped += 1
                if row_num % 10000 == 0:
                    conn.commit()
                    conn.execute("UPDATE source_runs SET ingested=?,skipped=?,updated=? WHERE source_id=?",
                                 (inserted,skipped,dt.datetime.now(dt.timezone.utc).isoformat(),args.source_id))
                    conn.commit()
        if not members:
            raise ValueError("NO_CSV_MEMBERS")
        if inserted == 0:
            raise ValueError("SOURCE_ZERO_RECOGNIZED_RECORDS_HOLD")
        if kind=="la_properties":
            quality=conn.execute("""SELECT count(*) AS total,
              sum(CASE WHEN year_built IS NOT NULL THEN 1 ELSE 0 END) AS with_year,
              sum(CASE WHEN address IS NOT NULL AND address!='' AND
                zip IS NOT NULL AND zip!='' THEN 1 ELSE 0 END) AS with_site
              FROM properties WHERE source_id=?""",(args.source_id,)).fetchone()
            if quality["total"]>100 and (
                quality["with_year"]<quality["total"]*0.01 or
                quality["with_site"]<quality["total"]*0.05):
                raise ValueError("LA_ASSESSOR_REQUIRED_FIELDS_MOSTLY_MISSING_HOLD")
        digest = sha(path)
        conn.execute("UPDATE source_runs SET state='INGESTED_NOT_COMPLETENESS_VERIFIED',ingested=?,skipped=?,file_sha256=?,filename=?,updated=? WHERE source_id=?",
                     (inserted,skipped,digest,path.name,dt.datetime.now(dt.timezone.utc).isoformat(),args.source_id))
        conn.commit()
        emit({"version":VERSION,"state":"INGESTED_NOT_COMPLETENESS_VERIFIED","source":args.source_id,
              "accepted":inserted,"skipped":skipped,"sha256":digest,"property_or_permit":"properties" if kind.endswith("properties") else "roof_permits",
              "needs_rebuild":True,"data_not_a_complete_housing_census":True})
    except Exception:
        conn.commit()
        conn.execute("UPDATE source_runs SET state='INCOMPLETE_IMPORT_HOLD',ingested=?,skipped=? WHERE source_id=?",
                     (inserted,skipped,args.source_id))
        conn.commit()
        raise
    finally:
        conn.close()

def rebuild(args):
    c = db_open(Path(args.db))
    try:
        c.execute("DELETE FROM candidates")
        c.commit()
        cursor = c.execute("""SELECT county,apn,city,zip,address,address_key,year_built,residential FROM properties
          WHERE source_id IN (SELECT source_id FROM source_runs WHERE state='INGESTED_NOT_COMPLETENESS_VERIFIED')""")
        current_year = dt.date.today().year
        seen = 0
        while rows := cursor.fetchmany(1500):
            for r in rows:
                by_apn = c.execute(
                    """SELECT MAX(issue_date) AS d FROM permits
                       WHERE county=? AND apn=?
                       AND source_id IN (
                          SELECT source_id FROM source_runs
                          WHERE state='INGESTED_NOT_COMPLETENESS_VERIFIED'
                       )""",
                    (r["county"], r["apn"]),
                ).fetchone()["d"] if not r["apn"].startswith("ADDRESS-") else None
                by_address = c.execute(
                    """SELECT MAX(issue_date) AS d FROM permits
                       WHERE county=? AND zip=? AND address_key=?
                       AND source_id IN (
                          SELECT source_id FROM source_runs
                          WHERE state='INGESTED_NOT_COMPLETENESS_VERIFIED'
                       )""",
                    (r["county"], r["zip"], r["address_key"]),
                ).fetchone()["d"] if r["zip"] and r["address_key"] else None
                permit = max(filter(None,(by_apn,by_address)),default=None)
                year = r["year_built"]
                age = current_year-year if year else None
                if permit and current_year-int(permit[:4]) < 20:
                    label = "RECENT_ROOF_RELATED_PERMIT"
                elif permit:
                    label = "ROOF_RELATED_PERMIT_20_PLUS"
                else:
                    label = "NO_ROOF_PERMIT_IN_INGESTED_RECORDS"
                # This is a transparent ordering heuristic, never a calibrated probability.
                priority = (min(50,max(0,age or 0)) if age else 0) + (35 if label=="ROOF_RELATED_PERMIT_20_PLUS" else 20 if not permit else 0)
                if r["residential"] == 1:
                    priority += 10
                priority = min(100,priority)
                c.execute("INSERT INTO candidates VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                          (r["county"],r["apn"],r["city"],r["zip"],r["address"],year,
                           r["residential"],permit,label,priority,"HISTORICAL_COVERAGE_UNVERIFIED"))
                seen += 1
            c.commit()
    finally:
        c.close()
    emit({"version":VERSION,"state":"CANDIDATES_BUILT","count":seen,
          "not_verified_20_year_roof_age":True,"no_outreach":True})

def status(args):
    c = db_open(Path(args.db))
    try:
        counts = {}
        for table in ("properties","permits","candidates"):
            counts[table] = c.execute("SELECT COUNT(*) FROM "+table).fetchone()[0]
        source_runs = [dict(x) for x in c.execute("SELECT source_id,kind,county,jurisdiction,state,ingested,skipped,substr(file_sha256,1,16) AS sha_prefix,updated,coverage FROM source_runs ORDER BY source_id")]
        counties = [dict(x) for x in c.execute("SELECT county,count(*) AS properties, sum(CASE WHEN residential=1 THEN 1 ELSE 0 END) AS classified_residential, sum(CASE WHEN year_built IS NULL THEN 1 ELSE 0 END) AS unknown_year_built FROM properties GROUP BY county")]
        matched = [dict(x) for x in c.execute("SELECT status,count(*) AS properties FROM candidates GROUP BY status")]
        emit({"version":VERSION,"counts":counts,"counties":counties,"candidate_categories":matched,"source_runs":source_runs,
              "data_completeness":"NOT_COUNTYWIDE_VERIFIED","roof_age_claims":False,
              "api_keys_required_for_public_exports":False,"external_actions":0})
    finally:
        c.close()

def candidates(args,markets=False):
    c = db_open(Path(args.db))
    try:
        cond = ["1=1"]; params=[]
        if args.county != "all":
            county = COUNTY_MAP.get(args.county.upper())
            if not county:
                raise ValueError("COUNTY_INVALID")
            cond.append("county=?");params.append(county)
        if args.city:
            cond.append("city LIKE ?");params.append(args.city[:70]+"%")
        if args.min_age:
            cond.append("(year_built IS NULL OR year_built<=?)")
            params.append(dt.date.today().year-args.min_age)
        if not args.include_unclassified:
            cond.append("residential=1")
        if args.only_no_permit:
            cond.append("status='NO_ROOF_PERMIT_IN_INGESTED_RECORDS'")
        where = " AND ".join(cond)
        if markets:
            sql = ("""SELECT county,city,zip, count(*) AS candidates,
                  SUM(CASE WHEN status='NO_ROOF_PERMIT_IN_INGESTED_RECORDS' THEN 1 ELSE 0 END) AS no_permit_observed,
                  SUM(CASE WHEN status='ROOF_RELATED_PERMIT_20_PLUS' THEN 1 ELSE 0 END) AS old_roof_permit,
                  ROUND(AVG(priority),1) AS mean_review_priority
                  FROM candidates WHERE """+where+
                  " GROUP BY county,city,zip ORDER BY (no_permit_observed+old_roof_permit) DESC,mean_review_priority DESC LIMIT 100")
        else:
            sql = ("SELECT county,apn,city,zip,address,year_built,residential,last_roof_permit,status,priority,evidence "
                   "FROM candidates WHERE "+where+" ORDER BY priority DESC,county,zip,apn LIMIT 100")
        data = [dict(x) for x in c.execute(sql,params)]
        emit({"version":VERSION,"rows":data,"universe":"IMPORTED_PARCELS_NOT_ALL_HOUSES_VERIFIED",
              "roof_condition_unknown":True,"no_permit_proves_no_replacement":False,
              "unclassified_excluded":not args.include_unclassified})

    finally:
        c.close()
class FixedOriginRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        from urllib.parse import urlsplit
        old, new = urlsplit(req.full_url), urlsplit(newurl)
        if old.scheme != "https" or new.scheme != "https" or new.hostname != old.hostname:
            raise ValueError("SOURCE_REDIRECT_OUTSIDE_APPROVED_HOST")
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def download(args):
    if args.source not in SOURCES:
        raise ValueError("SOURCE_ID_NOT_IN_ALLOWLIST")
    url,kind = SOURCES[args.source]
    from urllib.parse import urlsplit
    host = urlsplit(url).hostname
    if host not in ("data.lacity.org","apps.gis.lacounty.gov","arc.sbcounty.gov"):
        raise ValueError("SOURCE_HOST_NOT_ALLOWLISTED")
    folder = Path(args.root) / "official_downloads"
    folder.mkdir(parents=True,exist_ok=True)
    ext = ".zip" if urlsplit(url).path.endswith(".zip") else ".csv"
    target = folder / (args.source+ext)
    tmp = folder / (args.source+".incomplete")
    if target.exists() and not args.replace:
        emit({"version":VERSION,"state":"EXISTING_FILE_RETAINED","path":str(target),
              "bytes":target.stat().st_size,"source":args.source,"kind":kind})
        return
    req = urllib.request.Request(url,headers={"User-Agent":"FunIndustrialRoofingBulk/2.0 (official public data research)","Accept":"text/csv,application/zip,application/octet-stream,*/*"})
    token = os.environ.get("SOCRATA_APP_TOKEN")
    if token and host=="data.lacity.org":
        req.add_header("X-App-Token",token)
    total=0;limit=int(args.max_gb*1024**3);digest=hashlib.sha256()
    opener = urllib.request.build_opener(FixedOriginRedirect())
    try:
        with opener.open(req,timeout=120) as response, tmp.open("wb") as out:
            if response.status != 200:
                raise ValueError("SOURCE_HTTP_"+str(response.status))
            content_type=response.headers.get("content-type","").lower()
            if "html" in content_type or "json" in content_type:
                raise ValueError("SOURCE_RESPONSE_NOT_DATA")
            expected=int(response.headers.get("content-length","0") or 0)
            if expected>limit:raise ValueError("SOURCE_EXCEEDS_MAX_GB")
            while part:=response.read(1024*1024):
                total+=len(part)
                if total>limit:raise ValueError("SOURCE_EXCEEDS_MAX_GB")
                out.write(part);digest.update(part)
        if total<30:raise ValueError("EMPTY_SOURCE")
        if ext==".zip" and not zipfile.is_zipfile(tmp):
            raise ValueError("ZIP_SIGNATURE_INVALID")
        if ext==".csv" and not tmp.open("rb").read(256).strip():
            raise ValueError("CSV_EMPTY")
        tmp.replace(target)
        emit({"version":VERSION,"state":"DOWNLOADED_UNINGESTED","source":args.source,
              "kind":kind,"file":str(target),"bytes":total,"sha256":digest.hexdigest(),
              "completeness":"UNVERIFIED_UNTIL_IMPORT"})
    finally:
        if tmp.exists():tmp.unlink()

def parse_arcgis_sb_feature(feature):
    """Known public parcel attributes only; never fetch or store the OwnerName field."""
    a = feature.get("attributes", {}) if isinstance(feature, dict) else {}
    if not isinstance(a, dict):return None
    apn = norm(a.get("ParcelNumber")).replace(" ", "")
    if not apn:return None
    city = clean(a.get("Jurisdiction"), 90)
    classification = clean(a.get("AssessClass") or a.get("AssessDescription"), 75)
    residential = 1 if RESIDENTIAL.search(classification) else 0
    # Public GIS layer gives no assessment roll year, so do not invent one.
    # Later official property-characteristic CSV can enrich these APNs without
    # being rejected as "older" than a falsely assigned 2026 roll.
    return ("San Bernardino", apn, city, "", "", "", None, residential,
            classification, None, "sb_arcgis_parcels")

def fetch_sb_arcgis_page(query, *, timeout=40):
    """Fixed official origin, bounded JSON response and no follow-to-unknown-host redirect."""
    from urllib.parse import urlencode
    endpoint = SOURCES["sb_arcgis_parcels"][0]
    if set(query) - {"where", "returnCountOnly", "outFields", "returnGeometry", "resultOffset",
                     "resultRecordCount", "orderByFields", "f"}:
        raise ValueError("SB_ARCGIS_QUERY_FIELDS_INVALID")
    url = endpoint+"?"+urlencode(query)
    req = urllib.request.Request(url, headers={"Accept":"application/json",
        "User-Agent":"FunIndustrialRoofingBulkV2 (public parcel research)"})
    opener = urllib.request.build_opener(FixedOriginRedirect())
    with opener.open(req,timeout=timeout) as response:
        if response.status!=200:raise ValueError("SB_ARCGIS_HTTP_"+str(response.status))
        raw = response.read(4*1024*1024+1)
        if len(raw)>4*1024*1024:raise ValueError("SB_ARCGIS_PAGE_OVERSIZE")
    obj=json.loads(raw)
    if not isinstance(obj,dict) or "error" in obj:
        raise ValueError("SB_ARCGIS_RESPONSE_ERROR")
    return obj

def sync_sb_arcgis(args):
    """Walk the full public parcel layer, not the first 1,000 results."""
    source="sb_arcgis_parcels"
    c=db_open(Path(args.db))
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    c.execute("""INSERT INTO source_runs(source_id,kind,county,jurisdiction,state,updated)
      VALUES(?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET
      state=excluded.state,updated=excluded.updated,ingested=0,skipped=0,coverage='NOT_VERIFIED'""",
      (source,"sb_properties","San Bernardino","COUNTYWIDE",
       "INGEST_IN_PROGRESS",now))
    c.commit()
    c.execute("DELETE FROM properties WHERE source_id=?",(source,))
    c.commit()
    fetched=accepted=skipped=0
    try:
        report=fetch_sb_arcgis_page({"where":"1=1","returnCountOnly":"true","f":"json"})
        expected=int(report.get("count",0))
        if expected<1 or expected>3000000:raise ValueError("SB_ARCGIS_COUNT_INVALID")
        for page in range(args.max_pages):
            offset=page*1000
            if offset>=expected:break
            obj=fetch_sb_arcgis_page({"where":"1=1","outFields":
              "OBJECTID,ParcelNumber,Jurisdiction,Zoning,AssessClass,AssessDescription",
              "returnGeometry":"false","resultOffset":str(offset),
              "resultRecordCount":"1000","orderByFields":"OBJECTID","f":"json"})
            features=obj.get("features")
            if not isinstance(features,list) or not features:
                raise ValueError("SB_ARCGIS_PAGINATION_MISSING_AT_OFFSET_"+str(offset))
            for feature in features:
                fetched+=1
                row=parse_arcgis_sb_feature(feature)
                if row:
                    c.execute("""INSERT INTO properties VALUES(?,?,?,?,?,?,?,?,?,?,?)
                      ON CONFLICT(county,apn) DO UPDATE SET
                      city=excluded.city,source_id=excluded.source_id,
                      use_label=excluded.use_label,residential=excluded.residential,
                      roll_year=excluded.roll_year
                      WHERE properties.source_id=?""",row+(source,))
                    accepted+=1
                else:skipped+=1
            c.commit()
            if page%20==0:
                c.execute("UPDATE source_runs SET ingested=?,skipped=?,updated=? WHERE source_id=?",
                  (accepted,skipped,dt.datetime.now(dt.timezone.utc).isoformat(),source))
                c.commit()
            time.sleep(0.08)
        if fetched!=expected:
            raise ValueError("SB_ARCGIS_EXPECTED_"+str(expected)+"_RECEIVED_"+str(fetched))
        c.execute("""UPDATE source_runs SET state='INGESTED_NOT_COMPLETENESS_VERIFIED',
          ingested=?,skipped=?,updated=?,coverage='PUBLIC_PARCEL_LAYER_APN_NO_YEAR_BUILT_OR_ADDRESS'
          WHERE source_id=?""",
          (accepted,skipped,dt.datetime.now(dt.timezone.utc).isoformat(),source))
        c.commit()
    except Exception:
        c.execute("UPDATE source_runs SET state='INCOMPLETE_IMPORT_HOLD',ingested=?,skipped=? WHERE source_id=?",
          (accepted,skipped,source))
        c.commit()
        raise
    finally:c.close()
    emit({"version":VERSION,"source":source,"state":"INGESTED_NOT_COMPLETENESS_VERIFIED",
      "total_features_reported":expected,"fetched":fetched,"accepted":accepted,"skipped":skipped,
      "owner_names_collected":False,"street_addresses_available":False,
      "year_built_available":False,"municipal_permit_coverage":False})
    summary=materialize_roof_targets(args.db,drop_irrelevant=True)
    emit({"version":VERSION,"state":"FULL_SB_PARCELS_SELECTIVELY_FILTERED",
          "selection":summary,"source":source,"complete_roof_permit_coverage":False})

def sync(args):
    """Explicit operator sync: download one whole official file, ingest its rows, rebuild candidate indexes."""
    if args.source not in SOURCES:
        raise ValueError("SYNC_SOURCE_NOT_ALLOWLISTED")
    if args.source == "sb_assessor_characteristics":
        raise ValueError("SB_NP450_FIXED_WIDTH_PARSER_NOT_VERIFIED_USE_OFFICIAL_GOVPIMS_CSV_IMPORT")
    if args.source == "sb_arcgis_parcels":
        sync_sb_arcgis(args)
        return
    from types import SimpleNamespace
    dl = SimpleNamespace(source=args.source, root=args.root, max_gb=args.max_gb, replace=args.replace)
    download(dl)
    url, kind = SOURCES[args.source]
    extension = ".zip" if url.endswith(".zip") else ".csv"
    local = Path(args.root) / "official_downloads" / (args.source+extension)
    ing = SimpleNamespace(file=str(local), db=args.db, source_id=args.source,
                          kind=kind, county="", jurisdiction="Los Angeles",
                          roll_year=2025 if args.source=="la_assessor_2021_2025" else None)
    ingest(ing)
    summary=materialize_roof_targets(args.db,drop_irrelevant=True)
    emit({"version":VERSION,"state":"SYNC_FINISHED_FROM_FULL_EXPORT",
          "source":args.source,"full_export_requested":True,
          "selection":summary,"countywide_permit_coverage":False})

def inspect(args):
    path=Path(args.file)
    if not path.exists():raise ValueError("INPUT_FILE_MISSING")
    info=[]
    for name, binary in input_members(path):
        with binary:
            text=io.TextIOWrapper(binary,encoding="utf-8-sig",errors="replace",newline="")
            header_line=next(csv.reader(text),[])
        info.append({"member":name,"columns":[header(c) for c in header_line[:120]]})
        if len(info)>=25:break
    emit({"version":VERSION,"file":path.name,"csv_members":info,
          "owner_data_not_extracted":True,"requires_explicit_ingest":True})

def main():
    p=argparse.ArgumentParser(description="Full official property and permit data -> disk-backed SQLite. No scraping or outreach.")
    p.add_argument("--db",default=str(DEFAULT_ROOT/"roofing.sqlite3"))
    sub=p.add_subparsers(dest="cmd",required=True)
    d=sub.add_parser("download");d.add_argument("source",choices=sorted(SOURCES));d.add_argument("--root",default=str(DEFAULT_ROOT))
    d.add_argument("--replace",action="store_true");d.add_argument("--max-gb",type=float,default=8)
    i=sub.add_parser("ingest");i.add_argument("--file",required=True);i.add_argument("--source-id",required=True)
    i.add_argument("--kind",choices=["la_properties","sb_properties","la_permits","municipal_permits"])
    i.add_argument("--county",default="");i.add_argument("--jurisdiction",default="");i.add_argument("--roll-year",type=int)
    y=sub.add_parser("sync");y.add_argument("source",choices=sorted(SOURCES));y.add_argument("--root",default=str(DEFAULT_ROOT))
    y.add_argument("--replace",action="store_true");y.add_argument("--max-gb",type=float,default=8)
    y.add_argument("--max-pages",type=int,default=1600)
    b=sub.add_parser("rebuild");s=sub.add_parser("status");x=sub.add_parser("inspect");x.add_argument("--file",required=True)
    for name in ("markets","candidates"):
        q=sub.add_parser(name);q.add_argument("--county",default="all")
        q.add_argument("--city",default="");q.add_argument("--min-age",type=int,default=20)
        q.add_argument("--include-unclassified",action="store_true")
        q.add_argument("--only-no-permit",action="store_true")
    args=p.parse_args()
    if args.cmd=="download":
        if not 0.2<=args.max_gb<=32:raise ValueError("MAX_GB_INVALID")
        download(args)
    elif args.cmd=="ingest":ingest(args)
    elif args.cmd=="sync":
        if not 0.2<=args.max_gb<=32 or not 1<=args.max_pages<=5000:
            raise ValueError("SYNC_LIMITS_INVALID")
        sync(args)
    elif args.cmd=="rebuild":rebuild(args)
    elif args.cmd=="status":status(args)
    elif args.cmd=="inspect":inspect(args)
    else:candidates(args,args.cmd=="markets")
if __name__=="__main__":
    try:main()
    except (OSError,ValueError,sqlite3.Error,RuntimeError,zipfile.BadZipFile) as error:
        print("FUN_ROOFING_BULK_HOLD="+str(error)[:280],file=sys.stderr)
        sys.exit(1)
