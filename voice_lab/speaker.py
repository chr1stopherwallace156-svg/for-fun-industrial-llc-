"""Optional local speaker-embedding comparison via Resemblyzer.

This is acoustic speaker similarity only; never identity proof, access control,
or authorization to reproduce a voice. Runs CPU and must be explicitly invoked.
"""
from __future__ import annotations

import numpy as np
from .analyzer import validate_audio_path


def compare_speaker_embeddings(first, second):
    try:
        from resemblyzer import VoiceEncoder, preprocess_wav
    except ImportError as exc:
        raise RuntimeError("VOICE_SPEAKER_MODEL_NOT_INSTALLED: pip install resemblyzer") from exc

    a = validate_audio_path(first)
    b = validate_audio_path(second)
    encoder = VoiceEncoder(device="cpu")
    aa = encoder.embed_utterance(preprocess_wav(str(a)))
    bb = encoder.embed_utterance(preprocess_wav(str(b)))
    norm = float(np.linalg.norm(aa) * np.linalg.norm(bb))
    if norm < 1e-12:
        raise ValueError("VOICE_SPEAKER_EMBEDDING_INVALID")
    similarity = float(np.dot(aa, bb) / norm)
    return {
        "schema": "fun.voice.speaker-embedding-comparison.v1",
        "cosine_similarity": round(similarity, 5),
        "model": "Resemblyzer VoiceEncoder",
        "device": "cpu",
        "identity_verified": False,
        "authorized_to_synthesize": False,
        "note": "Uncalibrated similarity; not a reliable biometric identity or consent check. Voice, channel, noise, and playback affect this score."
    }
