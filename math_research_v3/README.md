# Fun Industrial Research V3 — mathematical falsification and future e-process

A separate, standard-library-only worker for Fun Industrial LLC. It does not modify Elektron, Qwen, REA, the existing dashboard, or any other local service. One run is scheduled at 07:30 local time daily. The installer **does not** install Qwen or the dashboard; the separate reviewed integration layer does that.

**Reproducible exploration:** V3 generates 138 bounded symbolic equations per eligible Mega Millions rules era: linear frequencies, quadratic transforms, feature interactions, and two-feature expressions. The separate report records true validation and historical test scores for **all candidates**, including negative scores; the fair baseline's score of zero is only a reference, not the score of every equation. Historical model selection uses validation data only; holdout test rankings remain explicitly exploratory.

**Prospective testing:** At first installation, V3 freezes five equations selected strictly from historical validation. Later drawings are scored with exact normalized probabilities for five distinct white balls, using a fixed equal-weight mixture of per-model likelihood ratios. Under the specified iid fair-draw null, the mixture is a nonnegative mean-one martingale and its e-value crossing 20 *at any time* has at most 5% probability. This requires no changes to the frozen family and no future peeking; statistical evidence is not proof of predictable lottery outcomes. A physical-bias mechanism and independent replication would still be required. Source revisions stop scoring instead of rewriting outcomes. No ticket picks or purchases are generated.

**Outputs under** `%LOCALAPPDATA%\FunIndustrial\MathResearchV3`:

- `latest_summary.md` — human-readable summary with caveats.
- `latest_report.json` — structured model and e-process metadata.
- `candidate_ledger.json` — all 138 validation and historical test scores per era.
- `v3_frozen_future_protocol.json` — permanently selected candidate family (created on first validated live run).
- `v3_future_scorecard.jsonl` — append-only forward evaluations, only once later draws exist.
- `research_run_ledger.jsonl` — run history.
- `official_source.csv` — validated source cache.

The worker reads the official historical feed previously verified by V1 (`data.ny.gov`) with fail-closed validation. It may use a stale cached source if official refresh fails, but never scores a future draw from stale data. If unchanged, the data SHA-256 allows skipping expensive recomputations. No continuous polling. CPU is used only during bounded scheduled runs.

**Research limits:** The discovered equations come from an explicitly finite, deterministic grammar. This is not an unrestricted automatic discovery of mathematical laws, and without future evidence it does not increase lottery winning odds. The e-process applies to the fixed 2025 rule era's five white balls; Mega Ball probabilities and physical draw characteristics are not modeled.

**Standalone installation:** `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Fun-MathResearchV3.ps1 -RunOnce -InstallSchedule`

**Turn off schedule:** `Unregister-ScheduledTask -TaskName 'FunIndustrial-MathResearchV3-Daily' -Confirm:$false`.