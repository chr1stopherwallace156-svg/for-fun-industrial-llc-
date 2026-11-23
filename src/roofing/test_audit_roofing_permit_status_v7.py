"""Offline regression checks for read-only roof permit status audit V7."""
import contextlib
import csv
import datetime as dt
import sqlite3
import tempfile
import unittest
from pathlib import Path

import roofing_bulk_v2 as importer
import audit_roofing_permit_status_v7 as v7

TODAY=dt.date(2026,11,23)
SOURCE="la_permits_2020_present"
ZIP="90037"

class RoofStatusAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.root=Path(self.tmp.name)
        self.archives=self.root/"official_downloads"
        self.archives.mkdir()
        self.db=self.root/"roofing.sqlite3"
        self.source=self.archives/(SOURCE+".csv")
        self.permits=[
            dict(permit_nbr="A001",apn="APN1",issue_date="2024-01-01",
                 work_desc="REROOF COMPLETE SHINGLE SYSTEM",
                 status_desc="Permit Finaled",status_date="2024-03-01",
                 cofo_date="",owner_email="sensitive@example.invalid"),
            dict(permit_nbr="A002",apn="APN2",issue_date="2024-01-02",
                 work_desc="REPAIR ROOF FLASHING",
                 status_desc="Permit Issued",status_date="2024-01-02",
                 cofo_date="",owner_email="sensitive@example.invalid"),
            dict(permit_nbr="A003",apn="APN3",issue_date="2024-01-03",
                 work_desc="REROOF",
                 status_desc="Permit Expired",status_date="2025-01-01",
                 cofo_date="",owner_email="sensitive@example.invalid"),
            dict(permit_nbr="A004",apn="APN4",issue_date="2024-01-04",
                 work_desc="ROOF MAINTENANCE",
                 status_desc="CofO Issued",status_date="2024-02-03",
                 cofo_date="2024-02-03",owner_email="sensitive@example.invalid"),
            dict(permit_nbr="A005",apn="APN5",issue_date="2024-01-05",
                 work_desc="ROOF",
                 status_desc="Building Permit Under Review",status_date="",
                 cofo_date="",owner_email="sensitive@example.invalid"),
            dict(permit_nbr="A006",apn="APN6",issue_date="2024-01-06",
                 work_desc="RE-ROOF",
                 status_desc="",status_date="",
                 cofo_date="",owner_email="sensitive@example.invalid"),
            dict(permit_nbr="A007",apn="HOLD",issue_date="2024-01-07",
                 work_desc="RE-ROOF",status_desc="Permit Finaled",
                 status_date="",cofo_date="",owner_email="sensitive@example.invalid")
        ]
        for i,row in enumerate(self.permits):
            row["zip_code"]=ZIP
            row["primary_address"]=str(100+i)+" TEST ST"
        self.write_csv()
        with contextlib.closing(sqlite3.connect(self.db)) as c,c:
            c.executescript("""
            CREATE TABLE source_runs(source_id TEXT PRIMARY KEY,
                state TEXT,file_sha256 TEXT,filename TEXT);
            CREATE TABLE roofing_selection_candidates_v3(
                county TEXT,apn TEXT,zip TEXT,year_built INTEGER,disposition TEXT);
            CREATE TABLE permits(source_id TEXT,permit_id TEXT,county TEXT,
                apn TEXT,issue_date TEXT,roof_class TEXT);
            """)
            c.execute("INSERT INTO source_runs VALUES (?,?,?,?)",
                    (SOURCE,"INGESTED_NOT_COMPLETENESS_VERIFIED",
                     importer.sha(self.source),self.source.name))
            c.executemany("INSERT INTO roofing_selection_candidates_v3 VALUES (?,?,?,?,?)",[
              ("Los Angeles",row["apn"],ZIP,1958,"HOLD" if row["apn"]=="HOLD" else "KEEP")
              for row in self.permits])
            c.executemany("INSERT INTO permits VALUES (?,?,?,?,?,?)",[
              (SOURCE,row["permit_nbr"],"Los Angeles",row["apn"],row["issue_date"],
               "REPLACEMENT_LIKE" if importer.REPLACED.search(row["work_desc"])
               else "ROOF_RELATED_NOT_PROVEN_REPLACED")
              for row in self.permits])
    def tearDown(self):
        self.tmp.cleanup()
    def write_csv(self):
        with self.source.open("w",encoding="utf-8",newline="") as stream:
            writer=csv.DictWriter(stream,fieldnames=self.permits[0].keys())
            writer.writeheader()
            writer.writerows(self.permits)
    def audit(self,**override):
        kw=dict(zips=(ZIP,"90049"),per_group=20,recent_years=5,
                min_building_age=25,today=TODAY)
        kw.update(override)
        return v7.audit_status(self.db,self.root,**kw)
    def hash_update(self):
        with contextlib.closing(sqlite3.connect(self.db)) as c,c:
            c.execute("UPDATE source_runs SET file_sha256=?",
                      (importer.sha(self.source),))

    def test_status_sample_reports_distinctions_without_personal_details(self):
        before=self.db.read_bytes()
        d=self.audit()
        c=d["totals"]
        self.assertEqual(d["state"],"STATUS_SAMPLE_RECONCILED")
        self.assertEqual(c["selected"],6)
        self.assertEqual(c["matched_original"],6)
        self.assertEqual(c["PERMIT_FINALED_STATUS_RECORDED"],1)
        self.assertEqual(c["COFO_ISSUED_STATUS_RECORDED"],1)
        self.assertEqual(c["ISSUED_NOT_FINALED"],1)
        self.assertEqual(c["EXPIRED_CANCELLED_OR_REVOKED"],1)
        self.assertEqual(c["OTHER_OR_UNRECOGNIZED_STATUS"],1)
        self.assertEqual(c["STATUS_MISSING"],1)
        self.assertEqual(c["cofo_date_present"],1)
        self.assertEqual(c["source_record_not_reconciled"],0)
        self.assertEqual(d["zip_counts"]["90049"]["selected"],0)
        self.assertTrue(d["archives_sha256_match_import_receipts"])
        self.assertTrue(d["status_is_not_inspection_verified"])
        self.assertNotIn("sensitive@example.invalid",str(d))
        self.assertNotIn("APN1",str(d))
        self.assertNotIn("A001",str(d))
        self.assertEqual(self.db.read_bytes(),before)

    def test_cannot_infer_completion_from_issued_or_occupancy_date(self):
        self.permits[1]["cofo_date"]="2024-07-01"
        self.write_csv();self.hash_update()
        d=self.audit()
        self.assertEqual(d["state"],"STATUS_SAMPLE_RECONCILED")
        self.assertEqual(d["totals"]["ISSUED_NOT_FINALED"],1)
        self.assertEqual(d["totals"]["cofo_with_nonfinal_status"],1)
        self.assertTrue(d["cofo_date_is_not_roof_completion_proof"])

    def test_status_date_before_issue_is_review_hold(self):
        self.permits[0]["status_date"]="2020-01-01"
        self.write_csv();self.hash_update()
        d=self.audit()
        self.assertEqual(d["state"],"STATUS_EVIDENCE_REVIEW_HOLD")
        self.assertEqual(d["totals"]["status_date_before_permit_issue"],1)

    def test_malformed_status_date_is_review_hold(self):
        self.permits[0]["status_date"]="2024-02-31"
        self.write_csv();self.hash_update()
        d=self.audit()
        self.assertEqual(d["state"],"STATUS_EVIDENCE_REVIEW_HOLD")
        self.assertEqual(d["totals"]["status_date_not_parseable"],1)

    def test_hash_drift_stops_status_analysis(self):
        with self.source.open("a",encoding="utf-8") as f:f.write("\n")
        with self.assertRaisesRegex(ValueError,"STATUS_AUDIT_LOCAL_CSV_HASH_MISMATCH"):
            self.audit()

    def test_incomplete_source_receipt_holds(self):
        with contextlib.closing(sqlite3.connect(self.db)) as c,c:
            c.execute("UPDATE source_runs SET state='INCOMPLETE_IMPORT_HOLD'")
        with self.assertRaisesRegex(ValueError,"STATUS_AUDIT_SOURCE_NOT_COMPLETED"):
            self.audit()

    def test_missing_status_columns_hold_not_guess(self):
        for row in self.permits:row.pop("status_desc")
        self.write_csv();self.hash_update()
        with self.assertRaisesRegex(ValueError,"STATUS_AUDIT_MISSING_STATUS_COLUMNS_HOLD"):
            self.audit()

    def test_wrong_parcel_for_permit_id_holds(self):
        self.permits[0]["apn"]="FORGED"
        self.write_csv();self.hash_update()
        with self.assertRaisesRegex(ValueError,"STATUS_AUDIT_SOURCE_INDEX_MISMATCH_HOLD"):
            self.audit()

    def test_keyword_sampler_guards_and_parser_field_allowlist(self):
        self.assertEqual(v7.status_category("Permit Finaled"),"PERMIT_FINALED_STATUS_RECORDED")
        self.assertEqual(v7.status_category("Permit Issued"),"ISSUED_NOT_FINALED")
        self.assertEqual(v7.status_category("Pending"),"OTHER_OR_UNRECOGNIZED_STATUS")
        self.assertEqual(v7.parse_date_safe("03/01/2024 12:00:00 AM"),
                         (dt.date(2024,3,1),False))
        self.assertEqual(v7.parse_date_safe("2024-01-01T08:01:01"),
                         (dt.date(2024,1,1),False))
        with self.assertRaisesRegex(ValueError,"AUDIT_PER_ZIP_KIND_SAMPLE_MAX_30"):
            self.audit(per_group=40)
        with self.assertRaisesRegex(ValueError,"CSV_ADDITIONAL_FIELDS_NOT_ALLOWLISTED"):
            with self.source.open("rb") as s:
                next(importer.csv_rows(s,additional_fields=("owner_email",)))

if __name__=="__main__":
    unittest.main(verbosity=2)
