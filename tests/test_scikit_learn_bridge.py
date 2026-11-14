"""Offline tests for the bounded scikit-learn capability."""
import json
import tempfile
import unittest
from pathlib import Path
from ml.scikit_learn_bridge import InvalidInput, _train, _predict, analyze_deals


class TestScikitLearnBridge(unittest.TestCase):
    def test_prices_and_anomalies(self):
        data = {"deals": [{"id": f"item{i}", "cost": float(i + 2), "sale_price": float(i + 13),
                           "shipping": 2.0, "fees": 1.0, "return_allowance": 0.5} for i in range(12)]}
        results = analyze_deals(data)
        self.assertEqual(results["count"], 12)
        self.assertEqual(results["results"][0]["estimated_profit"], 7.5)
        self.assertEqual(results["external_actions"], 0)

    def test_reject_bad_data(self):
        with self.assertRaises(InvalidInput):
            analyze_deals({"deals": [{"id": "a"}] * 8})

    def test_training_prediction_and_json_model(self):
        history = [{"visits": 50 + i * 10, "price": 5 + i % 4,
                    "ad_spend": 2 + i % 5, "units_sold": 4 + i} for i in range(24)]
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "model.json"
            result = _train({"history": history}, path)
            self.assertEqual(result["training_rows"], 24)
            self.assertEqual(json.loads(path.read_text())["schema"], "fun.ml.sales.ridge.v1")
            predicted = _predict({"candidates": [{"visits": 250, "price": 7, "ad_spend": 4}]}, path)
            self.assertEqual(len(predicted["predictions"]), 1)
            self.assertGreaterEqual(predicted["predictions"][0], 0)
            self.assertEqual(predicted["external_actions"], 0)


if __name__ == "__main__":
    unittest.main()

