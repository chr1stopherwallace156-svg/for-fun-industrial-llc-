"""V12 local-only ZIP geographic research, scoped street/property drilldowns."""
import contextlib
import csv
import tempfile
import unittest
from pathlib import Path
import roofing_geo_explorer_v12 as geo
import test_export_roofing_location_research_v9 as fixture

class ZipMapExplorerTests(unittest.TestCase):
    def setUp(self):
        self.fixture=fixture.RoofingLocationExportTests(
            "test_block_and_property_list_preserves_exact_peer_signals")
        self.fixture.setUp()
        self.root=self.fixture.root
        self.export=self.root/"research_exports"
        self.files=fixture.loc.write_reports(self.fixture.get(),self.export)

    def tearDown(self):
        self.fixture.tearDown()

    def test_offline_zip_reference_coordinates_are_not_parcel_coordinates(self):
        before=self.fixture.db.read_bytes()
        r=geo.explore(self.root,mode="blocks",limit=25)
        self.assertEqual(r["state"],"ZIP_STREET_RESEARCH_READY")
        self.assertEqual(r["total"],1)
        self.assertEqual(r["rows"][0]["zip"],"90037")
        self.assertEqual(r["rows"][0]["qualified_in_view"],4)
        self.assertEqual(r["rows"][0]["historical"],1)
        self.assertEqual(r["rows"][0]["no_match"],3)
        self.assertEqual(r["rows"][0]["recent_permit_parcels"],2)
        self.assertEqual({x["zip"] for x in r["zip_reference_points"]},
                         {"90037","90049"})
        self.assertTrue(all("lat" in p and "lon" in p for p in r["zip_reference_points"]))
        self.assertFalse(any("lat" in p or "lon" in p for p in r["rows"]))
        self.assertEqual(r["coordinate_meaning"],
                         "ZIP_POSTAL_REFERENCE_ONLY_NOT_STREET_OR_PARCEL")
        self.assertFalse(r["has_geocoded_streets_or_properties"])
        self.assertTrue(r["no_outreach"])
        self.assertEqual(before,self.fixture.db.read_bytes())

    def test_pathways_are_independent_and_no_new_roof_prediction(self):
        historical=geo.explore(self.root,zip_code="90037",pathway="HISTORICAL")
        no_match=geo.explore(self.root,zip_code="90037",pathway="NO_MATCH")
        other=geo.explore(self.root,zip_code="90037",pathway="OTHER")
        self.assertEqual(historical["rows"][0]["qualified_in_view"],1)
        self.assertEqual(no_match["rows"][0]["qualified_in_view"],3)
        self.assertEqual(other["total"],0)
        self.assertEqual(historical["total"],1)
        self.assertTrue(historical["last_recorded_permit_not_roof_age"])
        self.assertTrue(no_match["no_matching_permit_not_no_roof_work"])

    def test_scoped_property_drilldown_and_pagination(self):
        kw={"zip_code":"90037","block":"100-199 OAK ST","mode":"properties"}
        first=geo.explore(self.root,**kw,limit=2,offset=0)
        more=geo.explore(self.root,**kw,limit=2,offset=2)
        self.assertEqual(first["total"],4)
        self.assertEqual(len(first["rows"]),2)
        self.assertTrue(first["has_more"])
        self.assertEqual(len(more["rows"]),2)
        self.assertFalse(more["has_more"])
        self.assertEqual(len({p["address"] for p in first["rows"]+more["rows"]}),4)
        self.assertTrue(all(not p["roof_condition_verified"]
                            for p in first["rows"]+more["rows"]))
        historical=geo.explore(self.root,**kw,pathway="HISTORICAL")
        self.assertEqual(historical["total"],1)
        self.assertEqual(historical["rows"][0]["address"],"101 OAK ST")
        self.assertEqual(historical["rows"][0]["last_recorded_exact_parcel_roof_permit"],
                         "1998-03-01")
        self.assertNotIn("lat",historical["rows"][0])
        self.assertNotIn("lon",historical["rows"][0])
        self.assertFalse(any("phone" in name or "email" in name or "owner" in name
                             for name in historical["rows"][0].keys()))

    def test_filter_guards_hold_before_inspecting_property_files(self):
        cases=[
            {"zip_code":"not-a-zip"}, {"pathway":"bad"},
            {"mode":"properties"}, {"offset":-1}, {"limit":100},
            {"block":"abc; dangerous"}, {"zip_code":"90210"},
            {"zip_code":"90037","block":"not a real block","mode":"properties"},
        ]
        for params in cases:
            with self.subTest(params=params),self.assertRaises(ValueError):
                geo.explore(self.root,**params)

    def test_missing_incomplete_snapshot_returns_hold_without_fabrication(self):
        (self.export/Path(self.files["recent_permit_locations"]).name).unlink()
        r=geo.explore(self.root)
        self.assertEqual(r["state"],"LOCAL_V9_REPORT_INCOMPLETE_HOLD")
        self.assertNotIn("rows",r)

if __name__=="__main__":
    unittest.main(verbosity=2)
