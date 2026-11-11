"""Isolated offline tests: never connect to a model, spawn processes or write live files."""
from __future__ import annotations
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ai_ml.llama_runtime import LlamaCppRuntime


class Reply:
    def __init__(self, code=200, obj=None):
        self.status = code
        self.payload = json.dumps(obj or {}).encode()
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self, n=-1):
        return self.payload if n < 0 else self.payload[:n]


class ExternalAdoptionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.binary = Path(self.tmp.name, "llama-server.exe")
        self.model = Path(self.tmp.name, "Qwen3-4B-Q4_K_M.gguf")
        self.binary.write_bytes(b"placeholder")
        self.model.write_bytes(b"placeholder")
        self.env = {
            "LLAMA_CPP_SERVER": str(self.binary),
            "LLAMA_CPP_MODEL": str(self.model),
            "LLAMA_CPP_PORT": "8088"
        }

    def urlopen(self, request, timeout=None, *, model="Qwen3-4B-Q4_K_M.gguf"):
        url = request if isinstance(request, str) else request.full_url
        if url == "http://127.0.0.1:8088/health":
            return Reply(obj={"status": "ok"})
        if url == "http://127.0.0.1:8088/v1/models":
            return Reply(obj={"data": [{"id": model}]})
        if url == "http://127.0.0.1:8088/v1/chat/completions":
            return Reply(obj={"choices":[{"message":{"content":"verified mock"}}],"usage":{}})
        raise AssertionError("unexpected network call " + url)

    def test_verified_external_model_is_ready_and_never_owned(self):
        runtime = LlamaCppRuntime()
        with patch.dict("os.environ", self.env), patch("urllib.request.urlopen", self.urlopen):
            status = runtime.status()
            self.assertEqual(status["state"], "ready")
            self.assertEqual(status["ownership"], "external_unmanaged")
            self.assertFalse(status["managed"])
            self.assertIsNone(runtime.process)
            self.assertEqual(runtime.stop()["state"], "not-running")
            result = runtime.chat([{"role":"user","content":"hello"}])
            self.assertEqual(result["reply"], "verified mock")
            self.assertIsNone(runtime.process)

    def test_start_configured_adopts_without_subprocess(self):
        runtime = LlamaCppRuntime()
        with patch.dict("os.environ", self.env), patch("urllib.request.urlopen", self.urlopen), patch(
            "subprocess.Popen", side_effect=AssertionError("must not spawn")):
            status = runtime.start_configured()
            self.assertEqual(status["state"], "ready")
            self.assertFalse(status["managed"])
            self.assertIsNone(runtime.process)

    def test_wrong_model_identity_is_rejected_and_chat_denied(self):
        runtime = LlamaCppRuntime()
        def mismatch(req, timeout=None):
            return self.urlopen(req, timeout, model="different-model.gguf")
        with patch.dict("os.environ", self.env), patch("urllib.request.urlopen", mismatch):
            self.assertEqual(runtime.status()["state"], "stopped")
            with self.assertRaisesRegex(RuntimeError, "matching external"):
                runtime.chat([{"role":"user","content":"hello"}])
            self.assertIsNone(runtime.process)

    def test_wrong_port_does_not_adopt(self):
        runtime = LlamaCppRuntime()
        with patch.dict("os.environ", {**self.env,"LLAMA_CPP_PORT":"8089"}), patch(
            "urllib.request.urlopen", side_effect=AssertionError("wrong port must not fetch")):
            self.assertEqual(runtime.status()["state"], "stopped")

    def test_missing_model_file_does_not_adopt(self):
        runtime = LlamaCppRuntime()
        with patch.dict("os.environ", {**self.env,"LLAMA_CPP_MODEL":str(self.model)+".missing"}), patch(
            "urllib.request.urlopen", side_effect=AssertionError("missing model must not fetch")):
            self.assertEqual(runtime.status()["state"], "stopped")

    def test_unhealthy_endpoint_not_adopted(self):
        runtime = LlamaCppRuntime()
        def bad_health(req, timeout=None):
            if req.endswith("/health"):
                return Reply(obj={"status":"loading"})
            return self.urlopen(req, timeout)
        with patch.dict("os.environ", self.env), patch("urllib.request.urlopen", bad_health):
            self.assertEqual(runtime.status()["state"], "stopped")

    def test_multiple_models_requires_exact_configured_match(self):
        runtime = LlamaCppRuntime()
        def two(req, timeout=None):
            if req.endswith("/v1/models"):
                return Reply(obj={"data":[{"id":"unrelated.gguf"},{"id":"Qwen3-4B-Q4_K_M.gguf"}]})
            return self.urlopen(req, timeout)
        with patch.dict("os.environ", self.env), patch("urllib.request.urlopen", two):
            self.assertEqual(runtime.status()["state"], "ready")

    def test_unreachable_endpoint_fails_closed_and_does_not_spawn(self):
        runtime = LlamaCppRuntime()
        with patch.dict("os.environ", self.env), patch(
            "urllib.request.urlopen", side_effect=ConnectionRefusedError("offline")):
            self.assertEqual(runtime.status()["state"], "stopped")
            with self.assertRaisesRegex(RuntimeError, "matching external"):
                runtime.chat([{"role":"user","content":"hello"}])
            self.assertIsNone(runtime.process)


if __name__ == "__main__":
    unittest.main()
