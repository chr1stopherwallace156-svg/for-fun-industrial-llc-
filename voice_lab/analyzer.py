"""CPU-only spoken-voice acoustics. No network, no audio playback, no writes.

Features are acoustic descriptors, NOT a speaker identity certificate or emotion diagnosis.
Input is a local WAV/FLAC mono/stereo recording, maximum 60 seconds/75 MiB.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import numpy as np

SR = 16000
HOP = 256
MAX_SECONDS = 60
MAX_BYTES = 75 * 1024 * 1024


def _scalar(x: float, digits: int = 4) -> float:
    v = float(x)
    return round(v, digits) if np.isfinite(v) else 0.0


def validate_audio_path(filename: str | Path) -> Path:
    path = Path(filename).expanduser().resolve(strict=True)
    if not path.is_file() or path.suffix.lower() not in {".wav", ".flac"}:
        raise ValueError("VOICE_AUDIO_FORMAT_HOLD: use local WAV or FLAC")
    if path.stat().st_size <= 0 or path.stat().st_size > MAX_BYTES:
        raise ValueError("VOICE_AUDIO_SIZE_HOLD")
    return path


def load_voice(filename: str | Path):
    import librosa
    import soundfile as sf

    path = validate_audio_path(filename)
    info = sf.info(str(path))
    if info.duration < 1.2 or info.duration > MAX_SECONDS or info.channels not in (1, 2):
        raise ValueError("VOICE_AUDIO_DURATION_OR_CHANNELS_HOLD")
    y, _ = librosa.load(str(path), sr=SR, mono=True, duration=MAX_SECONDS + 0.1)
    if y.size < SR or y.size > SR * (MAX_SECONDS + 1):
        raise ValueError("VOICE_AUDIO_DECODE_HOLD")
    if not np.isfinite(y).all():
        raise ValueError("VOICE_AUDIO_NONFINITE_HOLD")
    return path, y.astype(np.float32, copy=False)


def analyze_audio(filename: str | Path, *, include_contours: bool = True) -> dict[str, Any]:
    import librosa

    path, y = load_voice(filename)
    n = len(y)
    peak = float(np.max(np.abs(y)))
    if peak < 0.00008:
        raise ValueError("VOICE_AUDIO_SILENT_HOLD")
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=HOP, center=True)[0]
    db = librosa.amplitude_to_db(rms, ref=1.0)
    # Energy threshold is adaptive, not a true phoneme or voice-activity detector.
    activity_threshold = max(-43.0, _scalar(np.quantile(db, 0.92) - 23.0, 2))
    speech_proxy = db >= activity_threshold
    # YIN estimates F0. Gate low-energy frames; unvoiced sounds need a dedicated voicing model.
    f0 = librosa.yin(y=y, sr=SR, fmin=55, fmax=700,
                     frame_length=1024, hop_length=HOP, center=True)
    m = min(len(f0), len(speech_proxy))
    f0 = np.asarray(f0[:m])
    speech_proxy = speech_proxy[:m]
    db = db[:m]
    f0 = np.where(speech_proxy & np.isfinite(f0), f0, np.nan)
    voiced_f0 = f0[np.isfinite(f0)]
    if len(voiced_f0) < 5:
        raise ValueError("VOICE_PITCH_NOT_ESTIMABLE_HOLD")
    centroid = librosa.feature.spectral_centroid(y=y, sr=SR, n_fft=1024, hop_length=HOP)[0][:m]
    # Normalized MFCC moments are useful for general acoustic similarity,
    # but they do NOT verify speaker identity.
    mfcc = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=13, n_fft=1024, hop_length=HOP)
    k = min(m, mfcc.shape[1])
    selected = mfcc[:, :k][:, speech_proxy[:k]]
    if selected.shape[1] < 3:
        raise ValueError("VOICE_INSUFFICIENT_SPEECH_HOLD")
    audio_sha = hashlib.sha256(path.read_bytes()).hexdigest()
    voiced_db = db[speech_proxy]
    start_times = np.arange(m) * HOP / SR
    activity_edges = np.diff(np.r_[False, speech_proxy, False].astype(np.int8))
    onsets, offsets = np.where(activity_edges == 1)[0], np.where(activity_edges == -1)[0]
    runs = []
    for a, b in zip(onsets, offsets):
        if (b - a) * HOP / SR >= 0.12:
            runs.append([_scalar(a * HOP / SR, 3), _scalar(min(b * HOP / SR, n / SR), 3)])
    # Time-normalized contour summaries to compare different recordings.
    interp = lambda arr: [
        _scalar(v, 2) for v in np.interp(
            np.linspace(0, max(1, m-1), num=64),
            np.flatnonzero(np.isfinite(arr)),
            arr[np.isfinite(arr)]).tolist()
    ]
    # Do not expose absolute original path in the output by default.
    result = {
        "schema": "fun.voice.analysis.v1",
        "source_sha256": audio_sha,
        "audio_name": path.name,
        "sample_rate_hz": SR,
        "duration_seconds": _scalar(n / SR, 3),
        "clipping_sample_fraction": _scalar(np.mean(np.abs(y) >= 0.995), 5),
        "pitch": {
            "median_hz": _scalar(np.median(voiced_f0), 2),
            "p10_hz": _scalar(np.percentile(voiced_f0, 10), 2),
            "p90_hz": _scalar(np.percentile(voiced_f0, 90), 2),
            "spread_semitones": _scalar(12 * np.log2(
                np.percentile(voiced_f0, 90) / max(1, np.percentile(voiced_f0, 10))), 2),
            "candidate_voiced_fraction": _scalar(np.mean(np.isfinite(f0)), 3),
            "method": "librosa.yin + energy gate; candidate F0, not perfect voicing"
        },
        "loudness": {
            "mean_dbfs_rms": _scalar(np.mean(voiced_db), 2),
            "p10_dbfs_rms": _scalar(np.percentile(voiced_db, 10), 2),
            "p90_dbfs_rms": _scalar(np.percentile(voiced_db, 90), 2),
            "peak_dbfs": _scalar(20 * np.log10(peak), 2),
            "note": "Digital dBFS, not calibrated physical sound-pressure level."
        },
        "temporal": {
            "active_fraction_energy_proxy": _scalar(np.mean(speech_proxy), 3),
            "speech_bursts_energy_proxy": len(runs),
            "activity_regions_seconds": runs[:80],
            "note": "Energy-based boundaries, not precise words/syllables or speaking rate."
        },
        "spectral": {
            "median_centroid_hz": _scalar(np.median(centroid[speech_proxy]), 2),
            "mfcc_mean_13": [_scalar(v, 3) for v in np.mean(selected, axis=1).tolist()],
            "mfcc_std_13": [_scalar(v, 3) for v in np.std(selected, axis=1).tolist()],
            "note": "Spectral summary affected by microphone, room, language and noise."
        },
        "privacy": {"network_requests": 0, "recording_uploaded": False,
                    "speaker_identity_certified": False, "emotional_state_inferred": False}
    }
    if include_contours:
        result["contours"] = {
            "time_resolution_ms": HOP / SR * 1000,
            "pitch_hz_64": interp(f0),
            "loudness_dbfs_64": interp(db)
        }
    return result


def compare_analyses(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    if a.get("schema") != "fun.voice.analysis.v1" or b.get("schema") != "fun.voice.analysis.v1":
        raise ValueError("VOICE_PROFILE_SCHEMA_HOLD")
    for data in (a,b):
        if "contours" not in data or len(data["contours"].get("pitch_hz_64",[])) != 64:
            raise ValueError("VOICE_CONTOURS_REQUIRED")
    p1,p2 = np.array(a["contours"]["pitch_hz_64"]),np.array(b["contours"]["pitch_hz_64"])
    l1,l2 = np.array(a["contours"]["loudness_dbfs_64"]),np.array(b["contours"]["loudness_dbfs_64"])
    # Normalization removes mean shift to highlight contour shape.
    shape1=np.log2(np.maximum(p1,1));shape2=np.log2(np.maximum(p2,1))
    mean_pitch_gap = 12 * abs(float(np.log2(
        max(a["pitch"]["median_hz"],1) / max(b["pitch"]["median_hz"],1))))
    shape_diff = float(np.mean(np.abs((shape1-shape1.mean())-(shape2-shape2.mean()))))*12
    loudness_gap = abs(a["loudness"]["mean_dbfs_rms"]-b["loudness"]["mean_dbfs_rms"])
    dynamic1=l1-l1.mean();dynamic2=l2-l2.mean()
    energy_shape_diff=float(np.mean(np.abs(dynamic1-dynamic2)))
    mfcc1=np.array(a["spectral"]["mfcc_mean_13"]),mfcc2=np.array(b["spectral"]["mfcc_mean_13"])
    mfcc_dist=float(np.linalg.norm((mfcc1-mfcc2)/np.maximum(np.abs(mfcc1)+np.abs(mfcc2),1.0)))
    duration_ratio=b["duration_seconds"]/max(a["duration_seconds"],0.001)
    return {
        "schema":"fun.voice.match.v1",
        "first_sha256":a["source_sha256"],"second_sha256":b["source_sha256"],
        "median_pitch_gap_semitones":_scalar(mean_pitch_gap,2),
        "pitch_contour_difference_semitones":_scalar(shape_diff,2),
        "loudness_gap_dbfs":_scalar(loudness_gap,2),
        "loudness_contour_difference_db":_scalar(energy_shape_diff,2),
        "spectral_mfcc_relative_distance":_scalar(mfcc_dist,4),
        "duration_ratio_second_over_first":_scalar(duration_ratio,3),
        "identity_verification": "NOT_PERFORMED",
        "interpretation": "Descriptive acoustic comparison only. Scores are not calibrated probabilities or speaker identity evidence.",
        "alignment": "64-point normalized timeline; not word-aligned, not dynamic time warping."
    }
