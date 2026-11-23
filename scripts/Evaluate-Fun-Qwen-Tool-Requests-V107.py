#!/usr/bin/env python3
"""Fun Industrial V10.7: real, isolated Qwen-generated typed math tool requests.

Only standalone CPU GGUF inference (7 new V10 validation cases).
The host holds trusted errors independently from Qwen output. A strict,
existing V10.6 dispatcher is invoked ONLY for a fully valid proposal.
Malformed/forged model requests are rejected, never repaired into calls.
No dashboard/REA/MCP registration, live model impact, training or frozen test.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

VERSION="fun-qwen-isolated-tool-request-v10-7"
CONSENT="I_APPROVE_ISOLATED_QWEN_V107_TOOL_REQUEST_EXPERIMENT"
ROOT=Path(__file__).resolve().parents[1]
MODEL_SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
N_CASES=7
MAX_SOURCE_BYTES=512000
MAX_PRIOR_REPORT_BYTES=220000

def load(name,rel):
    spec=importlib.util.spec_from_file_location(name,ROOT/"scripts"/rel)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

v105=load("fun_v107_prior_bridge","Run-Fun-Qwen-Math-Toolbridge-V105.py")
v106=load("fun_v107_math_contract","Fun-Math-Tool-Contract-V106.py")
v104=v106.v104
v10=v105.v10
v101=v105.v101
v102=v105.v102
v7=v105.v7
v5=v105.v5
RUN=v5.APP/"math-qwen-real-tool-requests-v107"
PREVIOUS=v105.RUN/"toolbridge-report.json"

def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()

def read_prior_v105(provenance):
    """Attest seven existing V10.5 inference records, not just file presence."""
    if not PREVIOUS.is_file() or PREVIOUS.is_symlink() or PREVIOUS.stat().st_size>MAX_PRIOR_REPORT_BYTES:
        raise RuntimeError("V107_V105_EVIDENCE_MISSING_OR_UNTRUSTED")
    contents=PREVIOUS.read_bytes()
    report=json.loads(contents.decode("utf-8"))
    if (report.get("version")!="fun-qwen-verified-window-toolbridge-v10-5" or
        report.get("state")!="V105_ISOLATED_REAL_QWEN_TO_VERIFIED_MATH_BRIDGE_COMPLETE_NOT_DEPLOYED" or
        report.get("original_model_sha256")!=MODEL_SHA or
        report.get("case_count")!=N_CASES or
        report.get("frozen_test_opened") is not False or
        report.get("training_or_deployment_performed") is not False or
        report.get("original_qwen_weights_modified") is not False or
        report.get("native_qwen_baseline_inference_completed")!=N_CASES):
        raise RuntimeError("V107_V105_REPORT_IDENTITY_OR_SCOPE_MISMATCH")
    rows=report.get("records")
    if not isinstance(rows,list) or len(rows)!=N_CASES:
        raise RuntimeError("V107_V105_REPORT_ROW_COUNT_INVALID")
    by_id={c["id"]:c for c in provenance["cases"]}
    if len(by_id)!=N_CASES or {r.get("id") for r in rows}!=set(by_id):
        raise RuntimeError("V107_V105_CASE_IDS_NOT_ATTESTED")
    for row in rows:
        source=by_id[row["id"]]
        answer=row.get("original_model_response")
        if (row.get("question")!=source["prompt"] or
            row.get("pattern")!=list(source["pattern"]) or
            row.get("expected_winners")!=list(source["pattern"]) or
            not isinstance(answer,str) or
            sha_bytes(answer.encode("utf-8"))!=row.get("model_generation_sha256") or
            row.get("verified_output")!=v104.verify(source["errors"])["verified_answer"] or
            row.get("verified_answer_mathematically_correct") is not True):
            raise RuntimeError("V107_V105_SAVED_RECORD_INCONSISTENT_"+row["id"])
    return {"sha256":sha_bytes(contents),"ids":set(by_id)}

def select_fresh_cases():
    """Fourth previously unused validation item per pattern, not frozen test."""
    provenance=v105.select_unseen_validation()
    prev=read_prior_v105(provenance)
    prior_ids=set(provenance["original_v101_case_ids"])|prev["ids"]
    sources=provenance["source_hashes"]
    val=v101.DATA_DIR/"validation.jsonl"
    oracle=v101.DATA_DIR/"validation-ground-truth.jsonl"
    for path in (val,oracle):
        if (not path.is_file() or path.is_symlink() or
            path.stat().st_size>MAX_SOURCE_BYTES or
            v105.hash_file(path)!=sources.get(str(path))):
            raise RuntimeError("V107_VALIDATION_SOURCE_HASH_HOLD_"+path.name)
    inputs=[json.loads(x) for x in val.read_text("utf-8").splitlines()]
    truths=[json.loads(x) for x in oracle.read_text("utf-8").splitlines()]
    if len(inputs)!=84 or len(truths)!=84:
        raise RuntimeError("V107_VALIDATION_LENGTH_INVALID")
    group={pattern:[] for pattern in v10.PATTERNS}
    all_prompts=set()
    for i,(row,truth) in enumerate(zip(inputs,truths)):
        caseid="v10-validation-"+str(i)
        if set(row)!={"messages"} or len(row["messages"])!=2:
            raise RuntimeError("V107_SOURCE_CHAT_STRUCTURE_INVALID")
        q,a=row["messages"]
        if q.get("role")!="user" or a.get("role")!="assistant":
            raise RuntimeError("V107_SOURCE_CHAT_ROLES_INVALID")
        prompt=q["content"]
        answer=a["content"]
        if prompt in all_prompts:
            raise RuntimeError("V107_DUPLICATE_VALIDATION_PROMPT")
        all_prompts.add(prompt)
        errors=v104.checked_errors(v105.v103_parse(prompt))
        pattern=v10.argmin_set(errors)
        if (truth.get("question")!=prompt or
            {int(k):v for k,v in truth.get("errors",{}).items()}!=errors or
            truth.get("best_windows")!=list(pattern) or
            truth.get("oracle_pairwise_differences")!=v10.pairwise_differences(errors) or
            answer!=v10.encode_label(errors)):
            raise RuntimeError("V107_SOURCE_ORACLE_DISAGREES_"+caseid)
        if caseid not in prior_ids:
            group[pattern].append({
                "id":caseid,"prompt":prompt,"errors":errors,"pattern":pattern,
                "reference_answer":answer,
                "source_id":"V107Val"+str(i),
            })
    if any(len(rows)!=9 for rows in group.values()):
        raise RuntimeError("V107_PRIOR_EXCLUSIONS_DID_NOT_LEAVE_NINE_PER_PATTERN")
    selected=[group[p][0] for p in v10.PATTERNS]
    if len(selected)!=N_CASES or len({c["id"] for c in selected})!=N_CASES or \
       any(c["id"] in prior_ids for c in selected):
        raise RuntimeError("V107_VALIDATION_CASE_SELECTION_FAILED")
    return {
        "cases":selected,"source_hashes":sources,
        "prior_v105_report_sha256":prev["sha256"],
        "prior_v101_report_sha256":provenance["prior_v101_report_sha256"],
        "excluded_previous_case_count":len(prior_ids),
    }

def tool_request_prompt(case):
    """Prompt for an actual request, NEVER include a ready-made answer or JSON fixture."""
    errors=v104.checked_errors(case["errors"])
    if errors!=v105.v103_parse(case["prompt"]):
        raise RuntimeError("V107_TRUSTED_CASE_PROMPT_MISMATCH")
    if not v106.SOURCE_RE.fullmatch(case["source_id"]):
        raise RuntimeError("V107_INVALID_ASSIGNED_SOURCE_ID")
    return (
        "You are allowed to request exactly ONE read-only mathematical tool, "
        "named verify_window_math. Do not calculate or present the final answer. "
        "Return only ONE valid, compact JSON object, without Markdown, explanation, "
        "or code fences. Its four top-level keys must be schema, tool, source_id, "
        "arguments. Set schema to fun-math-tool-proposal-v1 and tool to verify_window_math. "
        "Set source_id to "+case["source_id"]+". "
        "Arguments must contain exactly e3, e5, and e8 with JSON integer values "
        "copied precisely from the observed validation errors in the question. "
        "Do not invent numbers, options, extra keys or other actions. "
        "Question: "+case["prompt"]
    )

def evaluate_proposal(case,text):
    """Reject invalid Qwen requests; NEVER manufacture an accepted tool call."""
    errors=v104.checked_errors(case["errors"])
    if errors!=v105.v103_parse(case["prompt"]):
        raise RuntimeError("V107_HOST_NUMBERS_NOT_MATCHING_VERIFIED_QUESTION")
    host=v106.host_authority(case["source_id"],errors)
    accepted=None
    rejected_reason=None
    try:
        accepted=v106.dispatch(host,text)
    except (ValueError,TypeError) as e:
        rejected_reason=str(e)[:300]
    if accepted is None:
        return {
            "id":case["id"],"pattern":list(case["pattern"]),
            "source_id":case["source_id"],
            "proposal_status":"REJECTED_FAIL_CLOSED",
            "proposal_rejection_reason":rejected_reason,
            "host_math_tool_dispatched":False,
            "source_values_from_qwen_used_as_authority":False,
            "verified_tool_answer":None,
            "host_oracle_reference_for_diagnostics":v104.verify(errors)["verified_answer"],
            "raw_generated_proposal":text,
            "real_qwen_inference_provenance":False,
            "production_or_rea_action":False,
        }
    if accepted["verified_answer"]!=v104.verify(errors)["verified_answer"] or \
       accepted["arguments_matched_host_authority"] is not True:
        raise RuntimeError("V107_ACCEPTED_TOOL_ORACLE_DISAGREEMENT")
    return {
        "id":case["id"],"pattern":list(case["pattern"]),
        "source_id":case["source_id"],
        "proposal_status":"VALID_HOST_AUTHORIZED_AND_DISPATCHED",
        "proposal_rejection_reason":None,
        "host_math_tool_dispatched":True,
        "source_values_from_qwen_used_as_authority":False,
        "verified_tool_answer":accepted["verified_answer"],
        "host_oracle_reference_for_diagnostics":v104.verify(errors)["verified_answer"],
        "raw_generated_proposal":text,
        "real_qwen_inference_provenance":False,
        "production_or_rea_action":False,
    }

def preflight():
    if sys.platform!="win32":
        raise RuntimeError("V107_WINDOWS_REQUIRED")
    if RUN.exists() or RUN.is_symlink():
        raise RuntimeError("V107_OUTPUT_DIR_EXISTS_NO_OVERWRITE")
    selected=select_fresh_cases()
    msha=v5.checked_hash(v5.LIVE_GGUF,MODEL_SHA)
    binary=v7.inspect_existing_binary()
    if binary is None:
        raise RuntimeError("V107_PREEXISTING_PINNED_COMPLETION_BINARY_REQUIRED")
    memory=v7.initial_resources()
    return {"selected":selected,"sha":msha,"binary":binary,"memory":memory}

def run():
    prep=preflight()
    print("FUN_QWEN_V107_PREFLIGHT="+json.dumps({
        "status":"REAL_QWEN_TOOL_REQUEST_CPU_ONLY_VALIDATION_READY",
        "cases":N_CASES,"prior_cases_excluded":prep["selected"]["excluded_previous_case_count"],
        "original_model_sha256":prep["sha"],
        "free_host_gib":prep["memory"]["host_free_gib"],
        "commit_headroom_gib":prep["memory"]["commit_headroom_gib"],
        "frozen_test_opened":False,"live_deployment":False,
    },sort_keys=True),flush=True)
    RUN.mkdir()
    results=[]
    for index,case in enumerate(prep["selected"]["cases"]):
        print("FUN_QWEN_V107_CASE="+json.dumps({
            "ordinal":index+1,"id":case["id"],"pattern":list(case["pattern"]),
            "source_id":case["source_id"]
        },sort_keys=True),flush=True)
        native_case={
            "id":case["id"],"prompt":tool_request_prompt(case),
            "reference_answer":case["reference_answer"],
        }
        native=v7.run_case(prep["binary"],native_case,"baseline",RUN)
        result=evaluate_proposal(case,native["generated_text"])
        result["real_qwen_inference_provenance"]=True
        result["raw_qwen_sha256"]=native["generated_sha256"]
        result["native_log_paths"]=[native["stdout_log"],native["stderr_log"]]
        results.append(result)
        print("FUN_QWEN_V107_CASE_RESULT="+json.dumps({
            "id":result["id"],"status":result["proposal_status"],
            "reason":result["proposal_rejection_reason"],
            "host_tool_dispatched":result["host_math_tool_dispatched"],
            "generated_proposal":native["generated_text"][:600],
            "host_verified_answer":result["verified_tool_answer"],
        },sort_keys=True),flush=True)
    if len(results)!=N_CASES:
        raise RuntimeError("V107_INFERENCE_INCOMPLETE")
    for path,expected in prep["selected"]["source_hashes"].items():
        if v105.hash_file(Path(path))!=expected:
            raise RuntimeError("V107_V10_VALIDATION_SOURCE_CHANGED")
    if v105.hash_file(v102.REPORT)!=prep["selected"]["prior_v101_report_sha256"] or \
       v105.hash_file(PREVIOUS)!=prep["selected"]["prior_v105_report_sha256"]:
        raise RuntimeError("V107_PROTECTED_PRIOR_EVIDENCE_CHANGED")
    if v105.hash_file(v5.LIVE_GGUF)!=MODEL_SHA:
        raise RuntimeError("V107_PROTECTED_QWEN_MODEL_CHANGED")
    accepted=sum(x["host_math_tool_dispatched"] for x in results)
    summary={
        "version":VERSION,
        "state":"V107_ISOLATED_REAL_QWEN_TOOL_REQUESTS_EVALUATED_NO_DEPLOYMENT",
        "total_real_qwen_cpu_requests":len(results),
        "valid_model_generated_requests":accepted,
        "invalid_model_generated_requests_rejected":N_CASES-accepted,
        "trusted_host_dispatches":accepted,
        "host_tool_correct_results":sum(
            x["host_math_tool_dispatched"] and
            x["verified_tool_answer"]==x["host_oracle_reference_for_diagnostics"]
            for x in results),
        "independent_oracle_reference_count_for_diagnostics":N_CASES,
        "previous_qwen_validation_cases_excluded":prep["selected"]["excluded_previous_case_count"],
        "frozen_test_opened":False,
        "source_model_sha256":MODEL_SHA,
        "model_output_never_grants_authority":True,
        "host_source_fingerprint_is_not_authentication":True,
        "native_model_tool_call_protocol_proven":False,
        "architecture":"isolated_llama_completion_json_request_plus_external_host_dispatch",
        "training_performed":False,
        "live_fun_or_rea_modified":False,
        "elektron_untouched":True,
        "records":results,
    }
    with (RUN/"tool-requests-report.json").open("x",encoding="utf-8") as f:
        json.dump(summary,f,indent=2,sort_keys=True,ensure_ascii=False)
    print("FUN_QWEN_V107_RESULT="+json.dumps(
        {k:v for k,v in summary.items() if k!="records"},sort_keys=True),flush=True)
    print("FUN_QWEN_V107_REPORT="+str(RUN/"tool-requests-report.json"),flush=True)
    print("FUN_QWEN_V107=REAL_MODEL_TOOL_REQUESTS_MEASURED_NOT_DEPLOYED",flush=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--approval",default="")
    parser.add_argument("--preflight",action="store_true")
    args=parser.parse_args()
    if not args.preflight and args.approval!=CONSENT:
        raise RuntimeError("V107_EXPLICIT_OPERATOR_APPROVAL_REQUIRED")
    if args.preflight:
        ready=preflight()
        print("FUN_QWEN_V107_PREFLIGHT="+json.dumps({
            "state":"READY_FOR_ISOLATED_TOOL_REQUEST_TEST_NO_INFERENCE",
            "case_count":len(ready["selected"]["cases"]),
            "prior_cases_excluded":ready["selected"]["excluded_previous_case_count"],
            "host_free_gib":ready["memory"]["host_free_gib"],
            "model_sha256":ready["sha"],"frozen_test_unopened":True,
        },sort_keys=True),flush=True)
        return
    run()

if __name__=="__main__":
    try:
        main()
    except (ValueError,TypeError,KeyError,RuntimeError,OSError,ArithmeticError) as e:
        print(json.dumps({
            "version":VERSION,"state":"HOLD_V107_TOOL_REQUEST_EXPERIMENT_UNVERIFIED",
            "reason":str(e)[:480],"no_training_or_deployment_intended":True,
        },sort_keys=True),flush=True)
        sys.exit(2)
