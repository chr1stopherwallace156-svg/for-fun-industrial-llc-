"""Fun Industrial's fixed approved optimization worker.

One explicitly approved input -> one bounded local solve. No inspected source,
arbitrary Python eval, filesystem targets, network, downloads, or model calls.
Installed Optuna and OR-Tools packages are the only non-stdlib dependencies.
"""
import hashlib
import importlib.util
import json
import sys

VERSION = "fun-reviewed-optimization-v1"
MAX_BYTES = 12500


class Hold(ValueError):
    pass


def hold(name):
    raise Hold("FUN_OPTIMIZATION_HOLD_" + name)


def integer(value, lo, hi):
    if type(value) is not int or not lo <= value <= hi:
        hold("BOUNDED_INTEGER_REQUIRED")
    return value


def inventory(spec):
    if not isinstance(spec, dict) or set(spec) != {"demand", "holding_cost", "shortage_cost", "min_stock", "max_stock", "trials"}:
        hold("INVENTORY_SCHEMA_INVALID")
    demand = spec["demand"]
    if not isinstance(demand, list) or not 1 <= len(demand) <= 50:
        hold("DEMAND_COUNT_INVALID")
    demand = [integer(x, 0, 1000) for x in demand]
    holding = integer(spec["holding_cost"], 1, 1000)
    shortage = integer(spec["shortage_cost"], 1, 1000)
    low = integer(spec["min_stock"], 0, 1000)
    high = integer(spec["max_stock"], 0, 1000)
    if low > high:
        hold("STOCK_RANGE_REVERSED")
    trials = integer(spec["trials"], 12, 64)

    try:
        import optuna
    except ImportError:
        hold("OPTUNA_NOT_INSTALLED_IN_ISOLATED_ENV")

    def total_cost(stock):
        return sum(max(stock - d, 0) * holding +
                   max(d - stock, 0) * shortage for d in demand)

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    study = optuna.create_study(direction="minimize",
                                sampler=optuna.samplers.TPESampler(seed=314159))
    study.optimize(lambda trial: total_cost(trial.suggest_int("stock", low, high)),
                   n_trials=trials, n_jobs=1, show_progress_bar=False,
                   catch=(), gc_after_trial=True)
    chosen = int(study.best_params["stock"])
    chosen_total = total_cost(chosen)
    if chosen_total != int(study.best_value):
        hold("OPTUNA_RESULT_INCONSISTENT")
    # Independent full discrete enumeration: finite max 1001 candidate levels.
    exact_total, exact_stock = min((total_cost(stock), stock)
                                    for stock in range(low, high + 1))
    if total_cost(exact_stock) != exact_total or chosen_total < exact_total:
        hold("ENUMERATION_RECHECK_FAILED")
    return {
        "solver": "optuna_tpe_with_exhaustive_discrete_verification",
        "engine_version": getattr(optuna, "__version__", "unknown"),
        "direction": "minimize",
        "trials_completed": len(study.trials),
        "trial_best_stock": chosen,
        "trial_best_avg_cost": round(chosen_total / len(demand), 6),
        "exact_best_stock": exact_stock,
        "exact_best_avg_cost": round(exact_total / len(demand), 6),
        "optuna_found_global_optimum": chosen_total == exact_total,
        "exact_verification": True,
        "demand_count": len(demand),
        "cost_units": "user_defined_per_period",
        "limitations": "Static historical demand; does not forecast future outcomes."
    }


def routing(spec):
    if not isinstance(spec, dict) or set(spec) != {"cost_matrix"}:
        hold("ROUTING_SCHEMA_INVALID")
    matrix = spec["cost_matrix"]
    if not isinstance(matrix, list) or not 3 <= len(matrix) <= 12:
        hold("ROUTING_NODE_COUNT_INVALID")
    count = len(matrix)
    if any(not isinstance(row, list) or len(row) != count for row in matrix):
        hold("ROUTING_MATRIX_NOT_SQUARE")
    for i, row in enumerate(matrix):
        for j, x in enumerate(row):
            integer(x, 0, 10000)
            if i == j and x != 0:
                hold("ROUTING_DIAGONAL_NOT_ZERO")
    try:
        import ortools
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    except ImportError:
        hold("ORTOOLS_NOT_INSTALLED_IN_ISOLATED_ENV")

    manager = pywrapcp.RoutingIndexManager(count, 1, 0)
    model = pywrapcp.RoutingModel(manager)

    def cost_callback(from_index, to_index):
        return matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    callback_index = model.RegisterTransitCallback(cost_callback)
    model.SetArcCostEvaluatorOfAllVehicles(callback_index)
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.time_limit.FromSeconds(4)
    params.log_search = False
    solution = model.SolveWithParameters(params)
    if solution is None:
        hold("ROUTING_NO_SOLUTION")
    index = model.Start(0)
    route = []
    for _ in range(count + 2):
        route.append(manager.IndexToNode(index))
        if model.IsEnd(index):
            break
        index = solution.Value(model.NextVar(index))
    else:
        hold("ROUTING_CYCLE_LIMIT")
    if route[0] != 0 or route[-1] != 0 or sorted(route[1:-1]) != list(range(1, count)):
        hold("ROUTING_NODE_SET_INVALID")
    verified_cost = sum(matrix[a][b] for a, b in zip(route, route[1:]))
    if verified_cost != solution.ObjectiveValue():
        hold("ROUTING_COST_RECHECK_FAILED")
    return {
        "solver": "google_ortools_single_vehicle_routing",
        "engine_version": getattr(ortools, "__version__", "unknown"),
        "route": route,
        "route_cost": verified_cost,
        "route_verified_against_matrix": True,
        "optimality_proven": False,
        "node_count": count,
        "cost_units": "user_defined",
        "limitations": "Bounded heuristic route; no capacity, traffic, time windows, or optimality proof."
    }


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "--status":
        import importlib.util
        print(json.dumps({"version": VERSION, "state": "read_only_dependencies",
             "optuna_installed": importlib.util.find_spec("optuna") is not None,
             "ortools_installed": importlib.util.find_spec("ortools") is not None,
             "authority_granted": False, "actions_executed": 0}))
        return
    if len(sys.argv) != 1:
        hold("NO_COMMAND_LINE_OPTIONS")
    source = sys.stdin.buffer.read(MAX_BYTES + 1)
    if not source or len(source) > MAX_BYTES:
        hold("REQUEST_BYTES_INVALID")
    try:
        data = json.loads(source.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        hold("INVALID_INPUT_JSON")
    if not isinstance(data, dict) or set(data) != {"kind", "spec"}:
        hold("REQUEST_SCHEMA_INVALID")
    kind = data["kind"]
    if kind == "optuna_inventory":
        answer = inventory(data["spec"])
    elif kind == "ortools_routing":
        answer = routing(data["spec"])
    else:
        hold("UNSUPPORTED_SOLVER_KIND")
    payload_digest = hashlib.sha256(json.dumps(data, sort_keys=True,
        separators=(",", ":")).encode("utf-8")).hexdigest()
    print(json.dumps({"version": VERSION, "state": "COMPLETED_APPROVED_OPTIMIZATION",
        "kind": kind, "input_sha256": payload_digest, "result": answer,
        "source_code_executed": False, "external_actions": 0,
        "model_calls": 0, "authority_granted": False,
        "data_persisted_by_worker": False, "operator_approval_required": True},
        separators=(",", ":"), allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except (Hold, ValueError, OSError, OverflowError, RuntimeError) as error:
        print(json.dumps({"version": VERSION, "state": "HOLD",
             "reason": str(error)[:180], "external_actions": 0}), file=sys.stderr)
        sys.exit(2)
