"""Offline CPU speech-to-text for explicitly approved Fun Industrial voice clips.

No network is requested. Model weights must already be installed under the
private VoiceConversation models directory by Setup-Fun-Voice-Conversation.ps1.
The transcript is printed to stdout as JSON; raw audio never leaves the PC.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import sys
import wave

SCHEMA="fun.voice.transcription.v1"

def fail(message: str) -> None:
    print(json.dumps({"schema":SCHEMA,"error":message},ensure_ascii=True),file=sys.stderr)
    raise SystemExit(3)

def transcribe(wav_file: Path, model_dir: Path) -> dict:
    if not wav_file.is_file() or wav_file.suffix.lower()!=".wav":
        fail("VOICE_STT_INPUT_MISSING")
    if not model_dir.is_dir():
        fail("VOICE_STT_MODEL_NOT_INSTALLED")
    # Fail closed if any model weight needs to be fetched.
    os.environ["HF_HUB_OFFLINE"]="1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"]="1"
    os.environ["HF_HUB_DISABLE_PROGRESS_BARS"]="1"
    os.environ["OMP_NUM_THREADS"]="4"
    try:
        import faster_whisper
        from faster_whisper import WhisperModel
    except ImportError:
        fail("VOICE_STT_DEPENDENCIES_MISSING")
    with wave.open(str(wav_file),"rb") as wav:
        if (wav.getnchannels(),wav.getsampwidth(),wav.getframerate()) != (1,2,16000):
            fail("VOICE_STT_PCM_FORMAT_HOLD")
        seconds=wav.getnframes()/16000
        if not 2<=seconds<=30:
            fail("VOICE_STT_DURATION_HOLD")
    model=WhisperModel(str(model_dir),device="cpu",compute_type="int8",
                       cpu_threads=4,num_workers=1,local_files_only=True)
    segments,info=model.transcribe(str(wav_file),language="en",
                                  beam_size=2,condition_on_previous_text=False,
                                  vad_filter=False,without_timestamps=True)
    parts=[]
    for segment in segments:
        if len(" ".join(parts))>1800:break
        parts.append(segment.text.strip())
    value=" ".join(part for part in parts if part).strip()
    # Tiny Whisper may hallucinate during silence. Not an instruction or tool.
    if len(value)>1800:fail("VOICE_STT_TRANSCRIPT_OVERSIZED")
    return {"schema":SCHEMA,"text":value,"language":"en",
            "seconds":round(seconds,3),"networkRequests":0,"device":"cpu",
            "model":"faster-whisper-tiny.en"}

def main() -> None:
    if len(sys.argv)!=4 or sys.argv[1]!="transcribe":
        fail("VOICE_STT_COMMAND_INVALID")
    p=Path(sys.argv[2]).resolve()
    models=Path(sys.argv[3]).resolve()
    print(json.dumps(transcribe(p,models),ensure_ascii=True))

if __name__=="__main__":
    main()
