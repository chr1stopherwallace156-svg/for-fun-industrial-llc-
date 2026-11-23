"""Realistic offline tests: bounded selected targets, held unknowns and safe pruning."""
import contextlib
import datetime as dt
import sqlite3
import tempfile
import unittest
from pathlib import Path
from selective_policy_v3 import property_decision, score_candidate
from selective_extract_v3 import select, status, markets

class SelectiveV3Tests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.db=Path(self.temp.name)/"roofing.sqlite3"
        with contextlib.closing(sqlite3.connect(self.db)) as c, c:
            c.executescript("""CREATE TABLE properties(
              county TEXT,apn TEXT,city TEXT,zip TEXT,address TEXT,address_key TEXT,
              year_built INTEGER,residential INTEGER,use_label TEXT,roll_year INTEGER,
              source_id TEXT,PRIMARY KEY(county,apn));
              CREATE TABLE permits(source_id TEXT,permit_id TEXT,county TEXT,
              jurisdiction TEXT,apn TEXT,zip TEXT,address_key TEXT,issue_date TEXT,roof_class TEXT);
              CREATE TABLE source_runs(source_id TEXT PRIMARY KEY,state TEXT);""")
            c.executemany("INSERT INTO source_runs VALUES(?,?)",[
                ("property_source","INGESTED_NOT_COMPLETENESS_VERIFIED"),
                ("permits_source","INGESTED_NOT_COMPLETENESS_VERIFIED"),
                ("incomplete_permits","INCOMPLETE_IMPORT_HOLD")])
            c.executemany("INSERT INTO properties VALUES(?,?,?,?,?,?,?,?,?,?,?)",[
                ("Los Angeles","001","Los Angeles","90001","10 MAIN ST","10 MAIN ST",1980,1,"Single Family Residential",2025,"property_source"),
                ("Los Angeles","002","Los Angeles","90001","20 MAIN ST","20 MAIN ST",1982,1,"Single Family Residential",2025,"property_source"),
                ("Los Angeles","003","Los Angeles","90001","30 MAIN ST","30 MAIN ST",2017,1,"Single Family Residential",2025,"property_source"),
                ("Los Angeles","004","Los Angeles","90001","40 MAIN ST","40 MAIN ST",1970,0,"Industrial warehouse",2025,"property_source"),
                ("Los Angeles","005","Los Angeles","","","",None,0,"Unknown",2025,"property_source")])
            c.executemany("INSERT INTO permits VALUES(?,?,?,?,?,?,?,?,?)",[
                ("permits_source","P001","Los Angeles","Los Angeles","001","90001","10 MAIN ST","2000-01-01","REPLACEMENT_LIKE"),
                ("incomplete_permits","P002","Los Angeles","Los Angeles","002","90001","20 MAIN ST","2025-01-01","REPLACEMENT_LIKE")])
    def tearDown(self):self.temp.cleanup()
    def test_preserves_missing_permit_and_held_unknown(self):
        result=select(self.db)
        self.assertEqual((result["selected"],result["held"],result["excluded"]),(2,2,1))
        self.assertEqual(result["permits_matched"],1)
        rows=markets(self.db)["rows"]
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["candidates"],2)
        self.assertEqual(rows[0]["no_permit_observed"],1)
        self.assertEqual(status(self.db)["held"],2)
        with contextlib.closing(sqlite3.connect(self.db)) as c, c:
            self.assertEqual(c.execute("SELECT COUNT(*) FROM properties").fetchone()[0],5)
    def test_verified_exclusions_only_removed(self):
        r=select(self.db,drop_irrelevant=True)
        self.assertTrue(r["pruned_from_original_db"])
        with contextlib.closing(sqlite3.connect(self.db)) as c, c:
            remain={x[0] for x in c.execute("SELECT apn FROM properties")}
            self.assertEqual(remain,{"001","002","003","005"})
            self.assertEqual(c.execute("SELECT COUNT(*) FROM permits").fetchone()[0],2)
            self.assertEqual(c.execute("SELECT COUNT(*) FROM roofing_selection_candidates_v3").fetchone()[0],4)
    def test_failed_source_cannot_trigger_deletion(self):
        with contextlib.closing(sqlite3.connect(self.db)) as c, c:
            c.execute("UPDATE source_runs SET state='INCOMPLETE_IMPORT_HOLD'")
        with self.assertRaisesRegex(ValueError,"NO_COMPLETED_SOURCE"):
            select(self.db,drop_irrelevant=True)
        with contextlib.closing(sqlite3.connect(self.db)) as c, c:
            self.assertEqual(c.execute("SELECT COUNT(*) FROM properties").fetchone()[0],5)
    def test_policy_rejects_only_proven_outside_scope(self):
        now=dt.date(2026,11,23)
        self.assertEqual(property_decision(year_built=1975,land_use="Single Family Residential",
          residential=1,address="A",zip_code="90001",apn="01",today=now)[0],"KEEP")
        self.assertEqual(property_decision(year_built=None,residential=1,address="A",
          zip_code="90001",apn="01",today=now)[0],"HOLD")
        self.assertEqual(property_decision(year_built=2018,residential=1,address="A",
          zip_code="90001",apn="01",today=now)[0],"HOLD")
        self.assertEqual(property_decision(year_built=1960,land_use="Industrial Warehouse",
          residential=0,address="A",zip_code="90001",apn="01",today=now)[0],"DROP")
        old=score_candidate(year_built=1980,last_roof_permit="2000-01-01",
          residential=1,address="A",zip_code="90001",apn="01",today=now)
        recent=score_candidate(year_built=1980,last_roof_permit="2024-01-01",
          residential=1,address="A",zip_code="90001",apn="01",today=now)
        self.assertGreater(old,recent)
    def test_held_records_excluded_by_default(self):
        select(self.db)
        self.assertEqual(sum(x["candidates"] for x in markets(self.db)["rows"]),2)
        self.assertEqual(sum(x["candidates"] for x in markets(self.db,include_holds=True,min_age=0)["rows"]),4)
        self.assertEqual(len(markets(self.db,county="Los Angeles",city="Los",min_age=20)["rows"]),1)
        self.assertEqual(len(markets(self.db,only_no_permit=True,detail=True)["rows"]),1)
        self.assertEqual(len(markets(self.db,detail=True,limit=1)["rows"]),1)
if __name__=="__main__":unittest.main(verbosity=2)
