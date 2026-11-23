"""Offline deterministic tests for disk-backed, full-file countywide property and permit joins."""
import contextlib
import csv
import io
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parent))
import roofing_bulk_v2 as roof

def captured(fn, arg):
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        fn(arg)
    return json.loads(output.getvalue().strip().splitlines()[-1])

class RoofingBulkTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.db = str(self.root / "warehouse.sqlite3")
        self._open_connections = []

    def connect(self):
        connection = sqlite3.connect(self.db)
        self._open_connections.append(connection)
        return connection

    def tearDown(self):
        # Connection context managers commit/rollback, but don't close.
        # Windows refuses to remove a temp folder with an open SQLite file.
        for connection in reversed(self._open_connections):
            connection.close()
        self._open_connections.clear()
        self.tmp.cleanup()

    def write_csv(self, name, rows):
        path = self.root / name
        with path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        return str(path)

    def ingest(self, path, source, kind, county="", jurisdiction=""):
        return captured(roof.ingest, SimpleNamespace(
            db=self.db, file=path, source_id=source, kind=kind,
            county=county, jurisdiction=jurisdiction, roll_year=2025))

    def seed(self):
        la=self.write_csv("la.csv",[
            dict(AIN="0123456789",Property_Location="101 SAMPLE ST, LOS ANGELES, CA 90001",
                 Year_Built="1984",Property_Use_Type="Single Family Residence",Roll_Year="2025"),
            dict(AIN="0123456790",Property_Location="103 SAMPLE ST, LOS ANGELES, CA 90001",
                 Year_Built="1982",Property_Use_Type="Single Family Residence",Roll_Year="2025"),
            dict(AIN="0123456791",Property_Location="105 SAMPLE ST, LOS ANGELES, CA 90001",
                 Year_Built="1979",Property_Use_Type="Single Family Residence",Roll_Year="2025"),
        ])
        self.ingest(la,"municipal_la_property_fixture","la_properties")
        sb=self.write_csv("sb.csv",[
            dict(rec_parcel_nbr="0001200000123",address="700 TEST LN",
                 rec_parsit_city="VICTORVILLE",rec_parsit_zip1="92392",
                 year_built="1991",property_type="Single Family Residential")
        ])
        self.ingest(sb,"municipal_sb_property_fixture","sb_properties","San Bernardino")
        permits=self.write_csv("permit.csv",[
            dict(APN="0123456789",Primary_Address="101 SAMPLE ST",ZIP_CODE="90001",
                 Issue_Date="01/05/2001",Work_Desc="REROOF",Permit_Nbr="ROOF001"),
            dict(APN="0123456790",Primary_Address="103 SAMPLE ST",ZIP_CODE="90001",
                 Issue_Date="2025-02-10",Work_Desc="ROOF REPLACEMENT",Permit_Nbr="ROOF002"),
            dict(APN="0123456791",Primary_Address="105 SAMPLE ST",ZIP_CODE="90001",
                 Issue_Date="2020-11-10",Work_Desc="ADD GARAGE",Permit_Nbr="GARAGE003")
        ])
        self.ingest(permits,"municipal_la_permits_fixture","municipal_permits","Los Angeles","Los Angeles")
        captured(roof.rebuild,SimpleNamespace(db=self.db))

    def test_no_permit_candidates_survive_in_both_counties(self):
        self.seed()
        conn=self.connect()
        rows=conn.execute("SELECT county,apn,status FROM candidates").fetchall()
        self.assertEqual(len(rows),4)
        found={r[1]:r[2] for r in rows}
        self.assertEqual(found["0123456789"],"ROOF_RELATED_PERMIT_20_PLUS")
        self.assertEqual(found["0123456790"],"RECENT_ROOF_RELATED_PERMIT")
        self.assertEqual(found["0123456791"],"NO_ROOF_PERMIT_IN_INGESTED_RECORDS")
        self.assertEqual(found["0001200000123"],"NO_ROOF_PERMIT_IN_INGESTED_RECORDS")

    def test_market_joins_and_no_personal_contact_data(self):
        self.seed()
        result=captured(roof.candidates,SimpleNamespace(
            db=self.db,county="all",city="",min_age=20,
            include_unclassified=True,only_no_permit=True),True)
        self.assertEqual(sum(x["no_permit_observed"] for x in result["rows"]),2)
        self.assertEqual(len(result["rows"]),2)
        state=Path(self.db).read_bytes()
        self.assertNotIn(b"person@example.com",state)

    def test_san_bernardino_arcgis_uses_only_public_property_fields(self):
        sample={"attributes":{"ParcelNumber":"001234567","Jurisdiction":"Victorville",
            "AssessClass":"Single Family Residential",
            "OwnerName":"PROTECTED_PERSONAL_VALUE"}}
        parsed=roof.parse_arcgis_sb_feature(sample)
        self.assertEqual(parsed[0],"San Bernardino")
        self.assertEqual(parsed[1],"001234567")
        self.assertEqual(parsed[2],"Victorville")
        self.assertEqual(parsed[6],None)
        self.assertEqual(parsed[7],1)
        self.assertNotIn("PROTECTED_PERSONAL_VALUE",str(parsed))
        self.assertIn("sb_arcgis_parcels",roof.SOURCES)

    def test_fixed_official_sources_and_nonauthoritative_status(self):
        self.assertIn("la_assessor_2021_2025",roof.SOURCES)
        self.assertIn("la_permits_pre2010",roof.SOURCES)
        for source in ("la_permits_pre2010","la_permits_2010_2019","la_permits_2020_present"):
            self.assertIn("/api/v3/views/",roof.SOURCES[source][0])
            self.assertTrue(roof.SOURCES[source][0].endswith("/export.csv"))
        result=captured(roof.status,SimpleNamespace(db=self.db))
        self.assertEqual(result["data_completeness"],"NOT_COUNTYWIDE_VERIFIED")
        self.assertFalse(result["roof_age_claims"])

    def test_invalid_permit_does_not_enter_evidence(self):
        self.seed()
        conn=self.connect()
        self.assertEqual(conn.execute("SELECT count(*) FROM permits").fetchone()[0],2)
        self.assertEqual(roof.parse_date("02/30/2026"),None)
        self.assertEqual(roof.parse_date("2026-11-01"),"2026-11-01")

    def test_unverified_source_is_not_exposed_after_broken_import(self):
        self.seed()
        conn=self.connect()
        conn.execute("UPDATE source_runs SET state='INCOMPLETE_IMPORT_HOLD' WHERE source_id='municipal_la_permits_fixture'")
        conn.commit();conn.close()
        captured(roof.rebuild,SimpleNamespace(db=self.db))
        db=self.connect()
        states=[x[0] for x in db.execute("SELECT status FROM candidates ORDER BY apn")]
        self.assertTrue(all(x=="NO_ROOF_PERMIT_IN_INGESTED_RECORDS" for x in states))

    def test_csv_reader_streams_rows(self):
        self.seed()
        rows=captured(roof.candidates,SimpleNamespace(
            db=self.db,county="San Bernardino",city="",min_age=20,
            include_unclassified=True,only_no_permit=False),False)
        self.assertEqual(len(rows["rows"]),1)
        self.assertEqual(rows["rows"][0]["address"],"700 TEST LN")

if __name__=="__main__":
    unittest.main(verbosity=2)
