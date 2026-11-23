#!/usr/bin/env python3
"""Explicit, offline PEFT LoRA -> GGUF adapter conversion only, NOT deployment.

Requires a validated trained candidate receipt and exact base + converter paths.
Never overwrites running Qwen GGUF, changes model settings, restarts services,
merges original weights, or loads an adapter into llama-server.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

APPROVAL = "I_APPROVE_FIBONACCI_ADAPTER_CONVERSION"
VERSION = "fun-fibonacci-adapter-export-v1"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--training-output", type=Path, required=True)
    p.add_argument("--base-dir", type=Path, required=True)
    p.add_argument("--llama-cpp-source", type=Path, required=True)
    p.add_argument("--outfile", type=Path, required=True)
    p.add_argument("--approve", default="")
    a = p.parse_args()
    if a.approve != APPROVAL:
        raise ValueError("OPERATOR_CONVERSION_APPROVAL_REQUIRED")
    out = a.outfile.expanduser().resolve()
    if out.suffix.lower() != ".gguf" or out.exists():
        raise ValueError("REFUSE_OVERWRITE_OR_INVALID_GGUF_DESTINATION")
    training = a.training_output.expanduser().resolve()
    base = a.base_dir.expanduser().resolve()
    converter = a.llama_cpp_source.expanduser().resolve() / "convert_lora_to_gguf.py"
    if any("elektron" in str(x).lower() for x in (out, training, base, converter)):
        raise ValueError("ELEKTRON_PATH_REFUSED")
    receipt_file = training / "training_receipt.json"
    if not receipt_file.is_file() or receipt_file.is_symlink():
        raise ValueError("TRAINING_RECEIPT_MISSING")
    receipt = json.loads(receipt_file.read_text("utf-8"))
    if receipt.get("version") != "fun-qwen-fibonacci-qlora-v1" or \
            receipt.get("state") != "CANDIDATE_LOSS_IMPROVED_NOT_DEPLOYED" or \
            receipt.get("real_adapter_weights_updated") is not True or \
            receipt.get("original_gguf_unchanged") is not True or \
            receipt.get("base_checkpoint") != str(base):
        raise ValueError("TRAINED_ADAPTER_NOT_VALIDATED_OR_BASE_CHANGED")
    adapter = Path(receipt["adapter_path"]).resolve()
    if adapter != training / "adapter_candidate" or not adapter.is_dir():
        raise ValueError("ADAPTER_PATH_UNVERIFIED")
    if not (adapter / "adapter_config.json").is_file() or \
            not list(adapter.glob("*.safetensors")):
        raise ValueError("PEFT_ADAPTER_FILES_MISSING")
    if not converter.is_file() or converter.is_symlink():
        raise ValueError("LOCAL_LLAMA_CPP_CONVERTER_MISSING")
    if not (base / "config.json").is_file():
        raise ValueError("LOCAL_BASE_CONFIG_MISSING")
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        raise FileExistsError("OUTPUT_ALREADY_EXISTS")
    env = os.environ.copy()
    env.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1",
               HF_DATASETS_OFFLINE="1", PYTHONNOUSERSITE="1")
    completed = subprocess.run(
        [sys.executable, str(converter), "--base", str(base), "--outfile", str(out),
         "--outtype", "f16", str(adapter)],
        cwd=str(converter.parent), env=env, timeout=300,
        capture_output=True, text=True)
    if completed.returncode != 0:
        if out.exists():
            out.unlink()  # only our new output, never an existing GGUF
        raise RuntimeError("CONVERTER_FAILED_" + completed.stderr[-800:])
    if not out.is_file() or out.stat().st_size < 100 or out.open("rb").read(4) != b"GGUF":
        raise ValueError("CONVERTED_ADAPTER_GGUF_HEADER_INVALID")
    digest = hashlib.file_digest(out.open("rb"), "sha256").hexdigest()
    report = {
        "version": VERSION, "state": "GGUF_ADAPTER_CONVERTED_NOT_DEPLOYED",
        "adapter_gguf": str(out), "adapter_sha256": digest,
        "adapter_bytes": out.stat().st_size,
        "original_qwen_gguf_unchanged": True,
        "live_qwen_restarted": False,
        "gguf_base_revision_match_verified": False,
        "device_tool_permissions_changed": False,
        "next": "Independently verify exact GGUF/base architecture and test before any explicit server reload using --lora."
    }
    print(json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, RuntimeError, subprocess.TimeoutExpired, KeyError) as exc:
        print(json.dumps({"version": VERSION, "state": "CONVERSION_HOLD_NOT_DEPLOYED",
                          "reason": str(exc)[-500:]}, sort_keys=True))
        sys.exit(2)
