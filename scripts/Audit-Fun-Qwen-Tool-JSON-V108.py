#!/usr/bin/env python3
"""Fun Industrial V10.8: read-only forensic replay of real V10.7 model JSON.

Tests exactly ONE extraneous trailing "}" recovery as a DIAGNOSTIC.
Historical malformed requests remain REJECTED. No production parser
changes, autonomous tools, inference, model weights, REA or service calls.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

VERSION="fun-qwen-tool-json-trailing-brace-forensics-v10-8"
ROOT=Path(__file__).resolve().parents[1]
MAX_REPORT_BYTES=220000
MODEL_SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/"scripts"/path)
    obj=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

v107=load("fun_v108_verified_v107","Evaluate-Fun-Qwen-Tool-Requests-V107.py")
v106=v107.v106
v104=v107.v104
SOURCE=v107.RUN/"tool-requests-report.json"

def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(65536),b""):
            h.update(chunk)
    return h.hexdigest()

def inspect_request(case,raw):
    """Simulate a narrowly scoped one-brace fix WITHOUT altering original.

    Exact grammar is still required after removing the final brace.
    Host-provenance and all integer values must match; a malformed,
    forged or larger repair remains blocked. The one-character candidate
    is never relabeled a model-produced strictly valid JSON request.
    """
    host=v106.host_authority(case["source_id"],v104.checked_errors(case["errors"]))
    raw_result=v107.evaluate_proposal(case,raw)
    if raw_result["host_math_tool_dispatched"]:
        return {
            "raw_json_accepted":True,
            "raw_json_reject_reason":None,
            "one_brace_candidate":False,
            "would_pass_full_host_contract_after_one_brace":False,
            "simulated_tool_answer":None,
            "diagnostic":"RAW_ALREADY_VALID_NO_NORMALIZATION",
        }
    reason=raw_result["proposal_rejection_reason"]
    if reason!="V106_PROPOSAL_NOT_STRICT_JSON":
        return {
            "raw_json_accepted":False,
            "raw_json_reject_reason":reason,
            "one_brace_candidate":False,
            "would_pass_full_host_contract_after_one_brace":False,
            "simulated_tool_answer":None,
            "diagnostic":"NON_SYNTAX_OR_AMBIGUOUS_FAILURE_"+str(reason)[:160],
        }
    # JSON object key order is irrelevant: the final field may be scalar
    # (one closing brace) or an object (two). Require the raw string to
    # be invalid and end in a closing brace, then remove EXACTLY ONE byte.
    # The UNCHANGED V10.6 strict parser and host authority check must pass.
    if not isinstance(raw,str) or not raw.startswith("{") or not raw.endswith("}") or \
       len(raw.encode("utf-8"))>v106.MAX_REQUEST_BYTES:
        return {
            "raw_json_accepted":False,
            "raw_json_reject_reason":reason,
            "one_brace_candidate":False,
            "would_pass_full_host_contract_after_one_brace":False,
            "simulated_tool_answer":None,
            "diagnostic":"NOT_EXACTLY_TARGETED_TRAILING_BRACE_SHAPE",
        }
    candidate=raw[:-1]
    try:
        normalized=v106.parse_proposal(candidate)
        # Strict identity: no new fields, no difference in observed trusted
        # values, no automatically guessed JSON or model-generated authority.
        if normalized["source_id"]!=host["source_id"] or \
           normalized["arguments"]!={"e3":host["errors"][3],
                                    "e5":host["errors"][5],
                                    "e8":host["errors"][8]}:
            raise ValueError("V108_HOST_AUTHORITY_MISMATCH")
        verified=v106.dispatch(host,candidate)
        if verified["verified_answer"]!=v104.verify(case["errors"])["verified_answer"]:
            raise RuntimeError("V108_HOST_TOOL_ORACLE_DISAGREES")
    except (ValueError,TypeError,RuntimeError) as e:
        return {
            "raw_json_accepted":False,
            "raw_json_reject_reason":reason,
            "one_brace_candidate":True,
            "would_pass_full_host_contract_after_one_brace":False,
            "simulated_tool_answer":None,
            "diagnostic":"CANDIDATE_REJECTED_"+str(e)[:160],
        }
    return {
        "raw_json_accepted":False,
        "raw_json_reject_reason":reason,
        "one_brace_candidate":True,
        "would_pass_full_host_contract_after_one_brace":True,
        "simulated_tool_answer":verified["verified_answer"],
        "diagnostic":"HYPOTHETICAL_HOST_VALID_NOT_ACTUALLY_DISPATCHED_IN_V107",
    }

def verified_evidence():
    if not SOURCE.is_file() or SOURCE.is_symlink() or \
       not 0<SOURCE.stat().st_size<=MAX_REPORT_BYTES:
        raise RuntimeError("V108_EXISTING_V107_REPORT_MISSING_OR_UNTRUSTED")
    raw_file=SOURCE.read_bytes()
    original_sha=hashlib.sha256(raw_file).hexdigest()
    document=json.loads(raw_file.decode("utf-8"))
    if (document.get("version")!="fun-qwen-isolated-tool-request-v10-7" or
        document.get("state")!="V107_ISOLATED_REAL_QWEN_TOOL_REQUESTS_EVALUATED_NO_DEPLOYMENT" or
        document.get("source_model_sha256")!=MODEL_SHA or
        document.get("total_real_qwen_cpu_requests")!=7 or
        document.get("valid_model_generated_requests")!=0 or
        document.get("trusted_host_dispatches")!=0 or
        document.get("host_tool_correct_results")!=0 or
        document.get("invalid_model_generated_requests_rejected")!=7 or
        document.get("previous_qwen_validation_cases_excluded")!=21 or
        document.get("frozen_test_opened") is not False or
        document.get("training_performed") is not False or
        document.get("live_fun_or_rea_modified") is not False):
        raise RuntimeError("V108_V107_REPORT_SCOPE_OR_SCORE_MISMATCH")
    source=v107.select_fresh_cases()
    cases=source["cases"]
    by_id={c["id"]:c for c in cases}
    if len(by_id)!=7 or len(document.get("records",[]))!=7:
        raise RuntimeError("V108_SAVED_CASE_COUNT_INVALID")
    if {r.get("id") for r in document["records"]}!=set(by_id):
        raise RuntimeError("V108_REPORT_CASE_IDS_DIFFER_FROM_VERIFIED_VALIDATION")
    for record in document["records"]:
        case=by_id[record["id"]]
        text=record.get("raw_generated_proposal")
        if (record.get("pattern")!=list(case["pattern"]) or
            record.get("source_id")!=case["source_id"] or
            record.get("proposal_status")!="REJECTED_FAIL_CLOSED" or
            record.get("host_math_tool_dispatched") is not False or
            record.get("verified_tool_answer") is not None or
            record.get("real_qwen_inference_provenance") is not True or
            record.get("source_values_from_qwen_used_as_authority") is not False or
            record.get("production_or_rea_action") is not False or
            not isinstance(text,str) or
            hashlib.sha256(text.encode("utf-8")).hexdigest()!=record.get("raw_qwen_sha256") or
            record.get("host_oracle_reference_for_diagnostics")!=
                v104.verify(case["errors"])["verified_answer"]):
            raise RuntimeError("V108_SAVED_QWEN_RECORD_UNVERIFIED_"+record["id"])
        regraded=v107.evaluate_proposal(case,text)
        if regraded["proposal_status"]!=record["proposal_status"] or \
           regraded["proposal_rejection_reason"]!=record.get("proposal_rejection_reason"):
            raise RuntimeError("V108_V107_ORIGINAL_REJECTION_NOT_REPRODUCIBLE")
    return {"sha256":original_sha,"cases":by_id,"original":document,
            "source_hashes":source["source_hashes"],
            "v101_sha256":source["prior_v101_report_sha256"],
            "v105_sha256":source["prior_v105_report_sha256"]}

def audit():
    evidence=verified_evidence()
    rows=[]
    for record in evidence["original"]["records"]:
        case=evidence["cases"][record["id"]]
        diagnostic=inspect_request(case,record["raw_generated_proposal"])
        rows.append({
            "id":record["id"],
            "pattern":list(case["pattern"]),
            "raw_qwen_sha256":record["raw_qwen_sha256"],
            "raw_v107_status":record["proposal_status"],
            **diagnostic,
        })
    # Re-hash originals; never edit them.
    if sha(SOURCE)!=evidence["sha256"] or \
       sha(v107.v102.REPORT)!=evidence["v101_sha256"] or \
       sha(v107.PREVIOUS)!=evidence["v105_sha256"]:
        raise RuntimeError("V108_PROTECTED_REPORT_CHANGED")
    for path,digest in evidence["source_hashes"].items():
        if sha(Path(path))!=digest:
            raise RuntimeError("V108_PROTECTED_CURRICULUM_CHANGED")
    if len(rows)!=7:
        raise RuntimeError("V108_MISSING_CASE_DIAGNOSTICS")
    return {
        "version":VERSION,
        "state":"V108_READONLY_EXTRA_BRACE_JSON_FORENSICS_COMPLETE",
        "original_v107_report_sha256":evidence["sha256"],
        "original_real_qwen_requests":7,
        "raw_valid_tool_requests":0,
        "raw_host_dispatches":0,
        "single_trailing_brace_shape_count":sum(x["one_brace_candidate"] for x in rows),
        "hypothetical_host_valid_after_one_brace_removal":
            sum(x["would_pass_full_host_contract_after_one_brace"] for x in rows),
        "hypothetical_results_never_counted_as_real_model_success":True,
        "models_retrained_or_inferred":False,
        "host_dispatch_in_original_v107_remains_zero":True,
        "new_live_tool_registration":False,
        "source_reports_or_data_changed":False,
        "frozen_test_opened":False,
        "records":rows,
    }

def main():
    report=audit()
    print("FUN_QWEN_V108_SUMMARY="+json.dumps(
        {k:v for k,v in report.items() if k!="records"},sort_keys=True),flush=True)
    for row in report["records"]:
        print("FUN_QWEN_V108_CASE="+json.dumps({
            k:v for k,v in row.items() if k!="simulated_tool_answer"
        },sort_keys=True),flush=True)
    print("FUN_QWEN_V108=READONLY_JSON_TERMINATION_FORENSICS_PASS_NO_DEPLOYMENT",flush=True)

if __name__=="__main__":
    try:
        main()
    except (OSError,TypeError,ValueError,RuntimeError,KeyError) as e:
        print(json.dumps({
            "version":VERSION,
            "state":"HOLD_V108_JSON_FORENSICS_NOT_VERIFIED",
            "reason":str(e)[:390],
            "new_inference_training_or_production_changes":False,
        },sort_keys=True),flush=True)
        sys.exit(2)
