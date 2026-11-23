#!/usr/bin/env python3
"""V7 paired base-versus-LoRA inference on REAL pretrained Qwen3-4B GGUF.

Runs one CPU model at a time in a separate local subprocess. Read-only
evaluation: NEVER trains/edits models, starts the live server, uses ports,
installs packages, or deploys adapters. Produces explicit non-claiming evidence.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import time

VERSION="fun-real-qwen-base-vs-lora-inference-v7"
ROOT=Path(__file__).resolve().parents[1]
CONSENT="I_APPROVE_ISOLATED_QWEN_BASE_ADAPTER_EVALUATION"
MAX_CASES=3
MAX_GENERATION_TOKENS=96
MAX_CHILD_SECONDS=300
MIN_HOST_FREE_GIB=4.3
MIN_COMMIT_HEADROOM_GIB=4.0
WIN="\x1b"
ANSI=re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")

def load_module(name, path):
    spec=importlib.util.spec_from_file_location(name,ROOT/"scripts"/path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

v5=load_module("qwen_gguf_native_v5","Run-Fun-Qwen-GGUF-Native-LoRA-V5.py")
v6=load_module("qwen_gguf_audit_v6","Audit-Fun-Qwen-Real-LoRA-V6.py")
APP=v5.APP
MODEL=v5.LIVE_GGUF
ADAPTER=APP/"candidate"/"qwen-fibonacci-smoke.lora.gguf"
RECEIPT=APP/"receipt.json"
TRAINING_LOG=APP/"training.log"
BUILD=APP/"cpu-train-build-vs2022-noasm-v1"
RUN_DIR=APP/"evaluation-v7"
EXPECTED_TRAINING_SHA=v6.EXPECTED_ADAPTER_SHA
GENERATION_SEED=6427

def verify_inputs():
    model_sha=v5.checked_hash(MODEL,v5.EXPECTED_GGUF_SHA)
    audit=v6.inspect_adapter(ADAPTER,EXPECTED_TRAINING_SHA)
    if audit["state"]!="PASS_REAL_QWEN_LORA_B_TENSORS_LEARNED_NOT_DEPLOYED":
        raise RuntimeError("LEARNED_ADAPTER_TENSORS_NOT_VERIFIED")
    receipt=json.loads(RECEIPT.read_text("utf-8"))
    if receipt.get("state")!="REAL_QWEN_GGUF_ADAPTER_CANDIDATE_NOT_DEPLOYED" or \
       receipt.get("adapter",{}).get("adapter_sha256")!=EXPECTED_TRAINING_SHA:
        raise RuntimeError("V5_TRAINING_RECEIPT_NOT_VERIFIED")
    if b"stopped after 2 windows (--stop-after)" not in TRAINING_LOG.read_bytes()[-500000:]:
        raise RuntimeError("TWO_TRAINING_WINDOWS_NOT_ATTESTED")
    rows=v5.dataset_verified()["validation"]
    selections={}
    for family in ("recurrence","meta_selection"):
        candidates=[r for r in rows if r["family"]==family]
        if not candidates:
            raise RuntimeError("HELDOUT_FAMILY_MISSING_"+family)
        example=candidates[0]
        selections[family]=example
    cases=[
        {"id":"heldout-recurrence","kind":"heldout_fibonacci",
         "prompt":selections["recurrence"]["messages"][0]["content"],
         "reference_answer":selections["recurrence"]["messages"][1]["content"]},
        {"id":"heldout-model-selection","kind":"heldout_meta_selection",
         "prompt":selections["meta_selection"]["messages"][0]["content"],
         "reference_answer":selections["meta_selection"]["messages"][1]["content"]},
        {"id":"general-control","kind":"non_fibonacci_control",
         "prompt":"What is the capital city of Japan? Reply with just the city name.",
         "reference_answer":"Tokyo"},
    ]
    if len(cases)!=MAX_CASES or len({x["prompt"] for x in cases})!=len(cases):
        raise RuntimeError("EVALUATION_CASES_INVALID")
    train_set={r["messages"][0]["content"] for r in v5.dataset_verified()["train"]}
    if any(x["prompt"] in train_set for x in cases):
        raise RuntimeError("HELDOUT_PROMPT_IN_TRAINING_DATA")
    return {"model_sha256":model_sha,"adapter_sha256":audit["adapter_sha256"],
            "cases":cases}

def inspect_existing_binary():
    bins=list(BUILD.glob("**/llama-completion.exe")) if BUILD.is_dir() else []
    bins=[b for b in bins if b.is_file() and not b.is_symlink()]
    if len(bins)>1:
        raise RuntimeError("MULTIPLE_EVALUATION_BINARIES_REQUIRE_REVIEW")
    return bins[0] if bins else None

def ensure_binary():
    if not BUILD.is_dir() or not (BUILD/"CMakeCache.txt").is_file():
        raise RuntimeError("PINNED_V5_BUILD_CONFIGURATION_NOT_FOUND")
    # Validate the pinned original and overlay before executing build.
    source=v5.prepare_source(APP)
    v5.prepare_msvc_noasm_overlay(APP,source)
    binary=inspect_existing_binary()
    if binary:
        return binary
    v5.requirements()
    log=v5.fresh_log(APP,"cmake-build-completion-v7")
    v5.safe_run(["cmake","--build",str(BUILD),"--config","Release",
                 "--target","llama-completion","--parallel","2"],
                log,v5.MAX_BUILD_SECONDS,expected_cwd=APP)
    binary=inspect_existing_binary()
    if not binary:
        raise RuntimeError("EVALUATION_BINARY_NOT_FOUND_AFTER_BUILD")
    return binary

def initial_resources():
    m=v5.memory()
    if m["host_free_gib"] < MIN_HOST_FREE_GIB or \
       m["commit_headroom_gib"] < MIN_COMMIT_HEADROOM_GIB:
        raise RuntimeError("RAEM_EVALUATION_MEMORY_HOLD:host="+str(m["host_free_gib"])+
                           " commit="+str(m["commit_headroom_gib"]))
    return m

def run_case(binary, case, mode, output_root):
    if mode not in ("baseline","adapter"):
        raise RuntimeError("INVALID_MODE")
    initial_resources()
    log_base=output_root/(case["id"]+"--"+mode)
    stdout_file=Path(str(log_base)+".stdout.txt")
    stderr_file=Path(str(log_base)+".stderr.txt")
    if stdout_file.exists() or stderr_file.exists():
        raise RuntimeError("EVALUATION_LOG_EXISTS_NO_OVERWRITE_"+case["id"]+"_"+mode)
    cmd=[str(binary),"-m",str(MODEL),
         "-cnv","-st","--reasoning","off",
         "-p",case["prompt"],"--no-display-prompt","--simple-io",
         "-n",str(MAX_GENERATION_TOKENS),"--temp","0",
         "--seed",str(GENERATION_SEED),
         "-ngl","0","-c","512","-b","128","-ub","128","-t","4"]
    if mode=="adapter":
        cmd+=["--lora",str(ADAPTER)]
    start=time.monotonic()
    with stdout_file.open("xb") as out,stderr_file.open("xb") as err:
        proc=subprocess.Popen(cmd,cwd=binary.parent,stdout=out,stderr=err,
                              stdin=subprocess.DEVNULL,
                              creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        stop=None
        peak_child_commit=0.0
        while proc.poll() is None:
            m=v5.memory()
            c=v5.private_commit_gib(proc.pid)
            if c is not None:
                peak_child_commit=max(peak_child_commit,c)
            if m["host_free_gib"]<v5.KILL_HOST_FREE_GIB:
                stop="HOST_RAM_RESERVE_CROSSED"
            if m["commit_headroom_gib"]<v5.KILL_COMMIT_HEADROOM_GIB:
                stop="COMMIT_RESERVE_CROSSED"
            if c is not None and c>v5.MAX_CHILD_PRIVATE_COMMIT_GIB:
                stop="EVALUATION_PRIVATE_COMMIT_LIMIT"
            if time.monotonic()-start>MAX_CHILD_SECONDS:
                stop="EVALUATION_TIME_BUDGET_REACHED"
            if stop:
                subprocess.run(["taskkill","/PID",str(proc.pid),"/T","/F"],
                               stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                               timeout=15,check=False)
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()
                raise RuntimeError(stop+" case="+case["id"]+" mode="+mode)
            time.sleep(0.5)
        if proc.returncode!=0:
            raise RuntimeError("EVAL_CHILD_EXIT_"+str(proc.returncode)+
                               " case="+case["id"]+" mode="+mode)
    std=stdout_file.read_text("utf-8",errors="replace")
    stderr=stderr_file.read_text("utf-8",errors="replace")
    if mode=="adapter":
        # Fork's llama_adapter_lora_init_impl logs a successful tensor load.
        if "loaded 4 tensors from lora file" not in stderr:
            raise RuntimeError("LORA_LOAD_NOT_VERIFIED_IN_NATIVE_STDERR_"+case["id"])
        if ADAPTER.name.lower() not in stderr.lower():
            raise RuntimeError("LORA_EXPECTED_PATH_NOT_FOUND_IN_NATIVE_STDERR")
    else:
        if "loaded 4 tensors from lora file" in stderr:
            raise RuntimeError("BASELINE_UNEXPECTEDLY_LOADED_LORA")
    generated=ANSI.sub("",std)
    generated=generated.replace(" [end of text]","").strip()
    if not generated:
        raise RuntimeError("NO_GENERATED_TEXT_"+case["id"]+"_"+mode)
    if len(generated)>15000:
        raise RuntimeError("UNEXPECTED_EVAL_OUTPUT_SIZE")
    return {
        "mode":mode,"case":case["id"],"elapsed_seconds":round(time.monotonic()-start,3),
        "peak_child_private_commit_gib_observed":peak_child_commit,
        "stdout_log":str(stdout_file),"stderr_log":str(stderr_file),
        "adapter_load_attested": mode=="adapter",
        "generated_text":generated[:4000],
        "generated_sha256":hashlib.sha256(generated.encode("utf-8")).hexdigest(),
        "max_generated_tokens":MAX_GENERATION_TOKENS
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--approve",default="")
    a=p.parse_args()
    if sys.platform!="win32":
        raise RuntimeError("WINDOWS_REQUIRED")
    if a.approve!=CONSENT:
        raise RuntimeError("EXPLICIT_ISOLATED_EVALUATION_APPROVAL_REQUIRED")
    evidence=verify_inputs()
    resources=initial_resources()
    if RUN_DIR.exists():
        raise RuntimeError("EVALUATION_OUTPUT_EXISTS_NO_OVERWRITE")
    RUN_DIR.mkdir(parents=True)
    print("FUN_QWEN_V7_INPUTS="+json.dumps({
        "state":"VERIFIED_REAL_QWEN_GGUF_AND_LEARNED_LORA",
        "model_sha256":evidence["model_sha256"],
        "adapter_sha256":evidence["adapter_sha256"],
        "host_free_gib":resources["host_free_gib"],
        "commit_headroom_gib":resources["commit_headroom_gib"],
        "cases":len(evidence["cases"]),
        "live_server_changes":False,"network_access":False},sort_keys=True),flush=True)
    binary=ensure_binary()
    print("FUN_QWEN_V7_EVALUATION_BINARY="+str(binary),flush=True)
    records=[]
    for case in evidence["cases"]:
        print("FUN_QWEN_V7_CASE="+case["id"],flush=True)
        base=run_case(binary,case,"baseline",RUN_DIR)
        adapted=run_case(binary,case,"adapter",RUN_DIR)
        records.append({
            "id":case["id"],"kind":case["kind"],"prompt":case["prompt"],
            "reference_answer":case["reference_answer"],
            "baseline":base,
            "adapter":adapted,
            "exact_generated_text_changed":base["generated_sha256"]!=adapted["generated_sha256"]
        })
        print("FUN_QWEN_V7_CASE_RESULT="+json.dumps({
            "id":case["id"],"baseline_response":base["generated_text"],
            "adapter_response":adapted["generated_text"],
            "exact_generated_text_changed":records[-1]["exact_generated_text_changed"]},
            sort_keys=True),flush=True)
    if len(records)!=MAX_CASES:
        raise RuntimeError("INCOMPLETE_EVALUATION_CASE_SET")
    changed=sum(x["exact_generated_text_changed"] for x in records)
    report={
        "version":VERSION,
        "state":"PAIRED_BASE_VS_TRAINED_LORA_INFERENCE_COMPLETE_NOT_DEPLOYED",
        "model_sha256":evidence["model_sha256"],
        "adapter_sha256":evidence["adapter_sha256"],
        "case_count":len(records),
        "cases_with_exact_text_difference":changed,
        "unchanged_response_count":len(records)-changed,
        "sampling_temperature":0,"sampling_seed":GENERATION_SEED,
        "max_generation_tokens":MAX_GENERATION_TOKENS,
        "result_qualification":"Observed text differences (or lack thereof) are not a measure of improved factual accuracy.",
        "fibonacci_generalization_or_improvement_proven":False,
        "full_curriculum_training_done":False,
        "original_model_changed":False,
        "live_services_restarted":False,
        "adapter_auto_deployed":False,
        "records":records
    }
    out=RUN_DIR/"evaluation-report.json"
    with out.open("x",encoding="utf-8") as f:
        json.dump(report,f,indent=2,sort_keys=True,ensure_ascii=False)
    print("FUN_QWEN_V7_RESULT="+json.dumps({k:v for k,v in report.items() if k!="records"},
           sort_keys=True),flush=True)
    print("FUN_QWEN_V7_REPORT="+str(out),flush=True)

if __name__=="__main__":
    try:
        main()
    except (RuntimeError,ValueError,OSError,KeyError,subprocess.SubprocessError) as e:
        print(json.dumps({"version":VERSION,"state":"HOLD_PAIRED_QWEN_INFERENCE_NOT_VERIFIED",
                          "reason":str(e)[:520],"original_model_changed":False,
                          "auto_deployment_requested":False},sort_keys=True),flush=True)
        sys.exit(2)
