"""Import-only Cognee health check. Never remembers, recalls or downloads models.

Run via the existing dedicated Windows Python 3.12 venv:
    python.exe -I cognee\probe_local.py

The caller sets FI_COGNEE_ROOT to the existing isolated CognitiveMemory root.
"""
import importlib.metadata
import os
import sys
import traceback
from pathlib import Path

KEYS = (
    "LLM_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
    "EMBEDDING_API_KEY", "COGNEE_API_KEY", "AZURE_OPENAI_API_KEY",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
)

def local_environment(root):
    root = Path(root).resolve()
    if not root.is_absolute() or root.name.lower() != "cognitivememory":
        raise ValueError("UNEXPECTED_COGNEE_ROOT")
    empty_file = root / "cognee-isolated.env"
    root.mkdir(parents=True, exist_ok=True)
    if not empty_file.exists():
        empty_file.touch()
    elif empty_file.read_bytes():
        raise ValueError("COGNEE_ISOLATED_ENV_MUST_BE_EMPTY")
    paths = {
        "COGNEE_ENV_FILE": empty_file,
        "DATA_ROOT_DIRECTORY": root / "storage" / "data",
        "SYSTEM_ROOT_DIRECTORY": root / "storage" / "system",
        "CACHE_ROOT_DIRECTORY": root / "cache",
        "HF_HOME": root / "cache" / "huggingface",
        "FASTEMBED_CACHE_PATH": root / "cache" / "fastembed",
        "COGNEE_LOGS_DIR": root / "logs",
        "DLT_DATA_DIR": root / "dlt",
    }
    for key, path in paths.items():
        if key != "COGNEE_ENV_FILE":
            path.mkdir(parents=True, exist_ok=True)
        os.environ[key] = str(path)
    for name in KEYS:
        os.environ.pop(name, None)
    return paths

def main():
    root = os.environ.get("FI_COGNEE_ROOT")
    if not root:
        raise ValueError("FI_COGNEE_ROOT_REQUIRED")
    paths = local_environment(root)
    version = importlib.metadata.version("cognee")
    if version != "1.6.7":
        raise RuntimeError("COGNEE_VERSION_MISMATCH:" + version)
    for package in ("fastembed", "gliner2"):
        print("COGNEE_PACKAGE=" + package + " VERSION=" + importlib.metadata.version(package), flush=True)
    import cognee
    cognee.config.data_root_directory(str(paths["DATA_ROOT_DIRECTORY"]))
    cognee.config.system_root_directory(str(paths["SYSTEM_ROOT_DIRECTORY"]))
    data_path = Path(cognee.config.get("data_root_directory")).resolve()
    system_path = Path(cognee.config.get("system_root_directory")).resolve()
    if data_path != paths["DATA_ROOT_DIRECTORY"] or system_path != paths["SYSTEM_ROOT_DIRECTORY"]:
        raise RuntimeError("COGNEE_STORAGE_ISOLATION_FAILED")
    print("COGNEE_IMPORT=PASS VERSION=" + version, flush=True)
    print("COGNEE_STORAGE_ISOLATED=PASS ROOT=" + str(Path(root).resolve()), flush=True)
    print("COGNEE_MODEL_DOWNLOADS=NOT_PERFORMED MEMORY_WRITES=0", flush=True)

if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        print("COGNEE_IMPORT=HOLD ERROR=" + type(error).__name__ + ": " + str(error)[:300], flush=True)
        traceback.print_exc(limit=18)
        sys.exit(47)
