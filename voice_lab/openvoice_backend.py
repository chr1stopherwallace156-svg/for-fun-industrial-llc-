"""Optional offline OpenVoice V2 + MeloTTS synthesis for an enrolled, approved voice.

No model weights are bundled. Checkpoints and TTS cache must be installed
separately and reviewed for provenance/licensing. Runs only on explicit command.
This copies reference timbre; it does not promise exact prosody replication.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from .profiles import home, load_authorized


_EXPECTED_SHA256 = {
    "converter": "9652c27e92b6b2a91632590ac9962ef7ae2b712e5c5b7f4c34ec55ee2b37ab9e",
    "speaker_en_newest": "6a3798229b1114f0e9cc137b33211809def7dda5a8a9398d5a112c0b42699177",
    "melo_en_newest": "959433dc1c6df618922560b4b7bc8c7af0a4b7ceaea267480c5d9ae8a3cfe536",
}


def _assert_pinned_hash(file: Path, expected: str) -> None:
    checksum = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
    if checksum.hexdigest() != expected:
        raise RuntimeError("VOICE_MODEL_CHECKPOINT_SHA256_MISMATCH")


def _check_local_assets():
    raw = os.environ.get("FUN_VOICE_OPENVOICE_CHECKPOINTS", "")
    if not raw:
        raise RuntimeError("VOICE_SYNTH_MODEL_NOT_CONFIGURED: set FUN_VOICE_OPENVOICE_CHECKPOINTS")
    checkpoints = Path(raw).expanduser().resolve()
    converter = checkpoints / "converter"
    base = checkpoints / "base_speakers" / "ses"
    for file in (converter / "config.json", converter / "checkpoint.pth"):
        if not file.is_file():
            raise FileNotFoundError("VOICE_OPENVOICE_CHECKPOINT_MISSING: " + str(file))
    if not (base / "en-newest.pth").is_file():
        raise FileNotFoundError("VOICE_OPENVOICE_EN_NEWEST_SPEAKER_CHECKPOINT_MISSING")
    raw_melo = os.environ.get("FUN_VOICE_MELO_EN_NEWEST_HOME", "")
    if not raw_melo:
        raise RuntimeError("VOICE_MELO_MODEL_NOT_CONFIGURED: set FUN_VOICE_MELO_EN_NEWEST_HOME")
    melo_home = Path(raw_melo).expanduser().resolve()
    for file in (melo_home / "config.json", melo_home / "checkpoint.pth"):
        if not file.is_file() or file.stat().st_size < 100:
            raise FileNotFoundError("VOICE_MELO_LOCAL_CHECKPOINT_MISSING: " + str(file))
    _assert_pinned_hash(converter / "checkpoint.pth", _EXPECTED_SHA256["converter"])
    _assert_pinned_hash(base / "en-newest.pth", _EXPECTED_SHA256["speaker_en_newest"])
    _assert_pinned_hash(melo_home / "checkpoint.pth", _EXPECTED_SHA256["melo_en_newest"])
    return converter, base, melo_home


def synthesize(speaker_id: str, text: str, *, attestation: str, speed: float = 1.0):
    if attestation != "SYNTHESIZE VOICE " + speaker_id:
        raise PermissionError("VOICE_REPRODUCTION_OPERATOR_APPROVAL_REQUIRED")
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= 350:
        raise ValueError("VOICE_TEXT_LENGTH_HOLD_1_TO_350")
    if not isinstance(speed, (int, float)) or not .8 <= speed <= 1.2:
        raise ValueError("VOICE_SPEED_OUTSIDE_0.8_TO_1.2")
    profile, reference = load_authorized(speaker_id)
    converter_path, base_ses_path, melo_home = _check_local_assets()

    # Force local inference; fail instead of downloading a model.
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_DATASETS_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    try:
        import torch
        from openvoice.api import OpenVoiceBaseClass, ToneColorConverter
        from melo.api import TTS
    except ImportError as exc:
        raise RuntimeError("VOICE_SYNTH_DEPENDENCIES_MISSING: install reviewed OpenVoice V2 and MeloTTS in isolated venv") from exc

    # Operator-provisioned checkpoint files are trusted inputs. Do not load
    # arbitrary untrusted .pth files; torch serialized weights can be unsafe.
    device = "cpu"
    # Upstream ToneColorConverter forwards enable_watermark to a base
    # constructor that does not accept it. Its default also initializes
    # wavmark, which is unnecessary and may fetch additional weights.
    # Initialize the verified converter class directly without watermark.
    converter = ToneColorConverter.__new__(ToneColorConverter)
    OpenVoiceBaseClass.__init__(converter, str(converter_path / "config.json"), device=device)
    converter.watermark_model = None
    converter.version = getattr(converter.hps, "_version_", "v1")
    # Prevent arbitrary pickle deserialization for the approved checkpoint.
    checkpoint = torch.load(str(converter_path / "checkpoint.pth"),
                            map_location=torch.device(device), weights_only=True)
    if not isinstance(checkpoint, dict) or not isinstance(checkpoint.get("model"), dict):
        raise RuntimeError("VOICE_OPENVOICE_CHECKPOINT_PAYLOAD_INVALID")
    converter.model.load_state_dict(checkpoint["model"], strict=False)
    target_embedding = converter.extract_se([str(reference)])
    # Explicit paths prevent the MeloTTS API from attempting HF downloads.
    # The official TTS initializer supports use_hf/config_path/ckpt_path.
    # The installed MeloTTS loader can use torch.load without weights_only.
    # Force safe checkpoint loading for this single constructor; then restore
    # the original module binding before generation. No model downloads.
    import melo.api as melo_api
    previous_loader = melo_api.load_or_download_model
    def _local_model_loader(language, destination, use_hf=True, ckpt_path=None):
        if language != "EN_NEWEST" or str(ckpt_path) != str(melo_home / "checkpoint.pth"):
            raise RuntimeError("VOICE_UNEXPECTED_MELO_MODEL_REQUEST")
        data = torch.load(str(melo_home / "checkpoint.pth"),
                          map_location=torch.device(destination), weights_only=True)
        if not isinstance(data, dict) or not isinstance(data.get("model"), dict):
            raise RuntimeError("VOICE_MELO_CHECKPOINT_PAYLOAD_INVALID")
        return data
    try:
        melo_api.load_or_download_model = _local_model_loader
        synthesizer = TTS(language="EN_NEWEST", device=device, use_hf=True,
                          config_path=str(melo_home / "config.json"),
                          ckpt_path=str(melo_home / "checkpoint.pth"))
    finally:
        melo_api.load_or_download_model = previous_loader
    speakers = synthesizer.hps.data.spk2id
    if "EN-Newest" not in speakers:
        raise RuntimeError("VOICE_BASE_SPEAKER_MISMATCH")
    name = "EN-Newest"
    speaker_idx = speakers[name]
    source_embedding_path = base_ses_path / "en-newest.pth"
    # Only weights-only loading; incompatible assets fail closed.
    source_embedding = torch.load(str(source_embedding_path), map_location=device, weights_only=True)
    dest = home() / "exports"
    dest.mkdir(parents=True, exist_ok=True)
    ident = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + secrets.token_hex(5)
    target = dest / (speaker_id + "-" + ident + ".wav")
    metadata_path = target.with_suffix(".json")
    with tempfile.TemporaryDirectory(prefix="voice-synthesis-", dir=str(home())) as temp:
        intermediate = Path(temp) / "base.wav"
        synthesizer.tts_to_file(text, speaker_idx, str(intermediate), speed=float(speed))
        converter.convert(audio_src_path=str(intermediate), src_se=source_embedding,
                          tgt_se=target_embedding, output_path=str(target),
                          message="FunIndustrialAuthorized")
    if not target.is_file() or target.stat().st_size < 128:
        raise RuntimeError("VOICE_RENDER_OUTPUT_MISSING")
    output_sha = hashlib.sha256(target.read_bytes()).hexdigest()
    metadata = {
        "schema": "fun.voice.reproduction.v1",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "speaker_id": speaker_id,
        "consented_reference_sha256": profile["reference_sha256"],
        "output_sha256": output_sha,
        "engine": "OpenVoice V2 tone-color conversion + MeloTTS EN_NEWEST",
        "speaker_key": name,
        "device": "cpu",
        "text": text,
        "speed": speed,
        "operator_approval": "explicit_one_output",
        "audio_generated": True,
        "synthetic_voice_disclosure": True,
        "wav_watermark_present": False,
        "note": "Style and prosody are approximate, not guaranteed to match the reference contour."
    }
    try:
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf8")
    except OSError:
        target.unlink(missing_ok=True)
        raise
    return {"state": "rendered", "audio_path": str(target),
            "provenance_path": str(metadata_path), "output_sha256": output_sha,
            "synthetic_voice": True}


def synthesis_status():
    try:
        a, b, c = _check_local_assets()
        return {"configured": True, "converter_path": str(a),
                "base_speaker_checkpoints": len(list(b.glob("*.pth"))),
                "melo_model_path": str(c),
                "downloads_attempted": 0, "model_loaded": False}
    except (FileNotFoundError, RuntimeError) as exc:
        return {"configured": False, "reason": str(exc),
                "downloads_attempted": 0, "model_loaded": False}
