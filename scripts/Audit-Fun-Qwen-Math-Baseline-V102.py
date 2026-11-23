#!/usr/bin/env python3
"""Fun Industrial V10.2: strict read-only, proof-aware regrade of V10.1 output.

Separates: correct winner sets, correct minimum/tie, arithmetic correctness,
and deviations in text formatting. No inference, training, model reads,
downloads, filesystem mutation, or modification of original V10/V10.1 files.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from collections import Counter

VERSION="fun-qwen-math-baseline-proof-audit-v10-2"
ROOT=Path(__file__).resolve().parents[1]
MODEL_SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
MAX_REPORT=250_000
FIELD_TYPES={
    "MIN_ERROR":r"([+-]?\d+)",
    "BEST_WINDOWS":r"((?:3|5|8)(?:\s*,\s*(?:3|5|8)){0,2})",
    "TIE":r"(YES|NO)",
    "FIBONACCI_GUARANTEE":r"(YES|NO)",
    "PROOF_D35":r"([+-]?\d+)",
    "D38":r"([+-]?\d+)",
    "D58":r"([+-]?\d+)",
}
EXPECTED_PATTERN_COUNT=7
CASES_PER_PATTERN=2
EXPECTED_CASES=14

def load_module(name, rel):
    spec=importlib.util.spec_from_file_location(name,ROOT/"scripts"/rel)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

v10=load_module("fun_qwen_v102_oracle","Build-Fun-Qwen-Math-Foundation-V10.py")
v101=load_module("fun_qwen_v102_baseline","Evaluate-Fun-Qwen-Math-Baseline-V101.py")
REPORT=v101.RUN/"baseline-report.json"

def parse_fields(response):
    """Flexible about punctuation/spacing, strict about field uniqueness.

    This is a REPORT AUDIT, not a replacement for the original canonical
    V10 answer format. Malformed/ambiguous tokens fail rather than guessed.
    """
    if not isinstance(response,str) or len(response)>15000:
        raise ValueError("V102_RESPONSE_NOT_A_BOUNDED_STRING")
    fields={}
    missing=[]
    ambiguous=[]
    for key,pattern in FIELD_TYPES.items():
        # Disallow embedded key names and duplicated fields, but permit
        # spaces after '=' and between comma-separated window labels.
        regex=r"(?<![A-Za-z0-9_])"+re.escape(key)+r"\s*=\s*"+pattern+r"(?=\s*[,;.\n]|$)"
        matches=re.findall(regex,response,flags=re.I)
        if not matches:
            missing.append(key)
            continue
        if len(matches)!=1:
            ambiguous.append(key)
            continue
        value=matches[0]
        if key in ("MIN_ERROR","PROOF_D35","D38","D58"):
            fields[key]=int(value)
        elif key=="BEST_WINDOWS":
            values=tuple(int(x.strip()) for x in value.split(","))
            if len(values)!=len(set(values)) or values!=tuple(sorted(values)):
                ambiguous.append(key)
            else:
                fields[key]=values
        else:
            fields[key]=value.upper()=="YES"
    state=("COMPLETE" if not missing and not ambiguous else
           "AMBIGUOUS" if ambiguous else "INCOMPLETE")
    return {"state":state,"fields":fields,
            "missing":missing,"ambiguous":ambiguous}

def grade(case, answer):
    errors=case["errors"]
    truth=v10.argmin_set(errors)
    differences=v10.pairwise_differences(errors)
    parsed=parse_fields(answer)
    fields=parsed["fields"]
    expected={
        "MIN_ERROR":min(errors.values()),
        "BEST_WINDOWS":truth,
        "TIE":len(truth)>1,
        "FIBONACCI_GUARANTEE":False,
        "PROOF_D35":differences["D35"],
        "D38":differences["D38"],
        "D58":differences["D58"],
    }
    detail={}
    for key,want in expected.items():
        observed=fields.get(key)
        correct=(observed==want) if key in fields else None
        sign_error=(key in ("PROOF_D35","D38","D58") and
                    observed is not None and want!=0 and
                    observed!=want and abs(observed)==abs(want))
        detail[key]={"expected":list(want) if isinstance(want,tuple) else want,
                     "observed":list(observed) if isinstance(observed,tuple) else observed,
                     "correct":correct,"sign_error":sign_error}
    decision_fields=("MIN_ERROR","BEST_WINDOWS","TIE","FIBONACCI_GUARANTEE")
    proof_fields=("PROOF_D35","D38","D58")
    correct_decision=all(detail[k]["correct"] is True for k in decision_fields)
    correct_proof=all(detail[k]["correct"] is True for k in proof_fields)
    # The original strict scorer requires exact canonical delimiters. We
    # retain its outcome unchanged and report relaxed MATHEMATICAL accuracy
    # separately rather than silently promoting a failed format.
    return {
        "parse_state":parsed["state"],
        "missing_fields":parsed["missing"],
        "ambiguous_fields":parsed["ambiguous"],
        "fields":detail,
        "winner_set_correct":detail["BEST_WINDOWS"]["correct"],
        "minimum_correct":detail["MIN_ERROR"]["correct"],
        "tie_correct":detail["TIE"]["correct"],
        "guarantee_correct":detail["FIBONACCI_GUARANTEE"]["correct"],
        "all_decision_fields_correct":correct_decision,
        "all_proof_fields_correct":correct_proof,
        "complete_math_content_correct":correct_decision and correct_proof,
        "proof_sign_errors":sum(detail[k]["sign_error"] for k in proof_fields),
    }

def validate_report():
    if not REPORT.is_file() or REPORT.is_symlink() or REPORT.stat().st_size>MAX_REPORT:
        raise RuntimeError("V102_ORIGINAL_BASELINE_REPORT_MISSING_OR_UNTRUSTED")
    report_bytes=REPORT.read_bytes()
    report_sha=hashlib.sha256(report_bytes).hexdigest()
    old=json.loads(report_bytes.decode("utf-8"))
    if (old.get("version")!="fun-qwen-math-baseline-v10-1" or
        old.get("state")!="V101_ORIGINAL_QWEN_MATH_BASELINE_EVALUATED_NO_TRAINING" or
        old.get("source_model_sha256")!=MODEL_SHA or
        old.get("selected_split")!="validation_only_frozen_test_not_opened" or
        old.get("case_count")!=EXPECTED_CASES or
        old.get("test_set_unopened") is not True or
        old.get("retraining_performed") is not False or
        old.get("adapter_deployed") is not False):
        raise RuntimeError("V102_BASELINE_REPORT_IDENTITY_OR_SCOPE_MISMATCH")
    # Ground every saved answer in the separately SHA-verified V10 validation
    # and training inputs. Do not open V10's reserved test split.
    source=v101.verified_dataset()
    cases=source["cases"]
    originals=old.get("records",[])
    if not isinstance(originals,list) or len(originals)!=EXPECTED_CASES:
        raise RuntimeError("V102_ORIGINAL_REPORT_RECORD_COUNT_INVALID")
    by_id={x["id"]:x for x in cases}
    if len(by_id)!=EXPECTED_CASES or len({x.get("id") for x in originals})!=EXPECTED_CASES:
        raise RuntimeError("V102_DUPLICATE_OR_MISSING_CASE")
    if set(x["id"] for x in originals)!=set(by_id):
        raise RuntimeError("V102_REPORT_CASE_IDS_NOT_IN_VERIFIED_VALIDATION")
    for record in originals:
        ref=by_id[record["id"]]
        actual_errors={int(k):int(v) for k,v in record["errors"].items()}
        if (record.get("pattern")!=list(ref["pattern"]) or
            actual_errors!=ref["errors"] or
            record.get("reference")!=ref["reference_answer"] or
            not isinstance(record.get("generated_text"),str) or
            hashlib.sha256(record["generated_text"].encode("utf-8")).hexdigest()!=
                record.get("generation_sha256")):
            raise RuntimeError("V102_UNTRUSTED_BASELINE_RECORD_"+record["id"])
        if record["grade"]["strict_exact_answer"] is not False:
            raise RuntimeError("V102_OLD_BASELINE_GRADING_DIFFERENT_REQUIRE_REVIEW")
    return {"old":old,"source":source,"by_id":by_id,
            "sha256":report_sha,"report_bytes":report_bytes}

def analyze():
    v=validate_report()
    rows=[]
    pattern_score=Counter()
    by_field=Counter()
    sign_errors=Counter()
    malformed=Counter()
    for record in v["old"]["records"]:
        reference=v["by_id"][record["id"]]
        scoring=grade(reference,record["generated_text"])
        key=",".join(map(str,reference["pattern"]))
        pattern_score[(key,"total")]+=1
        if scoring["winner_set_correct"] is True:
            pattern_score[(key,"winner_correct")]+=1
        if scoring["all_decision_fields_correct"]:
            pattern_score[(key,"decision_correct")]+=1
        if scoring["all_proof_fields_correct"]:
            pattern_score[(key,"proof_correct")]+=1
        if scoring["complete_math_content_correct"]:
            pattern_score[(key,"math_content_correct")]+=1
        malformed[scoring["parse_state"]]+=1
        for k,item in scoring["fields"].items():
            if item["correct"] is True:
                by_field[(k,"correct")]+=1
            elif item["correct"] is False:
                by_field[(k,"wrong")]+=1
            else:
                by_field[(k,"missing")]+=1
            if item["sign_error"]:
                sign_errors[k]+=1
        rows.append({"id":record["id"],"pattern":list(reference["pattern"]),
                     "grade":scoring})
    if len(pattern_score)!=EXPECTED_PATTERN_COUNT*2 and \
       len(set(k for k,_ in pattern_score))!=EXPECTED_PATTERN_COUNT:
        raise RuntimeError("V102_PATTERN_GROUP_COUNTS_UNEXPECTED")
    # Preserve the original report unchanged and fingerprint it again.
    if hashlib.sha256(REPORT.read_bytes()).hexdigest()!=v["sha256"]:
        raise RuntimeError("V102_ORIGINAL_REPORT_CHANGED_DURING_AUDIT")
    for path,sha in v["source"]["source_hashes"].items():
        if hashlib.sha256(Path(path).read_bytes()).hexdigest()!=sha:
            raise RuntimeError("V102_V10_SOURCE_CHANGED_DURING_AUDIT")
    summary={
        "version":VERSION,
        "state":"V102_READONLY_MATH_DECISION_VS_ARITHMETIC_REGRADING_COMPLETE",
        "source_v101_report_sha256":v["sha256"],
        "evaluated_cases":len(rows),
        "original_v101_strict_exact_correct":v["old"]["strict_exact_correct"],
        "all_winner_sets_correct":sum(r["grade"]["winner_set_correct"] is True for r in rows),
        "all_decision_fields_correct":sum(r["grade"]["all_decision_fields_correct"] for r in rows),
        "all_proof_fields_correct":sum(r["grade"]["all_proof_fields_correct"] for r in rows),
        "complete_math_content_correct":sum(r["grade"]["complete_math_content_correct"] for r in rows),
        "responses_with_all_fields":malformed["COMPLETE"],
        "missing_or_ambiguous_responses":len(rows)-malformed["COMPLETE"],
        "field_scores":{k:{"correct":by_field[(k,"correct")],
                           "wrong":by_field[(k,"wrong")],
                           "missing":by_field[(k,"missing")]} for k in FIELD_TYPES},
        "arithmetic_sign_error_counts":dict(sign_errors),
        "per_pattern":[{
            "winner_set":list(pattern),
            "cases":pattern_score[(",".join(map(str,pattern)),"total")],
            "winner_set_correct":pattern_score[(",".join(map(str,pattern)),"winner_correct")],
            "decision_correct":pattern_score[(",".join(map(str,pattern)),"decision_correct")],
            "proof_correct":pattern_score[(",".join(map(str,pattern)),"proof_correct")],
            "full_math_correct":pattern_score[(",".join(map(str,pattern)),"math_content_correct")],
        } for pattern in v10.PATTERNS],
        "mistakes":[{
            "id":r["id"],"pattern":r["pattern"],
            "incorrect_fields":{k:val for k,val in r["grade"]["fields"].items()
                                if val["correct"] is not True},
        } for r in rows if not r["grade"]["complete_math_content_correct"]],
        "interpretation":"Formatting deviations are distinguished from incorrect arithmetic. This rescoring does not improve model behavior or constitute training.",
        "frozen_test_opened":False,
        "inference_performed":False,
        "training_performed":False,
        "original_report_and_dataset_modified":False,
    }
    return summary

def main():
    result=analyze()
    print("FUN_QWEN_V102_RESULT="+json.dumps({k:v for k,v in result.items()
          if k not in ("mistakes","per_pattern")},sort_keys=True),flush=True)
    print("FUN_QWEN_V102_PER_PATTERN="+json.dumps(result["per_pattern"],sort_keys=True),flush=True)
    for mistake in result["mistakes"]:
        print("FUN_QWEN_V102_MISTAKE="+json.dumps(mistake,sort_keys=True),flush=True)
    print("FUN_QWEN_V102=PASS_READONLY_MATH_VS_FORMAT_AUDIT_NO_TRAINING",flush=True)

if __name__=="__main__":
    try:
        main()
    except (RuntimeError,OSError,ValueError,KeyError,TypeError) as e:
        print(json.dumps({"version":VERSION,
                          "state":"HOLD_V102_BASELINE_REGRADING_NOT_VERIFIED",
                          "reason":str(e)[:440],"inference_performed":False,
                          "training_performed":False,"source_writes_requested":False},
                         sort_keys=True),flush=True)
        sys.exit(2)
