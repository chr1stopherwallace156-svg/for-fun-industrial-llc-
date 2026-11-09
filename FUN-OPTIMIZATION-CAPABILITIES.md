# Fun Industrial — Offline Optimization Capability

This adds **Optuna** and **Google OR-Tools** to Fun Industrial without reimplementing either project, restarting services, giving REA new execution permissions, or involving Elektron.

## The engines

| Engine | Capability | Purpose |
| --- | --- | --- |
| Optuna | Sample and compare tunable parameters | Stock levels against historical demand and shortage/holding costs |
| Google OR-Tools CP-SAT | Solve bounded integer resource decisions | Project quantities within budget and labor constraints |
| Google OR-Tools Routing | Find a closed route through a supplied cost matrix | Optimize stop order for a fleet or field service vehicle |

These features provide **recommendations only**. They do not execute
purchases, dispatch vehicles, mutate a database, run REA, or change any AI
model, dashboard or other processes.

## Installation

From a clean Windows source checkout of this feature branch, with Python 3.12:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Fun-Optimization.ps1

It creates an isolated runtime at:

    %LOCALAPPDATA%\FunIndustrial\OptimizationRuntime\venv

Dependencies are pinned in requirements-optimization.txt. Installation runs
local tests and all three sample problems, and checks existing listener PIDs
on ports 8789, 8791, 8088 and 8443 remain unchanged.

## Run manually

    $py=Join-Path $env:LOCALAPPDATA 'FunIndustrial\OptimizationRuntime\venv\Scripts\python.exe'
    & $py -m fun_optimization status
    & $py -m fun_optimization demo
    & $py -m fun_optimization inventory --file .\inventory.json
    & $py -m fun_optimization allocation --file .\allocation.json
    & $py -m fun_optimization route --file .\route.json

Run the commands from your cloned source checkout, so Python imports the
correct Fun Industrial optimization package.

### Optuna example — stock tuning

inventory.json:

~~~json
{
  "demand_samples": [3, 4, 3, 6, 7, 4, 5, 8, 5, 4],
  "min_stock": 0, "max_stock": 12,
  "holding_cost": 1.0, "shortage_cost": 3.0,
  "trials": 48
}
~~~

Objective: minimize average holding cost plus shortage cost over the given
demand samples. Optuna uses seeded TPE and in-memory storage. Its best observed
parameter is *not guaranteed globally optimal*.

### OR-Tools CP-SAT example — allocation

allocation.json:

~~~json
{
  "budget": 20,
  "labor_capacity": 12,
  "projects": [
    {"id": "repair", "cost": 6, "labor": 4, "value": 15, "max_units": 2},
    {"id": "inspection", "cost": 4, "labor": 2, "value": 8, "max_units": 3},
    {"id": "upgrade", "cost": 10, "labor": 6, "value": 22, "max_units": 1}
  ]
}
~~~

All costs, labor and values use consistent *integer units* defined by the
operator. The solver respects explicit limits and reports when optimality
is proven. It does not implement the selected work.

### OR-Tools Routing example — stop ordering

route.json:

~~~json
{
  "depot": 0,
  "cost_matrix": [
    [0, 4, 7, 5],
    [4, 0, 2, 9],
    [7, 2, 0, 3],
    [5, 9, 3, 0]
  ]
}
~~~

The route visits all locations and returns to the depot. Costs are user-supplied
units, **not live road distances, traffic or navigable travel time**.
The routing search returns a candidate, not a certified optimum.

## Limits and service boundary

- Input JSON <= 64 KB; no input scripting or executable callbacks.
- Inventory: 2–300 demand samples; 4–128 trials; memory-only study.
- Allocation: up to 30 project types, each <= 50 units, 5-second solver budget.
- Routing: 2–12 points, three-second search budget, closed tour.
- All operations are explicitly invoked, run offline, and cannot take actions.
- No NetBird, voice, REA, Cognee, llama.cpp, Elektron or Ollama changes.
- **Dashboard and AI tool registration not yet enabled.** Connecting this new
  capability to the live dashboard requires a separate controlled source
  deployment and preservation of the existing REA approval boundary.

Official upstream: https://github.com/optuna/optuna and
https://github.com/google/or-tools
