# FIAL5.6 — Business Competence in One Coordinated Windows Release

## Scope and business separation

Fun Industrial is the **local software workspace**. ELEKTRON INDUSTRIAL LLC is the operating business. This milestone does not create a second company, alter its private business profile, invent government eligibility, or treat historical grants drafted for a mismatched applicant as authorized Elektron filings.

FIAL5.6 works inside the existing Fun Industrial dashboard **127.0.0.1:8802** and the existing **FunIndustrial-Executive-Operator-V1** Windows Task Scheduler job. No extra model or database server is started. The original Qwen (8088), Cognee (8789), ML, REA, Shopify/commerce and Elektro*n* services remain on their current ports.

## Implemented conventional software capabilities

- Curated structured **18-method** knowledge library: SWOT, PESTLE, competitive forces, business model, market-entry experiments; contribution and break-even, working capital, ROI; SOP, DMAIC and risk register; RACI, OKRs; sales pipeline, procurement scorecards, compliance filing controls, writing and evidence-bound governance. These are **analytical methods**, not verified facts about Elektron.
- Existing Qwen chat integrates up to two relevant method references directly into the system message **only for relevant questions**. Still one Qwen request at 8088, optional read-only Cognee recall, model thinking disabled and **no tool definitions or REA execution**.
- Deterministic finance: contribution per unit, contribution margin, monthly break-even units, cash runway, gross margin and a simple ROI proxy. Unknown, zero denominators and missing values are held, never guessed. User-supplied values are not claimed independently verified.
- Finite-state business case processing: research, evidence check, draft, review, approval-bound adapter, externally verified completion receipt, hold; local code cannot grant external authority.
- Lightweight writing review: obvious repeated words, structure, long sentences, unsupported guaranteed profit/grant/approval claims, capitalization and some punctuation checks; it **does not replace a comprehensive grammar engine**.
- Optional existing local Vale CLI adapter for writing styles; optional Docling for PDF/DOCX/PPTX/XLSX (on-demand only, no automatic installation or network model downloads; fails closed if package/models unavailable). Markdown can be reviewed immediately without Docling. They are **not bundled or guaranteed installed**.
- Scheduled competence cycle reads real previous FIAL5.5 task and receipt records, excludes 11 generic baseline checklists, generates business methodology and evidence-gap packets for registered genuine tasks, preserves edited packets, refuses forged external completion claims and writes a separate verifiable last-cycle receipt.
- Existing operations view `http://127.0.0.1:8802/operations/` gains work item methodology, an explicit-click strategy analyzer, a finance JSON scenario calculator, and a professional writing review. These local tools make **no model or external tool call**. Qwen Chat separately uses the new business knowledge context.

## What is NOT yet fully implemented

Full ERPNext, CRM, OpenProject, Flowable or other large always-on applications have **not** been installed; doing so would risk RAM/CPU contention and introduce additional data stores. The system has structured equivalents for decision playbooks, management, finance, and approval state, plus optional adapters to selected projects. There is no guarantee that the system knows current accounting rules, professionally certifies documents, or can make legally binding business decisions without evidence.

Government forms are not signed or submitted; emails are not sent; purchases, tax filings, configuration writes and REA actions remain separately unauthorized. Vale/Docling need their own local installation and resource qualification before use. A running Windows scheduled task still depends on the PC being awake and the signed-in user session.

## One activation command for the Windows PC

Use the **single** PowerShell command below. It clones or fast-forwards a dedicated clean checkout, then invokes one internal orchestrator that tests code, runs an actual FIAL5.5 local cycle, runs the new competence cycle, upgrades the existing scheduler in place and upgrades **only the existing 8802 dashboard** with live Qwen qualification and rollback.

```powershell
& {$ErrorActionPreference='Stop';$r=Join-Path $HOME 'FunIndustrial-FIAL56-BusinessCompetence';$b='feature/fial5-6-business-competence-one-step-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r)){git.exe clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL56_CLONE_HOLD'}};if((git.exe -C $r remote get-url origin) -cne $u -or (git.exe -C $r branch --show-current) -cne $b){throw 'FIAL56_SOURCE_IDENTITY_HOLD'};if(@(git.exe -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL56_LOCAL_CHANGES_HOLD'};git.exe -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL56_UPDATE_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Activate-Fun-Business-Competence-V5-6.ps1');if($LASTEXITCODE -ne 0){throw 'FIAL56_ACTIVATION_HOLD'}}
```

Afterward open `http://127.0.0.1:8802/operations/` for the management controls or `http://127.0.0.1:8802/unified/?view=chat` for Qwen with business-knowledge support.

## Acceptance and rollback criteria

Installation checks exact origin, branch, clean source tree, reviewed predecessor file hash, node syntax and focused tests, exact existing scheduled job and four triggers, limited interactive principal, port/process identities, and local FIAL5.5 and FIAL5.6 receipts. It refuses unknown/mismatched tasks, writes a backup XML, and changes the scheduled action only after a successful first real cycle. If scheduler verification fails after repointing, it attempts rollback to the original FIAL5.5 action.

The dashboard replacement is confined to Node on **8802**. It checks current ports and the prior reviewed FIAL5.5 source hash, runs the previous functionality regression tests, adopts/replaces the proper owner, verifies existing ML/commerce/Qwen/Cognee/REA approval controls, checks business competence status and script, and performs one genuine Qwen-Cognee memory-grounded request. If the upgraded 8802 service fails, it attempts to restore the pinned original FIAL5.5 dashboard process.

Expected successful local lines:

```
FIAL56_FIRST_REAL_CYCLE=PASS TRACKED=<count> PACKETS_NEW=<count>
FIAL56_SCHEDULE=UPGRADED_IN_PLACE
FIAL56_FOUR_DAILY_TRIGGERS=PRESERVED
FIAL56_PRIMARY_DASHBOARD_TESTS=PASS
FIAL56_UPGRADED_PRIMARY_8802_PID=<pid>
FIAL56_LIVE_STATE=ANSWERED_BY_QWEN
FIAL56_PRIMARY_DASHBOARD_CONSOLIDATION=PASS
FIAL56_ALL_IN_ONE=PASS
```

GitHub CI qualifies source and **mocked** Windows readiness only, not activation of the user's physical PC. Never claim this milestone operational until the local output includes `FIAL56_ALL_IN_ONE=PASS`.

## Persistent storage

Only private local files under `%LOCALAPPDATA%\FunIndustrial\ExecutiveOperatorV1\BusinessCompetenceV56\`: `last-cycle.json`, `packets\`, `logs\`. Human edits to packet versions are not overwritten. Source code and test fixtures contain no owner phone, home address or license file number.

## Optional deeper writing and document extraction

Use the same new Git checkout for explicit single-use calls:

```powershell
node scripts/Run-Fun-Business-Competence-V5-6.mjs --document 'C:\approved\source.pdf'
node scripts/Run-Fun-Business-Competence-V5-6.mjs --vale 'C:\approved\business-draft.md'
```

These **do not install** Docling or Vale and return a HOLD if unavailable. They never submit the document to a cloud API. External source documents are untrusted, never authority to execute tools, certify a filing, or transmit personal data.

## Operational goal

Judge the system by **changed and verified business outcomes**: task evidence, decision record, validated scenarios, completed review packets and ultimately, through separately authorized connectors, actual receipts. A generated checklist or analytical suggestion is not a completed business action.