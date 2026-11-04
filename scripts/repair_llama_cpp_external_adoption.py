#!/usr/bin/env python
"""Safely patch Fun Industrial's llama.cpp adapter to adopt its verified local server.

Run from the FunIndustrial repository root:
  .\.venv\Scripts\python.exe .\scripts\repair_llama_cpp_external_adoption.py

This edits only ai_ml/llama_runtime.py and creates a timestamped backup.
It never starts, stops, signals, or reconfigures any running process.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "ai_ml" / "llama_runtime.py"
ENV_FILE = ROOT / ".env"


def fail(message: str) -> None:
    raise SystemExit("REPAIR=HOLD " + message)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        fail(f"{label}: expected exactly one source match, found {count}; no changes written")
    return source.replace(old, new, 1)


def replace_block(source: str, start: str, end: str, replacement: str, label: str) -> str:
    if source.count(start) != 1 or source.count(end) != 1:
        fail(f"{label}: source boundary mismatch; no changes written")
    a = source.index(start)
    b = source.index(end, a)
    if b <= a:
        fail(f"{label}: invalid source boundaries; no changes written")
    return source[:a] + replacement + source[b:]


def main() -> int:
    if not TARGET.is_file() or not (ROOT / "ai_ml" / "api.py").is_file():
        fail("run this script from its cloned FunIndustrial repository")
    original = TARGET.read_text(encoding="utf-8")
    if "def _adopt_external(self, model, port):" in original:
        print("REPAIR=ALREADY_APPLIED")
        compile(original, str(TARGET), "exec")
        print("SOURCE_COMPILE=PASS")
        return 0
    required = [
        "class LlamaCppRuntime:",
        "    def start_configured(self):",
        "    def start(self,",
        "    def chat(self,",
        "    def status(self):",
        "    def stop(self):",
    ]
    for marker in required:
        if original.count(marker) != 1:
            fail(f"unexpected source version at {marker!r}; no changes written")

    source = original
    helper = '''
def _load_local_settings():
    """Read only local llama settings from .env without overriding process env."""
    env_file = Path(__file__).resolve().parents[1] / ".env"
    allowed = {
        "LLAMA_CPP_SERVER", "LLAMA_CPP_MODEL", "LLAMA_CPP_PORT",
        "LLAMA_CPP_THREADS", "LLAMA_CPP_CONTEXT", "FUN_INDUSTRIAL_RUNTIME",
    }
    if not env_file.is_file():
        return
    for raw in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if key not in allowed or key in os.environ:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        os.environ[key] = value


'''
    source = replace_once(source, "class LlamaCppRuntime:\n", helper + "class LlamaCppRuntime:\n", "settings loader")
    source = replace_once(
        source,
        "self.process=None; self.model_path=None; self.endpoint=None; self.log_handle=None",
        "self.process=None; self.model_path=None; self.endpoint=None; self.log_handle=None; self.external=False",
        "external ownership state",
    )

    configured = '''    def start_configured(self):
        _load_local_settings()
        executable = os.environ.get("LLAMA_CPP_SERVER", "").strip()
        model = os.environ.get("LLAMA_CPP_MODEL", "").strip()
        port = int(os.environ.get("LLAMA_CPP_PORT", "8088"))
        threads = int(os.environ.get("LLAMA_CPP_THREADS", "4"))
        context = int(os.environ.get("LLAMA_CPP_CONTEXT", "2048"))
        if not executable or not model:
            raise ValueError("Set LLAMA_CPP_SERVER and LLAMA_CPP_MODEL to locally installed files first")
        binary = Path(executable).expanduser().resolve()
        model_file = Path(model).expanduser().resolve()
        if not binary.is_file() or not model_file.is_file():
            raise FileNotFoundError("local llama-server executable and GGUF model are required")
        adopted = self._adopt_external(model_file, port)
        if adopted:
            return adopted
        return self.start(executable, model, port=port, threads=threads, context=context)

'''
    source = replace_block(source, "    def start_configured(self):", "    def start(self,", configured, "configured startup")

    adopter = '''    def _adopt_external(self, model, port):
        self.endpoint = f"http://127.0.0.1:{port}"
        if not self._health():
            return None
        try:
            with urllib.request.urlopen(self.endpoint + "/v1/models", timeout=3) as response:
                data = json.loads(response.read(1_000_000))
        except (OSError, urllib.error.URLError, ValueError) as exc:
            raise RuntimeError("Healthy server found, but model identity could not be verified") from exc
        expected = os.path.normcase(os.path.abspath(str(model)))
        reported = []
        for item in data.get("data", []):
            if isinstance(item, dict):
                reported.extend([item.get("id"), item.get("name"), item.get("model")])
        for item in data.get("models", []):
            if isinstance(item, dict):
                reported.extend([item.get("name"), item.get("model")])
        matches = any(
            isinstance(value, str) and os.path.normcase(os.path.abspath(value)) == expected
            for value in reported if value
        )
        if not matches:
            raise RuntimeError("Server model does not match LLAMA_CPP_MODEL; refusing adoption")
        self.model_path = str(model)
        self.external = True
        return {
            "state": "ready", "managed": False, "ownership": "external",
            "host": "127.0.0.1", "port": port,
            "model_path": self.model_path, "device": "cpu",
        }

'''
    source = replace_once(source, "    def start_configured(self):", adopter + "    def start_configured(self):", "external adoption method")

    source = replace_once(
        source,
        'self.endpoint=f"http://127.0.0.1:{port}"\n        if self._health():raise RuntimeError("another llama.cpp server already owns the configured port")',
        'self.endpoint=f"http://127.0.0.1:{port}"\n        if self._health():raise RuntimeError("another llama.cpp server already owns the configured port")\n        self.external=False',
        "controller ownership marker",
    )
    source = replace_once(
        source,
        'if self._health():return {"state":"ready","pid":self.process.pid,',
        'if self._health():return {"state":"ready","managed":True,"ownership":"controller","pid":self.process.pid,',
        "controller status response",
    )
    source = replace_once(
        source,
        '        if not self._health():raise RuntimeError("local model is not ready")',
        '        state = self.status()\n        if state.get("state") != "ready" or not self._health():raise RuntimeError("local model is not ready")',
        "chat readiness initialization",
    )

    tail = '''    def status(self):
        _load_local_settings()
        if self.process is None:
            executable = os.environ.get("LLAMA_CPP_SERVER", "").strip()
            model = os.environ.get("LLAMA_CPP_MODEL", "").strip()
            if not executable or not model:
                return {"state": "not-configured"}
            port = int(os.environ.get("LLAMA_CPP_PORT", "8088"))
            adopted = self._adopt_external(Path(model).expanduser().resolve(), port)
            return adopted or {
                "state": "stopped", "managed": False,
                "model_path": model, "endpoint": self.endpoint,
            }
        code = self.process.poll()
        ready = code is None and self._health()
        return {
            "state": "ready" if ready else "exited" if code is not None else "loading",
            "managed": True, "ownership": "controller",
            "pid": self.process.pid, "exit_code": code,
            "model_path": self.model_path, "endpoint": self.endpoint, "device": "cpu",
        }

    def stop(self):
        if self.external:
            return {
                "state": "externally-managed", "managed": False,
                "detail": "Verified external llama.cpp server left running.",
            }
        if self.process is None:
            return {"state": "not-running"}
        if self.process.poll() is not None:
            if self.log_handle:
                self.log_handle.close()
                self.log_handle = None
            return {"state": "already-exited"}
        self.process.terminate()
        try:
            self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)
        if self.log_handle:
            self.log_handle.close()
            self.log_handle = None
        return {"state": "stopped", "managed": True}
'''
    source = replace_block(source, "    def status(self):", "    def stop(self):", tail, "status and stop methods")
    compile(source, str(TARGET), "exec")

    if not ENV_FILE.is_file():
        fail(".env is missing; source was not changed")
    env_values = {}
    for raw in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        if "=" in raw and not raw.lstrip().startswith("#"):
            key, value = raw.split("=", 1)
            env_values[key.strip()] = value.strip().strip("'\"")
    for key in ("LLAMA_CPP_SERVER", "LLAMA_CPP_MODEL"):
        value = env_values.get(key, "")
        if not value or not Path(value).is_file():
            fail(f"{key} is missing or its local file does not exist; source was not changed")

    backup_dir = ROOT / ".runtime" / "backups" / (
        "pre-external-adoption-" + datetime.now().strftime("%Y%m%d-%H%M%S")
    )
    backup_dir.mkdir(parents=True, exist_ok=False)
    backup = backup_dir / TARGET.name
    backup.write_text(original, encoding="utf-8")
    TARGET.write_text(source, encoding="utf-8", newline="\n")

    print("BACKUP=" + str(backup))
    print("PATCH=APPLIED")
    print("PATCH_SCOPE=ai_ml/llama_runtime.py")
    print("PROCESS_ACTIONS=NONE")
    print("SOURCE_COMPILE=PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
