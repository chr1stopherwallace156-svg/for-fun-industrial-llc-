"""Offline regression of V8 shape-only, local SQLite permit diagnostic."""
import contextlib
import datetime as dt
import io
import sqlite3
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import diagnose_inspection_permit_shapes_v8 as diag

TODAY=dt.date(2026,11,23)

class PermitShapeDiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db=Path(self.tmp.name)/"roofing.sqlite3"
        with contextlib.closing(sqlite3.connect(self.db)) as conn,conn:
            conn.executescript("""
                CREATE TABLE source_runs(source_id TEXT,state TEXT);
                CREATE TABLE roofing_selection_candidates_v3(
                    county TEXT,apn TEXT,zip TEXT,disposition TEXT);
                CREATE TABLE permits(
                    county TEXT,apn TEXT,permit_id TEXT,issue_date TEXT,
                    source_id TEXT,roof_class TEXT);
            """)
            conn.execute("INSERT INTO source_runs VALUES (?,?)",
                         (diag.SOURCE,"INGESTED_NOT_COMPLETENESS_VERIFIED"))
            conn.executemany(
                "INSERT INTO roofing_selection_candidates_v3 VALUES (?,?,?,?)",[
                ("Los Angeles","P1","90037","KEEP"),
                ("Los Angeles","P2","90037","KEEP"),
                ("Los Angeles","P3","90049","KEEP"),
                ("Los Angeles","X","90037","HOLD"),
                ("San Bernardino","P1","90037","KEEP"),
            ])
            conn.executemany("INSERT INTO permits VALUES (?,?,?,?,?,?)",[
                ("Los Angeles","P1","24016-10000-00001","2025-01-03",diag.SOURCE,"REPLACEMENT_LIKE"),
                ("Los Angeles","P2","24016-10000-00002","2025-02-03",diag.SOURCE,"REPLACEMENT_LIKE"),
                ("Los Angeles","P3","ABC 12345","2025-03-03",diag.SOURCE,"REPLACEMENT_LIKE"),
                ("Los Angeles","X","SHOULD-HOLD-111","2025-04-03",diag.SOURCE,"REPLACEMENT_LIKE"),
                ("San Bernardino","P1","SHOULD-SB-999","2025-04-03",diag.SOURCE,"REPLACEMENT_LIKE"),
                ("Los Angeles","P2","OTHER-KIND-123","2025-05-03",diag.SOURCE,"ROOF_RELATED_NOT_PROVEN_REPLACED")
            ])

    def tearDown(self):self.tmp.cleanup()

    def test_masked_query_matches_existing_v8_selection_and_keeps_no_identifiers(self):
        before=self.db.read_bytes()
        result=diag.report(self.db,today=TODAY,per_zip=3)
        self.assertEqual(result[0]["selected"],2)
        self.assertEqual(result[0]["v8_valid_format"],2)
        self.assertEqual(result[0]["issue_months"],["2025-01","2025-02"])
        self.assertEqual(result[0]["permit_shapes"],{"99999-99999-99999":2})
        self.assertEqual(result[1]["permit_shapes"],{"AAA_99999":1})
        self.assertEqual(result[2]["selected"],0)
        self.assertNotIn("24016-10000-00001",str(result))
        self.assertNotIn("OTHER-KIND-123",str(result))
        self.assertNotIn("P1",str(result))
        self.assertEqual(before,self.db.read_bytes())

    def test_source_receipt_and_sample_limit_fail_closed(self):
        with self.assertRaisesRegex(ValueError,"INSPECTION_SHAPE_INVALID_SAMPLE_LIMIT"):
            diag.report(self.db,today=TODAY,per_zip=999)
        with contextlib.closing(sqlite3.connect(self.db)) as conn,conn:
            conn.execute("UPDATE source_runs SET state='INCOMPLETE_IMPORT_HOLD'")
        with self.assertRaisesRegex(ValueError,"INSPECTION_SHAPE_SOURCE_NOT_COMPLETED"):
            diag.report(self.db,today=TODAY)

    def test_mask_never_emits_literal_id_characters(self):
        self.assertEqual(diag.permit_shape("23ABC 30-44"),"99AAA_99-99")
        self.assertEqual(diag.permit_shape("00!"),"99?")
        self.assertEqual(diag.permit_shape(None),"")

    def test_human_readable_prints_only_redacted_groups(self):
        with patch("sys.argv",["diagnose","--db",str(self.db)]),redirect_stdout(io.StringIO()) as stream:
            diag.main()
        output=stream.getvalue()
        self.assertIn("ZIP=90037",output)
        self.assertIn("MASKED_SHAPES=99999-99999-99999:2",output)
        self.assertNotIn("24016-10000-00001",output)
        self.assertNotIn("P1",output)
        self.assertNotIn("SHOULD",output)

if __name__=="__main__":unittest.main(verbosity=2)
