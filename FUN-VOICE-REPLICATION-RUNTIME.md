# Fun Industrial — First authorized offline voice replication on Windows

Separate local OpenVoice V2 inference; no dashboard, NetBird gateway, compute,
llama.cpp, REA, Cognee, Elektron or Ollama mutations.

## Preconditions

- Official SHA-256-verified models previously installed with Prepare-Fun-Voice-Replication-Models.ps1.
- Explicitly enrolled 'selfvoice' reference under the existing private VoiceLab.
- Windows Python 3.12 (py -3.12); Python 3.9 not required.
- Windows SpeechSynthesizer English voice and space for isolated CPU PyTorch.

## Separate runtime setup (from the new source checkout)

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Fun-Voice-Replication-Runtime.ps1

Creates a separate VoiceReplicationRuntime\venv with PyTorch 2.5.1 CPU and
the minimum OpenVoice converter dependencies, plus an official OpenVoice checkout
pinned to 74a1d147b17a8c3092dd5430504bd83ef6c7eb23.
Does not install legacy MeloTTS or generate speech automatically.

## First explicitly authorized new sentence

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Test-Fun-Voice-Replication-First-Wav.ps1

On prompt type SYNTHESIZE VOICE selfvoice to authorize one output.
The script synthesizes a local English SAPI source WAV then converts timbre
toward the original enrolled voice using OpenVoice V2. It writes one new WAV
plus JSON provenance to VoiceLab\exports. No voice API or external listener.

## Boundaries

- This SAPI-to-OpenVoice route is an alternative to MeloTTS-to-OpenVoice.
- Similarity, cadence, accent, quality and speed are not guaranteed.
- Model hashes are verified before a weights-only torch.load.
- A synthetic WAV is not a reliable identity credential; disclose synthetic use.
- Voice reference rights must be explicit. No imitation for deception.
- This source has synthetic tests; real inference PASS requires a generated
  WAV and listening assessment from the Windows operator.
- No automatic recording, REA tool execution or memory writes.
