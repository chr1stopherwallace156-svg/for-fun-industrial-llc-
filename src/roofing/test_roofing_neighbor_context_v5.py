"""Offline street-block comparison tests: don't mistake nearby permit work for damage."""
import contextlib
import datetime as dt
import sqlite3
import tempfile
import unittest
from pathlib import Path
from roofing_neighbor_context_v5 import street_block,neighbor_context,VERSION
from roofing_dual_formulas_v4 import analyze,REQUIRED_SOURCES

TODAY=dt.date(2026,11,23)

class NeighborCohortTests(unittest.TestCase):
    def setUp(self):
        self.t=tempfile.TemporaryDirectory()
        self.db=Path(self.t.name)/"fixtures.sqlite3"
        with contextlib.closing(sqlite3.connect(self.db)) as c, c:
            c.executescript("""
              CREATE TABLE source_runs(source_id TEXT PRIMARY KEY,state TEXT);
              CREATE TABLE properties(county TEXT,apn TEXT);
              CREATE TABLE roofing_selection_receipt_v3(
                id INTEGER PRIMARY KEY,selected INTEGER,source_count INTEGER);
              CREATE TABLE roofing_selection_candidates_v3(
                county TEXT,zip TEXT,apn TEXT,city TEXT,year_built INTEGER,
                priority INTEGER,disposition TEXT,address TEXT);
              CREATE TABLE permits(
                county TEXT,apn TEXT,source_id TEXT,permit_id TEXT,
                issue_date TEXT,roof_class TEXT);
            """)
            c.executemany("INSERT INTO source_runs VALUES (?,?)",
                 [(p,"INGESTED_NOT_COMPLETENESS_VERIFIED") for p in REQUIRED_SOURCES])
            c.execute("INSERT INTO roofing_selection_receipt_v3 VALUES (1,12,4)")
            entries=[]
            for j in range(1,8):
                entries.append(("Los Angeles","90011","APN"+str(j),"LOS ANGELES CA",
                       1978+(j%5),70+j,"KEEP",str(100+j)+" OAK ST"))
            entries.extend([
              ("Los Angeles","90011","APN8","LOS ANGELES CA",
                       1998,75,"KEEP","108 OAK ST"), # different construction cohort
              ("Los Angeles","90011","APN9","LOS ANGELES CA",
                       1980,70,"KEEP","208 OAK ST"), # other number block
              ("Los Angeles","90011","UNIT","LOS ANGELES CA",
                       1980,70,"KEEP","110 OAK ST APT 4"), # ambiguous unit
              ("Los Angeles","90049","APN10","LOS ANGELES CA",
                       1980,70,"KEEP","101 OAK ST"), # ZIP isolated
              ("Los Angeles","90011","HOLD","LOS ANGELES CA",
                       1980,70,"HOLD","105 OAK ST"),
            ])
            c.executemany("INSERT INTO roofing_selection_candidates_v3 VALUES (?,?,?,?,?,?,?,?)",entries)
            c.executemany("INSERT INTO permits VALUES (?,?,?,?,?,?)", [
              ("Los Angeles","APN2","la_permits_2020_present","P2","2025-03-01","ROOF_RELATED_NOT_PROVEN_REPLACED"),
              ("Los Angeles","APN3","la_permits_2020_present","P3","2025-03-02","REPLACEMENT_LIKE"),
              ("Los Angeles","APN10","la_permits_2020_present","P10","2025-03-02","REPLACEMENT_LIKE"),
              ("Los Angeles","HOLD","la_permits_2020_present","HOLD","2025-03-02","REPLACEMENT_LIKE"),
              ("Los Angeles","APN1","unverified_source","BAD","2025-03-02","REPLACEMENT_LIKE"),
              ("Los Angeles","APN2","la_permits_pre2010","OLD","1998-01-01","REPLACEMENT_LIKE"),
            ])
    def tearDown(self):
        self.t.cleanup()

    def read(self,**kwargs):
        with contextlib.closing(sqlite3.connect(self.db)) as c:
            c.row_factory=sqlite3.Row
            c.execute("PRAGMA query_only=ON")
            return neighbor_context(c,zips=("90011","90049"),today=TODAY,
                    recent_years=kwargs.get("recent_years",5),min_building_age=25,
                    kind=kwargs.get("kind","roof_related"),city="LOS ANGELES CA",
                    peer_years=kwargs.get("peer_years",5),
                    min_peers=kwargs.get("min_peers",5))

    def test_address_block_is_proxy_not_geodistance_and_units_excluded(self):
        self.assertEqual(street_block("105 Oak St"),("OAK ST",1))
        self.assertEqual(street_block("199 OAK ST"),("OAK ST",1))
        self.assertEqual(street_block("200 OAK ST"),("OAK ST",2))
        self.assertIsNone(street_block("110 OAK ST APT 4"))
        self.assertIsNone(street_block("PO BOX 2"))
        self.assertIsNone(street_block("105 OAK ST #2"))

    def test_recent_two_neighbor_permits_in_same_age_cohort_not_proof_of_damage(self):
        d=self.read()
        z=d["formula_c_neighborhood_context"]["zips"]["90011"]
        self.assertGreaterEqual(z["candidates_with_enough_age_similar_street_block_peers"],1)
        self.assertGreaterEqual(z["candidates_with_two_or_more_recent_peer_roof_permits"],1)
        self.assertGreaterEqual(z["blocks_with_qualifying_age_cohort"],1)
        self.assertFalse(z["individual_property_damage_or_new_roof_need_verified"])
        self.assertFalse(z["physical_distance_measured"])
        self.assertTrue(d["formula_c_neighborhood_context"]["not_able_to_infer_leaks_or_worn_shingles"])
        self.assertEqual(d["version"],VERSION)
        self.assertTrue(d["public_research_examples"])
        self.assertLessEqual(len(d["public_research_examples"]),25)
        self.assertTrue(all(x["roof_condition_and_replacement_need"]=="UNVERIFIED"
                            and x["other_parcels_with_recent_roof_permits"]>=2
                            and not x["physical_distance_measured"]
                            for x in d["public_research_examples"]))
        self.assertEqual(d["formula_c_neighborhood_context"]["zips"]["90049"]["candidates_with_two_or_more_recent_peer_roof_permits"],0)

    def test_age_window_and_short_recent_window_remove_neighbor_signal(self):
        strict=self.read(peer_years=0)
        self.assertEqual(strict["formula_c_neighborhood_context"]["zips"]["90011"]["candidates_with_two_or_more_recent_peer_roof_permits"],0)
        year=self.read(recent_years=1)
        self.assertEqual(year["formula_c_neighborhood_context"]["zips"]["90011"]["candidates_with_two_or_more_recent_peer_roof_permits"],0)

    def test_replacement_like_only_is_distinct_evidence_not_all_roof_permits(self):
        d=self.read(kind="replacement_like")
        z=d["formula_c_neighborhood_context"]["zips"]["90011"]
        self.assertEqual(z["candidates_with_two_or_more_recent_peer_roof_permits"],0)

    def test_min_peer_sample_gate_prevents_small_street_claim(self):
        d=self.read(min_peers=30)
        z=d["formula_c_neighborhood_context"]["zips"]["90011"]
        self.assertEqual(z["candidates_with_enough_age_similar_street_block_peers"],0)
        self.assertIsNone(z["age_matched_peer_permit_window_share_pct"])
        self.assertIsNone(z["peer_activity_relative_to_zip_reference_ratio"])

    def test_parallel_report_keeps_a_b_and_includes_c_read_only(self):
        with contextlib.closing(sqlite3.connect(self.db)) as c:
            before=c.execute("SELECT count(*),sum(priority) FROM roofing_selection_candidates_v3").fetchone()
        d=analyze(self.db,zips=("90011","90049"),years=20,recent_years=5,
                  min_building_age=25,kind="roof_related",today=TODAY)
        self.assertTrue(d["formula_a_unchanged"])
        self.assertTrue(d["formula_c_not_a_roof_damage_prediction"])
        self.assertIn("formula_b_permit_cycle",d["markets"][0])
        self.assertIn("formula_c_neighborhood",d["markets"][0])
        self.assertTrue(d["neighborhood_research_examples"])
        self.assertEqual(d["neighborhood_research_examples"][0]["roof_condition_and_replacement_need"],"UNVERIFIED")
        with contextlib.closing(sqlite3.connect(self.db)) as c:
            after=c.execute("SELECT count(*),sum(priority) FROM roofing_selection_candidates_v3").fetchone()
        self.assertEqual(before,after)

if __name__=="__main__":
    unittest.main(verbosity=2)
