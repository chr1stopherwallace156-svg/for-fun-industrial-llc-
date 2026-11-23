#!/usr/bin/env python3
"""V10.4: reusable typed, deterministic mathematical decision verifier.

Local-only Python standard-library component. Receives numeric errors directly,
NOT a Qwen-supplied assertion about the numbers. It never invokes a model,
trains/deploys weights, calls the network, or reads/writes local data.
Production Fun Industrial is NOT connected to this prototype.
"""
import argparse
import hashlib
import json
import math
import re
import sys

VERSION="fun-deterministic-window-math-v10-4"
WINDOWS=(3,5,8)
MAX_ERROR=1_000_000_000
FIELDS=("MIN_ERROR","BEST_WINDOWS","TIE","FIBONACCI_GUARANTEE",
        "PROOF_D35","D38","D58")
PATTERN={
 "MIN_ERROR":r"([+-]?\d+)",
 "BEST_WINDOWS":r"((?:3|5|8)(?:\s*,\s*(?:3|5|8)){0,2})",
 "TIE":r"(YES|NO)",
 "FIBONACCI_GUARANTEE":r"(YES|NO)",
 "PROOF_D35":r"([+-]?\d+)",
 "D38":r"([+-]?\d+)",
 "D58":r"([+-]?\d+)",
}

def bounded_int(value):
    if type(value) is not int or not 0<=value<=MAX_ERROR:
        raise ValueError("V104_INTEGER_IN_0_TO_1_BILLION_REQUIRED")
    return value

def checked_errors(errors):
    if not isinstance(errors,dict) or set(errors)!=set(WINDOWS):
        raise ValueError("V104_REQUIRES_EXACTLY_WINDOWS_3_5_8")
    return {w:bounded_int(errors[w]) for w in WINDOWS}

def calculate(errors):
    e=checked_errors(errors)
    least=min(e.values())
    winners=tuple(w for w in WINDOWS if e[w]==least)
    d35=e[3]-e[5]
    d38=e[3]-e[8]
    d58=e[5]-e[8]
    # Equality is not proof of correctness, so also compute every difference
    # directly from trusted numbers above.
    if d35+d58!=d38:
        raise ArithmeticError("V104_DIFFERENCE_IDENTITY_FAILED")
    if (d35==0)!=(e[3]==e[5]) or (d38==0)!=(e[3]==e[8]) or (d58==0)!=(e[5]==e[8]):
        raise ArithmeticError("V104_TIE_DIFFERENCE_MISMATCH")
    return {
        "MIN_ERROR":least,
        "BEST_WINDOWS":winners,
        "TIE":len(winners)>1,
        "FIBONACCI_GUARANTEE":False,
        "PROOF_D35":d35,
        "D38":d38,
        "D58":d58,
    }

def format_oracle(calc):
    if set(calc)!=set(FIELDS):
        raise ValueError("V104_ORACLE_FIELDS_INCOMPLETE")
    winners=",".join(str(x) for x in calc["BEST_WINDOWS"])
    return (
        f"MIN_ERROR={calc['MIN_ERROR']}; BEST_WINDOWS={winners}; "
        f"TIE={'YES' if calc['TIE'] else 'NO'}; FIBONACCI_GUARANTEE=NO; "
        f"PROOF_D35={calc['PROOF_D35']},D38={calc['D38']},D58={calc['D58']}; "
        "REASON=Minimum observed validation error; Fibonacci scale is not guaranteed optimal."
    )

def parse_model_claim(answer):
    if not isinstance(answer,str) or not 1<=len(answer)<=5000 or "\x00" in answer:
        raise ValueError("V104_MODEL_CLAIM_INVALID_LENGTH_OR_TYPE")
    values={}
    for key in FIELDS:
        rex=(r"(?<![A-Za-z0-9_])"+key+r"\s*=\s*"+PATTERN[key]+
             r"(?=\s*[,;.\n]|$)")
        m=re.findall(rex,answer,flags=re.IGNORECASE)
        if len(m)!=1:
            raise ValueError("V104_MISSING_OR_AMBIGUOUS_CLAIM_FIELD_"+key)
        item=m[0]
        if key=="BEST_WINDOWS":
            val=tuple(int(x.strip()) for x in item.split(","))
            if val!=tuple(sorted(set(val))):
                raise ValueError("V104_WINNER_LIST_DUPLICATE_OR_UNSORTED")
        elif key in ("TIE","FIBONACCI_GUARANTEE"):
            val=item.upper()=="YES"
        else:
            val=int(item)
        values[key]=val
    return values

def verify(errors, model_claim=None):
    """Deterministic response; never treats model claims as source values."""
    original=checked_errors(errors)
    correct=calculate(original)
    canonical=format_oracle(correct)
    observed=None
    differences={}
    if model_claim is not None:
        observed=parse_model_claim(model_claim)
        for name in FIELDS:
            if observed[name]!=correct[name]:
                differences[name]={
                    "claimed":list(observed[name]) if isinstance(observed[name],tuple) else observed[name],
                    "verified":list(correct[name]) if isinstance(correct[name],tuple) else correct[name],
                }
    result={
      "version":VERSION,
      "state":("VERIFIED_DETERMINISTIC_SOLUTION" if model_claim is None
          else "MODEL_CLAIM_VERIFIED_AGAINST_INPUTS" if not differences
          else "MODEL_CLAIM_INCORRECT_VERIFIED_ALTERNATIVE_AVAILABLE"),
      "source":"operator_supplied_typed_window_error_values",
      "input_errors":{str(k):v for k,v in original.items()},
      "verified_fields":{
          k:(list(v) if isinstance(v,tuple) else v) for k,v in correct.items()},
      "verified_answer":canonical,
      "algebraic_identity_checked":True,
      "model_claim_compared":model_claim is not None,
      "model_claim_mismatch_fields":differences,
      "corrected_output_generated_by_qwen":False,
      "qwen_or_adapters_loaded":False,
      "training_or_deployment_performed":False,
      "production_connected":False,
    }
    return result

def offline_proofs():
    checks=0
    categories={}
    # Exhaustively enumerate all 12^3 small error triples, including ties.
    for a in range(12):
        for b in range(12):
            for c in range(12):
                e={3:a,5:b,8:c}
                o=calculate(e)
                cats=",".join(map(str,o["BEST_WINDOWS"]))
                categories[cats]=categories.get(cats,0)+1
                if o["MIN_ERROR"]!=min(a,b,c):
                    raise AssertionError("V104_MINIMUM_ORACLE_FAILED")
                if o["PROOF_D35"]+o["D58"]!=o["D38"]:
                    raise AssertionError("V104_DIFFERENCE_IDENTITY_FAILED")
                # Positive-affine shift is guaranteed not to alter argmin.
                t=calculate({k:3*v+17 for k,v in e.items()})
                if t["BEST_WINDOWS"]!=o["BEST_WINDOWS"]:
                    raise AssertionError("V104_AFFINE_ARGMIN_INVARIANCE_FAILED")
                if t["PROOF_D35"]!=3*o["PROOF_D35"] or \
                   t["D38"]!=3*o["D38"] or t["D58"]!=3*o["D58"]:
                    raise AssertionError("V104_AFFINE_DIFFERENCE_SCALING_FAILED")
                checks+=1
    if set(categories)!=set(("3","5","8","3,5","3,8","5,8","3,5,8")):
        raise AssertionError("V104_NOT_ALL_WINNER_PATTERNS_EXERCISED")
    return {"error_triplets_verified":checks,"winner_patterns_covered":7}

def main():
    p=argparse.ArgumentParser(description="Offline verified window-math decision")
    p.add_argument("--e3",type=int,required=True)
    p.add_argument("--e5",type=int,required=True)
    p.add_argument("--e8",type=int,required=True)
    p.add_argument("--model-claim",default=None)
    p.add_argument("--self-check",action="store_true")
    a=p.parse_args()
    if a.self_check:
        print("FUN_MATH_V104_PROOFS="+json.dumps(offline_proofs(),sort_keys=True),flush=True)
    result=verify({3:a.e3,5:a.e5,8:a.e8},a.model_claim)
    print("FUN_MATH_V104_RESULT="+json.dumps(result,sort_keys=True),flush=True)
    print("FUN_MATH_V104=VERIFIED_STANDALONE_MATH_NOT_DEPLOYED",flush=True)

if __name__=="__main__":
    try:
        main()
    except (ArithmeticError,ValueError,RuntimeError,AssertionError) as exc:
        print(json.dumps({"version":VERSION,"state":"HOLD_V104_INPUT_OR_PROOF_INVALID",
                          "reason":str(exc)[:260],"model_inference_or_training":False},
                         sort_keys=True),flush=True)
        sys.exit(2)
