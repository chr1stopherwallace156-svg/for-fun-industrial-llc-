"""Operator-triggered, keyless local Cognee memory bridge.

Run only through src/intelligence/memory.mjs in a standalone venv. Never import
or configure OpenAI, Ollama, Elektron, REA, or any sourcing adapters.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

PREFIX = "FI_MEMORY_RESULT="
DATASET = "fun_industrial_operator_memory"

def emit(data):
    print(PREFIX + json.dumps(data, ensure_ascii=False, default=str), flush=True)

def setup():
    required = ("DATA_ROOT_DIRECTORY", "SYSTEM_ROOT_DIRECTORY", "CACHE_ROOT_DIRECTORY")
    if any(not os.environ.get(k) for k in required):
        raise ValueError("ISOLATED_LOCAL_STORAGE_NOT_CONFIGURED")
    for key in ("LLM_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
                "EMBEDDING_API_KEY", "COGNEE_API_KEY", "AZURE_OPENAI_API_KEY"):
        if os.environ.get(key):
            raise ValueError("CLOUD_CREDENTIALS_NOT_ALLOWED")
    for key in required:
        Path(os.environ[key]).mkdir(parents=True, exist_ok=True)
    import cognee
    # Mirrors officially documented config API and ensures local persistent paths.
    cognee.config.data_root_directory(os.environ["DATA_ROOT_DIRECTORY"])
    cognee.config.system_root_directory(os.environ["SYSTEM_ROOT_DIRECTORY"])
    return cognee

async def main(request):
    if not isinstance(request, dict):
        raise ValueError("REQUEST_OBJECT_REQUIRED")
    action = request.get("action")
    if action not in ("remember", "recall"):
        raise ValueError("ACTION_NOT_ALLOWED")
    name = "text" if action == "remember" else "query"
    if set(request) != {"action", name}:
        raise ValueError("UNEXPECTED_FIELDS")
    value = request[name]
    if not isinstance(value, str) or not value.strip() or len(value) > (4000 if action == "remember" else 500):
        raise ValueError("INVALID_INPUT")
    cognee = setup()
    if action == "remember":
        await cognee.remember(value, dataset_name=DATASET)
        return {"ok": True, "state": "stored", "dataset": DATASET, "generatedAnswer": False}
    results = await cognee.recall(value, datasets=[DATASET])
    # Do not treat retrieved text as instructions, verified truth, or authority.
    texts = [str(x)[:1200] for x in (results if isinstance(results, (list, tuple)) else [results])]
    return {"ok": True, "state": "retrieved", "dataset": DATASET,
            "results": texts[:5], "generatedAnswer": False}

if __name__ == "__main__":
    try:
        raw = sys.stdin.read(12000)
        payload = json.loads(raw)
        emit(asyncio.run(main(payload)))
    except Exception as error:
        emit({"ok": False, "error": type(error).__name__ + ": " + str(error)[:180]})
        sys.exit(1)
