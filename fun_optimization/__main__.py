"""Manual, offline CLI entry point for Fun Industrial optimization.

Examples:
    python -m fun_optimization status
    python -m fun_optimization demo
    python -m fun_optimization allocation --file allocation.json
    python -m fun_optimization route --file route.json
    python -m fun_optimization inventory --file inventory.json

Never executes optimizer recommendations as external operations.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__
from .core import (
    DEMO_ALLOCATION, DEMO_INVENTORY, DEMO_ROUTE,
    OptimizationInputError, allocate_resources, optimize_route, tune_inventory,
)


def parse_json_file(filename: str) -> dict:
    file = Path(filename).expanduser()
    if not file.is_file() or file.is_symlink() or file.stat().st_size > 64_000:
        raise OptimizationInputError("input must be a real local JSON file <= 64KB")
    try:
        text = file.read_text(encoding="utf-8-sig")
        return json.loads(text, parse_constant=lambda _: (_ for _ in ()).throw(
            OptimizationInputError("nonfinite JSON numbers are not allowed")))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise OptimizationInputError("invalid UTF-8 JSON input file") from exc


def _status() -> dict:
    import optuna
    import ortools
    return {
        "application": "Fun Industrial Offline Optimization",
        "version": __version__,
        "state": "ready",
        "engines": {"optuna": optuna.__version__, "google_or_tools": ortools.__version__},
        "capabilities": [
            "bounded_inventory_stock_tuning",
            "integer_budget_and_labor_allocation",
            "closed_single_vehicle_route_optimization",
        ],
        "execution": "operator_invoked_only",
        "network_required": False,
        "network_listener_started": False,
        "REA_tools_executed": 0,
        "memory_writes": 0,
        "other_services_touched": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Operator-invoked, offline optimization")
    parser.add_argument("action", choices=("status", "demo", "allocation", "route", "inventory"))
    parser.add_argument("--file", help="JSON input for allocation, route, inventory")
    args = parser.parse_args(argv)
    try:
        if args.action == "status":
            if args.file:
                raise OptimizationInputError("status does not take --file")
            result = _status()
        elif args.action == "demo":
            if args.file:
                raise OptimizationInputError("demo does not take --file")
            result = {
                "inventory": tune_inventory(DEMO_INVENTORY),
                "allocation": allocate_resources(DEMO_ALLOCATION),
                "route": optimize_route(DEMO_ROUTE),
            }
        else:
            if not args.file:
                raise OptimizationInputError("--file required for this action")
            task = parse_json_file(args.file)
            result = {
                "allocation": allocate_resources,
                "route": optimize_route,
                "inventory": tune_inventory,
            }[args.action](task)
    except (OptimizationInputError, ImportError, RuntimeError) as error:
        print("FUN_OPTIMIZATION_HOLD=" + str(error), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
