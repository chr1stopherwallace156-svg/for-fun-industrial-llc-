"""Deterministic offline tests of the bounded public-property roofing review export."""
import csv
import datetime as dt
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import export_roofing_pilot_v1 as pilot


class PublicReviewPilotTests(unittest.TestCase):
    def setUp(self):
        self.root_context = tempfile.TemporaryDirectory()
        self.root = Path(self.root_context.name)
        self.db = self.root / "research.sqlite3"
        self.outputs = self.root / "out"
        with sqlite3.connect(self.db) as c:
            c.executescript("""
                CREATE TABLE source_runs(source_id TEXT PRIMARY KEY,state TEXT);
                CREATE TABLE roofing_selection_receipt_v3(
                   id INTEGER PRIMARY KEY,selected INTEGER,held INTEGER,
                   source_count INTEGER);
                CREATE TABLE roofing_selection_candidates_v3(
                   county TEXT,apn TEXT,city TEXT,zip TEXT,address TEXT,
                   year_built INTEGER,last_roof_permit TEXT,priority INTEGER,
                   disposition TEXT);
            """)
            c.executemany("INSERT INTO source_runs VALUES (?,?)",
                [(source,"INGESTED_NOT_COMPLETENESS_VERIFIED")
                 for source in pilot.REQUIRED_SOURCES])
            c.execute("INSERT INTO roofing_selection_receipt_v3 VALUES (1,1946966,341841,4)")
            for zipcode in pilot.PILOT_ZIPS:
                c.executemany("""INSERT INTO roofing_selection_candidates_v3
                   VALUES ('Los Angeles',?,?,?,?,?,?,?,?)""",[
                   (zipcode + "1","LOS ANGELES CA",zipcode,"100 TEST ST",1970,
                    "2001-04-04",89,"KEEP"),
                   (zipcode + "2","LOS ANGELES CA",zipcode,"200 TEST ST",1980,
                    None,78,"KEEP"),
                   (zipcode + "3","LOS ANGELES CA",zipcode,"300 TEST ST",1970,
                    "2025-05-01",82,"KEEP"),
                   (zipcode + "4","LOS ANGELES CA",zipcode,"400 TEST ST",None,
                    None,81,"HOLD"),
                   (zipcode + "5","LOS ANGELES CA",zipcode,"500 TEST ST",1970,
                    None,91,"HOLD"),
                ])

    def tearDown(self):
        self.root_context.cleanup()

    def test_fixed_zip_pilot_separates_old_evidence_from_no_match(self):
        rows,summary = pilot.produce_rows(self.db,today=dt.date(2026,11,23),
                                        per_zip=2,old_per_zip=1)
        self.assertEqual(len(rows),8)
        self.assertEqual(len(summary),4)
        for zipcode in pilot.PILOT_ZIPS:
            one=[r for r in rows if r["zip"]==zipcode]
            self.assertEqual(len(one),2)
            self.assertEqual({r["evidence_bucket"] for r in one},
                {"OLD_ROOF_RELATED_PERMIT_RECORDED",
                 "NO_MATCH_IN_IMPORTED_LA_CITY_PERMITS"})
            self.assertFalse(any(r["last_roof_related_permit"]=="2025-05-01" for r in one))
            self.assertTrue(all(r["roof_condition"]=="UNVERIFIED" for r in one))

    def test_export_creates_only_public_review_csv_without_changing_database(self):
        before=self.db.read_bytes()
        result=pilot.export_pilot(self.db,self.outputs,today=dt.date(2026,11,23),
                                  per_zip=2,old_per_zip=1)
        self.assertEqual(result["properties"],8)
        self.assertTrue(result["only_public_property_research_fields"])
        self.assertEqual(result["person_contact_fields_exported"],0)
        self.assertFalse(result["automated_outreach"])
        with Path(result["output_file"]).open("r",encoding="utf-8-sig",newline="") as f:
            rows=list(csv.DictReader(f))
        self.assertEqual(len(rows),8)
        self.assertEqual(set(rows[0]),set(pilot.CSV_COLUMNS))
        self.assertNotIn("owner",",".join(rows[0]).lower())
        self.assertEqual(before,self.db.read_bytes())

    def test_missing_source_forces_hold(self):
        with sqlite3.connect(self.db) as c:
            c.execute("UPDATE source_runs SET state='INCOMPLETE_IMPORT_HOLD' "
                      "WHERE source_id='la_permits_pre2010'")
        with self.assertRaisesRegex(ValueError,"FOUR_OFFICIAL_IMPORTS_NOT_COMPLETE_HOLD"):
            pilot.produce_rows(self.db,today=dt.date(2026,11,23),
                               per_zip=2,old_per_zip=1)

    def test_insufficient_stratum_fails_without_writing_csv(self):
        with self.assertRaisesRegex(ValueError,"PILOT_INSUFFICIENT_VERIFIED_COHORT"):
            pilot.export_pilot(self.db,self.outputs,today=dt.date(2026,11,23),
                               per_zip=3,old_per_zip=2)
        self.assertFalse(self.outputs.exists())

    def test_formulas_are_never_executable_in_export(self):
        self.assertEqual(pilot.csv_safe("=HYPERLINK('x')"),"'=HYPERLINK('x')")
        self.assertEqual(pilot.csv_safe("+MALICIOUS"),"'+MALICIOUS")
        self.assertEqual(pilot.csv_safe("@SUM(1,2)"),"'@SUM(1,2)")
        self.assertEqual(pilot.csv_safe("Normal Street"),"Normal Street")
        self.assertEqual(pilot.csv_safe("00123456789"),"'00123456789")
        self.assertEqual(pilot.twenty_year_cutoff(dt.date(2024,2,29)),"2004-02-29")

    def test_bad_quotas_fail_before_database_access(self):
        with self.assertRaisesRegex(ValueError,"PILOT_QUOTAS_INVALID"):
            pilot.produce_rows(self.db,today=dt.date(2026,11,23),
                               per_zip=0,old_per_zip=1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
