#!/usr/bin/env python3
"""V8: resume REAL pretrained Qwen3-4B LoRA, using copied V5 checkpoint.

This is an operator-opt-in, bounded, strictly isolated CPU training attempt.
Original Qwen GGUF, V5 learned adapter, optimizer, and evaluation reports are
READ-ONLY; no live server or model reconfiguration is performed.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys

VERSION="fun-qwen-real-lora-resume-v8"
APPROVAL="I_APPROVE_ISOLATED_QWEN_LORA_V8_CONTINUATION"
ROOT=Path(__file__).resolve().parents[1]
TOTAL_NEW_WINDOWS=16
REQUIRED_HOST_GIB=5.3
REQUIRED_COMMIT_GIB=6.0
EXPECTED_DATA_SHA="fa59b109c325243c141ad220ad0b13d2ee690084a521437a01335e56c1258cbf"
EXPECTED_GGUF_SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
EXPECTED_V5_SHA="da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193"

def module(name, file):
    sp=importlib.util.spec_from_file_location(name, ROOT/"scripts"/file)
    obj=importlib.util.module_from_spec(sp)
    sp.loader.exec_module(obj)
    return obj

v5=module("fun_lora_v5","Run-Fun-Qwen-GGUF-Native-LoRA-V5.py")
v6=module("fun_lora_audit_v6","Audit-Fun-Qwen-Real-LoRA-V6.py")
APP=v5.APP
V5_PREFIX=APP/"candidate"/"qwen-fibonacci-smoke"
V5_LORA=Path(str(V5_PREFIX)+".lora.gguf")
V8_DIR=APP/"continuation-v8"
V8_PREFIX=V8_DIR/"qwen-fibonacci-resumed"
V8_LORA=Path(str(V8_PREFIX)+".lora.gguf")
TRAIN_FILE=APP/"fibonacci-train-30.jsonl"
TRAIN_LOG=V8_DIR/"training.log"
V5_LOG=APP/"training.log"
V5_RECEIPT=APP/"receipt.json"
TRAINER=APP/"cpu-train-build-vs2022-noasm-v1"/"bin"/"Release"/"llama-finetune.exe"


def digest(path):
    h=hashlib.sha256()
    with Path(path).open("rb") as f:
        for part in iter(lambda:f.read(1024*1024),b""):
            h.update(part)
    return h.hexdigest()

def checkpoint_paths(adapter):
    return [adapter,Path(str(adapter)+".opt"),Path(str(adapter)+".state")]

def verify_v5():
    model_hash=v5.checked_hash(v5.LIVE_GGUF,EXPECTED_GGUF_SHA)
    source=v6.inspect_adapter(V5_LORA,EXPECTED_V5_SHA)
    if source["state"]!="PASS_REAL_QWEN_LORA_B_TENSORS_LEARNED_NOT_DEPLOYED":
        raise RuntimeError("V5_LEARNED_ADAPTER_NOT_QUALIFIED")
    report=json.loads(V5_RECEIPT.read_text("utf-8"))
    if report.get("state")!="REAL_QWEN_GGUF_ADAPTER_CANDIDATE_NOT_DEPLOYED" or \
       report.get("adapter",{}).get("adapter_sha256")!=EXPECTED_V5_SHA or \
       report.get("original_qwen_gguf_sha256")!=EXPECTED_GGUF_SHA:
        raise RuntimeError("V5_RECEIPT_IDENTITY_MISMATCH")
    if b"stopped after 2 windows (--stop-after)" not in V5_LOG.read_bytes()[-500000:]:
        raise RuntimeError("V5_TWO_WINDOW_COMPLETION_NOT_VERIFIED")
    for item in checkpoint_paths(V5_LORA):
        if not item.is_file() or item.is_symlink():
            raise RuntimeError("V5_REQUIRED_RESUME_FILE_MISSING_"+item.name)
        if item.stat().st_size <= 0 or item.stat().st_size>200_000_000:
            raise RuntimeError("V5_RESUME_FILE_SIZE_UNEXPECTED_"+item.name)
    state=json.loads(Path(str(V5_LORA)+".state").read_text("utf-8"))
    if not isinstance(state,dict) or not isinstance(state.get("epoch"),int) or \
       not isinstance(state.get("datapoints_done"),int) or \
       not isinstance(state.get("lr_step"),int):
        raise RuntimeError("V5_RESUME_STATE_NOT_VALID")
    if state["epoch"]!=0 or not (1 <= state["datapoints_done"] <= 32):
        raise RuntimeError("V5_RESUME_POSITION_UNEXPECTED")
    dataset=v5.dataset_verified()
    if not TRAIN_FILE.is_file() or TRAIN_FILE.is_symlink() or TRAIN_FILE.stat().st_size>100_000:
        raise RuntimeError("ORIGINAL_TRAINING_SLICE_MISSING_OR_UNTRUSTED")
    # Verify byte identity with V5 WITHOUT creating or replacing any file
    # during either preflight or training.
    with TRAIN_FILE.open("rb") as f:
        slice_data=f.read(100_001)
    if hashlib.sha256(slice_data).hexdigest()!=EXPECTED_DATA_SHA:
        raise RuntimeError("ORIGINAL_TRAINING_SLICE_NOT_SAME_AS_V5")
    rows=[json.loads(line) for line in slice_data.decode("utf-8").splitlines()]
    if len(rows)!=30 or any(set(row)!={"messages"} for row in rows):
        raise RuntimeError("ORIGINAL_TRAINING_SLICE_STRUCTURE_INVALID")
    train_prompts={r["messages"][0]["content"] for r in dataset["train"]}
    if any(r["messages"][0]["content"] not in train_prompts for r in rows):
        raise RuntimeError("ORIGINAL_TRAINING_SLICE_NOT_TRAIN_DATA")
    slice_info={"sha256":EXPECTED_DATA_SHA,"records":len(rows)}
    if not TRAINER.is_file() or TRAINER.is_symlink():
        raise RuntimeError("ORIGINAL_PINNED_LLAMA_FINETUNE_BINARY_MISSING")
    return {"official_gguf_sha256":model_hash,
            "original_adapter_sha256":source["adapter_sha256"],
            "resume_state":state,
            "original_30_example_slice_sha256":slice_info["sha256"],
            "original_resume_files":[{"name":p.name,"bytes":p.stat().st_size,"sha256":digest(p)} for p in checkpoint_paths(V5_LORA)]}

def memory_guard():
    m=v5.memory()
    if m["host_free_gib"]<REQUIRED_HOST_GIB or m["commit_headroom_gib"]<REQUIRED_COMMIT_GIB:
        raise RuntimeError("RAEM_V8_PREFLIGHT_HOLD:host="+str(m["host_free_gib"])+" commit="+str(m["commit_headroom_gib"]))
    return m

def copy_exclusive(source,destination,expected_digest):
    if source.is_symlink() or not source.is_file() or destination.exists():
        raise RuntimeError("CHECKPOINT_SOURCE_OR_TARGET_UNSAFE")
    h=hashlib.sha256()
    with source.open("rb") as src,destination.open("xb") as dst:
        for chunk in iter(lambda:src.read(1024*1024),b""):
            dst.write(chunk)
            h.update(chunk)
    if h.hexdigest()!=expected_digest:
        raise RuntimeError("COPIED_CHECKPOINT_HASH_MISMATCH")
    return h.hexdigest()

def resume():
    check=verify_v5()
    available=memory_guard()
    if V8_DIR.exists() or V8_DIR.is_symlink():
        raise RuntimeError("V8_CONTINUATION_ALREADY_EXISTS_NO_OVERWRITE")
    if "elektron" in str(V8_DIR).lower() or not V8_DIR.parent.is_dir():
        raise RuntimeError("V8_OUTSIDE_ISOLATED_FUN_DIR")
    V8_DIR.mkdir()
    for original in check["original_resume_files"]:
        p=V5_LORA if original["name"]==V5_LORA.name else \
          Path(str(V5_LORA)+(".opt" if original["name"].endswith(".opt") else ".state"))
        target=V8_LORA if p==V5_LORA else Path(str(V8_LORA)+(".opt" if p.name.endswith(".opt") else ".state"))
        copy_exclusive(p,target,original["sha256"])
    manifest={"version":VERSION,"state":"PRETRAINING_RESUME_COPY_VERIFIED",
              "original_v5_files":check,"host_memory_before":available,
              "new_training_windows_requested":TOTAL_NEW_WINDOWS,
              "operator_approved":True,"original_files_unchanged":True,
              "adapter_not_deployed":True}
    (V8_DIR/"preflight.json").write_text(json.dumps(manifest,indent=2,sort_keys=True),encoding="utf-8")
    print("FUN_QWEN_V8_COPIED_CHECKPOINT="+json.dumps({
        "state":"VERIFIED_V5_ADAPTER_OPTIMIZER_AND_POSITION_COPIED",
        "adapter_source_sha256":EXPECTED_V5_SHA,
        "original_resume_position":check["resume_state"],
        "source_files_unchanged":True},sort_keys=True),flush=True)
    command=[str(TRAINER),"-m",str(v5.LIVE_GGUF),"-f",str(TRAIN_FILE),
             "-o",str(V8_PREFIX)+".gguf",
             "--lora-train-target",r"^blk\.35\.attn_(q|v)\.weight$",
             "--lora-train-rank","2","--lora-train-alpha","2",
             "-opt","sgd","-lr","0.0001","--epochs","1",
             "-val-split","0.1","--stop-after",str(TOTAL_NEW_WINDOWS),
             "--resume",
             "--grad-checkpoint","--reasoning","off",
             "-ngl","0","-c","128","-b","32","-ub","32",
             "-t","4","-tb","4"]
    print("FUN_QWEN_V8_REAL_RESUME=START CPU_ONLY=TRUE WINDOWS_LIMIT="+str(TOTAL_NEW_WINDOWS),flush=True)
    metrics=v5.safe_run(command,TRAIN_LOG,v5.MAX_TRAIN_SECONDS,expected_cwd=TRAINER.parent)
    log=TRAIN_LOG.read_bytes()[-1000000:]
    if not re.search(rb"--resume: 2 LoRA pairs from",log):
        raise RuntimeError("V8_TRAINER_DID_NOT_CONFIRM_CHECKPOINT_RESUME")
    stopped=b"stopped after "+str(TOTAL_NEW_WINDOWS).encode()+b" windows (--stop-after)" in log
    completed=b"wrote trained LoRA adapter to" in log
    if not stopped and not completed:
        raise RuntimeError("V8_NO_ATTESTED_STOP_OR_NATURAL_EPOCH_END")
    audit=v6.inspect_adapter(V8_LORA,expected_hash=None)
    if audit["state"]!="PASS_REAL_QWEN_LORA_B_TENSORS_LEARNED_NOT_DEPLOYED":
        raise RuntimeError("V8_NONZERO_LORA_NOT_VERIFIED")
    if audit["adapter_sha256"]==EXPECTED_V5_SHA:
        raise RuntimeError("V8_TRAINED_ADAPTER_IDENTICAL_TO_START")
    source_b=v6.inspect_adapter(V5_LORA,EXPECTED_V5_SHA)["learned_b_tensors"]
    for name, b in audit["learned_b_tensors"].items():
        prior=source_b[name]
        if abs(b["max_abs"]-prior["max_abs"])<1e-12 and abs(b["l2_norm"]-prior["l2_norm"])<1e-12:
            # A hash change could be metadata-only; B tensor changes
            # provide direct evidence of adapter learning.
            raise RuntimeError("V8_NO_MEASURABLE_B_TENSOR_CHANGE_"+name)
    # Verify the original input checkpoint triplet, original GGUF and
    # training slice remain byte-identical after the isolated child finished.
    for original in check["original_resume_files"]:
        p=V5_LORA if original["name"]==V5_LORA.name else (
            Path(str(V5_LORA)+".opt") if original["name"].endswith(".opt")
            else Path(str(V5_LORA)+".state"))
        if digest(p)!=original["sha256"]:
            raise RuntimeError("V8_ORIGINAL_CHECKPOINT_CHANGED_"+original["name"])
    if digest(v5.LIVE_GGUF)!=EXPECTED_GGUF_SHA:
        raise RuntimeError("V8_OFFICIAL_QWEN_GGUF_CHANGED")
    if digest(TRAIN_FILE)!=EXPECTED_DATA_SHA:
        raise RuntimeError("V8_ORIGINAL_TRAINING_SLICE_CHANGED")
    result={"version":VERSION,
            "state":"PASS_REAL_QWEN_LORA_V8_CONTINUED_CANDIDATE_NOT_DEPLOYED",
            "source_adapter_sha256":EXPECTED_V5_SHA,
            "new_adapter_sha256":audit["adapter_sha256"],
            "new_adapter_bytes":audit["adapter_bytes"],
            "adapter_path":str(V8_LORA),
            "actual_source_model_hash":check["official_gguf_sha256"],
            "resume_checkpoint_attested":True,
            "termination":"bounded_windows" if stopped else "natural_epoch_end",
            "additional_windows_requested_limit":TOTAL_NEW_WINDOWS,
            "candidate_has_nonzero_qv_b_tensors":True,
            "train":metrics,
            "heldout_accuracy_improved_proven":False,
            "original_qwen_gguf_changed":False,
            "original_v5_adapter_changed":False,
            "original_v7_and_v71_evaluations_changed":False,
            "auto_deployed":False,
            "next":"Run guarded paired inference on V8 candidate versus base and compare to preserved V7.1 results before any further training."
           }
    (V8_DIR/"receipt.json").write_text(json.dumps(result,sort_keys=True,indent=2),encoding="utf-8")
    print(json.dumps(result,sort_keys=True),flush=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--approve",default="")
    parser.add_argument("--check-only",action="store_true")
    a=parser.parse_args()
    if sys.platform!="win32":
        raise RuntimeError("WINDOWS_REQUIRED")
    before=verify_v5()
    ram=memory_guard()
    print("FUN_QWEN_V8_PREFLIGHT="+json.dumps({
        "state":"VERIFIED_MATCHING_RESUMABLE_V5_CHECKPOINT",
        "original_v5_sha256":before["original_adapter_sha256"],
        "source_model_sha256":before["official_gguf_sha256"],
        "resume_epoch":before["resume_state"]["epoch"],
        "resume_datapoints_done":before["resume_state"]["datapoints_done"],
        "host_free_gib":ram["host_free_gib"],
        "commit_headroom_gib":ram["commit_headroom_gib"],
        "requested_additional_windows":TOTAL_NEW_WINDOWS,
        "v5_and_v7_outputs_protected":True},sort_keys=True),flush=True)
    if a.check_only:
        return
    if a.approve != APPROVAL:
        raise RuntimeError("NEW_REAL_QWEN_TRAINING_APPROVAL_REQUIRED")
    resume()

if __name__=="__main__":
    try:
        main()
    except (OSError,RuntimeError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as e:
        print(json.dumps({"version":VERSION,"state":"HOLD_V8_REAL_QWEN_LORA_CONTINUATION_NOT_VERIFIED",
                         "reason":str(e)[:550],
                         "original_source_not_changed":True,"no_auto_deployment":True},
                         sort_keys=True),flush=True)
        sys.exit(2)
