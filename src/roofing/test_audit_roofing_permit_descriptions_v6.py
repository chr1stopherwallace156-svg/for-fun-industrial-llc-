"""Offline no-contact regression tests for official roofing-permit CSV audit."""
import contextlib
import csv
import datetime as dt
import sqlite3
import tempfile
import unittest
from pathlib import Path

import roofing_bulk_v2 as importer
import audit_roofing_permit_descriptions_v6 as audit

TODAY=dt.date(2026,11,23)
SRC="la_permits_2020_present"

class PermitDescriptionAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.db=self.root/"roofing.sqlite3"
        self.archives=self.root/"official_downloads"
        self.archives.mkdir()
        self.file=self.archives/(SRC+".csv")
        self.base_rows=[
          {"permit_nbr":"R001","apn":"APN001","address":"101 ROOF ST",
           "zip":"90037","issue_date":"2025-04-01",
           "work_desc":"REROOF COMPLETE SHINGLE SYSTEM",
           "owner_email":"private@example.invalid"},
          {"permit_nbr":"R002","apn":"APN002","address":"103 ROOF ST",
           "zip":"90037","issue_date":"2025-04-02",
           "work_desc":"REPAIR ROOF FLASHING AT CHIMNEY",
           "owner_email":"private@example.invalid"},
          {"permit_nbr":"R003","apn":"APN003","address":"105 ROOF ST",
           "zip":"90037","issue_date":"2025-04-03",
           "work_desc":"ADD SOLAR PANEL NO ROOFING WORK",
           "owner_email":"private@example.invalid"},
        ]
        self.write_archive(self.base_rows)
        with contextlib.closing(sqlite3.connect(self.db)) as c, c:
            c.executescript("""
              CREATE TABLE source_runs(source_id TEXT PRIMARY KEY,
               state TEXT,file_sha256 TEXT,filename TEXT);
              CREATE TABLE roofing_selection_candidates_v3(
               county TEXT,apn TEXT,zip TEXT,year_built INTEGER,disposition TEXT);
              CREATE TABLE permits(
               source_id TEXT,permit_id TEXT,county TEXT,apn TEXT,
               issue_date TEXT,roof_class TEXT);
            """)
            c.execute("INSERT INTO source_runs VALUES (?,?,?,?)",
              (SRC,"INGESTED_NOT_COMPLETENESS_VERIFIED",
               importer.sha(self.file),self.file.name))
            c.executemany("INSERT INTO roofing_selection_candidates_v3 VALUES (?,?,?,?,?)", [
                ("Los Angeles","APN001","90037",1960,"KEEP"),
                ("Los Angeles","APN002","90037",1960,"KEEP"),
                ("Los Angeles","APN003","90037",1960,"KEEP"),
                ("Los Angeles","HOLD","90037",1960,"HOLD"),
                ("Los Angeles","NEW","90037",2015,"KEEP"),
                ("San Bernardino","APN001","90037",1960,"KEEP"),
            ])
            c.executemany("INSERT INTO permits VALUES (?,?,?,?,?,?)", [
                (SRC,"R001","Los Angeles","APN001","2025-04-01","REPLACEMENT_LIKE"),
                (SRC,"R002","Los Angeles","APN002","2025-04-02","ROOF_RELATED_NOT_PROVEN_REPLACED"),
                (SRC,"R003","Los Angeles","APN003","2010-04-03","ROOF_RELATED_NOT_PROVEN_REPLACED"),
                (SRC,"R004","Los Angeles","HOLD","2025-04-04","REPLACEMENT_LIKE"),
                (SRC,"R005","Los Angeles","NEW","2025-04-04","REPLACEMENT_LIKE"),
                (SRC,"R006","San Bernardino","APN001","2025-04-04","REPLACEMENT_LIKE"),
            ])

    def tearDown(self):
        self.temp.cleanup()

    def write_archive(self,rows):
        with self.file.open("w",encoding="utf-8",newline="") as f:
            writer=csv.DictWriter(f,fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)

    def audit(self,**kw):
        filters=dict(zips=("90037","90049"),per_group=5,recent_years=5,
                     min_building_age=25,today=TODAY)
        filters.update(kw)
        return audit.local_audit(self.db,self.root,**filters)

    def update_source_hash(self):
        with contextlib.closing(sqlite3.connect(self.db)) as c,c:
            c.execute("UPDATE source_runs SET file_sha256=? WHERE source_id=?",
                      (importer.sha(self.file),SRC))

    def test_verified_sample_is_aggregated_and_no_sensitive_rows_exported(self):
        before=self.db.read_bytes()
        result=self.audit()
        self.assertEqual(result["state"],"SAMPLED_IMPORT_KEYWORDS_RECONCILED")
        self.assertEqual(result["aggregate"]["sample_requested"],2)
        self.assertEqual(result["aggregate"]["matched_original"],2)
        self.assertEqual(result["aggregate"]["EXPLICIT_REROOF_OR_REPLACEMENT_TERMS"],1)
        self.assertEqual(result["aggregate"]["REPAIR_MAINTENANCE_OR_LEAK_TERMS"],1)
        self.assertEqual(result["verified_sources"],[SRC])
        self.assertTrue(result["official_archive_sha256_verified"])
        self.assertTrue(result["no_contact_details_or_raw_descriptions_emitted"])
        self.assertNotIn("APN001",str(result))
        self.assertNotIn("private@example.invalid",str(result))
        self.assertNotIn("101 ROOF ST",str(result))
        self.assertEqual(before,self.db.read_bytes())
        self.assertFalse((self.root/"audit-output.json").exists())

    def test_changed_csv_sha_causes_hold_before_any_classification(self):
        with self.file.open("a",encoding="utf-8") as f:f.write("\n")
        with self.assertRaisesRegex(ValueError,"AUDIT_ARCHIVE_SHA256_MISMATCH"):
            self.audit()

    def test_negated_roof_language_is_human_review_hold_not_positive_confirmation(self):
        self.base_rows[0]["work_desc"]="REPAIR ONLY NO REROOF"
        self.write_archive(self.base_rows)
        self.update_source_hash()
        result=self.audit()
        self.assertEqual(result["state"],"SAMPLED_AMBIGUOUS_DESCRIPTION_REVIEW_HOLD")
        self.assertEqual(result["aggregate"]["negated_or_ambiguous_replacement_language"],1)
        self.assertEqual(result["aggregate"]["classification_disagreement"],0)
        self.assertEqual(audit.classify_description("NO ROOF REPLACEMENT"),
                         "NEGATED_OR_AMBIGUOUS_REPLACEMENT_TERMS_REVIEW")
        self.assertEqual(audit.classify_description("REROOF NOT INCLUDED"),
                         "NEGATED_OR_AMBIGUOUS_REPLACEMENT_TERMS_REVIEW")

    def test_unknown_or_reclassified_archive_is_hold(self):
        with contextlib.closing(sqlite3.connect(self.db)) as c,c:
            c.execute("UPDATE permits SET roof_class='REPLACEMENT_LIKE' WHERE permit_id='R002'")
        result=self.audit()
        self.assertEqual(result["state"],"AUDIT_INCONSISTENCY_HOLD")
        self.assertEqual(result["aggregate"]["classification_disagreement"],1)

    def test_failed_import_receipt_never_audited(self):
        with contextlib.closing(sqlite3.connect(self.db)) as c,c:
            c.execute("UPDATE source_runs SET state='INCOMPLETE_IMPORT_HOLD'")
        with self.assertRaisesRegex(ValueError,"AUDIT_SOURCE_NOT_COMPLETED"):
            self.audit()

    def test_bounded_input_validation(self):
        with self.assertRaisesRegex(ValueError,"AUDIT_PER_ZIP_KIND_SAMPLE_MAX_30"):
            self.audit(per_group=60)
        with self.assertRaisesRegex(ValueError,"AUDIT_FIVE_DIGIT_ZIP_REQUIRED"):
            self.audit(zips=("9001X",))
        with self.assertRaisesRegex(ValueError,"AUDIT_RECENT_YEARS_REQUIRE_1_TO_10"):
            self.audit(recent_years=20)

if __name__=="__main__":
    unittest.main(verbosity=2)
