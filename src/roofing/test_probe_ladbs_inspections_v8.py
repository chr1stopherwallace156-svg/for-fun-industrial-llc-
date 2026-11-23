"""Offline regression for fixed-origin bounded LADBS inspection V8 probing."""
import contextlib
import datetime as dt
import sqlite3
import tempfile
import unittest
import urllib.parse
from pathlib import Path

import probe_ladbs_inspections_v8 as v8

TODAY=dt.date(2026,11,23)
SOURCE="la_permits_2020_present"

class InspectionJoinProbeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db=Path(self.tmp.name)/"roofing.sqlite3"
        with contextlib.closing(sqlite3.connect(self.db)) as c,c:
            c.executescript("""
              CREATE TABLE source_runs(source_id TEXT,state TEXT);
              CREATE TABLE roofing_selection_candidates_v3(
                county TEXT,apn TEXT,zip TEXT,disposition TEXT);
              CREATE TABLE permits(
                county TEXT,apn TEXT,permit_id TEXT,issue_date TEXT,
                source_id TEXT,roof_class TEXT);
            """)
            c.execute("INSERT INTO source_runs VALUES (?,?)",
                (SOURCE,"INGESTED_NOT_COMPLETENESS_VERIFIED"))
            c.executemany("INSERT INTO roofing_selection_candidates_v3 VALUES (?,?,?,?)",[
                ("Los Angeles","100001","90037","KEEP"),
                ("Los Angeles","100002","90037","KEEP"),
                ("Los Angeles","100003","90049","KEEP"),
                ("Los Angeles","PRIVATE","90037","HOLD"),
                ("San Bernardino","100001","90037","KEEP")
            ])
            c.executemany("INSERT INTO permits VALUES (?,?,?,?,?,?)",[
                ("Los Angeles","100001","24016-10000-00001","2025-01-03",SOURCE,"REPLACEMENT_LIKE"),
                ("Los Angeles","100002","24016-10000-00002","2025-02-03",SOURCE,"REPLACEMENT_LIKE"),
                ("Los Angeles","100003","24016-10000-00003","2025-03-03",SOURCE,"REPLACEMENT_LIKE"),
                ("Los Angeles","PRIVATE","24016-10000-00004","2025-04-03",SOURCE,"REPLACEMENT_LIKE"),
                ("San Bernardino","100001","24016-10000-00005","2025-04-03",SOURCE,"REPLACEMENT_LIKE"),
                ("Los Angeles","100002","24016-10000-00006","2025-06-03",SOURCE,"ROOF_RELATED_NOT_PROVEN_REPLACED")
            ])
    def tearDown(self):
        self.tmp.cleanup()
    def run_probe(self,rows,zips=("90037","90049"),**kwargs):
        url_seen=[]
        def fetch(url):
            url_seen.append(url)
            return rows
        options=dict(zips=zips,per_zip=3,today=TODAY,fetch=fetch)
        options.update(kwargs)
        result=v8.probe(self.db,**options)
        return result,url_seen[0]
    def test_exact_permit_join_only_and_no_identifiers_or_db_change(self):
        before=self.db.read_bytes()
        rows=[
          {"permit":"24016-10000-00001","inspection":"Final","inspection_result":"Approved",
           "inspection_date":"2025-09-01T00:00:00.000","permit_status":"Permit Finaled"},
          {"permit":"24016-10000-00001","inspection":"Foundation","inspection_result":"Approved",
           "inspection_date":"2025-04-01T00:00:00.000"},
          {"permit":"24016-10000-00002","inspection":"Final","inspection_result":"Corrections Issued",
           "inspection_date":"2025-09-01T00:00:00.000"}
        ]
        report,url=self.run_probe(rows)
        self.assertEqual(report["state"],"BOUNDED_INSPECTION_JOIN_OBSERVED")
        self.assertEqual(report["aggregate"]["selected_exact_permit_ids"],3)
        self.assertEqual(report["aggregate"]["found_in_official_inspection_dataset"],2)
        self.assertEqual(report["aggregate"]["has_final_inspection_type_with_approved_result"],1)
        self.assertEqual(report["aggregate"]["not_found_in_bounded_query"],1)
        self.assertEqual(report["aggregate"]["final_type_without_verified_approval"],1)
        self.assertEqual(report["zip_counts"]["90049"]["not_found_in_bounded_query"],1)
        self.assertTrue(report["approved_final_type_is_not_proof_roof_replacement"])
        self.assertTrue(report["no_match_is_not_proof_of_no_inspection"])
        self.assertNotIn("24016-",str(report))
        self.assertNotIn("100001",str(report))
        self.assertEqual(before,self.db.read_bytes())
        query=urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
        self.assertEqual(urllib.parse.urlsplit(url).netloc,"data.lacity.org")
        self.assertEqual(query["$limit"],["500"])
        self.assertIn("24016-10000-00001",query["$where"][0])
        self.assertNotIn("24016-10000-00004",query["$where"][0])
        self.assertNotIn("24016-10000-00005",query["$where"][0])
        self.assertNotIn("24016-10000-00006",query["$where"][0])
    def test_permit_finaled_result_and_status_do_not_equal_approved_final(self):
        report,_=self.run_probe([
          {"permit":"24016-10000-00001","inspection":"Final",
           "inspection_result":"Permit Finaled","permit_status":"Permit Finaled",
           "inspection_date":"2025-06-01T00:00:00"},
          {"permit":"24016-10000-00002","inspection":"Foundation",
           "inspection_result":"Approved","permit_status":"Permit Finaled",
           "inspection_date":"2025-06-02T00:00:00"},
        ])
        totals=report["aggregate"]
        self.assertEqual(totals["has_final_inspection_type_with_approved_result"],0)
        self.assertEqual(totals["has_final_type_with_permit_finaled_result"],1)
        self.assertEqual(totals["has_permit_finaled_status"],2)
        self.assertTrue(report["permit_finaled_text_is_separate_from_inspection_approval"])

    def test_date_must_be_real_for_final_approval(self):
        r,_=self.run_probe([
          {"permit":"24016-10000-00001","inspection":"Final",
           "inspection_result":"Approved","inspection_date":"2025-02-30T00:00:00"}])
        self.assertEqual(r["aggregate"]["has_final_inspection_type_with_approved_result"],0)
        self.assertEqual(r["aggregate"]["final_type_without_verified_approval"],1)
    def test_no_matches_is_not_fabricated_completion(self):
        r,_=self.run_probe([])
        self.assertEqual(r["aggregate"]["found_in_official_inspection_dataset"],0)
        self.assertEqual(r["aggregate"]["not_found_in_bounded_query"],3)
    def test_unknown_permit_in_remote_response_fails_closed(self):
        with self.assertRaisesRegex(ValueError,"INSPECTION_REMOTE_UNEXPECTED_PERMIT_HOLD"):
            self.run_probe([{"permit":"24016-10000-99999"}])
    def test_response_shape_and_limit_fail_closed(self):
        with self.assertRaisesRegex(ValueError,"INSPECTION_REMOTE_FORMAT_UNEXPECTED"):
            self.run_probe({"error":"unavailable"})
        with self.assertRaisesRegex(ValueError,"INSPECTION_QUERY_TRUNCATION_HOLD"):
            self.run_probe([{} for _ in range(v8.MAX_RESULTS)])
    def test_sample_parameters_and_completed_source_are_required(self):
        with self.assertRaisesRegex(ValueError,"INSPECTION_SAMPLE_PER_ZIP_LIMIT"):
            v8.probe(self.db,per_zip=30,fetch=lambda _:[])
        with self.assertRaisesRegex(ValueError,"INSPECTION_ZIPS_NOT_APPROVED"):
            v8.probe(self.db,zips=("99999",),fetch=lambda _:[])
        with contextlib.closing(sqlite3.connect(self.db)) as c,c:
            c.execute("UPDATE source_runs SET state='INCOMPLETE_IMPORT_HOLD'")
        with self.assertRaisesRegex(ValueError,"INSPECTION_PERMIT_SOURCE_NOT_COMPLETE"):
            v8.probe(self.db,fetch=lambda _:[])
    def test_permit_number_validation_blocks_url_injection(self):
        self.assertIsNone(v8.canonical_permit("ABC' OR 1=1--"))
        self.assertIsNone(v8.canonical_permit("1; DROP TABLE"))
        self.assertEqual(v8.canonical_permit("24016-10000-00001"),"24016-10000-00001")
    def test_query_is_leap_safe_for_february_29(self):
        # Date-window boundary must not throw for leap-day today.
        result,_=self.run_probe([],today=dt.date(2028,2,29))
        self.assertEqual(result["aggregate"]["selected_exact_permit_ids"],3)

if __name__=="__main__":
    unittest.main(verbosity=2)
