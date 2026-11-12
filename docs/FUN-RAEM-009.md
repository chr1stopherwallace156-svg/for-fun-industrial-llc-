# RAEM-009 — Explicitly approved, one-request public breach-catalogue pilot

## Current qualification evidence

RAEM-008b passed **118/118 automated tests** on the operator's Windows 16 GiB host. Its offline full-catalogue mock run returned `RAEM_008_RESULT=PASS`, with baseline/checkpoint, six-hour preflight hold, one added, one modified, one unchanged and one absent item. None of those were live provider requests.

The RAEM-009 pilot is a separate, **not-yet-deployed development branch**. Nothing is currently scheduled or configured to run a real request automatically.

## Public provider and scope

The source is the documented free public breach metadata catalogue:
`GET https://haveibeenpwned.com/api/v3/breaches`

Documentation: https://haveibeenpwned.com/API/v3

Required attribution: **Have I Been Pwned** — https://haveibeenpwned.com/ (CC BY 4.0). The public catalog is metadata, not a leaked-account/password/data-dump service. This pilot never searches specific email accounts, usernames, passwords or stealer logs.

## Conservative manual execution boundary

`scripts/Qualify-Fun-RAEM009.mjs` accepts exactly two modes:

- No arguments, or `--dry-run`: **observational preflight only**. It samples memory and CPU, evaluates admission, prints the fixed provider URL and returns. No provider request, checkpoint directory write, background task or process change is made.
- `--live`: an **explicit, operator-initiated** foreground action. It checks that both input and output are interactive terminals; then prompts for exact text `AUTHORIZE ONE PUBLIC CATALOGUE GET`. Anything else cancels with zero network requests. A second resource preflight runs after confirmation before the client is allowed to make a single fixed-provider HTTPS GET.

Even if the person uses `--live`, resource pressure or an eligible-refresh checkpoint can HOLD without a request. The programme never repeats, retries or schedules requests. It prints a bounded, redacted/diff-only response with correct HIBP attribution. Only hashed name/version metadata is stored for future manual reconciliation in an app-local checkpoint; it is not a permanent or comprehensive history and must not be treated as anonymization of publicly guessable names.

### Resource guardrails

RAEM's **conservative default** remains in effect for a live check: reserve the greater of 1,536 MiB and 20% of total RAM. Additionally require 128 MiB free *above* that reserve before the first request, and maintain a further 64 MiB above that reserve during the response. The worker requests 64–128 MiB of **advisory** RSS headroom, with observed baseline-process checks. CPU pressure at 85% or higher holds. Resource checks are observational; they are not Windows Job Objects or enforced hard RAM quotas.

The previous Windows snapshot was 15,981 MiB total, 3,237 MiB free, and 57.09 MiB baseline Node RSS. At that snapshot the **live** admission should HOLD. Do not kill Ollama/Qwen/REA or sacrifice the reserve to make a live request run.

## Validation

- `intelligence-checks/resource-aware-live-gate-case.mjs` contains ten tests of no-arg dry-run, exact confirmation, invalid arguments, resource holds, and CLI wiring.
- Run the 11 targeted RAEM test files + the RAEM-009 dry-run from a clean test-only checkout.
- The inherited RAEM-008 catalog tests use mock fetch responses. Dry-run never contacts HIBP.
- Windows qualification of RAEM-009 is pending. Do not merge/enable live until reviewed by the operator.

## Production limitations

The public /breaches catalogue can evolve, be rate limited, or exceed currently configured 8 MiB body / 4,096 entry bounds; invalid and oversized results return HOLD. No guarantee is made about complete event truth or about running the full AIL Framework. No authenticated approval API, multi-operator RBAC, Windows hard process-RAM cap, continuous scheduler, alert delivery, source integrity attestation or recovery from a corrupted checkpoint is implemented.

A live action must be expressly authorized as a **separate decision** after a clean dry-run. Running the dry-run does not grant permission for live access. Existing Fun Industrial dashboard, Qwen, REA, Ollama, and Elektron workloads must remain untouched.
