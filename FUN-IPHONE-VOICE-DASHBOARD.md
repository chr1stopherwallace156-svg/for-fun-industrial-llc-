# Fun Industrial — iPhone Safari Voice Recorder on the Existing Dashboard

This module integrates with the **deployed** Fun Industrial dashboard at
\`http://127.0.0.1:8789/\` on the Windows host. It does not replace the
existing dashboard source with the older GitHub repository copy.

## Status as implemented

- Browser panel: **Record iPhone microphone**, **Stop**, choose audio
  file from iPhone Files, listen to the prepared clip, **Upload**.
- Browser converts Safari's audio recording to 16-kHz mono, 16-bit PCM WAV.
- Upload endpoint accepts only strict WAV (2–30 seconds, max 1.1 MiB).
- File saved on Windows as a server-generated name:
  \`%LOCALAPPDATA%\FunIndustrial\VoiceLab\recordings\iphone-<date>-<token>.wav\`.
- Dashboard lists the last 15 iPhone upload filenames.
- After successful upload, the panel shows a self-contained Windows
  PowerShell command to run the existing local Voice Lab analyzer.
- No Cognee memory write, voice enrollment, voice synthesis, REA execution,
  transcription, background microphone capture, or automated analysis.
- The iPhone recording contains personal voice data: access to the
  authenticated dashboard effectively permits local voice uploads. Restrict
  access to authorized users only.

## HTTPS security is not optional on iPhone

**The Fun Industrial dashboard stays loopback-only.** Do not edit
\`HOST=127.0.0.1\` to \`0.0.0.0\`; do not expose port 8789 to the LAN
or the public internet.

The repository already has a separate HTTPS gateway
\`src/gateway.mjs\`, designed to bind to a specific NetBird IPv4 address,
require a **private peer allowlist**, strong Basic authentication and a
certificate/key provided by the operator. It reverse-proxies authenticated
requests to the loopback dashboard. Its TLS certificate must be **trusted
by the iPhone** for microphone access; clicking through an untrusted TLS
warning is not a supported substitute.

The gateway is not created, enabled or reconfigured by the voice install.
The NetBird connection alone is **not** enough: Safari's microphone API
requires a secure context (e.g., a trusted HTTPS page). If you have no
such gateway yet, use iPhone Voice Memos and a separately authorized secure
file-transfer workflow until HTTPS is configured. Do not use insecure
public tunnels to expose the dashboard or voice recordings.

Reference:
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts

## Deploy the dashboard panel on Windows

You must have already installed the stand-alone voice lab successfully
(\`FUN_VOICE_LAB_SETUP=PASS\`), and the existing normal Fun Industrial
chat must still have automatic read-only Cognee recall and the 229-tool REA
catalogue.

Obtain a NEW copy of this branch in a separate folder:

    $d=Join-Path $env:TEMP ('FunVoiceMobile-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
    git clone --quiet --depth 1 --single-branch --branch feature/fun-iphone-voice-dashboard-20261108 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git $d

Do not copy GitHub's \`src/server.mjs\` or \`public/index.html\` into your
live app. Use only the staging/backup-aware deployment script:

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'Activate-Fun-iPhone-Voice.ps1')

The script:

1. Reads the current deployed server and dashboard HTML.
2. Checks automatic Cognee memory status, local model, compute and all
   229 REA tool names.
3. Runs Node tests and syntax checks for the new mobile module and panel.
4. Stages a surgical patch that **does not require the original `chat-input` ID**; it appends the mobile voice panel immediately before the sole closing `</body>` tag while preserving the exact existing chat UI and operator tool-approval flow. It rejects missing or ambiguous body anchors, duplicate voice panels, and unsupported Content Security Policy shapes before modifying live files.
5. Creates a rollback backup, adds the voice module and restarts only
   the 8789 dashboard Node process; existing compute may require the
   existing compute-only recovery script.
6. Checks the memory budget and REA catalogue after restart.
7. Enables local upload through an operator-created flag file.
8. Executes a synthetic **validation-only** HTTP request without
   saving an audio recording.

Successful local deployment prints:

    FI_VOICE_DASHBOARD_DEPLOY=PASS
    FI_VOICE_PRESERVED=PASS REA=229
    FI_VOICE_MOBILE_HTTP=PASS WAV_VALIDATION=PASS WRITES=0

A failed deployment attempts to restore the original server and HTML
and restart the previous dashboard. Keep the printed backup path.

## Use iPhone Safari

1. Ensure both the Windows PC and iPhone are connected as authorized
   NetBird peers.
2. Open the **trusted HTTPS Fun Industrial gateway URL** on the iPhone
   in Safari, using the exact hostname on its TLS certificate.
3. Authenticate as the authorized dashboard operator.
4. In the normal dashboard scroll to **Spoken Voice Lab — iPhone
   microphone**.
5. Tap **Record iPhone microphone** and allow Safari microphone access.
6. Speak for between 2 and 30 seconds and tap **Stop recording**.
7. Review audio preview; tap **Upload prepared audio**.
8. The Windows PC saves the WAV and returns a path, and the dashboard
   gives the appropriate Windows PowerShell analysis command.
9. Run the analysis command on the PC. The uploaded audio is not
   automatically sent to the model or Cognee.

Alternatively, tap **Choose file** to select an existing Voice Memo
from iPhone Files. Safari must be able to decode the format locally
(e.g., typical M4A or WAV) before converting to PCM WAV.

The recording panel will not request microphone permission on HTTP over
the phone's NetBird IP; it will show an HTTPS warning instead.

## Disable phone uploads immediately without stopping other services

Run on the PC:

    Remove-Item (Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceLab\mobile-upload.enabled') -Force

The server checks the marker on each upload request. Deleting it disables
upload and list endpoints; it does not delete already recorded audio,
reset the dashboard, stop the model, or affect REA/Cognee.

## Boundaries

- Uploads are explicitly requested, not continuous surveillance.
- Upload filename is always generated on Windows; request filenames and
  arbitrary storage paths are ignored.
- Browser decoding and resampling is performed on the iPhone before
  upload. Safari must support MediaRecorder/Web Audio; if it does not,
  use the file picker.
- The WAV parser deliberately accepts a narrow canonical PCM WAV
  header; unusual WAV chunks/formats may be rejected.
- Private disk folder is not a substitute for disk encryption, backup
  privacy controls, or access-control reviews.
- The upload endpoint does not perform identity authentication or
  enroll a voice. The existing authenticated HTTPS/NetBird gateway
  is responsible for remote user access.
- Browser microphone access cannot be tested from GitHub CI and is
  subject to iOS/Safari permissions, certificate trust, and device policy.
- OpenVoice synthesis remains optional and must be separately
  configured and approved. It is not triggered by uploading audio.

## Repo source

- \`src/voice/mobile-upload.mjs\`: validated local WAV upload
- \`src/voice/mobile-panel.html\`: dashboard panel
- \`src/voice/mobile-client.js\`: iPhone Safari audio recorder/resampler
- \`scripts/patch-iphone-voice-dashboard.mjs\`: surgical staging
- \`scripts/check-iphone-voice-live.mjs\`: local validation-only smoke test
- \`Activate-Fun-iPhone-Voice.ps1\`: backup/rollback deploy
- \`intelligence-checks/iphone-voice-case.mjs\`: synthetic security tests
- \`.github/workflows/iphone-voice-ci.yml\`: Node tests and PowerShell parsing
