#!/usr/bin/env python3
"""Fun Industrial V10.5: isolated original-Qwen -> deterministic math bridge.

Exercises genuine CPU-only Qwen inference and passes only independently
verified V10 validation error integers into the already-tested V10.4 math
oracle. The Qwen response is untrusted; correction is deterministic, not
a model-generated result. No live-service / REA / dashboard integration.
No training, model edits, installs, downloads, or frozen-test access.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

VERSION="fun-qwen-verified-window-toolbridge-v10-5"
CONSENT="I_APPROVE_ISOLATED_QWEN_V105_MATH_TOOLBRIDGE_EVALUATION"
MODEL_SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
ROOT=Path(__file__).resolve().parents[1]
N_CASES=7
PER_PATTERN=1
MAX_SOURCE_BYTES=512000

def load(name,rel):
    spec=importlib.util.spec_from_file_location(name,ROOT/"scripts"/rel)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

v104=load("fun_v105_standalone_math","Verified-Fun-Math-Decision-V104.py")
v102=load("fun_v105_prior_proof_audit","Audit-Fun-Qwen-Math-Baseline-V102.py")
v101=v102.v101
v10=v102.v10
v7=v101.v7
v5=v7.v5
RUN=v5.APP/"math-toolbridge-v105"

def hash_file(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""):
            h.update(block)
    return h.hexdigest()

def select_unseen_validation():
    """One previously unused row per winner pattern; never open frozen test."""
    baseline=v102.validate_report()
    sources=baseline["source"]["source_hashes"]
    old_ids=set(baseline["by_id"])
    val=v101.DATA_DIR/"validation.jsonl"
    truth=v101.DATA_DIR/"validation-ground-truth.jsonl"
    for path in (val,truth):
        if not path.is_file() or path.is_symlink() or path.stat().st_size>MAX_SOURCE_BYTES or \
           hash_file(path)!=sources.get(str(path)):
            raise RuntimeError("V105_VALIDATION_INPUT_SHA_UNVERIFIED_"+path.name)
    examples=[json.loads(line) for line in val.read_text("utf-8").splitlines()]
    oracles=[json.loads(line) for line in truth.read_text("utf-8").splitlines()]
    if len(examples)!=84 or len(oracles)!=84:
        raise RuntimeError("V105_VALIDATION_LENGTH_INVALID")
    group={p:[] for p in v10.PATTERNS}
    prior_prompts={x["prompt"] for x in baseline["by_id"].values()}
    for i,(row,oracle) in enumerate(zip(examples,oracles)):
        if set(row)!={"messages"} or len(row["messages"])!=2:
            raise RuntimeError("V105_INVALID_CHAT_FORMAT")
        user,answer=row["messages"]
        if user.get("role")!="user" or answer.get("role")!="assistant":
            raise RuntimeError("V105_INVALID_CHAT_ROLES")
        prompt=user["content"]
        label=answer["content"]
        ident="v10-validation-"+str(i)
        parsed=v104.checked_errors(v10.argmin_set({3:0,5:0,8:0}) and
                                   v103_parse(prompt)) # typed from trusted prompt
        oracle_errors={int(w):v for w,v in oracle["errors"].items()}
        if parsed!=oracle_errors or oracle.get("question")!=prompt or \
           tuple(oracle.get("best_windows",[]))!=v10.argmin_set(parsed) or \
           label!=v10.encode_label(parsed) or \
           oracle.get("oracle_pairwise_differences")!=v10.pairwise_differences(parsed):
            raise RuntimeError("V105_VALIDATION_ORACLE_DISAGREES_"+ident)
        pattern=v10.argmin_set(parsed)
        if pattern not in group:
            raise RuntimeError("V105_UNKNOWN_WINNER_PATTERN")
        if ident in old_ids:
            if prompt not in prior_prompts:
                raise RuntimeError("V105_PRIOR_BASELINE_CASE_INCONSISTENT")
            continue
        if prompt in prior_prompts:
            raise RuntimeError("V105_PROMPT_REUSED_FROM_BASELINE")
        group[pattern].append({
            "id":ident,
            "pattern":pattern,
            "errors":parsed,
            "prompt":prompt,
            "reference_answer":label,
        })
    if any(len(rows)!=10 for rows in group.values()):
        raise RuntimeError("V105_EXPECTED_TEN_NEW_VALIDATION_CASES_PER_PATTERN")
    cases=[group[p][0] for p in v10.PATTERNS]
    if len(cases)!=N_CASES or len({r["prompt"] for r in cases})!=N_CASES:
        raise RuntimeError("V105_NEW_CASE_SELECTION_INVALID")
    return {
        "cases":cases,
        "source_hashes":sources,
        "prior_v101_report_sha256":baseline["sha256"],
        "original_v101_case_ids":sorted(old_ids),
        "frozen_test_not_opened":True,
    }

def v103_parse(prompt):
    # Only the already-declared V10 question grammar is accepted.
    # This function deliberately does not trust the model response.
    return v103.errors_from_question(prompt)

v103=load("fun_v105_input_grammar","Verify-Fun-Qwen-Math-Answers-V103.py")

def verify_bridge(case, generated):
    """Oracle always derives from trusted dataset error integers, never Qwen."""
    errors=v104.checked_errors(case["errors"])
    if errors!=v103_parse(case["prompt"]):
        raise RuntimeError("V105_TYPED_INPUT_VERSUS_QUESTION_MISMATCH")
    if v10.encode_label(errors)!=case["reference_answer"]:
        raise RuntimeError("V105_VERIFIED_REFERENCE_MISMATCH")
    result=v104.verify(errors)
    model_fields=None
    mismatch_fields={}
    try:
        compared=v104.verify(errors,generated)
        model_fields=v104.parse_model_claim(generated)
        mismatch_fields=compared["model_claim_mismatch_fields"]
        status=("MODEL_ANSWER_VERIFIED" if not mismatch_fields else
                "MODEL_ANSWER_MATH_INCORRECT_VERIFIED_ALTERNATIVE")
    except ValueError as ex:
        status="MODEL_ANSWER_UNPARSEABLE_VERIFIED_ALTERNATIVE"
        mismatch_fields={"format":{"reason":str(ex)[:160]}}
    original_grade=v102.grade(case,generated)
    oracle=v104.calculate(errors)
    if result["verified_answer"]!=v104.format_oracle(oracle):
        raise RuntimeError("V105_FORMATTED_ORACLE_INCONSISTENT")
    return {
        "id":case["id"],
        "expected_winners":list(oracle["BEST_WINDOWS"]),
        "source":"sha256_verified_v10_validation_only",
        "question":case["prompt"],
        "original_model_response":generated,
        "model_answer_state":status,
        "model_response_fields":({k:(list(v) if isinstance(v,tuple) else v)
                                for k,v in model_fields.items()}
                                if model_fields is not None else None),
        "model_answer_mismatches":mismatch_fields,
        "model_decision_correct":original_grade["all_decision_fields_correct"],
        "model_proof_correct":original_grade["all_proof_fields_correct"],
        "model_complete_math_correct":original_grade["complete_math_content_correct"],
        "verified_output":result["verified_answer"],
        "verified_answer_mathematically_correct":
            v10.grade_output(errors,v10.encode_label(errors))["exact_answer"],
        "verified_output_generated_by_qwen":False,
        "model_weights_updated":False,
        "production_integrated":False,
    }

def preflight():
    if sys.platform!="win32":
        raise RuntimeError("V105_WINDOWS_REQUIRED")
    if RUN.exists() or RUN.is_symlink():
        raise RuntimeError("V105_OUTPUT_DIR_EXISTS_PRESERVE_PRIOR_RUN")
    data=select_unseen_validation()
    original_sha=v5.checked_hash(v5.LIVE_GGUF,MODEL_SHA)
    executable=v7.inspect_existing_binary()
    if executable is None:
        raise RuntimeError("V105_OFFLINE_PINNED_LLAMA_COMPLETION_MISSING_NO_BUILD")
    m=v7.initial_resources()
    return {
        "data":data,"binary":executable,"resources":m,
        "original_sha":original_sha,
    }

def run():
    checked=preflight()
    cases=checked["data"]["cases"]
    sources=checked["data"]["source_hashes"]
    binary=checked["binary"]
    print("FUN_QWEN_V105_PREFLIGHT="+json.dumps({
        "state":"VERIFIED_ISOLATED_NEW_VALIDATION_AND_CPU_QWEN_READY",
        "cases":len(cases),
        "heldout_pattern_count":len(v10.PATTERNS),
        "reuses_v101_questions":False,
        "frozen_test_opened":False,
        "original_model_sha256":checked["original_sha"],
        "host_free_gib":checked["resources"]["host_free_gib"],
        "commit_headroom_gib":checked["resources"]["commit_headroom_gib"],
        "training_or_deployment":False,
    },sort_keys=True),flush=True)
    RUN.mkdir()
    rows=[]
    for idx,case in enumerate(cases):
        print("FUN_QWEN_V105_CASE="+json.dumps({
            "number":idx+1,"id":case["id"],
            "errors":case["errors"],"pattern":list(case["pattern"]),
        },sort_keys=True),flush=True)
        # This is an ISOLATED original Qwen inference process, not a
        # function call made by Qwen, nor the live model server.
        native=v7.run_case(binary,case,"baseline",RUN)
        verified=verify_bridge(case,native["generated_text"])
        verified["model_generation_sha256"]=native["generated_sha256"]
        verified["native_log_paths"]=[native["stdout_log"],native["stderr_log"]]
        rows.append(verified)
        print("FUN_QWEN_V105_CASE_RESULT="+json.dumps({
            "id":case["id"],
            "model_status":verified["model_answer_state"],
            "model_winners_correct":verified["model_decision_correct"],
            "model_proof_correct":verified["model_proof_correct"],
            "corrected_fields":sorted(verified["model_answer_mismatches"]),
            "original_model_response":verified["original_model_response"][:500],
            "tool_verified_response":verified["verified_output"],
        },sort_keys=True),flush=True)
    if len(rows)!=N_CASES:
        raise RuntimeError("V105_NOT_ALL_ISOLATED_CASES_COMPLETED")
    for path,expected_sha in sources.items():
        if hash_file(Path(path))!=expected_sha:
            raise RuntimeError("V105_PROTECTED_V10_TRAIN_VALIDATION_SOURCE_CHANGED")
    if hash_file(v102.REPORT)!=checked["data"]["prior_v101_report_sha256"]:
        raise RuntimeError("V105_ORIGINAL_V101_REPORT_CHANGED")
    if hash_file(v5.LIVE_GGUF)!=MODEL_SHA:
        raise RuntimeError("V105_ORIGINAL_QWEN_MODEL_CHANGED")
    report={
        "version":VERSION,
        "state":"V105_ISOLATED_REAL_QWEN_TO_VERIFIED_MATH_BRIDGE_COMPLETE_NOT_DEPLOYED",
        "architecture":"external_python_orchestrated_qwen_inference_then_deterministic_checker_NOT_native_Qwen_tool_call",
        "case_count":len(rows),
        "only_v10_validation_examples_unseen_in_v101":True,
        "frozen_test_opened":False,
        "original_model_sha256":MODEL_SHA,
        "model_winner_correct":sum(x["model_decision_correct"] for x in rows),
        "model_proof_correct":sum(x["model_proof_correct"] for x in rows),
        "model_full_math_correct":sum(x["model_complete_math_correct"] for x in rows),
        "model_answers_requiring_tool_reconstruction":
            sum(x["model_answer_state"]!="MODEL_ANSWER_VERIFIED" for x in rows),
        "verified_oracle_answers_correct":sum(x["verified_answer_mathematically_correct"] for x in rows),
        "native_qwen_baseline_inference_completed":len(rows),
        "source_evidence_unchanged":True,
        "original_qwen_weights_modified":False,
        "training_or_deployment_performed":False,
        "live_ql_server_or_fun_dashboard_changed":False,
        "elektron_untouched":True,
        "records":rows,
    }
    with (RUN/"toolbridge-report.json").open("x",encoding="utf-8") as f:
        json.dump(report,f,indent=2,sort_keys=True,ensure_ascii=False)
    print("FUN_QWEN_V105_RESULT="+json.dumps({k:v for k,v in report.items() if k!="records"},
       sort_keys=True),flush=True)
    print("FUN_QWEN_V105_REPORT="+str(RUN/"toolbridge-report.json"),flush=True)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--approve",default="")
    p.add_argument("--preflight",action="store_true")
    a=p.parse_args()
    if not a.preflight and a.approve!=CONSENT:
        raise RuntimeError("V105_EXPLICIT_OPERATOR_APPROVAL_FOR_ISOLATED_INFERENCE_REQUIRED")
    if a.preflight:
        evidence=preflight()
        print("FUN_QWEN_V105_PREFLIGHT="+json.dumps({
            "state":"V105_ISOLATED_BRIDGE_READY_WITHOUT_MODEL_RUN",
            "selected_validation_cases":len(evidence["data"]["cases"]),
            "frozen_test_not_opened":True,"writes_performed":False,
            "original_model_sha256":evidence["original_sha"],
            "host_free_gib":evidence["resources"]["host_free_gib"],
        },sort_keys=True),flush=True)
        return
    run()

if __name__=="__main__":
    try:
        main()
    except (ValueError,RuntimeError,OSError,KeyError,TypeError) as e:
        print(json.dumps({"version":VERSION,
            "state":"HOLD_V105_QWEN_MATH_BRIDGE_NOT_VERIFIED",
            "reason":str(e)[:480],"original_model_and_production_intended_unchanged":True,
            "training_started":False},sort_keys=True),flush=True)
        sys.exit(2)
