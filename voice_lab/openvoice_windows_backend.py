"""Offline Windows-SAPI-to-OpenVoice-V2 speech conversion for an enrolled self voice.

Uses user-selected, consented reference recording and a fresh synthetic base
utterance generated locally by Windows SpeechSynthesizer. No MeloTTS needed.
No network service, no automation, no REA, Cognee, llama.cpp or Ollama.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import sys
from datetime import datetime, timezone

from .openvoice_backend import _check_local_assets
from .profiles import home, load_authorized


def _is_private_base(filename: str, root: Path) -> Path:
    path = Path(filename).expanduser()
    if path.is_symlink() or not path.is_file() or path.suffix.lower() != ".wav":
        raise ValueError("VOICE_SAPI_BASE_MISSING_OR_INVALID")
    result = path.resolve(strict=True)
    expected = (root / "base").resolve()
    if result.parent != expected or result.stat().st_size > 1024 * 1024 * 6:
        raise ValueError("VOICE_SAPI_BASE_NOT_IN_PRIVATE_RUNTIME")
    import wave
    with wave.open(str(result), "rb") as wav:
        sec = wav.getnframes() / wav.getframerate()
        if wav.getnchannels() not in (1, 2) or wav.getsampwidth() != 2 or not 1.2 <= sec <= 30:
            raise ValueError("VOICE_SAPI_BASE_FORMAT_OR_DURATION")
    return result


def _load_converter(converter_dir: Path):
    import torch
    from openvoice.api import OpenVoiceBaseClass, ToneColorConverter

    # The original ToneColorConverter kwargs call is incompatible with the
    # published OpenVoiceBaseClass constructor; create without wavmark.
    cv = ToneColorConverter.__new__(ToneColorConverter)
    OpenVoiceBaseClass.__init__(cv, str(converter_dir / "config.json"), device="cpu")
    cv.watermark_model = None
    cv.version = getattr(cv.hps, "_version_", "v1")

    obj = torch.load(str(converter_dir / "checkpoint.pth"),
                     map_location=torch.device("cpu"), weights_only=True)
    if not isinstance(obj, dict) or not isinstance(obj.get("model"), dict):
        raise RuntimeError("VOICE_OPENVOICE_CHECKPOINT_PAYLOAD_INVALID")
    missing, unexpected = cv.model.load_state_dict(obj["model"], strict=False)
    if len(missing) or len(unexpected):
        raise RuntimeError("VOICE_OPENVOICE_MODEL_STATE_MISMATCH")
    return cv


def convert_sapi_base(speaker_id: str, wav_path: str, *, attestation: str, runtime_root: str) -> dict:
    if attestation != "SYNTHESIZE VOICE " + speaker_id:
        raise PermissionError("VOICE_REPRODUCTION_OPERATOR_APPROVAL_REQUIRED")
    profile, reference = load_authorized(speaker_id)
    converter_dir, _source, _melo = _check_local_assets()
    root = Path(runtime_root).expanduser().resolve()
    source = _is_private_base(wav_path, root)

    # For one output only, all audio and inference remain on Windows.
    # With Windows SAPI as source, derive source speaker encoding from the
    # actual SAPI utterance instead of an incompatible Melo speaker embedding.
    for key in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_DATASETS_OFFLINE"):
        os.environ[key] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    converter = _load_converter(converter_dir)

    target_embedding = converter.extract_se([str(reference)])
    source_embedding = converter.extract_se([str(source)])
    output_dir = home() / "exports"
    output_dir.mkdir(parents=True, exist_ok=True)
    if output_dir.is_symlink():
        raise ValueError("VOICE_EXPORT_DIR_SYMLINK_REJECTED")
    suffix = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + secrets.token_hex(6)
    output_file = output_dir / (speaker_id + "-replica-" + suffix + ".wav")
    metadata_file = output_file.with_suffix(".json")
    converter.convert(
        audio_src_path=str(source),
        src_se=source_embedding,
        tgt_se=target_embedding,
        output_path=str(output_file),
        message="FunIndustrialAuthorizedSynthetic",
    )
    if not output_file.is_file() or output_file.stat().st_size < 1024:
        raise RuntimeError("VOICE_REPLICATION_WAV_NOT_RENDERED")
    sha = hashlib.sha256(output_file.read_bytes()).hexdigest()
    result = {
        "schema": "fun.voice.replication.sapi.v1",
        "state": "rendered",
        "source_engine": "Windows SpeechSynthesizer (offline operating system voice)",
        "voice_converter": "OpenVoice V2 tone-color conversion",
        "speaker_id": speaker_id,
        "reference_sha256": profile["reference_sha256"],
        "source_base_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "output_sha256": sha,
        "audio_path": str(output_file),
        "provenance_path": str(metadata_file),
        "consent": "explicit_one_output",
        "synthetic_voice": True,
        "voice_identity_verified": False,
        "model_downloads": 0,
        "no_other_service_calls": True,
        "notes": "First local experimental replica; timbre similarity and naturalness require listening qualification. Always disclose synthetic voice.",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
    }
    try:
        metadata_file.write_text(json.dumps(result, indent=2), encoding="utf-8")
    except OSError:
        output_file.unlink(missing_ok=True)
        raise
    return result


def main() -> None:
    p = argparse.ArgumentParser(description="One authorized offline Windows speech-to-speech voice replication")
    p.add_argument("speaker_id")
    p.add_argument("--base", required=True)
    p.add_argument("--runtime-root", required=True)
    p.add_argument("--operator-attested", required=True)
    args = p.parse_args()
    result = convert_sapi_base(
        args.speaker_id, args.base,
        attestation=args.operator_attested, runtime_root=args.runtime_root,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (PermissionError, FileNotFoundError, ValueError, RuntimeError, OSError, ImportError) as exc:
        print("VOICE_REPLICATION_HOLD=" + str(exc), file=sys.stderr)
        raise SystemExit(1)
