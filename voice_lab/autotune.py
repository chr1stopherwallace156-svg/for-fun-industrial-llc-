"""Experimental offline pitch correction for explicitly selected voice clips.

This corrects F0 toward a chromatic/major/minor note grid using short-window
phase-vocoder pitch shifts. It is not voice cloning, formant-preserving studio
Auto-Tune, or a real-time microphone processor. No downloads or listeners.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import secrets
import time

import numpy as np

from .analyzer import SR, load_voice
from .profiles import home

NOTES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
SCALES = {"chromatic": tuple(range(12)), "major": (0, 2, 4, 5, 7, 9, 11),
          "minor": (0, 2, 3, 5, 7, 8, 10)}


def target_note(midi: float, *, key: str = "C", scale: str = "chromatic") -> int:
    if not np.isfinite(midi) or not 0 < midi < 128:
        raise ValueError("VOICE_TUNE_PITCH_INVALID")
    if key not in NOTES or scale not in SCALES:
        raise ValueError("VOICE_TUNE_KEY_OR_SCALE_INVALID")
    allowed = {(NOTES.index(key) + offset) % 12 for offset in SCALES[scale]}
    choices = [n for n in range(max(1, int(midi) - 6),
                               min(127, int(midi) + 8)) if n % 12 in allowed]
    if not choices:
        raise ValueError("VOICE_TUNE_NO_TARGET_NOTE")
    return min(choices, key=lambda n: (abs(n - midi), n))


def note_name(midi: int) -> str:
    return NOTES[int(midi) % 12] + str(int(midi) // 12 - 1)


def auto_tune(filename: str | Path, *, key: str = "C", scale: str = "chromatic",
              strength: float = 0.8, output: str | Path | None = None) -> dict:
    import librosa
    import soundfile as sf

    if key not in NOTES or scale not in SCALES:
        raise ValueError("VOICE_TUNE_KEY_OR_SCALE_INVALID")
    if not isinstance(strength, (float, int)) or not np.isfinite(strength) or not 0 <= strength <= 1:
        raise ValueError("VOICE_TUNE_STRENGTH_INVALID")
    source, audio = load_voice(filename)
    if not 1.2 <= len(audio) / SR <= 30:
        raise ValueError("VOICE_TUNE_DURATION_MAX_30_SECONDS")
    if np.max(np.abs(audio)) < .00008:
        raise ValueError("VOICE_TUNE_SILENT_HOLD")
    export_root = home() / "exports"
    export_root.mkdir(parents=True, exist_ok=True)
    if output is None:
        target = export_root / ("pitch-tuned-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()) +
                                "-" + secrets.token_hex(5) + ".wav")
    else:
        target = Path(output).expanduser().absolute()
    if target.suffix.lower() != ".wav" or target.is_symlink() or target.exists() or not target.parent.is_dir():
        raise ValueError("VOICE_TUNE_OUTPUT_INVALID_OR_EXISTS")
    if target.parent.resolve() != export_root.resolve():
        raise ValueError("VOICE_TUNE_OUTPUT_PRIVATE_EXPORTS_ONLY")
    if (target.with_suffix(".json")).exists():
        raise ValueError("VOICE_TUNE_PROVENANCE_ALREADY_EXISTS")

    hop = 256
    f0 = librosa.yin(audio, sr=SR, fmin=65, fmax=700,
                    frame_length=2048, hop_length=hop, center=True)
    rms = librosa.feature.rms(y=audio, frame_length=2048,
                              hop_length=hop, center=True)[0]
    size = min(len(f0), len(rms))
    f0 = np.asarray(f0[:size])
    voiced = (rms[:size] > max(.008, float(np.quantile(rms[:size], .85)) * .12)) & \
             np.isfinite(f0) & (f0 > 65) & (f0 < 700)
    if np.count_nonzero(voiced) < 8:
        raise ValueError("VOICE_TUNE_INSUFFICIENT_VOICED_AUDIO")

    block = int(.45 * SR)
    step = int(.30 * SR)
    overlap = block - step
    result = np.zeros(len(audio), dtype=np.float64)
    weights = np.zeros(len(audio), dtype=np.float64)
    details = []
    applied = 0

    for start in range(0, len(audio), step):
        end = min(start + block, len(audio))
        clip = audio[start:end]
        left = max(0, int((start + .07 * SR) / hop))
        right = min(size, max(left + 1, int((end - .07 * SR) / hop)))
        mids = librosa.hz_to_midi(f0[left:right][voiced[left:right]])
        semitones = 0.0
        note = None
        snapped = None
        if len(mids) >= 4 and np.max(np.abs(clip)) > .015:
            median = float(np.median(mids))
            snapped = target_note(median, key=key, scale=scale)
            note = round(median, 3)
            semitones = float(np.clip((snapped - median) * strength, -2.5, 2.5))
        if abs(semitones) >= .045:
            changed = librosa.effects.pitch_shift(clip, sr=SR, n_steps=semitones)
            if len(changed) != len(clip) or not np.all(np.isfinite(changed)):
                raise RuntimeError("VOICE_TUNE_ENGINE_OUTPUT_INVALID")
            applied += 1
        else:
            changed = clip
        weight = np.ones(len(clip), dtype=np.float64)
        fade = min(overlap, len(clip))
        if start > 0:
            weight[:fade] = np.linspace(0, 1, fade, endpoint=True)
        if end < len(audio):
            weight[-fade:] = np.minimum(weight[-fade:], np.linspace(1, 0, fade, endpoint=True))
        result[start:end] += changed * weight
        weights[start:end] += weight
        if note is not None:
            details.append({"start_seconds": round(start / SR, 3),
                            "end_seconds": round(end / SR, 3),
                            "source_midi": note,
                            "target_note": note_name(snapped),
                            "applied_semitones": round(semitones, 3)})
        if end == len(audio):
            break

    out = (result / np.maximum(weights, 1e-10)).astype(np.float32)
    peak = float(np.max(np.abs(out)))
    if peak > .99:
        out *= .99 / peak
    if not np.isfinite(out).all():
        raise RuntimeError("VOICE_TUNE_OUTPUT_NOT_FINITE")
    sf.write(str(target), out, SR, subtype="PCM_16")
    checksum = hashlib.sha256(target.read_bytes()).hexdigest()
    report = {"schema": "fun.voice.pitch-tune.v1", "state": "rendered",
              "source": source.name, "output": str(target), "output_sha256": checksum,
              "duration_seconds": round(len(audio) / SR, 3),
              "mode": "experimental_short_window_note_snap",
              "key": key, "scale": scale, "strength": float(strength),
              "pitch_method": "librosa.yin + energy gate",
              "pitch_render": "librosa.effects.pitch_shift + overlapping crossfade",
              "windows_pitch_corrected": applied, "note_windows": details,
              "voice_clone": False, "timbre_guarantee": False,
              "real_time": False, "model_downloads": 0,
              "provenance": str(target.with_suffix(".json")),
              "limitations": "Experimental short-window correction; consonants and pitch transitions may produce artifacts."
              }
    try:
        target.with_suffix(".json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return report
