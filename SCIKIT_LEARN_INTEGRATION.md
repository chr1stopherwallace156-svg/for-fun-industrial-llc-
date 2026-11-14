# Fun Industrial — scikit-learn ML capability V1

This is a **separate, optional local machine-learning component**, not a replacement for Fun Industrial/Qwen/REA. It is an operator-run CLI bridge. It never starts a listener, browser, gateway, store, or tool executor, and it does not alter existing services. It is **not automatically registered as a Qwen/REA tool**.

## Install from Windows PowerShell or Termius

After checking out this feature branch, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Fun-ScikitLearn-V1.ps1
```

The installer uses 64-bit Python 3.12, creates an isolated virtual environment under `%LOCALAPPDATA%\FunIndustrial\MLScikitLearnV1\venv`, installs the **binary-wheel** distribution of `scikit-learn==1.9.1`, runs unit tests and a model smoke test, and caps library threading at 2. It does **not** compile scikit-learn from source. Re-running after success validates the pinned environment and does not reinstall packages.

## Operate the capability

```powershell
$python = Join-Path $env:LOCALAPPDATA 'FunIndustrial\MLScikitLearnV1\venv\Scripts\python.exe'
& $python .\ml\scikit_learn_bridge.py health
& $python .\ml\scikit_learn_bridge.py self-test
```

Send data as JSON on standard input:

```powershell
Get-Content -Raw .\deals.json | & $python .\ml\scikit_learn_bridge.py analyze_deals
Get-Content -Raw .\history.json | & $python .\ml\scikit_learn_bridge.py train_sales
Get-Content -Raw .\candidates.json | & $python .\ml\scikit_learn_bridge.py predict_sales
```

`deals.json` must have a `deals` array of 8–250 records with precisely: `id`, `cost`, `sale_price`, `shipping`, `fees`, and `return_allowance` (nonnegative numeric values). The output includes a deterministic estimated profit per deal and an `IsolationForest` *outlier flag*; neither verifies that the deal is real.

`history.json` must have a chronological `history` array of 16–1000 records: `visits`, `price`, `ad_spend`, `units_sold`. The script trains a ridge regression, evaluates it using 3 time-ordered splits, and saves the numeric coefficients under the `FunIndustrial\MLScikitLearnV1` local-app-data folder as safe, inspectable JSON. No pickle, no external download other than the one-time package installation.

`candidates.json` has a `candidates` array of 1–100 records with `visits`, `price`, and `ad_spend` to estimate unit sales using the previously trained model. The model is advisory and does not authorize purchases, pricing, or Shopify publication.

## Future integration

Qwen cannot invoke this module on its own until a purpose-built, separately approved bridge is registered and qualified in the Fun Industrial local-tool workflow. The existing REA tool catalog, 8789 dashboard, 8798 unified chat, 8088 llama.cpp, 8791 compute, and Elektron/Ollama processes are intentionally unchanged by V1.