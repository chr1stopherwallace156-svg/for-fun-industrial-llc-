# FIAL 5 — Whole-system Fun Industrial Autonomous Language

**Goal:** FIAL is the common programming, evidence, memory and decision **platform** for the entire Fun Industrial system. California grants were its initial domain-specific adapter, not its intended limit.

FIAL 5 no longer compiles `SOURCE GRANTS`. It compiles `SCOPE FUN_INDUSTRIAL` and observes a fixed registry of known capabilities. It records changes, unavailable services, and integration gaps using a shared SQLite ledger, persistent evidence receipts and operator-readable decisions.

## Domains in the initial registry

- Platform: original control center (8789), integrated hub (8802).
- AI and compute: Qwen (8088), compute (8791), unified chat (8798), ML (8801).
- Tools: local tools (8796), REA (8797).
- Business intelligence: commerce (8802), official grant-data FIAL4 (8803).
- Registered capabilities awaiting verified interfaces: persistent memory, optimization, workflows, voice, security, engineering inspection, ecommerce operations and public web.

These are **18 registered capability entries**, not a claim of 18 live or fully integrated services. Each connected service is queried at its fixed, already-existing loopback status URL. When its status response provides an identifiable version or documented signature, the core reports `IDENTITY_VERIFIED`. Other reachable endpoints are `OBSERVED_ENDPOINT` or `OBSERVED_ENDPOINT_IDENTITY_NOT_ATTESTED`. Modules without a verified status endpoint are `NOT_INSTRUMENTED`. A down or mismatched endpoint is a named HOLD. No arbitrary URLs, external network scans or cross-module execution are included.

## Active operation

FIAL 5 runs one entire-system observation on startup, repeats every **15 minutes** while port 8804 is running, and exposes a **Check entire system now** button that triggers one non-overlapping cycle. Data is persisted in:

`%LOCALAPPDATA%\FunIndustrial\FIAL5System\`

- `fial-system-memory-v5.sqlite`: run and module observation ledger.
- `runs\<run-id>.json`: append-only per-cycle snapshot.
- `last-run.json`: atomic current system status and next-action recommendations.

The runtime generates bounded deterministic decisions such as `INVESTIGATE_LOCAL_DEPENDENCY`, `REVIEW_IDENTITY_BEFORE_USE`, `REVIEW_OBSERVED_CHANGE`, `INTEGRATION_NEEDED` and `CONTINUE_MONITORING`. **These are real programmed decisions, not approvals to execute REA or modify files.** A future adapter may implement reviewed, permitted actions separately.

## Unified dashboard and existing services

The active FIAL 5 control center runs on **http://127.0.0.1:8804/**. It reuses the existing 8803 integrated dashboard HTML and forwards its API requests when that process is available, adding the system-wide FIAL 5 panel. If 8803 is down, the system-wide panel still loads independently. The runner only starts or adopts **8804** and will never restart or modify Qwen, REA, Elektron, 8443, 8789, 8798, 8802 or 8803. Existing service process ownership stays unchanged.

## One Windows PowerShell command

```powershell
$r=Join-Path $HOME 'FunIndustrial-FIAL5-System';$b='feature/fial5-system-wide-core-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r)){git clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL5_CLONE_HOLD'}};if((git -C $r remote get-url origin) -cne $u -or (git -C $r branch --show-current) -cne $b){throw 'FIAL5_SOURCE_HOLD'};if(@(git -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL5_DIRTY_CHECKOUT_HOLD'};git -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL5_UPDATE_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Start-Fun-FIAL-System-V5.ps1');if($LASTEXITCODE -ne 0){throw 'FIAL5_ACTIVATION_HOLD'}
```

The command clones into its own checkout, refuses changed source, validates tests and identity before starting only the new system coordinator. Expected live outputs include `FIAL5_SYSTEM_ACTIVATION=PASS`, `FIAL5_MODULES_REGISTERED=18`, individual module states and `FIAL5_PROTECTED_SERVICES=NOT_TOUCHED`.

## Scope, implementation and future execution

FIAL 5 is the **system-wide architectural core**. The initial qualified version is an active registry, evidence, change detection and decision engine. It is **not yet a universal executor** and does **not** imply every module is fully wired to the common language. A capability becomes integrated only once its real adapter supports contract-checked observations and, where desired, separately authorized actions.

The next engineering objective is to replace each `NOT_INSTRUMENTED` with an explicit adapter contract and integrate the existing approved optimization/workflow step APIs. Any external tools, payments, email, submissions, REA actions or protected service changes remain behind their current operator approvals.

Automatic cycles run while the new local service is running. This release does not install a Windows boot autostart task, public listener or external gateway configuration.
