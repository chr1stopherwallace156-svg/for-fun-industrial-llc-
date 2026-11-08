"""Non-memory diagnostic of installed Cognee subprocess configuration.

Calls the same bridge.setup() as remember/recall, with NO remember, recall,
search, model invocation, or REA tool calls. Cognee import may create small
logging/configuration files. Never prints memory contents or credentials.
"""
import importlib.util
import inspect
import os
from pathlib import Path
import sys
import traceback

def stage(label, action):
    print("BRIDGE_STAGE=" + label, flush=True)
    try:
        out = action()
        print("BRIDGE_STAGE_PASS=" + label, flush=True)
        return out
    except BaseException as error:
        print("BRIDGE_STAGE_HOLD=" + label + " ERROR_TYPE=" + type(error).__name__, flush=True)
        print("ERROR_DETAIL=" + str(error)[:400], flush=True)
        traceback.print_exc(limit=16)
        sys.exit(31)

def main():
    root = Path(os.environ["LOCALAPPDATA"]) / "FunIndustrial" / "CognitiveMemory"
    bridge_path = Path(__file__).resolve().parent / "memory_bridge.py"
    print("MODE=NO_MEMORY_OPERATION NO_REA_TOOLS NO_MODEL_REQUESTS", flush=True)
    print("COGNEE_VERSION_TARGET=1.6.7", flush=True)
    print("EXISTING_BRIDGE_FILE=" + str(bridge_path.is_file()).lower(), flush=True)
    print("ISOLATED_ROOT=" + str(root), flush=True)
    spec = stage("bridge_module_spec",lambda:importlib.util.spec_from_file_location("fun_industrial_memory_bridge", str(bridge_path)))
    module = importlib.util.module_from_spec(spec)
    stage("load_bridge_module",lambda:spec.loader.exec_module(module))
    import importlib.metadata
    print("INSTALLED_COGNEE=" + importlib.metadata.version("cognee"), flush=True)
    c = stage("bridge_setup",module.setup)
    print("REMEMBER_API_SIGNATURE=" + str(inspect.signature(c.remember))[:850], flush=True)
    print("RECALL_API_SIGNATURE=" + str(inspect.signature(c.recall))[:850], flush=True)
    print("BRIDGE_DIAGNOSTIC=PASS NO_REMEMBER_OR_RECALL_EXECUTED",flush=True)

if __name__ == "__main__":
    try:main()
    except BaseException as error:
        print("BRIDGE_DIAGNOSTIC=HOLD ERROR_TYPE="+type(error).__name__,flush=True)
        print("ERROR_DETAIL="+str(error)[:400],flush=True)
        traceback.print_exc(limit=16)
        sys.exit(32)
