"""Offline verification for automatic read-only roofing dashboard offers (V10)."""
import contextlib
import csv
import tempfile
import unittest
from pathlib import Path

import roofing_opportunities_v10 as offers
import test_export_roofing_location_research_v9 as fixture

class AutomaticRoofingOffersTests(unittest.TestCase):
    def setUp(self):
        # Reuse the independent synthetic V9 fixture and actually write all
        # four corresponding CSV reports before testing V10 discovery.
        self.fi=fixture.RoofingLocationExportTests(
            "test_block_and_property_list_preserves_exact_peer_signals")
        self.fi.setUp()
        self.root=self.fi.root
        self.exports=self.root/"research_exports"
        self.research=self.fi.get()
        self.files=fixture.loc.write_reports(self.research,self.exports)

    def tearDown(self):
        self.fi.tearDown()

    def test_auto_detects_reconciled_zip_block_and_pathway_offers(self):
        before=self.fi.db.read_bytes()
        o=offers.read_offers(self.root)
        self.assertEqual(o["state"],"READY_FROM_RECONCILED_LOCAL_V9_REPORTS")
        self.assertTrue(o["auto_discovered"])
        self.assertTrue(o["read_only"])
        self.assertEqual(o["totals"]["qualified_street_blocks"],1)
        self.assertEqual(o["totals"]["qualified_properties"],4)
        self.assertEqual(o["totals"]["recent_permit_locations"],2)
        self.assertEqual(o["totals"]["historical"],1)
        self.assertEqual(o["totals"]["no_match"],3)
        self.assertEqual(o["totals"]["other"],0)
        self.assertEqual(o["top_street_blocks"][0]["qualified_properties"],4)
        self.assertEqual(o["top_street_blocks"][0]["historical_permit_properties"],1)
        self.assertEqual(o["top_street_blocks"][0]["no_matching_permit_properties"],3)
        self.assertEqual(o["top_historical_blocks"][0]["street_number_block"],"100-199 OAK ST")
        self.assertEqual(o["top_no_match_blocks"][0]["no_matching_permit_properties"],3)
        self.assertEqual(o["zips"][0]["historical"],1)
        self.assertEqual(o["zips"][0]["no_match"],3)
        self.assertEqual(o["filters"]["historical_x_years"],20)
        self.assertEqual(o["filters"]["min_similar_age_neighbors"],3)
        self.assertTrue(o["no_matching_permit_is_not_no_roof_work"])
        self.assertEqual(before,self.fi.db.read_bytes())

    def test_on_demand_property_previews_match_separate_pathways(self):
        hist=offers.read_offers(self.root,pathway="HISTORICAL")
        no_match=offers.read_offers(self.root,pathway="NO_MATCH")
        other=offers.read_offers(self.root,pathway="OTHER")
        self.assertEqual(hist["pathway_total"],1)
        self.assertEqual(no_match["pathway_total"],3)
        self.assertEqual(other["pathway_total"],0)
        self.assertEqual([p["apn"] for p in self.research["properties"]
                          if p["historical_permit_x_years_or_more"]],
                         ["APN1"])
        self.assertEqual(hist["property_examples"][0]["address"],"101 OAK ST")
        self.assertEqual(hist["property_examples"][0]["last_exact_apn_permit"],"1998-03-01")
        self.assertEqual(len(no_match["property_examples"]),3)
        self.assertFalse(other["property_examples"])
        self.assertNotIn("apn",hist["property_examples"][0])
        for obj in (hist,no_match,other):
            self.assertTrue(obj["no_outreach_or_model_execution"])
            self.assertFalse(any("email" in str(key).lower()
                             or "phone" in str(key).lower()
                             or "owner" in str(key).lower()
                             for key in obj["property_examples"][0])) if obj["property_examples"] else None
        with self.assertRaisesRegex(ValueError,"OPPORTUNITIES_PATHWAY_NOT_SUPPORTED"):
            offers.read_offers(self.root,pathway="ALL")

    def test_missing_and_partial_reports_are_not_fabricated(self):
        (self.exports/Path(self.files["recent_permit_locations"]).name).unlink()
        o=offers.read_offers(self.root)
        self.assertEqual(o["state"],"LOCAL_V9_REPORT_INCOMPLETE_HOLD")
        self.assertNotIn("totals",o)
        for name in self.files.values():
            Path(name).unlink(missing_ok=True)
        o=offers.read_offers(self.root)
        self.assertEqual(o["state"],"AWAITING_LOCAL_V9_REPORTS")

    def test_corrupted_counts_fail_closed_without_fallback(self):
        p=Path(self.files["ranked_street_blocks"])
        with p.open("r",encoding="utf-8-sig",newline="") as fp:
            rows=list(csv.DictReader(fp))
            fields=list(rows[0])
        rows[0]["qualified_properties"]="99"
        with p.open("w",encoding="utf-8-sig",newline="") as fp:
            writer=csv.DictWriter(fp,fieldnames=fields)
            writer.writeheader();writer.writerows(rows)
        with self.assertRaisesRegex(ValueError,"OPPORTUNITIES_BLOCK_PROPERTY_TOTAL_HOLD"):
            offers.read_offers(self.root)

    def test_missing_or_mismatched_csv_is_ineligible_for_offer(self):
        root=Path(tempfile.mkdtemp(dir=self.root))
        self.assertEqual(offers.read_offers(root)["state"],"AWAITING_LOCAL_V9_REPORTS")
        p=Path(self.files["qualified_property_research"])
        with p.open("r",encoding="utf-8-sig",newline="") as fp:
            rows=list(csv.DictReader(fp))
            fields=list(rows[0])
        rows[0]["historical_permit_x_years_or_more"]="True"
        rows[0]["no_exact_apn_permit_in_imported_sources"]="True"
        with p.open("w",encoding="utf-8-sig",newline="") as fp:
            writer=csv.DictWriter(fp,fieldnames=fields)
            writer.writeheader();writer.writerows(rows)
        with self.assertRaisesRegex(ValueError,"OPPORTUNITIES_INCONSISTENT_HISTORY_FLAGS"):
            offers.read_offers(self.root)

if __name__=="__main__":
    unittest.main(verbosity=2)
