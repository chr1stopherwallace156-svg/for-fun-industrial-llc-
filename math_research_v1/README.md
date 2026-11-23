# Fun Industrial mathematical hypothesis engine — V1

This is a **Fun Industrial-only** isolated researcher of the publicly reported Mega Millions draw history, starting May 17, 2002. It does **not** claim an ability to predict lottery outcomes. It does not trade, buy tickets, open gambling websites, change permissions, modify Qwen, call REA, replace the UI on port 8802, or touch Elektron.

## Files

- `engine.py`: standard-library-only official data collection, integrity validation, rule-era segmentation, null-model Monte Carlo, rolling hot/cold research hypotheses, chronological holdout backtesting, familywise multiple-testing correction, reproducible JSON/Markdown reports, SHA-256 source tracking, and append-only evidence ledger.
- `Install-Fun-MathResearchV1.ps1`: opt-in scheduled task and one-shot run; installed files reside in `%LOCALAPPDATA%\FunIndustrial\MathResearchV1`.

## Windows installation from downloaded folder

Open PowerShell in the extracted directory and run:

```powershell
& '.\Install-Fun-MathResearchV1.ps1' -InstallSchedule -RunOnce
```

The scheduled task runs daily at 06:30 local time and performs no continuous polling. Each invocation reads from New York State's official Open Data API. If refresh fails, a previously validated local cache may be used, **explicitly labeled stale**. If the input hash has not changed, it skips expensive calculations. Work is CPU-bounded, Python standard-library-only, and isolated from other Fun Industrial services.

To stop automatic scheduled runs:

```powershell
Unregister-ScheduledTask -TaskName 'FunIndustrial-MathResearchV1-Daily' -Confirm:$false
```

## Research validity and limitations

The historical frequency analysis is descriptive. Adaptive rolling strategies are defined before evaluation, scored against a fair-draw null on chronological unseen-in-model data, and corrected for testing multiple candidates. The last 30% of each rule era is a historical holdout; this is **not** equivalent to live prospective replication. Re-evaluating old data daily does not make an apparent effect predictive. The engine marks rare results as requiring *future* independent confirmation, never as a guaranteed edge.

## Operations

- Raw dataset: `%LOCALAPPDATA%\FunIndustrial\MathResearchV1\official_source.csv`
- Report: `%LOCALAPPDATA%\FunIndustrial\MathResearchV1\latest_summary.md`
- Structured output: `latest_report.json`
- Immutable-in-normal-operation ledger: `evidence_ledger.jsonl`
- To run without networking after a prior successful refresh: `py -3 engine.py --offline --out <output-directory>`

Do not connect the engine to production workflows or grant the model write authority. Integration into the 8802 UI, if desired, is a separate reviewed change.