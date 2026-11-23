#!/usr/bin/env python3
"""READ-ONLY inspection of the stranded V8 native LoRA .best / .tmp files.

A Windows std::rename destination-exists error can leave a complete trained
LoRA GGUF in *.tmp after the resumed fork successfully trained an epoch.
It may also have written a *.best file when validation improved.

Do not start, modify, copy, rename, redeploy, or train anything.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
VERSION="fun-qwen-real-lora-v8-stranded-checkpoint-audit-v8.1"
EXPECTED_ORIGINAL_ADAPTER_SHA="da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193"
EXPECTED_BASE_SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"

def load(name, file):
    spec=importlib.util.spec_from_file_location(name, ROOT/"scripts"/file)
    out=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(out)
    return out

v6=load("fun_v6_gguf_audit_recovery","Audit-Fun-Qwen-Real-LoRA-V6.py")
APP=Path(os.environ.get("LOCALAPPDATA",str(Path.home()))) / "FunIndustrial" / "QwenActualGGUFLoRAV5"
V5=APP/"candidate"/"qwen-fibonacci-smoke.lora.gguf"
BASE=Path.home()/"FunIndustrial"/".runtime"/"models"/"Qwen3-4B-Q4_K_M.gguf"
V8=APP/"continuation-v8"
PREFIX=V8/"qwen-fibonacci-resumed.lora.gguf"
LOG=V8/"training.log"
LOG_LIMIT=20_000_000
MIN_BYTES=512
MAX_BYTES=2_000_000
FILES=(
    ("best_validation",Path(str(PREFIX)+".best")),
    ("last_attempted_main_save",Path(str(PREFIX)+".tmp")),
)

def sha256(p):
    h=hashlib.sha256()
    with p.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""):
            h.update(block)
    return h.hexdigest()

def safe_file(path, minimum=MIN_BYTES, maximum=MAX_BYTES):
    if not path.is_file() or path.is_symlink():
        return False
    return minimum <= path.stat().st_size <= maximum

def analyze_candidates(base_audit, choices=FILES):
    results=[]
    for role,path in choices:
        if path.is_symlink() or (path.exists() and not path.is_file()):
            results.append({"role":role,"state":"HOLD_UNSAFE_CANDIDATE_PATH"})
            continue
        if not path.is_file():
            results.append({"role":role,"state":"NOT_FOUND"})
            continue
        if not safe_file(path):
            results.append({"role":role,"state":"HOLD_FILE_SIZE_OUTSIDE_EXPECTED_RANGE",
                            "bytes":path.stat().st_size})
            continue
        try:
            audit=v6.inspect_adapter(path,expected_hash=None)
            old=base_audit["learned_b_tensors"]
            new=audit["learned_b_tensors"]
            changed={}
            for name,stats in new.items():
                previous=old[name]
                changed[name] = (
                    abs(stats["max_abs"]-previous["max_abs"])>1e-12 or
                    abs(stats["l2_norm"]-previous["l2_norm"])>1e-12
                )
            if audit["adapter_sha256"]==EXPECTED_ORIGINAL_ADAPTER_SHA or not all(changed.values()):
                status="HOLD_ADAPTER_IDENTICAL_OR_NO_MEASURABLE_B_UPDATES"
            else:
                status="VALID_DIFFERENT_LEARNED_LORA_CANDIDATE_NOT_DEPLOYED"
            results.append({
                "role":role,"state":status,
                "path":str(path),"bytes":audit["adapter_bytes"],
                "sha256":audit["adapter_sha256"],
                "expected_qv_layers":audit["trained_targets"],
                "learned_b_tensors":new,
                "b_tensor_changed_vs_v5":changed,
            })
        except (ValueError,OSError,KeyError,TypeError) as e:
            results.append({"role":role,"state":"HOLD_GGUF_AUDIT_FAILED","reason":str(e)[:300]})
    return results

def run():
    if "elektron" in str(APP).lower() or not V8.is_dir() or V8.is_symlink():
        raise RuntimeError("ORIGINAL_FUN_V8_DIRECTORY_INVALID")
    if not safe_file(LOG,minimum=20,maximum=LOG_LIMIT):
        raise RuntimeError("V8_TRAINING_LOG_UNAVAILABLE")
    v5=v6.inspect_adapter(V5,expected_hash=EXPECTED_ORIGINAL_ADAPTER_SHA)
    if not BASE.is_file() or BASE.is_symlink() or sha256(BASE)!=EXPECTED_BASE_SHA:
        raise RuntimeError("OFFICIAL_ORIGINAL_BASE_HASH_MISMATCH")
    if not safe_file(PREFIX):
        raise RuntimeError("RESUME_SOURCE_ADAPTER_NOT_PRESENT")
    original_sha=sha256(PREFIX)
    if original_sha!=EXPECTED_ORIGINAL_ADAPTER_SHA:
        raise RuntimeError("V8_MAIN_ADAPTER_CHANGED_REVIEW_BEFORE_RECOVERY")
    body=LOG.read_bytes().decode("utf-8",errors="replace")
    markers={
      "epoch_train_64_observed": bool(re.search(r"data=0000064/0000064",body)),
      "validation_started":bool(re.search(r"val:\s*\[",body)),
      "native_adapter_save_failed": "failed to write LoRA adapter" in body,
      "native_best_saved":bool(re.search(r"best so far, saved",body)),
      "native_resume_attested":bool(re.search(r"--resume: 2 LoRA pairs from",body)),
    }
    if not markers["epoch_train_64_observed"] or not markers["validation_started"]:
        raise RuntimeError("V8_TRAIN_AND_VALIDATION_EVIDENCE_INCOMPLETE")
    if not markers["native_resume_attested"]:
        raise RuntimeError("V8_NATIVE_RESUME_NOT_ATTESTED")
    states=analyze_candidates(v5)
    qualified=[x for x in states if x["state"]=="VALID_DIFFERENT_LEARNED_LORA_CANDIDATE_NOT_DEPLOYED"]
    result={
        "version":VERSION,
        "state":"RECOVERABLE_V8_TRAINED_LORA_FOUND_NOT_DEPLOYED" if qualified else
                "HOLD_NO_VERIFIED_RECOVERABLE_ADAPTER",
        "original_model_sha256":EXPECTED_BASE_SHA,
        "original_v5_adapter_sha256":EXPECTED_ORIGINAL_ADAPTER_SHA,
        "v8_main_checkpoint_still_original":True,
        "v8_native_log_markers":markers,
        "candidates":states,
        "qualified_count":len(qualified),
        "training_restarted":False,
        "original_files_modified":False,
        "recovery_copy_performed":False,
        "auto_deployed":False,
        "fibonacci_improvement_proven":False,
        "next":"If a candidate is valid, create a separate integrity-checked recovery copy and conduct paired held-out inference; no retraining needed.",
    }
    print("FUN_QWEN_V81_READONLY_AUDIT="+json.dumps(result,sort_keys=True),flush=True)
    if not qualified:
        raise RuntimeError("NO_GGUF_RECOVERY_FILE_PROVED")

if __name__=="__main__":
    try:
        run()
    except (RuntimeError,ValueError,OSError,KeyError,TypeError) as e:
        print(json.dumps({"version":VERSION,"state":"HOLD_V8_1_RECOVERY_NOT_VERIFIED",
                         "reason":str(e)[:400],"training_restarted":False,
                         "original_files_modified":False},sort_keys=True),flush=True)
        sys.exit(2)
