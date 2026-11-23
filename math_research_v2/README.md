# Fun Industrial Math Research V2 — independent symbolic hypothesis laboratory

**Status:** autonomous bounded mathematical research, not a lottery forecasting product or proof of predictability.

## Technical advances over V1

- A reproducible 69-equation symbolic grammar, covering rolling frequency (25/50/100), momentum, last-draw presence, and appearance gaps.
- Each equation produces bounded weights `exp(sum(beta * standardized_feature))` for all eligible white balls.
- Mathematically exact normalized probability of five distinct white balls, `P(S)=product(weights in S)/e_5(weights)`, with efficient O(5N) polynomial normalizer. `e_5` denotes the elementary symmetric polynomial.
- Era-specific 50% training history, 25% validation, 25% untouched historical test where sample size permits; validation selects equations, never the final test.
- Fair-lottery null simulations redo the whole test path with updated simulated history, rather than incorrectly shuffling only the outcomes.
- A candidate equation is frozen when first installed in a future-only protocol; subsequent official drawings are scored without changing that equation. The frozen candidate can be unpromising on historical validation and remains an exploratory control rather than a claim of better odds.
- Corrects across tested eras, but repeated looks and researcher choices mean even a low historical p value is **not a verified predictive edge**; evidence needs a truly future preregistered evaluation.
- Outputs JSON, Markdown, an append-only research ledger, a frozen future protocol file and append-only prospective scorecard. A matching validated cache skips recomputation.
- Standard-library-only Python 3, no Node, Qwen, REA, Optuna, ML service, or dashboard dependencies. Supports official NY State draw data back to 2002 through the vetted V1 data loader.
- 200 null simulations by default (up to 500); no continuous polling, runs at 07:00 local once per scheduled invocation.

## Installation

Run `Install-Fun-MathResearchV2.ps1 -InstallSchedule -RunOnce` from Windows PowerShell with the Python 3 launcher present. The worker is staged only under `%LOCALAPPDATA%\FunIndustrial\MathResearchV2` and creates only its own scheduled task `FunIndustrial-MathResearchV2-Daily`.

V1's task continues unchanged at 06:30, and neither task changes Elektron, Fun's 8802 UI, AI model, tool allowlists, network listeners, or anything outside its own directory. User-provided CSVs can be analyzed with `py -3 engine.py --file <path> --out <directory>`. Offline cached mode is `--offline`; outputs explicitly flag stale sources.

Stop V2 scheduling: `Unregister-ScheduledTask -TaskName FunIndustrial-MathResearchV2-Daily -Confirm:$false`.

## Limitations

The model searches a constrained hypothesis grammar, not mathematical laws without limits. Its results cannot establish a predictable lottery without replicated prospective evaluation. No Mega Ball modeling yet; no ticket combinations, gambling purchases or financial actions. Do not claim better odds from historical frequency or a nominal p-value. All software is research-only and self-contained.

The source is frozen from the first validated run to separate hypothesis selection from later scorekeeping. Repeatedly examining a historical holdout, or changing the frozen model after observing future results, would invalidate a confirmatory claim. If state data are revised, the future ledger holds rather than silently rewriting historical results.
