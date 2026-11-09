"""One-shot isolated JSON bridge for a supervisor-launched local optimizer.

Reads precisely one input document from stdin; rejects other command inputs,
does not listen on a port or execute arbitrary Python code, and uses installed
Optuna and Google OR-Tools engines for bounded operator-authorized problems.
"""
from __future__ import annotations

import json
import sys

from .core import (
    OptimizationInputError, allocate_resources, optimize_route, tune_inventory,
)

MAX_BYTES = 32_768
ACTIONS = {
    "allocation": allocate_resources,
    "route": optimize_route,
    "inventory": tune_inventory,
}


def main() -> int:
    try:
        raw = sys.stdin.buffer.read(MAX_BYTES + 1)
        if not raw or len(raw) > MAX_BYTES:
            raise OptimizationInputError("input payload must be 1 to 32768 bytes")
        payload = json.loads(
            raw.decode("utf-8"),
            parse_constant=lambda _: (_ for _ in ()).throw(
                OptimizationInputError("nonfinite numeric input rejected")),
        )
        if not isinstance(payload, dict) or set(payload) != {"action", "problem"}:
            raise OptimizationInputError("require exactly action and problem")
        action = payload["action"]
        if not isinstance(action, str) or action not in ACTIONS:
            raise OptimizationInputError("unsupported optimization action")
        result = ACTIONS[action](payload["problem"])
        print(json.dumps(
            {"schema": "fun.optimization.result.v1",
             "action": action, "result": result,
             "decision_support_only": True,
             "rea_tools_executed": 0,
             "external_actions_executed": 0},
            allow_nan=False,
        ))
        return 0
    except (OptimizationInputError, ValueError, UnicodeError, TypeError, ImportError) as exc:
        print("FUN_OPTIMIZATION_BRIDGE_HOLD=" + str(exc), file=sys.stderr)
        return 2
    except Exception as exc:
        print("FUN_OPTIMIZATION_BRIDGE_RUNTIME_HOLD=" + type(exc).__name__, file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
