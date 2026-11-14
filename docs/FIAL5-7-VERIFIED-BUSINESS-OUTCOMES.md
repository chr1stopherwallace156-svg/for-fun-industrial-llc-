# FIAL5.7 — First Verified Business Outcome

Fun Industrial is software. **ELEKTRON INDUSTRIAL LLC** is the business. This release measures **actual external outcomes** instead of counting generated checklists.

## Initial outcome: one official Victorville Business License inquiry

Official City of Victorville contact (verified from official city source):

- https://www.victorvilleca.gov/Government/City-Departments/Business-License-Division
- Business License Division email: `businesslicense@victorvilleca.gov`.

From the private verified-format **operator-provided** ELEKTRON profile, the system produces one fixed message asking about the supplied city file reference, current license status and applicable renewal or remaining requirements. It does **not** claim the file number proves an issued or active license, a current SOS entity record, or a government filing. The generated text and recipient are reviewable locally.

### Actual progress receipts

- `DRAFT_AWAITING_REVIEW` — private draft prepared; **0 external results**.
- `SEND_ATTEMPT_STARTED` — irrevocable one-time checkpoint persisted before any network send. If a request fails or times out, hold; never retry without reconciling the Gmail Sent folder and ledger.
- `SENT_WITH_GMAIL_RECEIPT` — Google accepted **one** exact message. Gmail message ID and thread ID saved; **not** proof the City received or read it.
- `POSSIBLE_REPLY_REQUIRES_HUMAN_REVIEW` — read-only inbox headers may indicate a City response; neither account authenticity nor actual license status is automatically certified.

Any claim of revenue, license approval, government filing, payment, or external tool execution remains false without an independently verified receipt. Old FIAL5.4/5.5/5.6 local evidence remains intact.

## Guarded unattended work

The existing Windows Task Scheduler worker is upgraded **in place** at 01:00, 07:00, 13:00 and 19:00 local time. Its job chains the existing FIAL5.6 scheduled cycle and calls ONLY `--observe`. It may read up to six Elektron Gmail message headers **if the distinct, account-verified `gmail.readonly` OAuth authorization has already been connected**. A missing Gmail account yields `MAILBOX_UNAVAILABLE`, not an invented email or a failed system-wide operation.

The scheduled job **cannot** call `--connect-send` or `--send-approved-stdin`, and the new dashboard endpoint supports GET status only. Email transmission requires a separate, exact user action in Windows PowerShell.

## Manual operator-approved Gmail sending

Sending uses a **separate** OAuth token with only Gmail `gmail.send` and Google `userinfo.email` scopes, stored encrypted with the current Windows user's DPAPI. The token is never copied from the old read-only adapter, and must match the exact Elektron account in the private business profile.

First the operator must configure their own Google OAuth Desktop Application JSON at:

`%LOCALAPPDATA%\FunIndustrial\ElektronGmail\desktop-oauth-client.json`

Then the operator can run these deliberate actions from the FIAL5.7 checkout:

```powershell
node scripts/Run-Fun-Outcome-V5-7.mjs --prepare
node scripts/Run-Fun-Outcome-V5-7.mjs --connect-send
```

`--prepare` prints the exact email and a one-use authorization phrase bound to its SHA-256 content fingerprint. `--connect-send` opens a Google authorization URL for **the PC's local loopback browser**, and does not send anything. Authorization may need the owner's consent/test-user configuration in Google Cloud. Do **not** paste OAuth tokens, private client secrets or verification codes into ChatGPT or GitHub.

After independently reviewing the recipient, content and sending account, submit the exact phrase to the process via stdin:

```powershell
$approval=Read-Host 'Exact FIAL57 approval phrase';$approval | node scripts/Run-Fun-Outcome-V5-7.mjs --send-approved-stdin
```

This is **one single, non-replayable send** to the City email hard-coded in reviewed source. It cannot send arbitrary messages, attachments, files, or public outreach. If the Gmail request outcome is uncertain, the permanent attempt marker prevents automatic retry.

## One-command activation of the software (NO SEND)

```powershell
& {$ErrorActionPreference='Stop';$r=Join-Path $HOME 'FunIndustrial-FIAL57-VerifiedOutcomes';$b='feature/fial5-7-verifiable-business-outcomes-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r)){git.exe clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL57_CLONE_HOLD'}};if((git.exe -C $r remote get-url origin) -cne $u -or (git.exe -C $r branch --show-current) -cne $b){throw 'FIAL57_SOURCE_IDENTITY_HOLD'};if(@(git.exe -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL57_DIRTY_SOURCE_HOLD'};git.exe -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL57_PULL_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Activate-Fun-Verified-Outcomes-V5-7.ps1');if($LASTEXITCODE -ne 0){throw 'FIAL57_ACTIVATION_HOLD'}}
```

The command validates the reviewed repository, performs real local existing-FIAL5.6 + outcome observation cycles, updates the **same** scheduled task, and upgrades only the primary Node service on `127.0.0.1:8802` with FIAL5.6 rollback. It must not change Qwen, REA, Ollama, commerce, databases or ELEKTRON engineering services.

Success markers: `FIAL57_FIRST_REAL_OBSERVATION=PASS`, `FIAL57_SCHEDULE=UPGRADED_IN_PLACE`, `FIAL57_FOUR_DAILY_TRIGGERS=PRESERVED`, `FIAL57_PRIMARY_DASHBOARD_TESTS=PASS`, `FIAL57_PRIMARY_DASHBOARD_CONSOLIDATION=PASS`, `FIAL57_ALL_IN_ONE=PASS`.

Dashboard: `http://127.0.0.1:8802/operations/`

Private ledger under `%LOCALAPPDATA%\FunIndustrial\ExecutiveOperatorV1\OutcomeV57\`. Google send and read-only Gmail credentials are stored separately in `%LOCALAPPDATA%\FunIndustrial\ElektronGmail\`, encrypted with Windows DPAPI.

## Boundaries

The new system will **not** automatically send emails, apply for grants, sign government forms, purchase goods, or declare official status. The only external action supported by its first dedicated adapter is a single explicitly approved email to the verified City recipient. Additional businesses, grants, sales, vendors, contracts and other legitimate activities need their own typed verified actions and receipts. Google OAuth setup is not bypassed or silently delegated.

Windows Task Scheduler runs only when the machine is available and the relevant Windows user session is signed in. Offline source tests and GitHub CI are not evidence the customer's PC has actually activated the worker. Google acceptance is not confirmation of delivery or a City response.