# Fun Industrial Gmail — local read-only connection

Account chosen by operator: **ch1stopherwallace156@gmail.com**.
This identity is not authorized merely because its address appears here.

## What has been implemented

- Google OAuth **Desktop application** authorization-code flow with S256 PKCE,
  cryptographically random state, a random local loopback callback port and
  explicit confirmation of the exact Gmail profile address.
- Only \`https://www.googleapis.com/auth/gmail.readonly\` permission requested.
- Encrypted OAuth tokens stored using Windows **current-user DPAPI**, at
  \`%LOCALAPPDATA%\FunIndustrial\Gmail\gmail-token.dpapi\`.
- Local CLI to verify connection, list mailbox message IDs and explicitly read
  a requested message. Messages are untrusted external data.
- No password sign-in, no Gmail send, no drafts, no delete, no automatic email
  ingestion into Cognee, and no REA tool authority.

## One-time Google setup — operator does this in Windows browser

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create/select a project controlled by the owner of the Gmail account.
3. [Enable Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com).
4. Under **Google Auth Platform**, configure application name, branding,
   audience and consent. If in Testing mode, add
   \`ch1stopherwallace156@gmail.com\` as an authorized test user as necessary.
5. Under **Clients**, create an OAuth 2.0 client of type **Desktop app**.
6. Download its JSON credentials. Never paste the contents into a chat or
   commit them to GitHub.
7. On Windows PowerShell, create the private folder:
   \`New-Item -ItemType Directory -Force (Join-Path $env:LOCALAPPDATA 'FunIndustrial\Gmail') | Out-Null\`
8. Copy the downloaded OAuth JSON to
   \`%LOCALAPPDATA%\FunIndustrial\Gmail\desktop-oauth-client.json\`.
   The file must contain the \`installed\` JSON object from Google.
9. Run from this branch's local checkout:
   \`node scripts/fun-gmail.mjs status\`
   \`node scripts/fun-gmail.mjs connect\`
10. Open the printed Google authorization URL **on the same Windows host**,
    sign into exactly \`ch1stopherwallace156@gmail.com\` and authorize
    **view email** permission. The callback completes on Windows loopback.
    Do not share login codes, JSON credentials or OAuth token contents.
11. Verify with \`node scripts/fun-gmail.mjs status\`.
    To list at most 10 messages:
    \`node scripts/fun-gmail.mjs list "newer_than:7d"\`.
    To inspect one message after seeing its ID:
    \`node scripts/fun-gmail.mjs read <message-id>\`.
    Printed email bodies are sensitive and should not be pasted into public
    logs or chats without redaction.

### Current limitation

This is a **standalone, read-only local connector**. It has not been authorized
or integrated into the dashboard AI's tool proposal routing yet.
A separate guarded integration is required before Fun Industrial chat can use
mailbox information. Sending and changing drafts require further operator
consent, additional scopes and explicit per-message approval. Do not treat
approval to READ as permission to SEND.

Google marks \`gmail.readonly\` as a **restricted scope**. Production or
widely distributed apps may require Google OAuth verification/security review.
Personal/testing use may have different consent and token-expiration limits.
Follow Google's current requirements.

## Provider references

- https://developers.google.com/identity/protocols/oauth2/native-app
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get
