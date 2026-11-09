# Fun Industrial — Local Spoken Voice Lab v0.1

**Separate project from Elektron Industrial LLC.** This source branch adds a
new offline-first voice analysis and consent-gated speech reproduction
subsystem. It does not modify or restart Fun Industrial's live dashboard,
Cognee, REA, llama.cpp, compute service, autonomous worker or Elektron's
Ollama. It never binds a network listener and does not ingest audio into
Cognee automatically.

## Capabilities and honest boundaries

| Component | What works from this source | What it does not guarantee |
|---|---|---|
| Microphone | Explicit 2–30 second WAV recording after optional sounddevice install | Continuous listening, automatic recording, remote microphone access |
| Analysis | F0 candidate pitch in Hz, pitch spread, relative digital loudness (dBFS), timing of energy bursts, spectral centroid, 13 MFCC means/stds, 64-sample time-normalized contours | Exact phonemes, exact musical notes, calibrated sound-pressure level, speech emotions, physiological features |
| Comparison | Pitch gap, coarse contour differences, loudness changes, spectral distance, duration ratio | Biometric identity verification or consent determination |
| Speaker similarity | Optional CPU Resemblyzer embedding cosine similarity | Verified identity or an authentication probability |
| Enrollment | Owner-entered permission attestation, reference hash, local copy, profile restrictions and revocation | Independent proof that the enrolling person owns the voice |
| Reproduction | Optional OpenVoice V2 + MeloTTS CPU backend; one operator confirmation per output, local WAV and provenance JSON | Installed model by default, perfect voice likeness, perfect prosody or word-by-word pitch transfer |

### Architecture

    microphone or local WAV/FLAC
              |
       input validation (1.2–60 seconds; 75 MiB max)
              |
       librosa YIN + relative RMS + MFCC
              |
       structured analysis JSON
             / \
    contour/metric match       optional Resemblyzer
             |                        |
        local output           similarity, not identity
              |
     operator voice enrollment — permission attestation
              |
    private reference WAV + SHA256 + consent metadata
              |
      explicit reproduction approval
              |
      optional OPENVOICE V2 checkpoints and cached MeloTTS
              |
    generated WAV + provenance JSON

No Fun Industrial normal-chat routes or REA tools are changed in this stage.
A later UI adapter can expose these **operator-controlled** functions while
preserving all existing approval boundaries. Voice files and model outputs
are not treated as authority by the AI. Don't use a similarity score to
approve synthesis.

## Install on Windows

Run in **PowerShell**. These commands create a NEW source checkout and
isolated voice virtual environment. They are not dashboard activation commands.

1. Obtain the branch in a separate folder:

    $src=Join-Path $env:USERPROFILE 'FunIndustrial-VoiceLab-Source'
    git clone --depth 1 --single-branch --branch feature/fun-local-spoken-voice-20261108 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git $src

2. Install core CPU analysis, microphone capture and run local tests:

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $src 'Setup-Fun-VoiceLab.ps1') -WithMicrophone

The script uses Python 3.12 if the Windows Python launcher has it (or
a compatible python on PATH). It installs core packages from PyPI into
\`%LOCALAPPDATA%\FunIndustrial\VoiceLab\venv\`. **Package installation
requires network access and disk space.** It does not download neural
voice-generation model weights. It checks the three existing service PIDs
before/after and refuses to report success if any changed.

3. Select the dedicated voice Python without touching the Fun Industrial
dashboard environment:

    $vp=Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceLab\venv\Scripts\python.exe'
    Set-Location $src
    & $vp -m voice_lab status

4. Explicitly record **your own voice** for 8 seconds:

    $rec=Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceLab\recordings\my-speech.wav'
    & $vp -m voice_lab record --seconds 8 --output $rec

5. Analyze and compare with another authorized file:

    & $vp -m voice_lab analyze $rec
    & $vp -m voice_lab match $rec 'C:\path\to\second-authorized.wav'

6. Enroll your own reference. The CLI will **ask you to type** the exact
   authorization phrase; it does not infer consent from the recording:

    & $vp -m voice_lab enroll my-voice $rec --i-own-or-have-permission

7. To list or revoke:

    & $vp -m voice_lab profiles
    & $vp -m voice_lab revoke my-voice

Revoking deletes the local enrolled profile and reference; prior exported
audio is not deleted automatically. Do not enroll third-party voices
without explicit rights to reproduce them.

## Experimental offline pitch correction (new; no cloning models)

The `voice_lab tune` command detects voiced pitch with librosa YIN, maps each
short block to the nearest note in a specified musical key and scale, and
renders a corrected local WAV using `librosa.effects.pitch_shift` and
overlap fades. This is **experimental audio processing**, not studio-quality
Auto-Tune, formant-preserving singing synthesis, or real-time streaming.
Transitions, consonants, and sustained vibrato can sound artificial.
Spoken voices do not normally follow fixed musical notes.

Use the **iPhone voice dashboard** branch for this feature. Setup in a
separate directory; do not use the original spoken-voice branch clone:

```powershell
$src=Join-Path $env:USERPROFILE 'FunIndustrial-VoiceLab-Pitch';git clone --depth 1 --single-branch --branch feature/fun-iphone-voice-dashboard-20261108 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git $src;& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $src 'Setup-Fun-VoiceLab.ps1')
```

After your iPhone has explicitly recorded and uploaded a 2–30 second WAV to
the existing private VoiceLab recordings directory, inspect and correct
that exact chosen file (do not automatically choose a voice without review):

```powershell
$src=Join-Path $env:USERPROFILE 'FunIndustrial-VoiceLab-Pitch';$vp=Join-Path $env:LOCALAPPDATA 'FunIndustrial\VoiceLab\venv\Scripts\python.exe';Set-Location $src;& $vp -m voice_lab analyze 'C:\PATH\TO\YOUR-AUTHORIZED.wav';& $vp -m voice_lab tune 'C:\PATH\TO\YOUR-AUTHORIZED.wav' --key C --scale major --strength 0.8
```

`--key` accepts C/C#/D/.../B; `--scale` is chromatic, major, or
minor; `--strength` is 0 to 1. Source files are never changed.
Every export is a new WAV and JSON report under
`%LOCALAPPDATA%\FunIndustrial\VoiceLab\exports`.
Inputs are explicitly selected, short, authorized local recordings.
No model weight downloads, always-listening microphone, network service,
Cognee writes, REA execution, or Elektron/Ollama integration.
Neural **voice replication** is separately handled by the optional
OpenVoice V2 adapter, and still requires reviewed model checkpoints
and explicit per-output operator consent.

## Optional speaker embeddings

Run the installer again with \`-WithSpeakerComparison\`. It installs the
optional Resemblyzer package; review the package and pretrained model
license and provenance before usage.

    & $vp -m voice_lab speaker-match $rec 'C:\path\to\second-authorized.wav'

The returned similarity is **not an authentication score**.

## Optional OpenVoice V2 speech reproduction

OpenVoice source: https://github.com/myshell-ai/OpenVoice (MIT according
to its official README). MeloTTS: https://github.com/myshell-ai/MeloTTS.

**This stage does not install/check out OpenVoice, MeloTTS, Torch or model
weights**: they are larger and must be downloaded only after operator
approval and license/provenance review. Prefer installing those in a separate
dedicated voice-generation virtual environment. The lab's optional backend
is in \`voice_lab/openvoice_backend.py\` and expects:

- Installed/importable \`openvoice\`, \`melo\`, and \`torch\` Python packages
  with compatible versions.
- Local operator-provisioned \`checkpoints_v2\` directory containing
  \`converter/config.json\`, \`converter/checkpoint.pth\`,
  and \`base_speakers/ses/*.pth\`.
- Locally cached MeloTTS \`EN_NEWEST\` model files.
- An explicitly set \`FUN_VOICE_OPENVOICE_CHECKPOINTS\` environment variable
  pointing to the parent \`checkpoints_v2\` directory.

Example **only after** all these prerequisites are met:

    $env:FUN_VOICE_OPENVOICE_CHECKPOINTS='C:\PATH\TO\checkpoints_v2'
    & $vp -m voice_lab synthesize my-voice --text "This is a locally authorized synthetic voice test."

The CLI requires an additional interactive phrase on EVERY synthesis
request. It writes only under
\`%LOCALAPPDATA%\FunIndustrial\VoiceLab\exports\`. No API or unattended
mode is provided for reproduction. Provenance is written as a JSON
sidecar; **this is not an inaudible watermark**, and metadata can be
removed by downstream consumers. Disclose generated speech accordingly.

The adapter forces common Hugging Face offline flags; any attempt to fetch
missing weights should fail. OpenVoice Torch \`.pth\` files can execute
unsafe deserialization when loaded by upstream libraries. **Never load
untrusted checkpoints.** Validate checkpoint provenance before enabling.

### Performance and limits

The initial analyzer uses **librosa YIN with energy gating**, not a
phoneme-level voicing model. Silence, music, reverberation, noise, and
other speakers can produce false pitch estimates. Pitch-following voice
conversion and exact prosody transfer are not built in; OpenVoice V2 in
this configuration chiefly transfers *timbre* over a base TTS utterance.
For word-aligned prosody transfer, a separately validated speech-aligner
and compatible controllable TTS model would be needed.

The system is CPU-first; OpenVoice generation can be slow. No runtime
performance claim is made until tested on the operator's Windows host.

## Privacy and threat model

- Local audio input is untrusted; no shell or external tooling from audio
- No background mic capture, auto-enroll, auto-synthesize or token storage
- No voice data is sent to Gmail or automatically ingested into Cognee
- Nothing is allowed to call REA or manage Elektron
- Speaker similarity never creates permission to synthesize
- Recording enrollment and reproduction both require operator confirmation
- Generated audio must be disclosed as synthetic when relevant
- Private Windows user directory is not hardware-secure or an ACL audit
- Backup/sync programs may still copy voice files; review local privacy
- Do not interpret voice metrics as diagnosis, age, emotion or identity
- Windows/local microphone and file permissions remain operator-controlled

### Qualification

    & $vp -m unittest discover -s tests -p test_voice_lab.py -v
    & $vp -m voice_lab status

Expected: tests pass, and \`listener_started=false\`,
\`connected_to_elektron=false\`, \`connected_to_ollama=false\`,
\`connected_to_rea=false\`, \`connected_to_cognee=false\`.

First-party source: \`voice_lab\` and \`tests/test_voice_lab.py\`.
Dependency lists: \`requirements-voice*.txt\`.

**Status as committed:** Source implementation complete for offline
analysis/matching/profile consent. Live Windows installation and
model-driven reproduction are **not yet verified**.
