# FIAL5.5 — Fun Industrial software operator for ELEKTRON INDUSTRIAL LLC

## Entity boundary

**Fun Industrial is the name of the software environment, not an independently verified licensed company.** The applicant, business correspondence and filings belong to **ELEKTRON INDUSTRIAL LLC**. Previous FIAL5.4 saved work and older grants worksheets may contain the phrase "FUN INDUSTRIAL LLC"; they are legacy artifacts and may not be used as Elektron's legal application evidence.

The owner-supplied license/file reference is a **reference only** until its issuing authority and present status are confirmed. A file number does not prove license issuance, Secretary of State registration, good standing, renewal dates, or authority to make a filing.

The current business name and operational profile are kept exclusively in local `%LOCALAPPDATA%\FunIndustrial\ExecutiveOperatorV1\business-identity-v5-5.json`; phone, address, owner name, company email and file number are deliberately **not embedded in GitHub source or test fixtures**. A local private JSON profile is not a secure vault for account passwords or government portal tokens. No credentials are stored there.

## Operational additions

- Guarded local business profile initialization using a UTF-8 JSON stdin pipe; idempotent if values match, rejects unexpected overwrite.
- Upgrades the **existing** `FunIndustrial-Executive-Operator-V1` Task Scheduler action in place rather than creating a second worker. Old scheduling XML is backed up, and the action is restored on a failed post-change qualification.
- Reuses the earlier persistent eleven-workstream queue but corrects the Fun Industrial vs Elektron business-entity classification. Eight new operator-review tasks link to filing, mail, funding, sales, configuration and engineering.
- Creates local SHA-256-attributed business-identity packet, a drafted city-license record verification email, California Secretary of State record verification checklist, and a **proposed Elektron grant applicant profile** with all verification flags set to false. Human edits to prepared files are never overwritten.
- Periodically checks the **three fixed official** City of Victorville/California SOS public pages. It records bounded downloaded HTML, SHA-256 hashes, and official page changes (not portal logins or personal entity status).
- Optional read-only source file SHA-256 inspection when the operator explicitly sets `FIAL55_APPROVED_SOURCE_FILE`; never rewrites the source.
- The dedicated Elektron Gmail adapter validates the account against the private local identity; uses only the Gmail read-only scope, requires interactive Google OAuth and encrypts locally held tokens using the Windows user DPAPI. Until separately configured, mail remains unavailable. There is **no Gmail send/modify/delete implementation**.
- The original `8802/operations/` dashboard gains a real-work status section. Private contact data is not exposed to its browser API. Qwen/Cognee, REA review, commerce, and all other original components are preserved.

## Official pages

- City of Victorville business licenses: https://www.victorvilleca.gov/Government/City-Departments/Business-License-Division
- City business requirements: https://www.victorvilleca.gov/Government/City-Departments/Business-License-Division/Business-License-Links-and-Resources
- California SOS records and Statements of Information: https://www.sos.ca.gov/business-programs/business-entities/information-requests and https://www.sos.ca.gov/business-programs/business-entities/statements
- California official bizfile: https://bizfileonline.sos.ca.gov/

A city business license number is not a California SOS entity number. Official current filing due dates must come from authoritative entity records. As of August 1, 2026, the SOS requires established portal User Access for Statements of Information.

## Security and authority

This release performs useful **local** work without user prompts, but cannot truthfully claim end-to-end filing, purchasing, company registration, autonomous software edits, sent outreach or full legal compliance. Government submissions, certifications/signatures, payments, changing approved configurations and sending email remain unsupported until specific official/authorized adapters, identity and one-time approval/receipt workflows are implemented.

The 01:00, 07:00, 13:00 and 19:00 existing Windows schedule continues while the PC is awake and the logged-on user session is available. It is not a guarantee of 24/7 uptime when asleep/offline.

If the legacy California grant worker still has a "FUN INDUSTRIAL LLC" applicant profile, FIAL5.5 **holds** its grant candidates from being promoted as Elektron application-ready. The new local Elektron grant-profile proposal can be reviewed before a separate safe migration of the legacy grant worker. Previously prepared Fun LLC worksheets are not renamed or resubmitted.

## Installation process

1. Clone fresh branch `feature/fial5-5-real-business-operations-20261114`. Verify exact origin and branch, clean worktree and Windows syntax/tests.
2. Run `Install-Fun-Real-Operations-V5-5.ps1` using only operator-provided profile parameters in the Windows session. This privately records fields, prepares real packets, verifies no external effects, and changes the existing scheduled-task action with backup/rollback.
3. Run `Deploy-Fun-FIAL55-PrimaryDashboard.ps1 -VerifyLive` to replace only the primary 8802 Node dashboard under protected-service checks and live Qwen/Cognee qualification. Failure attempts rollback to the pinned FIAL5.4 8802 process.
4. Open `http://127.0.0.1:8802/operations/` to review actual work, official-source monitoring, and the queue. The source checkout remains separate from local private files.

**The operator must run the actual Windows command to establish live activation. GitHub CI only validates source and mocked Windows readiness; it cannot claim the PC task was changed.**

### Gmail authorization prerequisite

The local Elektron Gmail read-only adapter requires an operator-owned Google Desktop OAuth client JSON at:
`%LOCALAPPDATA%\FunIndustrial\ElektronGmail\desktop-oauth-client.json`

After that file is created locally, run `node scripts/Run-Fun-Real-Operations-V5-5.mjs --connect-elektron-gmail` from the new repository checkout and finish the Google consent flow for **the exact business email in the private profile**. No password or one-time login code should ever be pasted into ChatGPT or GitHub. The Google console setup is not bypassed by providing an email address. Read-only authorization is independent of permissions to send.

## Local receipts

- `%LOCALAPPDATA%\FunIndustrial\ExecutiveOperatorV1\RealWorkV55\last-real-cycle.json`
- `%LOCALAPPDATA%\FunIndustrial\ExecutiveOperatorV1\OfficialWatchV55\official-watch-v1.json`
- `%LOCALAPPDATA%\FunIndustrial\ExecutiveOperatorV1\state-v1.json`
- `%LOCALAPPDATA%\FunIndustrial\ExecutiveOperatorV1\SchedulerBackups\pre-fial55-*.xml`

No local private file is pushed to GitHub automatically.
