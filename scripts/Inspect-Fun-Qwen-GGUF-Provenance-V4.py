#!/usr/bin/env python3
"""Bounded, READ-ONLY GGUF model metadata inspection; no model tensors read.

Identifies exact deployed Qwen architecture labels and optional upstream
provenance hints. Header metadata is not proof of identical HF checkpoint
revision/weights. Does not download a model or change llama.cpp servers.
"""
import argparse
import json
import os
from pathlib import Path
import struct
import sys

VERSION = "fun-qwen-gguf-provenance-v4"
FORMATS = {
    0: "<B", 1: "<b", 2: "<H", 3: "<h", 4: "<I", 5: "<i",
    6: "<f", 7: "<?", 10: "<Q", 11: "<q", 12: "<d"
}
EXPECTED = {
    "qwen3.block_count": 36,
    "qwen3.embedding_length": 2560,
    "qwen3.feed_forward_length": 9728,
    "qwen3.attention.head_count": 32,
    "qwen3.attention.head_count_kv": 8
}
USEFUL_KEYS = {
    "general.name", "general.architecture", "general.basename",
    "general.finetune", "general.size_label", "general.file_type",
    "general.quantization_version", "general.source.url",
    "general.source.repo_url", "general.source.huggingface.repository",
    "general.base_model.0.name", "general.base_model.0.organization",
    "general.base_model.0.repo_url", "tokenizer.ggml.model",
    "qwen3.context_length", "qwen3.rope.freq_base",
    "qwen3.attention.key_length", "qwen3.attention.value_length",
    "qwen3.attention.layer_norm_rms_epsilon", "tokenizer.chat_template",
} | set(EXPECTED)
MAX_METADATA_BYTES = 256 * 1024 * 1024
MAX_TEXT_BYTES = 2 * 1024 * 1024
MAX_FIELDS = 2048
MAX_ARRAY = 2_000_000


class Reader:
    def __init__(self, f, file_size):
        self.f, self.file_size = f, file_size

    def raw(self, size):
        if size < 0 or size > MAX_METADATA_BYTES:
            raise ValueError("GGUF_UNBOUNDED_METADATA_READ")
        if self.f.tell() + size > min(self.file_size, MAX_METADATA_BYTES):
            raise ValueError("GGUF_METADATA_OUT_OF_RANGE")
        data = self.f.read(size)
        if len(data) != size:
            raise ValueError("GGUF_METADATA_TRUNCATED")
        return data

    def number(self, code):
        fmt = FORMATS.get(code)
        if fmt is None:
            raise ValueError("GGUF_UNSUPPORTED_NUMERIC_TYPE_" + str(code))
        return struct.unpack(fmt, self.raw(struct.calcsize(fmt)))[0]

    def string(self, retain):
        length = self.number(10)
        if length > MAX_METADATA_BYTES:
            raise ValueError("GGUF_INVALID_STRING_LENGTH")
        if retain and length <= MAX_TEXT_BYTES:
            return self.raw(length).decode("utf-8", errors="replace")
        self.skip(length)
        return "<long or skipped string>" if retain else None

    def skip(self, n):
        if n < 0 or self.f.tell() + n > min(self.file_size, MAX_METADATA_BYTES):
            raise ValueError("GGUF_METADATA_SKIP_OUT_OF_BOUNDS")
        self.f.seek(n, os.SEEK_CUR)

    def value(self, code, retain, depth=0):
        if depth > 2:
            raise ValueError("GGUF_NESTED_ARRAY_DEPTH_EXCEEDED")
        if code == 8:
            return self.string(retain)
        if code == 9:
            elem = self.number(4)
            count = self.number(10)
            if count > MAX_ARRAY:
                raise ValueError("GGUF_UNBOUNDED_ARRAY_LENGTH")
            if elem in FORMATS:
                size = struct.calcsize(FORMATS[elem])
                if retain and count <= 32:
                    return [self.number(elem) for _ in range(count)]
                self.skip(count * size)
                return "<array omitted>" if retain else None
            if elem != 8:
                raise ValueError("GGUF_UNSUPPORTED_ARRAY_ELEMENT_" + str(elem))
            for _ in range(count):
                self.string(False)
            return "<string array omitted>" if retain else None
        if code not in FORMATS:
            raise ValueError("GGUF_UNSUPPORTED_METADATA_TYPE_" + str(code))
        if retain:
            return self.number(code)
        self.skip(struct.calcsize(FORMATS[code]))
        return None


def inspect(path):
    model = Path(path).expanduser().resolve()
    if not model.is_file() or model.is_symlink() or model.suffix.lower() != ".gguf":
        raise ValueError("GGUF_SOURCE_FILE_MISSING_OR_INVALID")
    if "elektron" in str(model).lower():
        raise ValueError("ELEKTRON_PATH_REFUSED")
    size = model.stat().st_size
    if size < 1024:
        raise ValueError("GGUF_FILE_TOO_SMALL")
    with model.open("rb") as f:
        r = Reader(f, size)
        if r.raw(4) != b"GGUF":
            raise ValueError("NOT_A_GGUF")
        version = r.number(4)
        if version not in (2, 3):
            raise ValueError("GGUF_VERSION_UNSUPPORTED")
        tensors = r.number(10)
        fields = r.number(10)
        if fields > MAX_FIELDS or tensors > 100000:
            raise ValueError("GGUF_HEADER_COUNTS_INVALID")
        found = {}
        for _ in range(fields):
            key = r.string(True)
            if not isinstance(key, str) or len(key) > 240:
                raise ValueError("GGUF_METADATA_KEY_INVALID")
            code = r.number(4)
            useful = key in USEFUL_KEYS
            val = r.value(code, useful)
            if useful:
                found[key] = val
    mismatches = {key: {"expected": val, "actual": found.get(key)}
                  for key, val in EXPECTED.items() if found.get(key) != val}
    arch = found.get("general.architecture")
    if arch != "qwen3":
        mismatches["general.architecture"] = {"expected": "qwen3", "actual": arch}
    # No exact source revision available just from GGUF header; do not claim
    # it is the same as a separately downloaded matching HF checkpoint.
    return {
        "version": VERSION,
        "state": "GGUF_QWEN3_4B_GEOMETRY_MATCH_PROVENANCE_UNVERIFIED"
                 if not mismatches else "HOLD_GGUF_ARCHITECTURE_NOT_AS_EXPECTED",
        "path": str(model),
        "file_size_gib": round(size / (1024**3), 3),
        "gguf_version": version,
        "tensor_count": tensors,
        "metadata_count": fields,
        "selected_metadata": {k: ("<template omitted>" if k=="tokenizer.chat_template" else v)
                              for k,v in found.items()},
        "architecture_mismatches": mismatches,
        "exact_huggingface_weights_revision_verified": False,
        "hf_safetensors_checkpoint_available": False,
        "gguf_tensor_data_read": False,
        "model_weights_modified": False,
        "qwen_server_restarted": False,
        "next": "Verify matching original HF Qwen3-4B checkpoint and use isolated trainer; GGUF metadata alone cannot verify exact revision."
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gguf", type=Path, required=True)
    args = ap.parse_args()
    try:
        result = inspect(args.gguf)
        print(json.dumps(result, sort_keys=True))
        return 0 if result["state"] == "GGUF_QWEN3_4B_GEOMETRY_MATCH_PROVENANCE_UNVERIFIED" else 2
    except (ValueError, OSError, struct.error) as err:
        print(json.dumps({"version": VERSION, "state": "HOLD_GGUF_READONLY_INSPECTION",
                          "reason": str(err)[:350], "gguf_tensor_data_read": False,
                          "model_weights_modified": False}, sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main())
