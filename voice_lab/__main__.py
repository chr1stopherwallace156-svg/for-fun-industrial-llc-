"""Operator-only CLI for Fun Industrial voice lab. No processes started at import."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _print(value):
    print(json.dumps(value, indent=2, ensure_ascii=False))


def _approval(prompt):
    if not sys.stdin.isatty():
        raise PermissionError("VOICE_OPERATOR_INTERACTIVE_TERMINAL_REQUIRED")
    return input("Type exactly [" + prompt + "] to confirm: ").strip()


def run(argv=None):
    parser = argparse.ArgumentParser(prog="python -m voice_lab",
        description="Fun Industrial local spoken voice analysis and authorized synthesis")
    sub = parser.add_subparsers(dest="command", required=True)
    rec = sub.add_parser("record", help="Record local spoken audio from a microphone, no network")
    rec.add_argument("--seconds", type=int, default=8)
    rec.add_argument("--output", required=True)
    a = sub.add_parser("analyze", help="Pitch, digital loudness, spectral and energy-based speech timing")
    a.add_argument("recording")
    a.add_argument("--no-contours", action="store_true")
    m = sub.add_parser("match", help="Descriptive comparison of two recordings")
    m.add_argument("first")
    m.add_argument("second")
    s = sub.add_parser("speaker-match", help="Optional CPU Resemblyzer embedding similarity")
    s.add_argument("first")
    s.add_argument("second")
    e = sub.add_parser("enroll", help="Enrol an explicitly authorized local voice reference")
    e.add_argument("speaker_id")
    e.add_argument("reference")
    e.add_argument("--i-own-or-have-permission", action="store_true", required=True)
    r = sub.add_parser("revoke", help="Delete local reference/profile; exports not automatically deleted")
    r.add_argument("speaker_id")
    p = sub.add_parser("profiles", help="List local authorized profiles")
    sub.add_parser("status", help="Show available engines; no model downloads")
    tune = sub.add_parser("tune", help="Experimentally correct a selected local voice clip toward a musical key/scale")
    tune.add_argument("recording")
    tune.add_argument("--key", choices=("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"), default="C")
    tune.add_argument("--scale", choices=("chromatic", "major", "minor"), default="chromatic")
    tune.add_argument("--strength", type=float, default=0.8)
    tune.add_argument("--output", help="Optional non-existing WAV path inside private VoiceLab exports")
    gen = sub.add_parser("synthesize", help="Operator-authorized single synthetic speech output")
    gen.add_argument("speaker_id")
    texts = gen.add_mutually_exclusive_group(required=True)
    texts.add_argument("--text")
    texts.add_argument("--text-file")
    gen.add_argument("--speed", type=float, default=1.0)
    args = parser.parse_args(argv)
    if args.command == "record":
        if not 2 <= args.seconds <= 30:
            raise ValueError("VOICE_RECORD_SECONDS_HOLD")
        from pathlib import Path
        import numpy as np
        import soundfile as sf
        try:
            import sounddevice as sd
        except ImportError as exc:
            raise RuntimeError("VOICE_MICROPHONE_DEPENDENCY_MISSING: pip install sounddevice") from exc
        from .profiles import home
        root = home() / "recordings"
        root.mkdir(parents=True, exist_ok=True)
        target = Path(args.output).expanduser().resolve()
        if target.suffix.lower() != ".wav" or not target.is_relative_to(root.resolve()):
            raise ValueError("VOICE_RECORD_OUTPUT_MUST_BE_UNDER_PRIVATE_RECORDINGS_FOLDER")
        if target.exists():
            raise FileExistsError("VOICE_RECORD_OUTPUT_EXISTS")
        print("VOICE_MICROPHONE_RECORDING=START seconds=" + str(args.seconds), file=sys.stderr)
        samples = sd.rec(int(args.seconds * 16000), samplerate=16000, channels=1,
                         dtype="float32", blocking=True)
        if not np.isfinite(samples).all():
            raise ValueError("VOICE_RECORD_NONFINITE_HOLD")
        sf.write(str(target), samples, 16000, subtype="PCM_16")
        _print({"state":"recorded","file":str(target),"seconds":args.seconds,
                "microphone_only":True,"network_requests":0})
    elif args.command == "analyze":
        from .analyzer import analyze_audio
        _print(analyze_audio(args.recording, include_contours=not args.no_contours))
    elif args.command == "match":
        from .analyzer import analyze_audio, compare_analyses
        _print(compare_analyses(analyze_audio(args.first), analyze_audio(args.second)))
    elif args.command == "speaker-match":
        from .speaker import compare_speaker_embeddings
        _print(compare_speaker_embeddings(args.first, args.second))
    elif args.command == "enroll":
        from .profiles import enroll
        phrase = _approval("AUTHORIZE VOICE " + args.speaker_id)
        _print(enroll(args.speaker_id, args.reference,
                      authorization=args.i_own_or_have_permission, attestation=phrase))
    elif args.command == "revoke":
        from .profiles import revoke
        _print(revoke(args.speaker_id, attestation=_approval("REVOKE VOICE " + args.speaker_id)))
    elif args.command == "profiles":
        from .profiles import list_profiles
        _print({"profiles": list_profiles()})
    elif args.command == "status":
        from .profiles import home, list_profiles
        from .openvoice_backend import synthesis_status
        _print({"application": "Fun Industrial Local Spoken Voice Lab",
                "version": "0.1.0",
                "mode": "local-operator-cli",
                "listener_started": False,
                "connected_to_elektron": False,
                "connected_to_ollama": False,
                "connected_to_rea": False,
                "connected_to_cognee": False,
                "model_autodownloads": False,
                "storage": str(home()),
                "profiles": list_profiles(),
                "synthesis": synthesis_status()})
    elif args.command == "tune":
        from .autotune import auto_tune
        _print(auto_tune(args.recording, key=args.key, scale=args.scale,
                         strength=args.strength, output=args.output))
    elif args.command == "synthesize":
        from .openvoice_backend import synthesize
        text = args.text if args.text is not None else Path(args.text_file).read_text(encoding="utf-8")
        phrase = _approval("SYNTHESIZE VOICE " + args.speaker_id)
        _print(synthesize(args.speaker_id, text, attestation=phrase, speed=args.speed))
    else:
        raise ValueError("VOICE_UNKNOWN_COMMAND")


if __name__ == "__main__":
    try:
        run()
    except (ValueError, RuntimeError, OSError, PermissionError, ImportError) as exc:
        print("FUN_VOICE_HOLD=" + str(exc), file=sys.stderr)
        sys.exit(1)
