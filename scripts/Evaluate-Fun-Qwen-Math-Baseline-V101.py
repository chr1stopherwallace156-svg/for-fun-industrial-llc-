#!/usr/bin/env python3
"""Fun Industrial V10.1: STRICT baseline Qwen3 mathematical decision evaluation.

Runs ONLY original official Qwen3-4B GGUF via existing pinned isolated
llama-completion CPU binary. No training, LoRA adapter, service, port, network,
package installation, changes to V10 curriculum or frozen test-set use.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

VERSION="fun-qwen-math-baseline-v10-1"
CONSENT="I_APPROVE_ISOLATED_QWEN_V101_BASELINE_EVALUATION"
ROOT=Path(__file__).resolve().parents[1]
CASES_PER_PATTERN=2
EXPECTED_CASES=14
MODEL_SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
MANIFEST_VERSION="fun-qwen-math-foundation-v10"

def load_module(name,rel):
    spec=importlib.util.spec_from_file_location(name,ROOT/"scripts"/rel)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

v10=load_module("fun_qwen_math_v10_v101","Build-Fun-Qwen-Math-Foundation-V10.py")
v7=load_module("fun_qwen_v71_baseline_v101","Evaluate-Fun-Qwen-Real-LoRA-V7.py")
v5=v7.v5
APP=v5.APP
DATA_DIR=v10.OUT
RUN=APP/"math-v10-baseline-v101"

def hash_file(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""):
            h.update(block)
    return h.hexdigest()

def verified_dataset():
    if not DATA_DIR.is_dir() or DATA_DIR.is_symlink() or "elektron" in str(DATA_DIR).lower():
        raise RuntimeError("V101_CORRECTED_V10_DATASET_NOT_FOUND_OR_UNTRUSTED")
    manifest_file=DATA_DIR/"manifest.json"
    if not manifest_file.is_file() or manifest_file.is_symlink() or manifest_file.stat().st_size>100000:
        raise RuntimeError("V101_MANIFEST_INVALID")
    manifest=json.loads(manifest_file.read_text("utf-8"))
    if manifest.get("version")!=MANIFEST_VERSION or \
       manifest.get("rows_per_split")!={"train":224,"validation":84,"test":84} or \
       manifest.get("windows")!=[3,5,8] or \
       manifest.get("math_invariants_checked")!=1568 or \
       manifest.get("training_performed") is not False:
        raise RuntimeError("V101_MANIFEST_VERSION_OR_MATH_PROOFS_INVALID")
    records={}
    source_hashes={str(manifest_file):hash_file(manifest_file)}
    for name,limit in (("train.jsonl",512000),("validation.jsonl",512000),
                       ("validation-ground-truth.jsonl",512000)):
        path=DATA_DIR/name
        entry=manifest.get("files",{}).get(name)
        if not isinstance(entry,dict) or not path.is_file() or path.is_symlink() or \
           path.stat().st_size>limit or \
           path.stat().st_size!=entry.get("bytes") or \
           hash_file(path)!=entry.get("sha256"):
            raise RuntimeError("V101_SOURCE_FILE_HASH_MISMATCH_"+name)
        records[name]=[json.loads(x) for x in path.read_text("utf-8").splitlines()]
        source_hashes[str(path)]=entry["sha256"]
    train=records["train.jsonl"]
    val=records["validation.jsonl"]
    truth=records["validation-ground-truth.jsonl"]
    if len(train)!=224 or len(val)!=84 or len(truth)!=84:
        raise RuntimeError("V101_DATASET_ROW_COUNT_MISMATCH")
    train_prompts={r["messages"][0]["content"] for r in train}
    cases=[]
    by_pattern={pattern:[] for pattern in v10.PATTERNS}
    for i,(r,g) in enumerate(zip(val,truth)):
        if set(r)!={"messages"} or len(r["messages"])!=2:
            raise RuntimeError("V101_VALIDATION_MESSAGE_FORMAT_INVALID")
        messages=r["messages"]
        if [x["role"] for x in messages]!=["user","assistant"]:
            raise RuntimeError("V101_VALIDATION_ROLES_INVALID")
        q=messages[0]["content"]
        answer=messages[1]["content"]
        if q in train_prompts or q!=g.get("question"):
            raise RuntimeError("V101_DATASET_PROMPT_LEAKAGE_OR_MISMATCH")
        m=re.search(r"window 3 = (\d+), window 5 = (\d+), window 8 = (\d+)",q)
        if not m:
            raise RuntimeError("V101_QUESTION_NUMBERS_UNPARSEABLE")
        errors={w:int(x) for w,x in zip(v10.WINDOWS,m.groups())}
        if errors != {int(w):int(n) for w,n in g.get("errors",{}).items()}:
            raise RuntimeError("V101_QUESTION_VS_ORACLE_ERRORS_DIFFER")
        pattern=tuple(g["best_windows"])
        if pattern not in by_pattern or pattern!=v10.argmin_set(errors) or \
           not v10.grade_output(errors,answer)["exact_answer"] or \
           g.get("oracle_pairwise_differences")!=v10.pairwise_differences(errors):
            raise RuntimeError("V101_MATH_ORACLE_OR_LABEL_FAILED")
        by_pattern[pattern].append({
            "id":"v10-validation-"+str(i),
            "pattern":pattern,"errors":errors,
            "prompt":q,"reference_answer":answer,
        })
    for pattern,rows in by_pattern.items():
        if len(rows)!=12:
            raise RuntimeError("V101_WINNER_PATTERN_NOT_BALANCED_"+str(pattern))
        cases.extend(rows[:CASES_PER_PATTERN])
    if len(cases)!=EXPECTED_CASES or len({x["prompt"] for x in cases})!=EXPECTED_CASES:
        raise RuntimeError("V101_BASELINE_CASE_SELECTION_UNEXPECTED")
    return {"cases":cases,"source_hashes":source_hashes,
            "patterns":[list(p) for p in v10.PATTERNS],
            "total_validation_rows_verified":len(val)}

def grade_response(case,text):
    strict=v10.grade_output(case["errors"],text)
    # A separate, explicitly limited structured-field winner-only check
    # prevents confusing a formatting failure with a mathematical error.
    partial=re.search(r"\bBEST_WINDOWS=((?:3|5|8)(?:,(?:3|5|8)){0,2})\b",text)
    extracted=None
    if partial:
        extracted=tuple(int(x) for x in partial.group(1).split(","))
        if len(extracted)!=len(set(extracted)) or extracted!=tuple(sorted(extracted)):
            extracted=None
    return {
        "oracle_best_windows":list(v10.argmin_set(case["errors"])),
        "strict_exact_answer":strict["exact_answer"],
        "strict_parse_state":strict["state"],
        "winner_set_correct":strict["winner_set_correct"],
        "proof_correct":strict.get("comparison_proof_correct"),
        "minimum_correct":strict.get("minimum_correct"),
        "tie_correct":strict.get("tie_correct"),
        "independently_parsed_best_windows":list(extracted) if extracted is not None else None,
        "partial_winner_set_correct":extracted==v10.argmin_set(case["errors"]) if extracted is not None else None,
    }

def run():
    if sys.platform!="win32":
        raise RuntimeError("V101_WINDOWS_REQUIRED")
    if RUN.exists() or RUN.is_symlink():
        raise RuntimeError("V101_EVALUATION_OUTPUT_EXISTS_NO_OVERWRITE")
    dataset=verified_dataset()
    source_model_hash=v5.checked_hash(v5.LIVE_GGUF,MODEL_SHA)
    binary=v7.inspect_existing_binary()
    if binary is None:
        raise RuntimeError("V101_EXISTING_LLAMA_COMPLETION_REQUIRED_NO_BUILD")
    memory=v7.initial_resources()
    print("FUN_QWEN_V101_INPUTS="+json.dumps({
        "state":"VERIFIED_V10_VALIDATION_AND_ORIGINAL_QWEN_GGUF",
        "dataset_validation_rows":dataset["total_validation_rows_verified"],
        "balanced_cases":len(dataset["cases"]),
        "patterns":dataset["patterns"],"model_sha256":source_model_hash,
        "host_free_gib":memory["host_free_gib"],
        "commit_headroom_gib":memory["commit_headroom_gib"],
        "training_or_deployment":False,
    },sort_keys=True),flush=True)
    RUN.mkdir()
    results=[]
    for idx,case in enumerate(dataset["cases"]):
        print("FUN_QWEN_V101_CASE="+json.dumps({
            "case_number":idx+1,"pattern":list(case["pattern"]),
            "id":case["id"],"errors":case["errors"],
        },sort_keys=True),flush=True)
        native=v7.run_case(binary,case,"baseline",RUN)
        graded=grade_response(case,native["generated_text"])
        row={
            "id":case["id"],"pattern":list(case["pattern"]),
            "errors":{str(k):v for k,v in case["errors"].items()},
            "reference":case["reference_answer"],
            "generated_text":native["generated_text"],
            "generation_sha256":native["generated_sha256"],
            "grade":graded,
        }
        results.append(row)
        print("FUN_QWEN_V101_CASE_RESULT="+json.dumps({
            "id":case["id"],"expected":graded["oracle_best_windows"],
            "structured_winners":graded["independently_parsed_best_windows"],
            "strict_exact_answer":graded["strict_exact_answer"],
            "strict_parse_state":graded["strict_parse_state"],
            "response":native["generated_text"][:500],
        },sort_keys=True),flush=True)
    if len(results)!=EXPECTED_CASES:
        raise RuntimeError("V101_INFERENCE_INCOMPLETE")
    for original,digest in dataset["source_hashes"].items():
        if hash_file(Path(original))!=digest:
            raise RuntimeError("V101_PROTECTED_CORRECTED_DATASET_CHANGED_"+Path(original).name)
    if hash_file(v5.LIVE_GGUF)!=MODEL_SHA:
        raise RuntimeError("V101_PRETRAINED_MODEL_CHANGED")
    summary={
        "version":VERSION,
        "state":"V101_ORIGINAL_QWEN_MATH_BASELINE_EVALUATED_NO_TRAINING",
        "case_count":len(results),
        "selected_split":"validation_only_frozen_test_not_opened",
        "patterns":[list(p) for p in v10.PATTERNS],
        "two_cases_per_pattern":True,
        "strict_exact_correct":sum(x["grade"]["strict_exact_answer"] for x in results),
        "strict_parsed":sum(x["grade"]["strict_parse_state"]=="PARSED" for x in results),
        "structured_winner_field_correct":sum(x["grade"]["partial_winner_set_correct"] is True for x in results),
        "structured_winner_field_present":sum(x["grade"]["independently_parsed_best_windows"] is not None for x in results),
        "strict_tie_cases_correct":sum(x["grade"]["strict_exact_answer"]
             for x in results if len(x["pattern"])>1),
        "total_tie_cases":sum(len(x["pattern"])>1 for x in results),
        "per_pattern":[{
            "expected_winners":list(p),
            "correct":sum(x["grade"]["strict_exact_answer"] for x in results if tuple(x["pattern"])==p),
            "cases":CASES_PER_PATTERN,
        } for p in v10.PATTERNS],
        "source_model_sha256":MODEL_SHA,
        "evaluation_is_not_a_training_outcome":True,
        "test_set_unopened":True,
        "original_curriculum_untouched":True,
        "live_services_untouched":True,
        "retraining_performed":False,
        "adapter_deployed":False,
        "records":results,
    }
    report=RUN/"baseline-report.json"
    with report.open("x",encoding="utf-8") as f:
        json.dump(summary,f,indent=2,sort_keys=True,ensure_ascii=False)
    print("FUN_QWEN_V101_RESULT="+json.dumps({k:v for k,v in summary.items() if k!="records"},
         sort_keys=True),flush=True)
    print("FUN_QWEN_V101_REPORT="+str(report),flush=True)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--approval",default="")
    p.add_argument("--preflight",action="store_true")
    opts=p.parse_args()
    if sys.platform!="win32":
        raise RuntimeError("V101_WINDOWS_REQUIRED")
    if not opts.preflight and opts.approval!=CONSENT:
        raise RuntimeError("V101_EXPLICIT_EVALUATION_CONSENT_REQUIRED")
    if opts.preflight:
        if RUN.exists() or RUN.is_symlink():
            raise RuntimeError("V101_EXISTING_OUTPUT_FOLDER_NO_OVERWRITE")
        ds=verified_dataset()
        if v7.inspect_existing_binary() is None:
            raise RuntimeError("V101_EXISTING_LLAMA_COMPLETION_REQUIRED_NO_BUILD")
        v5.checked_hash(v5.LIVE_GGUF,MODEL_SHA)
        ram=v7.initial_resources()
        print("FUN_QWEN_V101_PREFLIGHT="+json.dumps({
           "state":"V101_BASELINE_READY_NO_INFERENCE_STARTED",
           "selected_cases":len(ds["cases"]),
           "dataset_rows_verified":ds["total_validation_rows_verified"],
           "host_free_gib":ram["host_free_gib"],
           "commit_headroom_gib":ram["commit_headroom_gib"],
           "test_split_unopened":True,
           "files_written":False,
        },sort_keys=True),flush=True)
        return
    run()

if __name__=="__main__":
    try:
        main()
    except (OSError,RuntimeError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as exc:
        print(json.dumps({"version":VERSION,"state":"HOLD_V101_BASELINE_MATH_EVALUATION_NOT_VERIFIED",
                         "reason":str(exc)[:500],"training_performed":False,
                         "live_model_intended_unchanged":True},sort_keys=True),flush=True)
        sys.exit(2)
