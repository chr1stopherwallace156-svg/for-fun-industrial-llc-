"""Offline tests for independent older-property and permit-cycle mathematics."""
import contextlib
import datetime as dt
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import roofing_dual_formulas_v4 as mod


class DualFormulaTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "test.sqlite3"
        with contextlib.closing(sqlite3.connect(self.db)) as c, c:
            c.executescript("""
                CREATE TABLE source_runs(source_id TEXT PRIMARY KEY,state TEXT);
                CREATE TABLE roofing_selection_receipt_v3(
                    id INTEGER PRIMARY KEY, selected INTEGER, source_count INTEGER);
                CREATE TABLE roofing_selection_candidates_v3(
                    county TEXT,zip TEXT,apn TEXT,city TEXT,year_built INTEGER,
                    priority INTEGER,disposition TEXT);
                CREATE TABLE permits(
                    county TEXT,apn TEXT,source_id TEXT,permit_id TEXT,
                    issue_date TEXT,roof_class TEXT);
            """)
            c.executemany("INSERT INTO source_runs VALUES (?,?)",
                [(src, "INGESTED_NOT_COMPLETENESS_VERIFIED")
                 for src in mod.REQUIRED_SOURCES])
            c.execute("INSERT INTO roofing_selection_receipt_v3 VALUES (1,1946966,4)")
            c.executemany("INSERT INTO roofing_selection_candidates_v3 VALUES (?,?,?,?,?,?,?)", [
                ("Los Angeles","90011","APN1","LOS ANGELES CA",1980,90,"KEEP"),
                ("Los Angeles","90011","APN2","LOS ANGELES CA",1980,85,"KEEP"),
                ("Los Angeles","90011","APN3","LOS ANGELES CA",1975,80,"KEEP"),
                ("Los Angeles","90011","APN4","LOS ANGELES CA",1980,75,"KEEP"),
                ("Los Angeles","90049","APN5","LOS ANGELES CA",1985,82,"KEEP"),
                ("Los Angeles","90011","HOLD1","LOS ANGELES CA",1980,80,"HOLD"),
                ("Los Angeles","90011","NEW1","LOS ANGELES CA",2020,80,"KEEP"),
                ("San Bernardino","90011","OTHER","LOS ANGELES CA",1980,80,"KEEP"),
            ])
            c.executemany("INSERT INTO permits VALUES (?,?,?,?,?,?)",[
                ("Los Angeles","APN1","la_permits_pre2010","1","1999-02-01","REPLACEMENT_LIKE"),
                ("Los Angeles","APN1","la_permits_2020_present","2","2025-04-01","ROOF_RELATED_NOT_PROVEN_REPLACED"),
                ("Los Angeles","APN2","la_permits_pre2010","3","2000-02-01","REPLACEMENT_LIKE"),
                ("Los Angeles","APN4","la_permits_2020_present","4","2025-06-01","REPLACEMENT_LIKE"),
                ("Los Angeles","APN5","la_permits_2010_2019","5","2016-06-01","REPLACEMENT_LIKE"),
                ("Los Angeles","HOLD1","la_permits_2020_present","6","2024-06-01","REPLACEMENT_LIKE"),
                ("Los Angeles","NEW1","la_permits_2020_present","7","2024-06-01","REPLACEMENT_LIKE"),
                ("San Bernardino","OTHER","la_permits_2020_present","8","2024-06-01","REPLACEMENT_LIKE"),
            ])

    def tearDown(self):
        self.tmp.cleanup()

    def analyze(self, **kwargs):
        return mod.analyze(self.db, zips=("90011","90049"), today=dt.date(2026,11,23), **kwargs)

    def test_parallel_results_preserve_formula_a_and_compute_repeat_cycles(self):
        data=self.analyze(years=20,recent_years=5,min_building_age=25)
        self.assertTrue(data["formula_a_unchanged"])
        self.assertTrue(data["read_only"])
        z=data["markets"][0]
        self.assertEqual(z["formula_a_existing"]["selected_older_residential_properties"],4)
        self.assertEqual(z["formula_a_existing"]["mean_review_priority"],82.5)
        cycle=z["formula_b_permit_cycle"]
        self.assertEqual(cycle["exact_apn_match_properties"],3)
        self.assertEqual(cycle["without_exact_apn_permit_match"],1)
        self.assertEqual(cycle["last_roof_permit_at_least_x_years_ago"],1)
        self.assertEqual(cycle["recent_permit_properties"],2)
        self.assertEqual(cycle["historical_permit_properties"],2)
        self.assertEqual(cycle["recent_repeat_with_gap_at_least_x_years"],1)
        self.assertEqual(cycle["historical_to_recent_repeat_share_pct"],50.0)
        self.assertFalse(cycle["rate_not_a_replacement_probability"] is False)

    def test_no_recent_repeat_as_a_replacement_claim(self):
        data=self.analyze(years=20,recent_years=5,kind="replacement_like")
        c=data["markets"][0]["formula_b_permit_cycle"]
        self.assertEqual(c["recent_repeat_with_gap_at_least_x_years"],0)
        self.assertTrue(data["no_roof_age_asserted"])
        self.assertTrue(all(x["not_proof_of_replacement"] for x in data["public_parcel_id_examples"]))

    def test_shorter_year_window_recomputes_older_evidence_without_mutating_index(self):
        with contextlib.closing(sqlite3.connect(self.db)) as c:
            before=c.execute("SELECT COUNT(*),SUM(priority) FROM roofing_selection_candidates_v3").fetchone()
        result=self.analyze(years=10,recent_years=5)
        self.assertEqual(result["markets"][1]["formula_b_permit_cycle"]["last_roof_permit_at_least_x_years_ago"],1)
        with contextlib.closing(sqlite3.connect(self.db)) as c:
            after=c.execute("SELECT COUNT(*),SUM(priority) FROM roofing_selection_candidates_v3").fetchone()
        self.assertEqual(before,after)

    def test_missing_official_source_holds_not_invents_rates(self):
        with contextlib.closing(sqlite3.connect(self.db)) as c, c:
            c.execute("UPDATE source_runs SET state='FAILED' WHERE source_id='la_permits_pre2010'")
        with self.assertRaisesRegex(ValueError,"FOUR_COMPLETED_IMPORTS"):
            self.analyze()

    def test_invalid_zip_and_date_and_interval_parameters_fail_closed(self):
        with self.assertRaisesRegex(ValueError,"CYCLE_YEARS_REQUIRE"):
            self.analyze(years=2)
        with self.assertRaisesRegex(ValueError,"DUPLICATE_ZIP"):
            mod.analyze(self.db,zips=("90011","90011"))
        with self.assertRaisesRegex(ValueError,"FIVE_DIGIT_ZIP"):
            mod.analyze(self.db,zips=("9001x",))
        with self.assertRaisesRegex(ValueError,"PERMIT_KIND_UNRECOGNIZED"):
            self.analyze(kind="unbounded")
        with self.assertRaisesRegex(ValueError,"RECENT_WINDOW"):
            self.analyze(recent_years=25)

    def test_empty_zip_returns_unverified_not_invented_roof_evidence(self):
        data=mod.analyze(self.db,zips=("90291",),today=dt.date(2026,11,23))
        cycle=data["markets"][0]["formula_b_permit_cycle"]
        self.assertEqual(cycle["exact_apn_match_properties"],0)
        self.assertIsNone(cycle["historical_to_recent_repeat_share_pct"])
        self.assertIsNone(cycle["recent_roof_permit_activity_per_1000"])


if __name__=="__main__":
    unittest.main(verbosity=2)
