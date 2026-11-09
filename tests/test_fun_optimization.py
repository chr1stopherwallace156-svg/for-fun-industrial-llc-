"""Offline tests for the three bounded optimization operations."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fun_optimization.__main__ import parse_json_file
from fun_optimization.core import (
    DEMO_ALLOCATION,
    DEMO_INVENTORY,
    DEMO_ROUTE,
    OptimizationInputError,
    allocate_resources,
    optimize_route,
    tune_inventory,
)


class OfflineOptimizationTests(unittest.TestCase):
    def test_allocation_respects_budget_and_labor(self):
        result = allocate_resources(DEMO_ALLOCATION)
        self.assertTrue(result["solution_found"])
        self.assertTrue(result["optimality_proven"])
        self.assertEqual(result["total_value"], 46)
        self.assertLessEqual(result["budget_used"], DEMO_ALLOCATION["budget"])
        self.assertLessEqual(result["labor_used"], DEMO_ALLOCATION["labor_capacity"])
        self.assertEqual({p["id"] for p in result["allocation"]},
                         {p["id"] for p in DEMO_ALLOCATION["projects"]})
        self.assertFalse(result["operator_action_taken"])

    def test_allocation_has_no_unapproved_actions_or_negative_costs(self):
        for invalid in (
            {"budget": 10, "labor_capacity": 10,
             "projects": [{"id": "x", "cost": -1, "labor": 1, "value": 2, "max_units": 1}]},
            {"budget": True, "labor_capacity": 10, "projects": []},
            {"budget": 1, "labor_capacity": 1,
             "projects": [{"id": "x", "cost": 1, "labor": 1, "value": 1, "max_units": 1},
                          {"id": "x", "cost": 1, "labor": 1, "value": 1, "max_units": 1}]},
            {"budget": 10, "labor_capacity": 10,
             "projects": [{"id": "x", "cost": 1, "labor": 1, "value": 2, "max_units": 1}],
             "execute_now": True},
        ):
            with self.subTest(invalid=invalid), self.assertRaises(OptimizationInputError):
                allocate_resources(invalid)

    def test_route_visits_each_node_once_then_returns_to_depot(self):
        result = optimize_route(DEMO_ROUTE)
        self.assertTrue(result["solution_found"])
        self.assertEqual(result["route"][0], 0)
        self.assertEqual(result["route"][-1], 0)
        self.assertEqual(sorted(result["route"][:-1]), [0, 1, 2, 3])
        self.assertEqual(result["total_cost"], result["solver_objective"])
        self.assertEqual(result["total_cost"], 14)
        self.assertFalse(result["optimality_proven"])
        self.assertFalse(result["operator_action_taken"])

    def test_route_rejects_out_of_bounds(self):
        for invalid in (
            {"cost_matrix": [[0, 1], [1, 0]], "depot": 2},
            {"cost_matrix": [[1, 1], [1, 0]], "depot": 0},
            {"cost_matrix": [[0, 1], [1, -1]]},
            {"cost_matrix": [[0, 1], [1]]},
            {"cost_matrix": [[0, 1], [1, 0]], "execute": True},
        ):
            with self.subTest(invalid=invalid), self.assertRaises(OptimizationInputError):
                optimize_route(invalid)

    def test_inventory_tuning_is_bounded_and_score_verified(self):
        result = tune_inventory(DEMO_INVENTORY)
        self.assertEqual(result["engine"], "optuna-tpe")
        self.assertGreaterEqual(result["best_stock_level"], DEMO_INVENTORY["min_stock"])
        self.assertLessEqual(result["best_stock_level"], DEMO_INVENTORY["max_stock"])
        self.assertEqual(result["trials_completed"], DEMO_INVENTORY["trials"])
        self.assertFalse(result["best_is_globally_proven"])
        self.assertEqual(result["storage"], "memory_only")
        self.assertFalse(result["operator_action_taken"])

    def test_inventory_invalid_payload_rejected(self):
        for invalid in (
            {"demand_samples": [1], "max_stock": 5,
             "holding_cost": 1, "shortage_cost": 2},
            {"demand_samples": [1, 2], "max_stock": 5,
             "holding_cost": float("nan"), "shortage_cost": 2},
            {"demand_samples": [1, 2], "min_stock": 10, "max_stock": 5,
             "holding_cost": 1, "shortage_cost": 2},
            {"demand_samples": [1, 2], "max_stock": 5,
             "holding_cost": 1, "shortage_cost": 2, "trials": 1000},
            {"demand_samples": [1, 2], "max_stock": 5,
             "holding_cost": 1, "shortage_cost": 2, "shell": "powershell"},
        ):
            with self.subTest(invalid=invalid), self.assertRaises(OptimizationInputError):
                tune_inventory(invalid)

    def test_json_input_rejects_nonfinite_and_excessive_files(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "data.json"
            file.write_text('{"demand_samples":[1,NaN]}', encoding="utf-8")
            with self.assertRaises(OptimizationInputError):
                parse_json_file(str(file))
            file.write_text(" " * 64001, encoding="utf-8")
            with self.assertRaises(OptimizationInputError):
                parse_json_file(str(file))
            file.write_text(json.dumps(DEMO_ROUTE), encoding="utf-8")
            self.assertEqual(parse_json_file(str(file))["depot"], 0)

    def test_stdin_bridge_returns_sanitized_allocation_result(self):
        import subprocess
        import sys
        problem = {"action": "allocation", "problem": DEMO_ALLOCATION}
        run = subprocess.run(
            [sys.executable, "-m", "fun_optimization.bridge"],
            input=json.dumps(problem), capture_output=True, text=True,
            timeout=15,
        )
        self.assertEqual(run.returncode, 0, run.stderr)
        output = json.loads(run.stdout)
        self.assertEqual(output["schema"], "fun.optimization.result.v1")
        self.assertEqual(output["action"], "allocation")
        self.assertTrue(output["result"]["optimality_proven"])
        self.assertEqual(output["rea_tools_executed"], 0)
        self.assertEqual(output["external_actions_executed"], 0)

    def test_stdin_bridge_rejects_tool_calls_and_extra_fields(self):
        import subprocess
        import sys
        for invalid in (
            {"action": "shell", "problem": {"cmd": "whoami"}},
            {"action": "allocation", "problem": DEMO_ALLOCATION, "execute": True},
            {"action": "allocation", "problem": {"budget": 10, "labor_capacity": 10, "projects": [], "shell": "cmd"}},
        ):
            with self.subTest(invalid=invalid):
                run = subprocess.run(
                    [sys.executable, "-m", "fun_optimization.bridge"],
                    input=json.dumps(invalid), capture_output=True, text=True,
                    timeout=15,
                )
                self.assertNotEqual(run.returncode, 0)
                self.assertEqual(run.stdout.strip(), "")
                self.assertIn("FUN_OPTIMIZATION_BRIDGE_HOLD", run.stderr)


if __name__ == "__main__":
    unittest.main()
