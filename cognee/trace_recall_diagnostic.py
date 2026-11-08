"""Diagnose the exact deployed Cognee recall, without memory writes.

Invokes the same Python library, dataset, query and arguments as the existing
memory bridge, but outside the HTTP server. Do NOT log retrieved data or secrets.
Cognee may download local model weights and create caches during recall.
"""
import asyncio
import importlib.util
import inspect
import os
from pathlib import Path
import sys
import traceback

DATASET = "fun_industrial_operator_memory"
QUERY = "Fun Industrial requires operator approval before executing external tools."

def notice(s):
    print(s, flush=True)

def main():
    expected = (
        Path(os.environ["USERPROFILE"]).resolve()
        / "FunIndustrial-REA-MCP-Activation" / "cognee" / "memory_bridge.py"
    ).resolve()
    if not expected.is_file():
        raise RuntimeError("DEPLOYED_BRIDGE_NOT_FOUND")
    notice("DIRECT_RECALL=START MEMORY_WRITE=NO REA_CALLS=NO")
    notice("LOCAL_MODEL_WEIGHTS_MAY_BE_DOWNLOADED=TRUE")
    spec = importlib.util.spec_from_file_location("fun_cognee_bridge_diagnostic", str(expected))
    if spec is None or spec.loader is None:
        raise RuntimeError("BRIDGE_MODULE_SPEC_INVALID")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    notice("BRIDGE_IMPORT=PASS")
    cognee = module.setup()
    notice("BRIDGE_SETUP=PASS")
    kwargs = {"datasets": [DATASET], "top_k": 5, "only_context": True}
    inspect.signature(cognee.recall).bind(QUERY, **kwargs)
    notice("RECALL_SIGNATURE_BIND=PASS")
    # No call to remember() or other mutating application endpoint.
    try:
        result = asyncio.run(asyncio.wait_for(cognee.recall(QUERY, **kwargs), timeout=180))
    except Exception as error:
        notice("RECALL_DIRECT=HOLD")
        notice("EXCEPTION_TYPE=" + type(error).__name__)
        notice("EXCEPTION_DETAIL=" + str(error)[:650])
        traceback.print_exc(limit=22)
        return 12
    count = len(result) if isinstance(result, (list, tuple)) else (0 if result is None else 1)
    notice("RECALL_DIRECT=PASS RESULT_COUNT=" + str(count))
    notice("MEMORY_CONTENT_NOT_PRINTED")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        notice("DIRECT_RECALL_DIAGNOSTIC=HOLD")
        notice("EXCEPTION_TYPE=" + type(error).__name__)
        notice("EXCEPTION_DETAIL=" + str(error)[:650])
        traceback.print_exc(limit=22)
        sys.exit(13)
