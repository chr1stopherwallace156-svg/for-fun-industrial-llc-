# Fun Industrial — dedicated AI mailbox integration contract

This is a design/implementation checklist, **not** an enabled email connection.
No address, password, API token, SMTP credential, OAuth client secret or mailbox
content should be committed to GitHub.

## Desired architecture

- Dedicated business-controlled identity, e.g. `assistant@<domain-you-own>`
  (illustrative only; not a registered or verified mailbox).
- One local provider adapter for an explicitly connected account. Use OAuth 2.0
  with the fewest scopes required, or provider-approved service-account
  delegation if the provider allows it. Do not ask for or store primary account
  passwords in config or source.
- Store credentials in a Windows user-scoped secret store with access restricted
  to the Fun Industrial service account. Never log token contents.
- Local read-only mailbox synchronization: list/search/read message headers
  and bodies upon authorized request. No automatic public forwarding.
- Draft messages only from the system-owned identity with clear recipient,
  subject, body and provenance. The operator can edit drafts.
- Sending, replying, forwarding, deleting, archiving, assigning labels,
  changing contact details or mailbox settings require explicit per-action
  operator approval, with recipient/body/attachments review.
- Do not make any mailbox action available via untrusted Cognee excerpts or
  arbitrary REA tools. Imported email is untrusted content, not system policy.
- Do not automatically persist emails into Cognee. If memory extraction is
  later enabled, require privacy filtering and human review before write.
- Reject non-local listener hosts, remote control requests and tokens in logs.
- Audit every request: action, UTC time, mailbox identity, recipient counts,
  hash of draft content, approval decision and provider result, without
  logging secret tokens or sensitive body text.
- Fail closed on missing login, missing scopes, stale identity, provider
  errors, unavailable network or unsupported attachments. Report status only.

## Provider-dependent implementation (not yet configured)

1. Operator registers/owns dedicated mailbox under Google Workspace/Gmail,
   Microsoft 365/Outlook, or another supported provider.
2. Identify the mailbox address and provider, confirm who owns it and
   whether it is exclusively for Fun Industrial.
3. Configure consent and OAuth app/scopes for **that account**.
4. Implement provider-specific read/draft APIs and local credential management.
5. Build mock-provider tests for authentication denial, untrusted email text,
   recipient changes, unintended send prevention and approval replay.
6. Demonstrate harmless read and draft flows before enabling external sends.

The separate email identity must never inherit Cognee read permission as
write/send authority; it must not affect Elektron's Ollama or GitHub workflows.
