"""Isolated setup for Fun Industrial offline tiny.en speech recognition.

Run as: python setup-whisper-model.py download MODEL_DIR
        python setup-whisper-model.py verify MODEL_DIR
Uses script arguments, not PowerShell-native python -c quoting.
"""
from __future__ import annotations
import os
from pathlib import Path
import sys

REQUIRED=("model.bin","config.json","tokenizer.json")

def main() -> None:
    if len(sys.argv)!=3 or sys.argv[1] not in ("download","verify"):
        raise SystemExit("FI_WHISPER_SETUP_MODE_INVALID")
    mode=sys.argv[1]
    folder=Path(sys.argv[2]).resolve()
    if not folder.is_dir():
        raise SystemExit("FI_WHISPER_MODEL_DIR_MISSING")
    os.environ["HF_HUB_DISABLE_TELEMETRY"]="1"
    os.environ["HF_HUB_DISABLE_PROGRESS_BARS"]="1"
    if mode=="download":
        from huggingface_hub import snapshot_download
        snapshot_download("Systran/faster-whisper-tiny.en",local_dir=str(folder),
                          local_files_only=False,
                          allow_patterns=["model.bin","config.json","tokenizer.json",
                                          "preprocessor_config.json","vocabulary.*"])
        print("FI_STT_MODEL_DOWNLOADED=PASS")
    missing=[name for name in REQUIRED if not (folder/name).is_file()]
    if missing:
        raise SystemExit("FI_WHISPER_MODEL_FILES_MISSING="+",".join(missing))
    if mode=="verify":
        os.environ["HF_HUB_OFFLINE"]="1"
        from faster_whisper import WhisperModel
        WhisperModel(str(folder),device="cpu",compute_type="int8",
                     cpu_threads=4,num_workers=1,local_files_only=True)
        print("FI_STT_OFFLINE_MODEL_LOAD=PASS")
    print("FI_STT_MODEL_FILES=PASS")

if __name__=="__main__":
    main()
