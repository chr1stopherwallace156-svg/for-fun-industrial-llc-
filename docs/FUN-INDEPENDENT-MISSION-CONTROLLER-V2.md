# Fun Industrial — Independent Mission Controller V2

**Status:** Source committed and qualified by offline tests; a new real PC execution is required.

## Objective
Demonstrate operational autonomy through real work rather than a scripted conversational persona. The existing California grants worker already ran successfully on November 14, 2026, scanned 2,030 state records, found 25 open-business leads and 12 relevant candidates, created 3 editable RTF application worksheets, and installed a four-times-daily Windows Task Scheduler task.

V2 is a new **stateful decision-and-execution layer**, invoked by that same existing scheduled task. It does **not** create an additional background service, poll continuously, rewrite the 8802 dashboard, or touch Qwen/REA/Elektron runtime ports.

## Its independent decisions
1. Accept only a completed, hash-attributed official grants scan with no submissions.
2. Reject malformed grant IDs for automatic mission work; accept only safe IDs, but leave original source evidence intact.
3. Read the local verified business profile and identify actual missing contact, registration, project and budget details.
4. Detect **new** grants, **agency-record changes**, **approaching deadlines**, and **research deferred in previous runs**.
5. Choose up to 3 local research briefs per cycle based on relevance, urgency, and changed evidence. Defer the rest to future cycles instead of forgetting them.
6. Optionally read **one** approved `*.ca.gov` or `*.grants.gov` program page, max 220 KB and 10.5 seconds, 24-hour backoff even on failure, HTTPS only, redirects refused. Such text is untrusted evidence, not instructions to the worker. No other web hosts may be fetched.
7. Write versioned Markdown research briefs and a recorded mission plan. Existing RTF application drafts and human edits are never overwritten.
8. Save a persistent decision ledger and audit journal so later cycles can continue where the previous one ended.
9. Record what was executed, which new files exist, how many public pages were actually read, and why the next priority was selected.

**Not consciousness or literal free will:** V2 is goal-directed software with constrained initiative. It is permitted to choose operational actions only from its authorized scope. It cannot execute arbitrary commands or perform unapproved external acts.

## Authority boundaries
- Can: public-grant read, single approved official page read, prioritization, local draft and evidence creation, persistence.
- Cannot: government portal submission, certifications/signatures, official form entry, outreach/email, payments/purchases, inventing legal/financial details, REA execution, training, autonomous privilege changes.
- Strict fail-closed configuration checks; a modified mission-policy file cannot enable forbidden authorities.

## Actual new files
All produced on the user's Windows PC under:

`%LOCALAPPDATA%\FunIndustrial\RealApplicationWorkerV1\`

- `mission-policy-v2.json` — editable goal and permitted local-work budget, prohibitions cannot be disabled.
- `mission-plan-v2.json` — priority calculations and every decision.
- `mission-state-v2.json` — per-grant change history, deferred work and official-page backoff.
- `mission-briefs\<hash>-<revision>.md` — editable, versioned grant research briefs.
- `mission-evidence\official-page-<sha256>.html` — actual limited authorized government-page evidence when available.
- `last-mission-v2.json` — final auditable run receipt.
- `mission-actions.jsonl` — machine-readable append-only decisions with size-bounded rotated archives.

Previous `last-run.json`, original CSV SHA-256 evidence and `drafts\...` RTF worksheets are preserved.

## Scheduling
No new scheduler required. The previously installed `FunIndustrial-GrantApplications-V1` task is already configured for four daily triggers (00:00, 06:00, 12:00, 18:00 PC local time). The Task Scheduler action points to the same **Run-Fun-Grant-Applications-V1.ps1** file, which now performs V1 source work followed by V2 decisions.

`Activate-Fun-Grant-Applications-V1.ps1` qualifies V1+V2 offline, launches an **actual new government-data scan**, checks V2 evidence and zero outside authority, and then **adopts the existing exact Windows task**, refusing to alter an unexpected task.

Because Task Scheduler uses an Interactive logon in this pilot, it requires the Windows user to be logged in, computer powered and online. It is **not true 24/7 uptime** when the PC is sleeping, offline, or signed out.

## See actual self-directed behavior at any time
The read-only `Show-Fun-Independent-Mission-V2.ps1` command prints last real scan, selected grant, actual created briefs, recorded public page reads, upcoming Windows Task Scheduler event and whether the last scheduled task succeeded. This does not restart any process or query an external API.

## Live qualification
Run the repository-verified one-command activation, then inspect:

```text
FUN_GRANTS_FIRST_REAL_CYCLE=PASS
FUN_MISSION_V2=PASS EVIDENCE_MATCHED DECISIONS_RECORDED
FUN_MISSION_DECISIONS=<actual count>
FUN_MISSION_NEW_BRIEFS=<actual count>
FUN_MISSION_NEXT_PRIORITY=<real grant title and reason>
FUN_MISSION_LEDGER=<local path>
FUN_MISSION_V2=ACTIVE ...
```

If the program URLs are not at the exact allowlisted official domains, zero pages will be read and the briefs will explicitly state this. That is correct behavior, not a missing simulated success. No legal eligibility or award likelihood is automatically certified.

**Existing scheduled task starts new V2 behavior only after code is pulled onto the user's PC.** A GitHub commit alone does not upgrade running Windows code.
