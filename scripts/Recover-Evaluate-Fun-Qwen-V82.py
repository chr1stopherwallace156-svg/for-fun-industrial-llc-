#!/usr/bin/env python3
"""Fun Industrial V8.2: preserve recovered real Qwen adapter; compare base/V5/V8.

Explicit approval required. Does NO training, networking, installation,
server start/stop, live-model edits, or Elektron operations. Runs bounded,
sequential CPU inference using the existing isolated pinned llama-completion.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

VERSION="fun-qwen-v8-recovery-three-way-evaluation-v8.2"
APPROVAL="I_APPROVE_ISOLATED_QWEN_V82_RECOVERY_EVALUATION"
V8_SHA="05efce40082eee0815decc4c21f74150c612adbb2e88fb2149c9c4dd951f7240"
V5_SHA="da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193"
MODEL_SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
NUM_CASES=6
ROOT=Path(__file__).resolve().parents[1]

def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/"scripts"/file)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

v7=load("fun_v71_threeway","Evaluate-Fun-Qwen-Real-LoRA-V7.py")
v6=load("fun_v6_threeway","Audit-Fun-Qwen-Real-LoRA-V6.py")
v81=load("fun_v81_threeway","Audit-Fun-Qwen-V8-Recovery-V81.py")
v5=v7.v5

APP=v5.APP
ORIGINAL_V5=APP/"candidate"/"qwen-fibonacci-smoke.lora.gguf"
V8_MAIN=APP/"continuation-v8"/"qwen-fibonacci-resumed.lora.gguf"
V8_BEST=Path(str(V8_MAIN)+".best")
V8_TEMP=Path(str(V8_MAIN)+".tmp")
V8_LOG=APP/"continuation-v8"/"training.log"
RUN_ROOT=APP/"recovery-evaluation-v82"
RECOVERED=RUN_ROOT/"qwen-v8-validated-recovery.lora.gguf"

def digest(p):
    return v81.sha256(p)

def verify_checkpoint_inputs():
    if sys.platform!="win32":
        raise RuntimeError("WINDOWS_REQUIRED")
    if RUN_ROOT.exists() or RUN_ROOT.is_symlink():
        raise RuntimeError("V82_EXISTING_EVIDENCE_FOLDER_NO_OVERWRITE")
    if not v7.inspect_existing_binary():
        raise RuntimeError("V82_EXISTING_ISOLATED_LLAMA_COMPLETION_REQUIRED_NO_BUILD")
    if v5.checked_hash(v5.LIVE_GGUF,MODEL_SHA)!=MODEL_SHA:
        raise RuntimeError("OFFICIAL_BASE_MODEL_UNVERIFIED")
    if digest(ORIGINAL_V5)!=V5_SHA or digest(V8_MAIN)!=V5_SHA:
        raise RuntimeError("V5_AND_V8_SOURCE_ADAPTER_IDENTITIES_CHANGED")
    original=v6.inspect_adapter(ORIGINAL_V5,expected_hash=V5_SHA)
    if original["state"]!="PASS_REAL_QWEN_LORA_B_TENSORS_LEARNED_NOT_DEPLOYED":
        raise RuntimeError("V5_LEARNED_SOURCE_NOT_VERIFIED")
    checked={}
    for k,p in [("best_validation",V8_BEST),("stranded_final_tmp",V8_TEMP)]:
        if not p.is_file() or p.is_symlink() or digest(p)!=V8_SHA:
            raise RuntimeError("V82_RECOVERED_SOURCE_MISSING_OR_CHANGED_"+k)
        candidate=v6.inspect_adapter(p,expected_hash=V8_SHA)
        old=original["learned_b_tensors"]
        new=candidate["learned_b_tensors"]
        if not all(x in new and
                   (abs(new[x]["max_abs"]-old[x]["max_abs"])>1e-12 or
                    abs(new[x]["l2_norm"]-old[x]["l2_norm"])>1e-12)
                   for x in old):
            raise RuntimeError("V82_ADAPTER_HAS_NO_QV_LEARNED_DELTA_"+k)
        checked[k]={"bytes":p.stat().st_size,"sha256":V8_SHA}
    if V8_LOG.stat().st_size>20_000_000 or V8_LOG.is_symlink():
        raise RuntimeError("V8_TRAINING_LOG_UNTRUSTED")
    log=V8_LOG.read_bytes()
    for marker in (b"--resume: 2 LoRA pairs from",
                   b"data=0000064/0000064",
                   b"failed to write LoRA adapter"):
        if marker not in log:
            raise RuntimeError("V8_NATIVE_TRAINING_EVIDENCE_MISSING")
    # The original saved checkpoints are not allowed to change at any point.
    source_files=[v5.LIVE_GGUF,ORIGINAL_V5,V8_MAIN,V8_BEST,V8_TEMP,
                  Path(str(V8_MAIN)+".opt"),Path(str(V8_MAIN)+".state")]
    hashes={str(p):digest(p) for p in source_files}
    return {"source_files":hashes,"candidate_checks":checked}

def select_cases():
    validated=v5.dataset_verified()
    validation=validated["validation"]
    training_prompts={x["messages"][0]["content"] for x in validated["train"]}
    cases=[]
    for family,label in (("recurrence","recurrence"),("meta_selection","model-selection")):
        examples=[r for r in validation if r["family"]==family]
        if len(examples)<2:
            raise RuntimeError("V82_NOT_ENOUGH_HELDOUT_CASES_"+family)
        for i,example in enumerate(examples[:2]):
            cases.append({"id":"heldout-"+label+"-"+str(i),
                          "kind":family,
                          "prompt":example["messages"][0]["content"],
                          "reference_answer":example["messages"][1]["content"]})
    for city,country in (("Tokyo","Japan"),("Paris","France")):
        cases.append({"id":"control-"+country.lower(),"kind":"general_control",
                      "prompt":"What is the capital city of "+country+"? Reply with just the city name.",
                      "reference_answer":city})
    if len(cases)!=NUM_CASES or len({x["prompt"] for x in cases})!=NUM_CASES or \
       any(x["prompt"] in training_prompts for x in cases):
        raise RuntimeError("V82_HELDOUT_OR_CONTROL_CASES_INVALID")
    return cases

def grade(case, response):
    """Conservative evidence checks: not a general reasoning-quality metric."""
    if "<think>" in response or "</think>" in response:
        return {"status":"INVALID_THINKING_OUTPUT","reference_match":None}
    if case["kind"]=="recurrence":
        m=re.search(r"=(\d+)\.",case["reference_answer"])
        if not m:raise RuntimeError("RECURRENCE_REFERENCE_INVALID")
        normal=re.sub(r"(?<=\d),(?=\d)","",response)
        return {"status":"EXPECTED_RESULT_NUMBER_PRESENT_CHECK",
                "reference_match":bool(re.search(r"(?<!\d)"+re.escape(m.group(1))+r"(?!\d)",normal)),
                "expected_number":int(m.group(1))}
    if case["kind"]=="general_control":
        word=case["reference_answer"]
        return {"status":"FACT_KEYWORD_PRESENT_CHECK",
                "reference_match":bool(re.search(r"\b"+re.escape(word)+r"\b",response,re.I)),
                "expected_keyword":word}
    if case["kind"]=="meta_selection":
        m=re.search(r"are respectively (\d+), (\d+), (\d+)\.",case["prompt"])
        if not m:raise RuntimeError("SELECTION_PROMPT_CANNOT_BE_GROUNDED")
        losses=[int(x) for x in m.groups()]
        minima=[w for w,x in zip((3,5,8),losses) if x==min(losses)]
        # Search only explicit 'window N is best' style claims; do not
        # infer correctness from a mention of a window number.
        selected=[int(x) for x in re.findall(
             r"\bwindow\s+(3|5|8)\s+(?:is|has)\s+(?:the\s+)?(?:best|lowest)",
             response,re.I)]
        return {"status":"MANUAL_REVIEW_REQUIRED_TIE_AND_EXPLANATION",
                "reference_match":None,"expected_best_windows":minima,
                "observed_errors":dict(zip(("3","5","8"),losses)),
                "explicit_winner_claims":selected,
                "explicit_wrong_winner":any(x not in minima for x in selected)}
    raise RuntimeError("CASE_KIND_UNEXPECTED")

def copy_verified_candidate(src,dst):
    if dst.exists() or dst.is_symlink() or src.is_symlink() or not src.is_file():
        raise RuntimeError("V82_UNSAFE_RECOVERY_SOURCE_OR_TARGET")
    with src.open("rb") as old,dst.open("xb") as new:
        while True:
            chunk=old.read(128*1024)
            if not chunk:break
            new.write(chunk)
    if digest(dst)!=V8_SHA:
        raise RuntimeError("V82_RECOVERY_COPY_HASH_MISMATCH")
    return {"path":str(dst),"sha256":V8_SHA,"bytes":dst.stat().st_size}

def execute():
    evidence=verify_checkpoint_inputs()
    resources=v7.initial_resources()
    cases=select_cases()
    # Only start after all read-only safety and provenance checks succeed.
    RUN_ROOT.mkdir(parents=False)
    recovered=copy_verified_candidate(V8_BEST,RECOVERED)
    print("FUN_QWEN_V82_RECOVERY="+json.dumps(recovered,sort_keys=True),flush=True)
    binary=v7.inspect_existing_binary()
    if not binary:raise RuntimeError("ISOLATED_BINARY_DISAPPEARED")
    dirs={name:RUN_ROOT/name for name in ("baseline","v5","v8")}
    for directory in dirs.values():
        directory.mkdir()
    records=[]
    for case in cases:
        print("FUN_QWEN_V82_CASE="+case["id"],flush=True)
        record={k:case[k] for k in ("id","kind","prompt","reference_answer")}
        for label in ("baseline","v5","v8"):
            v7.ADAPTER = ORIGINAL_V5 if label=="v5" else RECOVERED
            native_mode="baseline" if label=="baseline" else "adapter"
            # Native V7.1 controls: deterministic Qwen nonthinking ChatML,
            # temperature 0, seed 6427, CPU, 160-token cap and RAM watchdog.
            result=v7.run_case(binary,case,native_mode,dirs[label])
            record[label]={"response":result["generated_text"],
                           "generated_sha256":result["generated_sha256"],
                           "adapter_load_attested":result["adapter_load_attested"],
                           "reference_evidence":grade(case,result["generated_text"])}
        record["v8_vs_baseline_text_changed"]=record["v8"]["generated_sha256"]!=record["baseline"]["generated_sha256"]
        record["v8_vs_v5_text_changed"]=record["v8"]["generated_sha256"]!=record["v5"]["generated_sha256"]
        records.append(record)
        print("FUN_QWEN_V82_CASE_RESULT="+json.dumps({
            "id":record["id"],
            "v8_vs_v5_text_changed":record["v8_vs_v5_text_changed"],
            "v8_vs_baseline_text_changed":record["v8_vs_baseline_text_changed"],
            "baseline_answer":record["baseline"]["response"][:400],
            "v5_answer":record["v5"]["response"][:400],
            "v8_answer":record["v8"]["response"][:400],
            "baseline_grade":record["baseline"]["reference_evidence"],
            "v5_grade":record["v5"]["reference_evidence"],
            "v8_grade":record["v8"]["reference_evidence"],
        },sort_keys=True),flush=True)
    if len(records)!=NUM_CASES:
        raise RuntimeError("V82_INCOMPLETE_THREE_WAY_EVALUATION")
    for p,sha in evidence["source_files"].items():
        if digest(Path(p))!=sha:
            raise RuntimeError("V82_PROTECTED_ORIGINAL_FILE_CHANGED_"+Path(p).name)
    report={
        "version":VERSION,
        "state":"V82_THREE_WAY_QWEN_INFERENCE_COMPLETE_RECOVERED_NOT_DEPLOYED",
        "model_sha256":MODEL_SHA,
        "v5_adapter_sha256":V5_SHA,
        "v8_adapter_sha256":V8_SHA,
        "v8_recovery_file":str(RECOVERED),
        "case_count":len(records),
        "modes":["baseline","v5","v8"],
        "cases_v8_text_changed_vs_baseline":sum(x["v8_vs_baseline_text_changed"] for x in records),
        "cases_v8_text_changed_vs_v5":sum(x["v8_vs_v5_text_changed"] for x in records),
        "sample_count_too_small_for_improvement_claim":True,
        "scoring_caveat":"Number/keyword occurrence is only preliminary evidence; tied selection requires manual judgment.",
        "baseline_generation_temperature":0,
        "seed":v7.GENERATION_SEED,
        "max_generated_tokens":v7.MAX_GENERATION_TOKENS,
        "source_checkpoints_unmodified":True,
        "retraining_performed":False,
        "deployment_performed":False,
        "initial_resources":resources,
        "cases":records
    }
    with (RUN_ROOT/"comparison.json").open("x",encoding="utf-8") as f:
        json.dump(report,f,sort_keys=True,indent=2,ensure_ascii=False)
    print("FUN_QWEN_V82_RESULT="+json.dumps({
        k:v for k,v in report.items() if k not in ("cases","initial_resources")
    },sort_keys=True),flush=True)
    print("FUN_QWEN_V82_REPORT="+str(RUN_ROOT/"comparison.json"),flush=True)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--approve",default="")
    p.add_argument("--preflight-only",action="store_true")
    a=p.parse_args()
    if sys.platform!="win32":
        raise RuntimeError("WINDOWS_REQUIRED")
    if not a.preflight_only and a.approve!=APPROVAL:
        raise RuntimeError("EXPLICIT_V82_RECOVERY_EVALUATION_APPROVAL_REQUIRED")
    if a.preflight_only:
        e=verify_checkpoint_inputs()
        cases=select_cases()
        resources=v7.initial_resources()
        print("FUN_QWEN_V82_PREFLIGHT="+json.dumps({
            "state":"PASS_RECOVERED_V8_CHECKPOINT_AND_THREE_WAY_EVAL_READY",
            "v8_sha256":V8_SHA,"v5_sha256":V5_SHA,
            "cases":len(cases),"sources_unchanged":True,
            "system_free_gib":resources["host_free_gib"],
            "source_file_count":len(e["source_files"]),
            "no_inference_or_copies_performed":True,
        },sort_keys=True),flush=True)
        return
    execute()

if __name__=="__main__":
    try:
        main()
    except (RuntimeError,ValueError,OSError,KeyError,TypeError,subprocess.SubprocessError) as exc:
        print(json.dumps({
            "version":VERSION,"state":"HOLD_V82_RECOVERY_OR_EVALUATION_NOT_VERIFIED",
            "reason":str(exc)[:520],"retraining_performed":False,
            "live_model_replaced":False,"original_files_intended_unchanged":True
        },sort_keys=True),flush=True)
        sys.exit(2)
