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
    gen = sub.add_parser("synthesize", help="Operator-authorized single synthetic speech output")
    gen.add_argument("speaker_id")
    texts = gen.add_mutually_exclusive_group(required=True)
    texts.add_argument("--text")
    texts.add_argument("--text-file")
    gen.add_argument("--speed", type=float, default=1.0)
    args = parser.parse_args(argv)
    if args.command == "analyze":
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
