"""Read-only GGUF metadata inspector standard-library unit tests.
No actual model files are opened or changed by these synthetic tests.
"""
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "gguf_inspector_v4", ROOT / "scripts" / "Inspect-Fun-Qwen-GGUF-Provenance-V4.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def s(value):
    data = value.encode("utf-8")
    return struct.pack("<Q", len(data)) + data


def fake_gguf(path, overrides=None):
    props = {
        "general.architecture": ("qwen3", 8),
        "general.name": ("Qwen3 4B synthetic test", 8),
        "qwen3.block_count": (36, 4),
        "qwen3.embedding_length": (2560, 4),
        "qwen3.feed_forward_length": (9728, 4),
        "qwen3.attention.head_count": (32, 4),
        "qwen3.attention.head_count_kv": (8, 4),
        "tokenizer.ggml.tokens": (["hi", "world"], 9),
    }
    props.update(overrides or {})
    raw = b"GGUF" + struct.pack("<IQQ", 3, 1, len(props))
    for key, (value, code) in props.items():
        raw += s(key) + struct.pack("<I", code)
        if code == 8:
            raw += s(value)
        elif code == 9:
            raw += struct.pack("<IQ", 8, len(value))
            raw += b"".join(s(token) for token in value)
        elif code == 4:
            raw += struct.pack("<I", value)
        else:
            raise ValueError("UNSUPPORTED_TEST_TYPE")
    path.write_bytes(raw + bytes(1024))
    return path


class GGUFProvenanceTests(unittest.TestCase):
    def test_known_qwen_geometry(self):
        with tempfile.TemporaryDirectory() as t:
            p = fake_gguf(Path(t) / "sample.gguf")
            result = mod.inspect(p)
            self.assertEqual(result["state"], "GGUF_QWEN3_4B_GEOMETRY_MATCH_PROVENANCE_UNVERIFIED")
            self.assertEqual(result["tensor_count"], 1)
            self.assertFalse(result["model_weights_modified"])
            self.assertFalse(result["exact_huggingface_weights_revision_verified"])

    def test_reject_other_geometry_without_training_claims(self):
        with tempfile.TemporaryDirectory() as t:
            p = fake_gguf(Path(t) / "test.gguf", {"qwen3.block_count": (12, 4)})
            result = mod.inspect(p)
            self.assertEqual(result["state"], "HOLD_GGUF_ARCHITECTURE_NOT_AS_EXPECTED")
            self.assertIn("qwen3.block_count", result["architecture_mismatches"])

    def test_reject_invalid_magic(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t) / "invalid.gguf"
            p.write_bytes(b"NOPE" + bytes(1024))
            with self.assertRaises(ValueError):
                mod.inspect(p)

    def test_missing_model(self):
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaises(ValueError):
                mod.inspect(Path(t) / "absent.gguf")

    def test_truncated_metadata(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t) / "truncated.gguf"
            p.write_bytes(b"GGUF"+struct.pack("<IQQ", 3, 1, 1)+
                          struct.pack("<Q", mod.MAX_METADATA_BYTES + 1)+bytes(1024))
            with self.assertRaises(ValueError):
                mod.inspect(p)

    def test_reject_huge_array(self):
        with tempfile.TemporaryDirectory() as t:
            p = fake_gguf(Path(t) / "huge.gguf", {
                "tokenizer.ggml.tokens": (["a"], 9)
            })
            blob = p.read_bytes()
            marker = struct.pack("<IQ", 8, 1)
            self.assertEqual(blob.count(marker), 1)
            p.write_bytes(blob.replace(marker, struct.pack("<IQ", 8, mod.MAX_ARRAY+1)))
            with self.assertRaises(ValueError):
                mod.inspect(p)


if __name__ == "__main__":
    unittest.main()
