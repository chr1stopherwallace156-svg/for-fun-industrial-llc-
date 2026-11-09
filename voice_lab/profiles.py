"""Local voice profile consent, containment and revocation.

Permission is a recorded operator attestation, not proof of legal ownership.
Use only voices for which the operator has reproduction rights.
"""
from __future__ import annotations
import hashlib
import json
import os
import re
import secrets
import shutil
from datetime import datetime, timezone
from pathlib import Path
from .analyzer import analyze_audio, validate_audio_path

ID = re.compile(r"^[a-z][a-z0-9-]{0,39}$")


def home() -> Path:
    base = os.environ.get("FUN_VOICE_HOME")
    if base:
        return Path(base).expanduser().resolve()
    local = os.environ.get("LOCALAPPDATA")
    if not local:
        local = str(Path.home() / "AppData" / "Local")
    return Path(local) / "FunIndustrial" / "VoiceLab"


def _profile_paths(speaker_id: str):
    if not ID.fullmatch(speaker_id):
        raise ValueError("VOICE_SPEAKER_ID_INVALID")
    directory = home() / "profiles" / speaker_id
    return directory, directory / "profile.json"


def _hash(file: Path) -> str:
    h = hashlib.sha256()
    with file.open("rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def _atomic_json(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + "." + secrets.token_hex(5) + ".tmp")
    try:
        temp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def enroll(speaker_id: str, reference: str, *, authorization: bool, attestation: str):
    directory, record_file = _profile_paths(speaker_id)
    if not authorization or attestation != "AUTHORIZE VOICE " + speaker_id:
        raise PermissionError("VOICE_OPERATOR_CONSENT_REQUIRED")
    if record_file.exists():
        raise FileExistsError("VOICE_PROFILE_EXISTS_REVOKE_BEFORE_REENROLL")
    path = validate_audio_path(reference)
    result = analyze_audio(path, include_contours=True)
    if result["duration_seconds"] < 2:
        raise ValueError("VOICE_REFERENCE_TOO_SHORT")
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / ("reference" + path.suffix.lower())
    if target.exists():
        raise FileExistsError("VOICE_REFERENCE_ALREADY_EXISTS")
    shutil.copyfile(path, target)
    if _hash(target) != result["source_sha256"]:
        target.unlink(missing_ok=True)
        raise RuntimeError("VOICE_REFERENCE_HASH_CHANGED")
    data = {
        "schema": "fun.voice.enrollment.v1",
        "speaker_id": speaker_id,
        "status": "authorized",
        "purpose": "local authorized spoken voice comparison and reproduction",
        "operator_asserted_rights": True,
        "authorized_utc": datetime.now(timezone.utc).isoformat(),
        "reference_sha256": result["source_sha256"],
        "reference_filename": target.name,
        "analysis": result,
        "no_automatic_model_downloads": True,
        "may_generate_without_separate_operator_approval": False,
        "rea_execution_authority": False,
        "cognee_automatic_write": False
    }
    _atomic_json(record_file, data)
    return {"state": "enrolled", "speaker_id": speaker_id,
            "reference_sha256": result["source_sha256"],
            "authorization": "operator_attested"}


def load_authorized(speaker_id: str):
    directory, record_file = _profile_paths(speaker_id)
    if not record_file.is_file():
        raise PermissionError("VOICE_PROFILE_NOT_ENROLLED")
    record = json.loads(record_file.read_text(encoding="utf-8"))
    if (record.get("schema") != "fun.voice.enrollment.v1"
        or record.get("status") != "authorized"
        or record.get("operator_asserted_rights") is not True
        or record.get("speaker_id") != speaker_id):
        raise PermissionError("VOICE_PROFILE_NOT_AUTHORIZED")
    refname = record.get("reference_filename")
    if refname not in ("reference.wav", "reference.flac"):
        raise ValueError("VOICE_REFERENCE_PATH_INVALID")
    reference = directory / refname
    if not reference.is_file() or reference.is_symlink():
        raise PermissionError("VOICE_REFERENCE_MISSING_OR_SYMLINK")
    if _hash(reference) != record.get("reference_sha256"):
        raise PermissionError("VOICE_REFERENCE_HASH_INVALID")
    return record, reference


def revoke(speaker_id: str, *, attestation: str):
    directory, record_file = _profile_paths(speaker_id)
    if attestation != "REVOKE VOICE " + speaker_id:
        raise PermissionError("VOICE_REVOKE_OPERATOR_CONFIRMATION_REQUIRED")
    if not record_file.is_file():
        raise FileNotFoundError("VOICE_PROFILE_NOT_FOUND")
    # Revocation removes the retained reference. Already exported audio is not recalled.
    shutil.rmtree(directory)
    return {"state": "revoked", "speaker_id": speaker_id,
            "note": "Local profile/reference deleted; previous exports require separate disposal."}


def list_profiles():
    base = home() / "profiles"
    if not base.exists():
        return []
    out = []
    for directory in sorted(base.iterdir()):
        if directory.is_dir() and ID.fullmatch(directory.name):
            try:
                record, _ = load_authorized(directory.name)
                out.append({"speaker_id": directory.name, "authorized_utc": record.get("authorized_utc")})
            except (OSError, ValueError, PermissionError, KeyError):
                out.append({"speaker_id": directory.name, "state": "unavailable"})
    return out
