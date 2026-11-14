# Fun Industrial — Autonomous Grant Application Preparation Pilot V1

## Actual responsibility
This operator-approved worker watches the California State Library **Grants Offered** data, not the separate Grants Awarded data already accessible in the older California Public Data panel. It looks for **open grants whose ApplicantType explicitly includes businesses**, and intersects opportunity descriptions with the configurable business profile's software, industry, innovation and efficiency search terms.

Official source: https://publish.data.ca.gov/dataset/california-grants-portal

Resource: https://publish.data.ca.gov/dataset/e1b1c799-cdd4-4219-af6d-93b79747fffb/resource/111c8c88-21f6-453c-ae2c-b4785a0624f5/download/california-grants-portal-data.csv

The State Library publishes this data daily (approximately 6.3 MB at initial verification). It has grant IDs, agency, status, applicant type, closing date, funding information and official grant URLs. These are dataset records; screening for relevance does **not** establish that Fun Industrial LLC is eligible.

## One real test and ongoing responsibility

Command after local Git update:

```powershell
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\FunIndustrial-MLHub-V3\Activate-Fun-Grant-Applications-V1.ps1"
```

The activation performs an offline regression test, **one real HTTP GET** of the official California Grants Offered CSV, screens the rows and writes actual local files. Only after the real run passes does it register four Windows Task Scheduler triggers every calendar day: 00:00, 06:00, 12:00 and 18:00 **in the PC's timezone**. No resident LLM or continuous polling.

This is not guaranteed 24/7 when Windows is shut down, offline, sleeping or the user is logged out. The task uses the logged-on Windows user via `Interactive` logon; for unattended logged-out operation, a separately authorized service account and operating environment are necessary. If a task already exists with a different action the script fails closed instead of replacing it.

An exclusive named Windows mutex prevents simultaneous runs. A source failure writes `last-error.txt` and fails the cycle. The schedule is only created after an actual successful scan, not after a simulated CSV fixture.

## Actual outputs (on the user's PC, not in GitHub)
`%LOCALAPPDATA%\FunIndustrial\RealApplicationWorkerV1\`
- `business-profile.json`: editable company profile created on first run, with unknown legal/contact/financial fields explicitly **null**.
- `evidence\grants-offered-<SHA-256>.csv`: captured original official CSV bytes. Re-running with identical content reuses the same digest-named file.
- `last-run.json`: timestamp, source hash, total rows, open-business candidates, prioritized shortlist and actual output paths.
- `drafts\<GrantID>\application-worksheet.rtf`: up to three editable Word-compatible preliminary worksheets containing the **real grant title, ID, agency, deadline, URL, published program description and requirements**, plus clearly labeled missing details. They are **not agency-issued application forms** and **not submitted**. A previously created worksheet is never overwritten on subsequent scans.
- `drafts\<GrantID>\source-record.json`: provenance for each prepared draft.
- `logs\grants-<timestamp>.log`: one-run execution output.
- `last-error.txt`: a recent scan failure message.

When zero eligible/relevant opportunities are present, no application worksheets are fabricated. The original evidence CSV and report are still produced. The user can update `business-profile.json` with verified information; the worker does not fabricate registration, tax details, project budgets, or qualifications.

## Autonomy / scope
**Allowed without further prompts:** request one public official CSV; stream and bound the response to 15 MiB; parse; use deterministic screening; write local evidence and draft worksheets; compare successive SHA-256 source hashes; repeat when Windows Task Scheduler triggers.

**Not allowed:** log into government portals, submit/complete official agency web forms, represent that eligibility is confirmed, sign documents, send emails, file legal statements, create financial obligations, spend money, run REA tools, or train models. These require separate human approval and, for actual form filling, access to the verified program-specific official application/questions.

No protected service (ports 8088, 8789, 8791, 8796, 8797, 8798, 8801, 8802, 8443, or Elektron 11434) is intentionally started, stopped, or modified.

## Future improvements
- Add state/local business procurement (solicitations) with a separate verified source and schema.
- Wire local report status into the existing 8802 UI as a read-only view.
- Use grant-specific forms and a verified company-document folder to pre-fill actual agency PDFs/docx offline, with user review before upload.
- Operator-approved notifications (email/app) for actual deadline changes; current worker does not send reminders.
- Transition to a dedicated always-on host/service account for true logged-out operation if desired.

## Qualification
`intelligence-checks/opportunity-worker-v1-case.mjs` tests CSV handling, applicant filtering, overdue and closed exclusions, editable RTF generation, no overwrites, source hash and duplicate source evidence, unsafe redirects, scheduler boundaries, and no automatic submissions. The tests use **synthetic fixtures exclusively**; the activation's first `--once` run is what verifies live external data.
