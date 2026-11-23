"""Offline end-to-end property/location export tests using synthetic data only."""
import contextlib
import csv
import datetime as dt
import sqlite3
import tempfile
import unittest
from pathlib import Path

import export_roofing_location_research_v9 as loc
from roofing_dual_formulas_v4 import REQUIRED_SOURCES

TODAY=dt.date(2026,11,23)

class RoofingLocationExportTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.db=self.root/"roofing.sqlite3"
        self.output=self.root/"reports"
        with contextlib.closing(sqlite3.connect(self.db)) as c,c:
            c.executescript("""
              CREATE TABLE source_runs(source_id TEXT PRIMARY KEY,state TEXT);
              CREATE TABLE properties(county TEXT,apn TEXT);
              CREATE TABLE roofing_selection_receipt_v3(
                id INTEGER PRIMARY KEY,selected INTEGER,source_count INTEGER);
              CREATE TABLE roofing_selection_candidates_v3(
                county TEXT,zip TEXT,apn TEXT,city TEXT,year_built INTEGER,
                priority INTEGER,disposition TEXT,address TEXT,last_roof_permit TEXT);
              CREATE TABLE permits(
                county TEXT,apn TEXT,source_id TEXT,permit_id TEXT,
                issue_date TEXT,roof_class TEXT);
            """)
            c.executemany("INSERT INTO source_runs VALUES (?,?)",[
              (src,"INGESTED_NOT_COMPLETENESS_VERIFIED")
              for src in REQUIRED_SOURCES
            ])
            c.execute("INSERT INTO roofing_selection_receipt_v3 VALUES (1,12,4)")
            records=[]
            for i in range(1,7):
                records.append((
                    "Los Angeles","90037","APN"+str(i),"LOS ANGELES CA",
                    1980+(i%3),90-i,"KEEP",str(100+i)+" OAK ST",
                    "1998-03-01" if i==1 else
                    "2025-05-01" if i in (2,3) else None))
            records.extend([
                ("Los Angeles","90037","UNIT","LOS ANGELES CA",1981,90,"KEEP",
                 "110 OAK ST APT 2",None),
                ("Los Angeles","90037","OTHER_BLOCK","LOS ANGELES CA",1981,90,"KEEP",
                 "210 OAK ST",None),
                ("Los Angeles","90037","NEW","LOS ANGELES CA",2023,90,"KEEP",
                 "109 OAK ST",None),
                ("Los Angeles","90037","HOLD","LOS ANGELES CA",1981,90,"HOLD",
                 "108 OAK ST",None),
                ("Los Angeles","90049","OTHER_ZIP","LOS ANGELES CA",1981,90,"KEEP",
                 "110 OAK ST",None),
                ("San Bernardino","90037","WRONG_COUNTY","LOS ANGELES CA",1981,90,
                 "KEEP","111 OAK ST",None)
            ])
            c.executemany("INSERT INTO roofing_selection_candidates_v3 VALUES (?,?,?,?,?,?,?,?,?)",records)
            c.executemany("INSERT INTO permits VALUES (?,?,?,?,?,?)",[
                ("Los Angeles","APN1","la_permits_pre2010","OLD","1998-03-01","REPLACEMENT_LIKE"),
                ("Los Angeles","APN2","la_permits_2020_present","REC2","2025-05-01","REPLACEMENT_LIKE"),
                ("Los Angeles","APN3","la_permits_2020_present","REC3","2025-05-02","REPLACEMENT_LIKE"),
                ("Los Angeles","APN4","la_permits_2020_present","REC4","2025-05-03","ROOF_RELATED_NOT_PROVEN_REPLACED"),
                ("Los Angeles","HOLD","la_permits_2020_present","BADH","2025-05-03","REPLACEMENT_LIKE"),
                ("Los Angeles","NEW","la_permits_2020_present","BADNEW","2025-05-03","REPLACEMENT_LIKE"),
                ("San Bernardino","WRONG_COUNTY","la_permits_2020_present","BADC","2025-05-03","REPLACEMENT_LIKE"),
            ])
    def tearDown(self):
        self.temp.cleanup()
    def get(self,**override):
        cfg=dict(zips=("90037","90049"),today=TODAY,
                 min_building_age=25,kind="replacement_like",
                 recent_years=5,years=20,peer_years=5,min_peers=3)
        cfg.update(override)
        return loc.analyze_locations(self.db,**cfg)

    def test_block_and_property_list_preserves_exact_peer_signals(self):
        before=self.db.read_bytes()
        r=self.get()
        self.assertEqual(r["state"],"ROOFING_LOCATION_RESEARCH_READY")
        self.assertEqual(r["total_qualified_street_blocks"],1)
        self.assertEqual(r["total_qualified_unique_properties"],4)
        b=r["blocks"][0]
        self.assertEqual(b["street_number_block"],"100-199 OAK ST")
        self.assertEqual(b["rank"],1)
        self.assertEqual(b["qualified_properties"],4)
        self.assertEqual(b["recent_permit_parcels_in_street_block"],2)
        self.assertEqual(r["zip_rows"][1]["qualified_unique_properties"],0)
        ids={p["apn"] for p in r["properties"]}
        self.assertEqual(ids,{"APN1","APN4","APN5","APN6"})
        self.assertTrue(all(p["other_properties_with_recent_exact_apn_permit"]==2
                            for p in r["properties"]))
        self.assertNotIn("HOLD",str(r["properties"]))
        self.assertNotIn("APT 2",str(r["properties"]))
        self.assertEqual(before,self.db.read_bytes())

    def test_x_years_changes_only_historical_permit_qualification(self):
        a=self.get(years=20)
        b=self.get(years=30)
        aa={p["apn"]:p for p in a["properties"]}
        bb={p["apn"]:p for p in b["properties"]}
        self.assertTrue(aa["APN1"]["historical_permit_x_years_or_more"])
        self.assertFalse(bb["APN1"]["historical_permit_x_years_or_more"])
        self.assertEqual(aa["APN1"]["last_recorded_exact_apn_roof_permit"],"1998-03-01")
        self.assertTrue(aa["APN5"]["no_exact_apn_permit_in_imported_sources"])
        self.assertEqual(a["total_qualified_unique_properties"],
                         b["total_qualified_unique_properties"])

    def test_roof_related_filter_keeps_distinct_activity_and_candidate_counts(self):
        r=self.get(kind="roof_related")
        self.assertEqual(r["total_qualified_street_blocks"],1)
        self.assertEqual(r["total_qualified_unique_properties"],3)
        ids={p["apn"] for p in r["properties"]}
        self.assertNotIn("APN4",ids)
        self.assertTrue(all(p["other_properties_with_recent_exact_apn_permit"]==3
                            for p in r["properties"]))

    def test_writer_produces_ranked_local_csvs_without_contacts(self):
        before=self.db.read_bytes()
        r=self.get()
        files=loc.write_reports(r,self.output)
        self.assertEqual(set(files),
              {"zip_market_summary","ranked_street_blocks","qualified_property_research",
               "recent_permit_locations"})
        with Path(files["ranked_street_blocks"]).open(encoding="utf-8-sig",newline="") as fp:
            b=list(csv.DictReader(fp))
        with Path(files["qualified_property_research"]).open(encoding="utf-8-sig",newline="") as fp:
            ps=list(csv.DictReader(fp))
        with Path(files["recent_permit_locations"]).open(encoding="utf-8-sig",newline="") as fp:
            recent=list(csv.DictReader(fp))
        self.assertEqual(len(recent),2)
        self.assertEqual({item["apn"] for item in recent},{"APN2","APN3"})
        self.assertTrue(all("NOT_PROOF_OF_COMPLETED" in item["research_label"] for item in recent))
        self.assertFalse(any("email" in k or "phone" in k or "owner" in k for k in recent[0]))
        self.assertEqual(len(b),1)
        self.assertEqual(len(ps),4)
        self.assertEqual(ps[0]["street_number_block"],"100-199 OAK ST")
        self.assertTrue(all(p["address"].endswith("OAK ST") for p in ps))
        self.assertFalse(any("owner" in k or "email" in k or "phone" in k
                      for k in ps[0]))
        self.assertEqual(before,self.db.read_bytes())

    def test_incomplete_source_and_invalid_age_hold(self):
        with self.assertRaisesRegex(ValueError,"BUILDING_AGE_MUST_BE_20_TO_100"):
            self.get(min_building_age=15)
        with contextlib.closing(sqlite3.connect(self.db)) as c,c:
            c.execute("UPDATE source_runs SET state='INCOMPLETE_IMPORT_HOLD' "
                      "WHERE source_id='la_permits_pre2010'")
        with self.assertRaisesRegex(ValueError,"DUAL_FORMULA_ALL_FOUR_COMPLETED_IMPORTS_REQUIRED"):
            self.get()
        self.assertFalse(self.output.exists())

if __name__=="__main__":
    unittest.main(verbosity=2)
