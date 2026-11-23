#!/usr/bin/env python3
"""Fun Industrial V10.3: read-only deterministic mathematical proof firewall.

Verifies/reconstructs exact answers from tightly bounded observed errors,
never trusting Qwen's arithmetic. Audits EXISTING V10.1 baseline outputs
without inference, training, deploying, file writes, or reading frozen tests.

This prototype is NOT wired to the production dashboard or autonomous tools.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

VERSION="fun-qwen-deterministic-proof-guard-v10-3"
ROOT=Path(__file__).resolve().parents[1]
CASE_COUNT=14
MAX_ERROR=1000000000

def module(name, file):
    spec=importlib.util.spec_from_file_location(name,ROOT/"scripts"/file)
    m=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

v102=module("v103_v102_readonly_report","Audit-Fun-Qwen-Math-Baseline-V102.py")
v10=v102.v10
v101=v102.v101

# Narrow user-input grammar: reject extra/missing window values, arbitrary
# tool instructions and malformed numbers; source prompt is untrusted text.
PREFIX=re.compile(
    r"^Observed validation errors:\s*window 3 = (0|[1-9]\d{0,9}),\s*"
    r"window 5 = (0|[1-9]\d{0,9}),\s*window 8 = (0|[1-9]\d{0,9})\."
)
FIELD_NAMES=("MIN_ERROR","BEST_WINDOWS","TIE","FIBONACCI_GUARANTEE",
             "PROOF_D35","D38","D58")

def errors_from_question(prompt):
    if not isinstance(prompt,str) or len(prompt)>2000:
        raise ValueError("V103_QUESTION_TOO_LARGE_OR_WRONG_TYPE")
    match=PREFIX.match(prompt)
    if not match:
        raise ValueError("V103_QUESTION_NOT_RECOGNIZED")
    # Reject another window 3/5/8 assignment embedded in remainder;
    # the remaining fixed V10 instruction text is always checked for
    # equality with the original validated source in audit_saved_baseline.
    rest=prompt[match.end():]
    if re.search(r"\bwindow\s*(?:3|5|8)\s*=",rest,flags=re.I):
        raise ValueError("V103_CONFLICTING_WINDOW_ASSIGNMENT")
    errors={w:int(s) for w,s in zip((3,5,8),match.groups())}
    if any(v>MAX_ERROR for v in errors.values()):
        raise ValueError("V103_ERROR_VALUE_OUTSIDE_BOUNDS")
    if tuple(errors)!=v10.WINDOWS:
        raise ValueError("V103_MISSING_WINDOW")
    return errors

def oracle(errors):
    """Independently calculate finite integer differences and exact argmin."""
    winners=v10.argmin_set(errors)
    d35=errors[3]-errors[5]
    d38=errors[3]-errors[8]
    d58=errors[5]-errors[8]
    if d35+d58!=d38:
        raise ArithmeticError("V103_DIFFERENCE_IDENTITY_FAILED")
    if (d35==0)!=(errors[3]==errors[5]) or \
       (d38==0)!=(errors[3]==errors[8]) or \
       (d58==0)!=(errors[5]==errors[8]):
        raise ArithmeticError("V103_TIE_IDENTITY_FAILED")
    ans=v10.encode_label(errors)
    if not v10.grade_output(errors,ans)["exact_answer"]:
        raise ArithmeticError("V103_MATH_ORACLE_SELF_TEST_FAILED")
    return {
        "expected":{
            "MIN_ERROR":min(errors.values()),
            "BEST_WINDOWS":winners,
            "TIE":len(winners)>1,
            "FIBONACCI_GUARANTEE":False,
            "PROOF_D35":d35,
            "D38":d38,
            "D58":d58,
        },
        "canonical_answer":ans,
        "consistency":{"D35_PLUS_D58_EQUALS_D38":True,
                       "ties_match_zero_differences":True}
    }

def verify_response(errors,model_text):
    """Fail closed on malformed/multiple fields, then rebuild from oracle.

    Repaired answer comes ONLY from the original question values.
    Qwen's response is retained as evidence, not patched or trusted.
    """
    ground=oracle(errors)
    parsed=v102.parse_fields(model_text)
    if parsed["state"]!="COMPLETE" or set(parsed["fields"])!=set(FIELD_NAMES):
        raise ValueError("V103_MODEL_OUTPUT_INCOMPLETE_OR_AMBIGUOUS")
    expected=ground["expected"]
    actual=parsed["fields"]
    mismatches={}
    for field in FIELD_NAMES:
        if actual[field]!=expected[field]:
            a=actual[field]; b=expected[field]
            mismatches[field]={
                "observed":list(a) if isinstance(a,tuple) else a,
                "verified":list(b) if isinstance(b,tuple) else b,
            }
    model_proof_consistency=(actual["PROOF_D35"]+actual["D58"]==actual["D38"])
    status="VERIFIED_UNCHANGED" if not mismatches else "REBUILT_FROM_VERIFIED_INPUTS"
    return {
        "status":status,
        "mismatch_fields":mismatches,
        "model_field_count":len(actual),
        "model_proof_algebraically_consistent":model_proof_consistency,
        "verified_answer":ground["canonical_answer"],
        "verified_oracle":{k:list(v) if isinstance(v,tuple) else v for k,v in expected.items()},
        "verification_rule":"pairwise_integer_subtraction_plus_set_argmin",
        "corrected_text_was_generated_by_model":False,
        "model_weights_changed":False,
    }

def audit_saved_baseline():
    evidence=v102.validate_report()
    originals=evidence["old"]["records"]
    cases=evidence["by_id"]
    if len(originals)!=CASE_COUNT:
        raise RuntimeError("V103_CASE_COUNT_UNEXPECTED")
    rows=[]
    protected_hashes=evidence["source"]["source_hashes"]
    for record in originals:
        c=cases[record["id"]]
        errors=errors_from_question(c["prompt"])
        if errors!=c["errors"] or {int(k):int(v) for k,v in record["errors"].items()}!=errors:
            raise RuntimeError("V103_QUESTION_RECORD_VALUE_CONFLICT")
        answer=verify_response(errors,record["generated_text"])
        # Cross-check the rebuilt oracle against the corrected V10
        # reference, never against the prior Qwen answer itself.
        if answer["verified_answer"]!=c["reference_answer"]:
            raise RuntimeError("V103_REFERENCE_AND_FORMULA_DISAGREE")
        if not v10.grade_output(errors,answer["verified_answer"])["exact_answer"]:
            raise RuntimeError("V103_REBUILT_ANSWER_NOT_EXACT")
        rows.append({
            "id":record["id"],
            "pattern":list(c["pattern"]),
            "model_answer_sha256":record["generation_sha256"],
            "status":answer["status"],
            "mismatch_fields":answer["mismatch_fields"],
            "model_proof_algebraically_consistent":answer["model_proof_algebraically_consistent"],
            "verified_answer":answer["verified_answer"],
        })
    if len(rows)!=CASE_COUNT or len({x["id"] for x in rows})!=CASE_COUNT:
        raise RuntimeError("V103_INVALID_CASE_REPORT")
    # Make no claims about the original model having been repaired.
    if hashlib.sha256(v102.REPORT.read_bytes()).hexdigest()!=evidence["sha256"]:
        raise RuntimeError("V103_SAVED_MODEL_EVIDENCE_CHANGED")
    for source,expected_hash in protected_hashes.items():
        path=Path(source)
        with path.open("rb") as f:
            h=hashlib.sha256()
            for block in iter(lambda:f.read(64*1024),b""):
                h.update(block)
        if h.hexdigest()!=expected_hash:
            raise RuntimeError("V103_V10_CURRICULUM_SOURCE_CHANGED")
    rebuilt=sum(x["status"]=="REBUILT_FROM_VERIFIED_INPUTS" for x in rows)
    proof_fields=("PROOF_D35","D38","D58")
    return {
        "version":VERSION,
        "state":"V103_READONLY_DETERMINISTIC_PROOF_VERIFICATION_COMPLETE",
        "source_v101_report_sha256":evidence["sha256"],
        "cases":len(rows),
        "model_original_decision_correct":14,
        "model_original_complete_proof_correct":CASE_COUNT-rebuilt,
        "model_outputs_requiring_correction":rebuilt,
        "verified_reconstructed_answers_exact":sum(
            v10.grade_output(cases[x["id"]]["errors"],x["verified_answer"])["exact_answer"]
            for x in rows),
        "repaired_arithmetic_field_instances":sum(
            k in proof_fields for x in rows for k in x["mismatch_fields"]),
        "repaired_other_field_instances":sum(
            k not in proof_fields for x in rows for k in x["mismatch_fields"]),
        "original_model_improvement_proven":False,
        "inference_or_training_performed":False,
        "production_integration_performed":False,
        "original_reports_or_curriculum_changed":False,
        "frozen_test_opened":False,
        "records":rows,
    }

def main():
    result=audit_saved_baseline()
    print("FUN_QWEN_V103_SUMMARY="+json.dumps(
        {k:v for k,v in result.items() if k!="records"},sort_keys=True),flush=True)
    for rec in result["records"]:
        if rec["status"]!="VERIFIED_UNCHANGED":
            print("FUN_QWEN_V103_PROOF_REPAIR="+json.dumps(rec,sort_keys=True),flush=True)
    print("FUN_QWEN_V103=VERIFIED_ANSWER_RECONSTRUCTION_NO_MODEL_CHANGES",flush=True)

if __name__=="__main__":
    try:
        main()
    except (RuntimeError,ValueError,ArithmeticError,OSError,KeyError,TypeError) as e:
        print(json.dumps({"version":VERSION,
             "state":"HOLD_V103_DETERMINISTIC_PROOF_AUDIT_NOT_VERIFIED",
             "reason":str(e)[:400],
             "model_changed":False,"training_or_inference_performed":False},
             sort_keys=True),flush=True)
        sys.exit(2)
