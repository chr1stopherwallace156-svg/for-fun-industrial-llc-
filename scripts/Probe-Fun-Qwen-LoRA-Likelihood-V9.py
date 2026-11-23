#!/usr/bin/env python3
"""Fun Industrial V9: isolate Qwen3 base/V5/V8 perplexity on held-out text.

No LoRA training, original model modification, production inference service
restart, network source clone, package installation, or Elektron operations.
This measures likelihood, NOT generalization or mathematical answer accuracy.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import subprocess
import sys

VERSION = "fun-qwen-pretrained-adapter-likelihood-probe-v9"
APPROVAL = "I_APPROVE_ISOLATED_QWEN_V9_LIKELIHOOD_EVALUATION"
ROOT = Path(__file__).resolve().parents[1]
EXPECTED_MODEL_SHA = "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
EXPECTED_V5_SHA = "da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193"
EXPECTED_V8_SHA = "05efce40082eee0815decc4c21f74150c612adbb2e88fb2149c9c4dd951f7240"
ROWS_PER_DOMAIN = 8
CTX = 128
MAX_CHILD_SECONDS = 240

def import_module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT/"scripts"/file)
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

v7 = import_module("qwen_v9_previous_eval","Evaluate-Fun-Qwen-Real-LoRA-V7.py")
v6 = import_module("qwen_v9_adapter_audit","Audit-Fun-Qwen-Real-LoRA-V6.py")
v5 = v7.v5
APP = v5.APP
MODEL = v5.LIVE_GGUF
V5_ADAPTER = APP/"candidate"/"qwen-fibonacci-smoke.lora.gguf"
V8_ADAPTER = APP/"recovery-evaluation-v82"/"qwen-v8-validated-recovery.lora.gguf"
V82_REPORT = APP/"recovery-evaluation-v82"/"comparison.json"
BUILD = APP/"cpu-train-build-vs2022-noasm-v1"
RESULTS = APP/"likelihood-probe-v9"

CAPITALS = (
    ("Japan","Tokyo"),("France","Paris"),("Canada","Ottawa"),
    ("Italy","Rome"),("Spain","Madrid"),("Germany","Berlin"),
    ("Portugal","Lisbon"),("Australia","Canberra"),
)

def file_hash(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for part in iter(lambda:f.read(1024*1024),b""):
            h.update(part)
    return h.hexdigest()

def validated_inputs():
    if sys.platform != "win32":
        raise RuntimeError("V9_WINDOWS_REQUIRED")
    if RESULTS.exists() or RESULTS.is_symlink():
        raise RuntimeError("V9_OUTPUT_DIRECTORY_EXISTS_NO_OVERWRITE")
    model_sha = v5.checked_hash(MODEL,EXPECTED_MODEL_SHA)
    v5_audit=v6.inspect_adapter(V5_ADAPTER,expected_hash=EXPECTED_V5_SHA)
    v8_audit=v6.inspect_adapter(V8_ADAPTER,expected_hash=EXPECTED_V8_SHA)
    if v5_audit["state"]!="PASS_REAL_QWEN_LORA_B_TENSORS_LEARNED_NOT_DEPLOYED" or \
       v8_audit["state"]!="PASS_REAL_QWEN_LORA_B_TENSORS_LEARNED_NOT_DEPLOYED":
        raise RuntimeError("V9_PRETRAINED_LORA_WEIGHT_AUDITS_INVALID")
    if not V82_REPORT.is_file() or V82_REPORT.is_symlink():
        raise RuntimeError("V9_PREVIOUS_THREE_WAY_EVALUATION_MISSING")
    prior=json.loads(V82_REPORT.read_text("utf-8"))
    if prior.get("state")!="V82_THREE_WAY_QWEN_INFERENCE_COMPLETE_RECOVERED_NOT_DEPLOYED" or \
       prior.get("v5_adapter_sha256")!=EXPECTED_V5_SHA or \
       prior.get("v8_adapter_sha256")!=EXPECTED_V8_SHA or \
       prior.get("model_sha256")!=EXPECTED_MODEL_SHA or \
       prior.get("case_count")!=6:
        raise RuntimeError("V9_V82_RECEIPT_IDENTITY_MISMATCH")
    if not BUILD.is_dir() or not (BUILD/"CMakeCache.txt").is_file():
        raise RuntimeError("V9_PREVIOUS_ISOLATED_CMAKE_BUILD_MISSING")
    if not (APP/"llama-tq-pinned-source"/".git").is_dir():
        raise RuntimeError("V9_PINNED_SOURCE_MISSING_NO_DOWNLOAD")
    # Keep these source bytes identical throughout the benchmark.
    source_files=[MODEL,V5_ADAPTER,V8_ADAPTER,V82_REPORT]
    identities={str(p):file_hash(p) for p in source_files}
    return {"model_sha256":model_sha, "source_hashes":identities}

def corpus_text(question_answer_pairs):
    """Simple consistent Qwen3 non-thinking user/assistant format.
    PPL scores ALL text in its scoring windows, including prompts, so this
    should never be interpreted as answer-only conditional accuracy.
    """
    result=[]
    for question,answer in question_answer_pairs:
        if any(x in question+answer for x in ("<|im_start|>","<|im_end|>","<think>")):
            raise RuntimeError("V9_UNTRUSTED_CHAT_TOKENS_IN_EVALUATION_SET")
        result.append(
            "<|im_start|>user\n"+question.strip()+"\n/no_think<|im_end|>\n"
            "<|im_start|>assistant\n<think>\n\n</think>\n\n"+
            answer.strip()+"<|im_end|>\n"
        )
    return "\n".join(result)+"\n"

def make_corpora():
    dataset=v5.dataset_verified()
    train={row["messages"][0]["content"] for row in dataset["train"]}
    holdout=dataset["validation"]
    corpora={}
    for family in ("recurrence","meta_selection"):
        rows=[row for row in holdout if row["family"]==family][:ROWS_PER_DOMAIN]
        if len(rows)!=ROWS_PER_DOMAIN:
            raise RuntimeError("V9_VALIDATION_DOMAIN_TOO_SMALL_"+family)
        pairs=[(r["messages"][0]["content"],r["messages"][1]["content"]) for r in rows]
        if any(question in train for question,_ in pairs):
            raise RuntimeError("V9_VALIDATION_QUESTION_IN_TRAINING")
        corpora[family]=corpus_text(pairs)
    corpora["general_control"]=corpus_text([
        ("What is the capital city of "+country+"? Reply with the city name.", city)
        for country,city in CAPITALS
    ])
    if len(corpora)!=3 or any(len(c.encode("utf-8"))<1000 for c in corpora.values()):
        raise RuntimeError("V9_CORPORA_INCOMPLETE_OR_TOO_SHORT")
    return corpora

def existing_binary():
    matches=[x for x in BUILD.glob("**/llama-perplexity.exe") if x.is_file() and not x.is_symlink()]
    if len(matches)>1:
        raise RuntimeError("V9_MULTIPLE_PERPLEXITY_BINARIES_REQUIRE_REVIEW")
    return matches[0] if matches else None

def ensure_binary():
    binary=existing_binary()
    if binary:
        return binary
    # Existing PINNED local repo and audited source overlay only.
    if not (APP/"llama-tq-pinned-source"/".git").is_dir():
        raise RuntimeError("V9_SOURCE_NOT_AVAILABLE_OFFLINE")
    source=v5.prepare_source(APP)
    v5.prepare_msvc_noasm_overlay(APP,source)
    v5.requirements()
    logfile=v5.fresh_log(APP,"cmake-build-perplexity-v9")
    v5.safe_run(["cmake","--build",str(BUILD),"--config","Release",
                 "--target","llama-perplexity","--parallel","2"],
                logfile,v5.MAX_BUILD_SECONDS,expected_cwd=APP)
    binary=existing_binary()
    if not binary:
        raise RuntimeError("V9_PERPLEXITY_TOOL_MISSING_AFTER_BUILD")
    return binary

def parse_ppl(body):
    match=re.findall(r"Final estimate:\s*PPL\s*=\s*([0-9]+(?:\.[0-9]+)?)",body)
    if len(match)!=1:
        raise RuntimeError("V9_EXACTLY_ONE_NATIVE_PPL_ESTIMATE_REQUIRED")
    value=float(match[0])
    if not math.isfinite(value) or value<=0.0:
        raise RuntimeError("V9_INVALID_NATIVE_PPL")
    return value

def run_ppl(binary,corpus,mode,adapter):
    if mode not in ("baseline","v5","v8"):
        raise RuntimeError("V9_INVALID_EVALUATION_MODE")
    if adapter is not None and mode=="baseline":
        raise RuntimeError("V9_BASELINE_MUST_NOT_LOAD_LORA")
    if adapter is None and mode!="baseline":
        raise RuntimeError("V9_ADAPTED_RUN_MISSING_LORA")
    resources=v7.initial_resources()
    log=RESULTS/(corpus+"--"+mode+".native.log")
    if log.exists():
        raise RuntimeError("V9_NATIVE_LOG_EXISTS_NO_OVERWRITE")
    command=[str(binary),"-m",str(MODEL),"-f",str(RESULTS/(corpus+".txt")),
             "-c",str(CTX),"-b",str(CTX),"-ub","64","-t","4","-ngl","0"]
    if adapter is not None:
        command += ["--lora",str(adapter)]
    metrics=v5.safe_run(command,log,MAX_CHILD_SECONDS,expected_cwd=binary.parent)
    if log.stat().st_size>20_000_000:
        raise RuntimeError("V9_LOG_TOO_LARGE")
    native=log.read_text("utf-8",errors="replace")
    if adapter is not None:
        if "loaded 4 tensors from lora file" not in native or str(adapter).lower() not in native.lower():
            raise RuntimeError("V9_LORA_NOT_CONFIRMED_LOADED_"+mode)
    elif "loaded 4 tensors from lora file" in native:
        raise RuntimeError("V9_BASELINE_UNEXPECTED_LORA")
    ppl=parse_ppl(native)
    return {"mode":mode,"corpus":corpus,"ppl":ppl,
            "native_metric_precision_decimal_places":4,
            "seconds":metrics["seconds"],
            "peak_child_private_commit_gib_observed":metrics["peak_child_private_commit_gib_observed"],
            "log":str(log),"adapter_loaded":adapter is not None}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--approve",default="")
    parser.add_argument("--preflight-only",action="store_true")
    args=parser.parse_args()
    if not args.preflight_only and args.approve!=APPROVAL:
        raise RuntimeError("V9_EXPLICIT_PROBABILITY_BENCHMARK_APPROVAL_REQUIRED")
    evidence=validated_inputs()
    corpora=make_corpora()
    resources=v7.initial_resources()
    print("FUN_QWEN_V9_PREFLIGHT="+json.dumps({
        "source_verified":True,
        "test_domains":list(corpora),
        "heldout_examples_per_domain":ROWS_PER_DOMAIN,
        "model_sha256":EXPECTED_MODEL_SHA,
        "v5_sha256":EXPECTED_V5_SHA,
        "v8_sha256":EXPECTED_V8_SHA,
        "host_free_gib":resources["host_free_gib"],
        "commit_headroom_gib":resources["commit_headroom_gib"],
        "inference_runs_requested":9,
        "training_and_live_deployment":False},sort_keys=True),flush=True)
    if args.preflight_only:
        print("FUN_QWEN_V9=PREFLIGHT_ONLY_NO_FILES_OR_INFERENCE",flush=True)
        return
    RESULTS.mkdir()
    manifest={"version":VERSION,"corpora":{},"measurement_scope":
        "Perplexity over entire held-out formatted text, NOT answer-only accuracy."}
    for name,source in corpora.items():
        path=RESULTS/(name+".txt")
        with path.open("x",encoding="utf-8",newline="\n") as f:
            f.write(source)
        manifest["corpora"][name]={"sha256":file_hash(path),"bytes":path.stat().st_size,
                                    "examples":ROWS_PER_DOMAIN}
    (RESULTS/"manifest.json").write_text(json.dumps(manifest,indent=2,sort_keys=True),encoding="utf-8")
    binary=ensure_binary()
    print("FUN_QWEN_V9_NATIVE_BINARY="+str(binary),flush=True)
    records=[]
    for corpus in ("recurrence","meta_selection","general_control"):
        results={}
        for mode,adapter in (("baseline",None),("v5",V5_ADAPTER),("v8",V8_ADAPTER)):
            print("FUN_QWEN_V9_RUN="+corpus+"/"+mode,flush=True)
            results[mode]=run_ppl(binary,corpus,mode,adapter)
        # Native fork prints only 4 decimal digits. Identical printed
        # metrics cannot rule out actual sub-precision logit changes.
        obs={
            "domain":corpus,
            "results":results,
            "delta_v5_minus_base":round(results["v5"]["ppl"]-results["baseline"]["ppl"],4),
            "delta_v8_minus_base":round(results["v8"]["ppl"]-results["baseline"]["ppl"],4),
            "delta_v8_minus_v5":round(results["v8"]["ppl"]-results["v5"]["ppl"],4),
            "resolution_limit":"0.0001 PPL; zero reported difference is inconclusive",
        }
        records.append(obs)
        print("FUN_QWEN_V9_DOMAIN_RESULT="+json.dumps({
            "domain":corpus,
            "baseline_ppl":results["baseline"]["ppl"],
            "v5_ppl":results["v5"]["ppl"],
            "v8_ppl":results["v8"]["ppl"],
            "v8_minus_baseline":obs["delta_v8_minus_base"],
            "v8_minus_v5":obs["delta_v8_minus_v5"],
            "ppl_lower_is_better_on_this_text_only":True,
        },sort_keys=True),flush=True)
    if len(records)!=3:
        raise RuntimeError("V9_MISSING_CORPUS_PPL_COMPARISONS")
    for path,identity in evidence["source_hashes"].items():
        if file_hash(Path(path))!=identity:
            raise RuntimeError("V9_PROTECTED_MODEL_OR_EVIDENCE_WAS_MODIFIED")
    report={
        "version":VERSION,
        "state":"REAL_QWEN_THREE_WAY_HELDOUT_PPL_COMPLETE_NOT_DEPLOYED",
        "model_sha256":EXPECTED_MODEL_SHA,
        "v5_sha256":EXPECTED_V5_SHA,
        "v8_sha256":EXPECTED_V8_SHA,
        "domains":records,
        "comparisons_completed":len(records),
        "native_lora_load_verification":True,
        "evaluation_uses_teacher_forced_reference_text":True,
        "ppl_is_not_mathematical_accuracy_or_generalization":True,
        "native_ppl_precision_limits_detection_of_small_weight_changes":True,
        "trained_or_deployed":False,
        "original_weights_and_evidence_unchanged":True,
    }
    with (RESULTS/"comparison.json").open("x",encoding="utf-8") as f:
        json.dump(report,f,indent=2,sort_keys=True)
    print("FUN_QWEN_V9_RESULT="+json.dumps({
        "state":report["state"],"comparisons_completed":report["comparisons_completed"],
        "native_lora_load_verification":True,
        "trained_or_deployed":False,
        "limitation":"Native PPL reported to 4 decimal places; lower PPL does not prove reasoning improvement",
    },sort_keys=True),flush=True)
    print("FUN_QWEN_V9_REPORT="+str(RESULTS/"comparison.json"),flush=True)

if __name__=="__main__":
    try:
        main()
    except (OSError,ValueError,RuntimeError,KeyError,TypeError,subprocess.SubprocessError) as e:
        print(json.dumps({
            "version":VERSION,"state":"HOLD_QWEN_V9_LIKELIHOOD_EVIDENCE_NOT_VERIFIED",
            "reason":str(e)[:480],"no_training_or_deployment":True,
        },sort_keys=True),flush=True)
        sys.exit(2)
