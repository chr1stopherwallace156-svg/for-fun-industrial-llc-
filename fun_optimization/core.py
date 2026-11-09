"""Optuna + Google OR-Tools optimization for bounded business/engineering inputs.

Designed as an additive, offline, operator-invoked capability. Problem
definitions are data, never user-supplied Python or arbitrary solver code.
"""
from __future__ import annotations

import math
from typing import Any


class OptimizationInputError(ValueError):
    pass


def _object(value: Any, name: str) -> dict:
    if not isinstance(value, dict):
        raise OptimizationInputError(f"{name} must be a JSON object")
    return value


def _keys(value: dict, allowed: set[str], name: str) -> None:
    unknown = set(value) - allowed
    if unknown:
        raise OptimizationInputError(f"{name} contains unsupported fields")


def _integer(value: Any, name: str, low: int, high: int) -> int:
    if type(value) is not int or not low <= value <= high:
        raise OptimizationInputError(f"{name} must be an integer from {low} to {high}")
    return value


def _number(value: Any, name: str, low: float, high: float) -> float:
    if type(value) not in (int, float) or not math.isfinite(value) or not low <= value <= high:
        raise OptimizationInputError(f"{name} must be a finite number from {low} to {high}")
    return float(value)


def allocate_resources(payload: dict) -> dict:
    """Choose integer quantities within explicit money and labor capacities."""
    from ortools.sat.python import cp_model

    data = _object(payload, "allocation")
    _keys(data, {"budget", "labor_capacity", "projects"}, "allocation")
    budget = _integer(data.get("budget"), "budget", 0, 10_000_000)
    labor_capacity = _integer(data.get("labor_capacity"), "labor_capacity", 0, 10_000_000)
    projects = data.get("projects")
    if not isinstance(projects, list) or not 1 <= len(projects) <= 30:
        raise OptimizationInputError("projects must contain 1 to 30 entries")
    parsed: list[dict] = []
    seen: set[str] = set()
    for i, item in enumerate(projects):
        item = _object(item, f"projects[{i}]")
        _keys(item, {"id", "cost", "labor", "value", "max_units"}, f"projects[{i}]")
        key = item.get("id")
        if not isinstance(key, str) or not 1 <= len(key) <= 48 or not all(c.isalnum() or c in "-_" for c in key):
            raise OptimizationInputError("project id must be 1 to 48 letters, digits, - or _")
        if key in seen:
            raise OptimizationInputError("project IDs must be unique")
        seen.add(key)
        parsed.append({
            "id": key,
            "cost": _integer(item.get("cost"), "cost", 0, 1_000_000),
            "labor": _integer(item.get("labor"), "labor", 0, 1_000_000),
            "value": _integer(item.get("value"), "value", 0, 1_000_000),
            "max_units": _integer(item.get("max_units"), "max_units", 0, 50),
        })

    model = cp_model.CpModel()
    selected = [model.new_int_var(0, p["max_units"], f"quantity_{i}") for i, p in enumerate(parsed)]
    model.add(sum(x * p["cost"] for x, p in zip(selected, parsed)) <= budget)
    model.add(sum(x * p["labor"] for x, p in zip(selected, parsed)) <= labor_capacity)
    model.maximize(sum(x * p["value"] for x, p in zip(selected, parsed)))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 17
    status = solver.solve(model)
    status_name = solver.status_name(status)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"engine": "google-or-tools-cp-sat", "state": status_name,
                "allocation": [], "solution_found": False,
                "optimality_proven": False, "operator_action_taken": False}

    quantities = [solver.value(x) for x in selected]
    spent = sum(q * p["cost"] for q, p in zip(quantities, parsed))
    labor_used = sum(q * p["labor"] for q, p in zip(quantities, parsed))
    value = sum(q * p["value"] for q, p in zip(quantities, parsed))
    if spent > budget or labor_used > labor_capacity or any(
        q < 0 or q > p["max_units"] for q, p in zip(quantities, parsed)
    ):
        raise RuntimeError("ALLOCATION_INDEPENDENT_CONSTRAINT_CHECK_FAILED")
    return {
        "engine": "google-or-tools-cp-sat",
        "state": status_name,
        "solution_found": True,
        "optimality_proven": status == cp_model.OPTIMAL,
        "total_value": value,
        "budget_used": spent,
        "budget_limit": budget,
        "labor_used": labor_used,
        "labor_capacity": labor_capacity,
        "allocation": [{"id": p["id"], "units": q} for p, q in zip(parsed, quantities)],
        "operator_action_taken": False,
    }


def optimize_route(payload: dict) -> dict:
    """Single-vehicle closed route on a provided bounded cost matrix."""
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2

    data = _object(payload, "route")
    _keys(data, {"cost_matrix", "depot"}, "route")
    matrix = data.get("cost_matrix")
    if not isinstance(matrix, list) or not 2 <= len(matrix) <= 12:
        raise OptimizationInputError("cost_matrix must contain 2 to 12 locations")
    n = len(matrix)
    costs = []
    for i, row in enumerate(matrix):
        if not isinstance(row, list) or len(row) != n:
            raise OptimizationInputError("cost_matrix must be square")
        costs.append([_integer(val, f"cost_matrix[{i}]", 0, 1_000_000) for val in row])
    if any(costs[i][i] != 0 for i in range(n)):
        raise OptimizationInputError("cost_matrix diagonal must be zero")
    depot = _integer(data.get("depot", 0), "depot", 0, n - 1)

    manager = pywrapcp.RoutingIndexManager(n, 1, depot)
    routing = pywrapcp.RoutingModel(manager)

    def distance(from_idx: int, to_idx: int) -> int:
        return costs[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)]

    callback = routing.RegisterTransitCallback(distance)
    routing.SetArcCostEvaluatorOfAllVehicles(callback)
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.time_limit.seconds = 3
    params.log_search = False
    solution = routing.SolveWithParameters(params)
    if not solution:
        return {"engine": "google-or-tools-routing", "solution_found": False,
                "optimality_proven": False, "operator_action_taken": False}
    index = routing.Start(0)
    nodes = [depot]
    objective = 0
    while not routing.IsEnd(index):
        next_index = solution.Value(routing.NextVar(index))
        a, b = manager.IndexToNode(index), manager.IndexToNode(next_index)
        objective += costs[a][b]
        nodes.append(b)
        index = next_index
        if len(nodes) > n + 1:
            raise RuntimeError("ROUTE_INDEPENDENT_CHECK_FAILED")
    if nodes[0] != depot or nodes[-1] != depot or sorted(nodes[:-1]) != list(range(n)):
        raise RuntimeError("ROUTE_INDEPENDENT_CHECK_FAILED")
    return {
        "engine": "google-or-tools-routing",
        "solution_found": True,
        "optimality_proven": False,
        "route": nodes,
        "total_cost": objective,
        "solver_objective": int(solution.ObjectiveValue()),
        "cost_units": "user_supplied_matrix_units",
        "operator_action_taken": False,
    }


def tune_inventory(payload: dict) -> dict:
    """Bounded Optuna study of holding vs. shortage cost on demand examples."""
    import optuna

    data = _object(payload, "inventory")
    _keys(data, {"demand_samples", "min_stock", "max_stock",
                 "holding_cost", "shortage_cost", "trials"}, "inventory")
    demands = data.get("demand_samples")
    if not isinstance(demands, list) or not 2 <= len(demands) <= 300:
        raise OptimizationInputError("demand_samples must contain 2 to 300 entries")
    samples = [_integer(v, "demand sample", 0, 100_000) for v in demands]
    lower = _integer(data.get("min_stock", 0), "min_stock", 0, 100_000)
    upper = _integer(data.get("max_stock"), "max_stock", 0, 100_000)
    if lower > upper:
        raise OptimizationInputError("min_stock must be <= max_stock")
    holding = _number(data.get("holding_cost"), "holding_cost", 0.0, 100_000)
    shortage = _number(data.get("shortage_cost"), "shortage_cost", 0.0, 100_000)
    if holding == 0 and shortage == 0:
        raise OptimizationInputError("at least one cost must be positive")
    trials = _integer(data.get("trials", 32), "trials", 4, 128)

    def expected_cost(stock: int) -> float:
        return sum(holding * max(stock - d, 0) +
                   shortage * max(d - stock, 0) for d in samples) / len(samples)

    optuna.logging.set_verbosity(optuna.logging.ERROR)
    study = optuna.create_study(direction="minimize",
                               sampler=optuna.samplers.TPESampler(seed=17),
                               storage=None)
    study.optimize(lambda trial: expected_cost(
        trial.suggest_int("stock_level", lower, upper)),
        n_trials=trials, n_jobs=1, catch=())
    best_level = int(study.best_params["stock_level"])
    best_value = expected_cost(best_level)
    if not math.isfinite(best_value) or abs(best_value - study.best_value) > 1e-6:
        raise RuntimeError("OPTUNA_INDEPENDENT_SCORE_CHECK_FAILED")
    return {
        "engine": "optuna-tpe",
        "study": "inventory_stock_level",
        "best_stock_level": best_level,
        "estimated_average_cost": round(best_value, 6),
        "baseline_min_stock_cost": round(expected_cost(lower), 6),
        "trials_completed": len(study.trials),
        "best_is_globally_proven": False,
        "storage": "memory_only",
        "data_note": "Optimized against supplied demand samples; future demand may differ.",
        "operator_action_taken": False,
    }


DEMO_ALLOCATION = {
    "budget": 20, "labor_capacity": 12,
    "projects": [
        {"id": "repair", "cost": 6, "labor": 4, "value": 15, "max_units": 2},
        {"id": "inspection", "cost": 4, "labor": 2, "value": 8, "max_units": 3},
        {"id": "upgrade", "cost": 10, "labor": 6, "value": 22, "max_units": 1},
    ],
}
DEMO_ROUTE = {"cost_matrix": [
    [0, 4, 7, 5],
    [4, 0, 2, 9],
    [7, 2, 0, 3],
    [5, 9, 3, 0],
], "depot": 0}
DEMO_INVENTORY = {
    "demand_samples": [3, 4, 3, 6, 7, 4, 5, 8, 5, 4],
    "min_stock": 0, "max_stock": 12,
    "holding_cost": 1.0, "shortage_cost": 3.0, "trials": 48,
}
