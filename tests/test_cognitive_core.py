"""Isolated hostile and behavioral tests: python -m unittest discover -s tests -p test_cognitive_core.py -v"""
import tempfile
import unittest
from pathlib import Path
from cognitive import CognitiveStore


class CognitiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / "memory.sqlite3"
        self.store = CognitiveStore(self.db)

    def tearDown(self):
        self.temp.cleanup()

    def propose(self, text="battery fleet charging", scope="general", origin="web"):
        return self.store.propose(text, scope=scope, origin=origin, evidence="https://example.org/evidence")

    def test_unreviewed_observation_is_not_retrieved(self):
        self.propose()
        self.assertEqual(self.store.recall("battery")["results"], [])

    def test_approval_enables_scoped_recall(self):
        p = self.propose()
        self.store.review(p["id"], decision="approved", reviewer="operator")
        result = self.store.recall("battery")
        self.assertEqual(result["results"][0]["id"], p["id"])
        self.assertEqual(result["results"][0]["trust"], "operator-approved")

    def test_rejected_never_retrieved(self):
        p = self.propose()
        self.store.review(p["id"], decision="rejected", reviewer="operator")
        self.assertEqual(self.store.recall("battery")["results"], [])

    def test_review_is_single_use(self):
        p = self.propose()
        self.store.review(p["id"], decision="rejected", reviewer="operator")
        with self.assertRaises(ValueError):
            self.store.review(p["id"], decision="approved", reviewer="operator")

    def test_scope_isolation(self):
        p = self.propose(scope="fleet")
        self.store.review(p["id"], decision="approved", reviewer="operator")
        self.assertEqual(self.store.recall("battery", scope="general")["results"], [])
        self.assertEqual(len(self.store.recall("battery", scope="fleet")["results"]), 1)

    def test_feedback_cannot_promote_pending(self):
        p = self.propose()
        with self.assertRaises(ValueError):
            self.store.feedback(p["id"], rating=1, reason="looks useful")

    def test_feedback_updates_ranking_not_content(self):
        a = self.propose("fleet charging guidelines")
        b = self.propose("fleet charging guidelines")
        for p in (a, b):
            self.store.review(p["id"], decision="approved", reviewer="operator")
        self.store.feedback(a["id"], rating=1, reason="verified outcome")
        self.store.feedback(b["id"], rating=-1, reason="incorrect outcome")
        results = self.store.recall("fleet charging")["results"]
        self.assertEqual(results[0]["id"], a["id"])
        self.assertFalse(self.store.feedback(a["id"], rating=0, reason="neutral")["model_weights_updated"])
        self.assertEqual(self.store.inspect(a["id"])["content"], "fleet charging guidelines")

    def test_persistence(self):
        p = self.propose()
        self.store.review(p["id"], decision="approved", reviewer="operator")
        self.assertEqual(CognitiveStore(self.db).recall("battery")["results"][0]["id"], p["id"])

    def test_invalid_limits_and_sources(self):
        with self.assertRaises(ValueError):
            self.store.propose("x" * 4001, origin="web", evidence="link")
        with self.assertRaises(ValueError):
            self.store.propose("anything", origin="unknown", evidence="link")
        with self.assertRaises(ValueError):
            self.store.recall("fleet", scope="../secrets")
        with self.assertRaises(ValueError):
            self.store.recall("fleet", limit=11)

    def test_query_injection_is_data_not_sql(self):
        p = self.propose("industrial fleet; DROP TABLE observations; --")
        self.store.review(p["id"], decision="approved", reviewer="operator")
        self.assertEqual(self.store.stats()["states"]["approved"], 1)
        self.assertEqual(len(self.store.recall("fleet")["results"]), 1)

    def test_feedback_rejects_non_integer(self):
        p = self.propose()
        self.store.review(p["id"], decision="approved", reviewer="operator")
        with self.assertRaises(ValueError):
            self.store.feedback(p["id"], rating=True, reason="not a score")

    def test_provenance_and_fingerprint_remain_readable(self):
        p = self.propose()
        self.store.review(p["id"], decision="approved", reviewer="operator")
        item = self.store.inspect(p["id"])
        self.assertEqual(len(item["fingerprint"]), 64)
        self.assertEqual(item["evidence"], "https://example.org/evidence")
        self.assertTrue(item["trusted"])


if __name__ == "__main__":
    unittest.main()
