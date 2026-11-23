#!/usr/bin/env python3
"""Fun Industrial V10: offline, equation-verified Qwen math training foundation.

Builds independent, exact-ground-truth instruction JSONL; never trains Qwen,
changes a tokenizer, downloads anything, alters a live service, or uses Elektron.
A generated curriculum is PROPOSED INPUT, not evidence of model improvement.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import random
import re
import sys

VERSION="fun-qwen-math-foundation-v10"
WINDOWS=(3,5,8)
PATTERNS=((3,),(5,),(8,),(3,5),(3,8),(5,8),(3,5,8))
COUNTS={"train":32,"validation":12,"test":12} # repetitions per winner pattern
RANGES={"train":(12,99),"validation":(211,299),"test":(411,499)}
GAPS=(1,2,5,13,29)
SEED=6427
OUT=Path(os.environ.get("LOCALAPPDATA",str(Path.home()))) / "FunIndustrial" / "QwenMathFoundationV10"
APPROVAL="I_APPROVE_ISOLATED_V10_CORRECTED_MATH_CURRICULUM_CREATION"

def argmin_set(errors):
    if set(errors)!=set(WINDOWS) or any(type(errors[w]) is not int or errors[w]<0 for w in WINDOWS):
        raise ValueError("V10_MUST_HAVE_THREE_NONNEGATIVE_INTEGER_ERRORS")
    minimum=min(errors.values())
    return tuple(w for w in WINDOWS if errors[w]==minimum)

def margin(errors):
    """Correct runner-up gap including ties. Tie -> gap zero."""
    values=sorted(errors.values())
    return values[1]-values[0]

def pairwise_differences(errors):
    """Ground-truth proof features; do NOT leak into user prompts."""
    argmin_set(errors)
    return {"D35":errors[3]-errors[5],
            "D38":errors[3]-errors[8],
            "D58":errors[5]-errors[8]}


def encode_label(errors):
    winners=argmin_set(errors)
    lowest=min(errors.values())
    w=",".join(map(str,winners))
    d=pairwise_differences(errors)
    return (f"MIN_ERROR={lowest}; BEST_WINDOWS={w}; TIE={'YES' if len(winners)>1 else 'NO'}; "
            f"FIBONACCI_GUARANTEE=NO; "
            f"PROOF_D35={d['D35']},D38={d['D38']},D58={d['D58']}; "
            "REASON=Minimum measured holdout error; "
            "Fibonacci window sizes do not guarantee generalization.")

def decode_label(answer):
    pattern=(r"MIN_ERROR=(\d+);\s*BEST_WINDOWS=((?:3|5|8)(?:,(?:3|5|8)){0,2});\s*"
             r"TIE=(YES|NO);\s*FIBONACCI_GUARANTEE=(YES|NO)\b")
    result=re.search(pattern,answer)
    if not result:
        return None
    windows=tuple(int(v) for v in result.group(2).split(","))
    if len(set(windows))!=len(windows) or tuple(sorted(windows))!=windows:
        return None
    proof=re.search(r"PROOF_D35=(-?\d+),D38=(-?\d+),D58=(-?\d+)\b",answer)
    if not proof:
        return None
    return {"min_error":int(result.group(1)),"winners":windows,
            "tie":result.group(3)=="YES",
            "guarantee":result.group(4)=="YES",
            "pairwise":{k:int(v) for k,v in zip(("D35","D38","D58"),proof.groups())}}

def grade_output(errors,response):
    parsed=decode_label(response)
    if parsed is None:
        return {"state":"UNPARSEABLE","exact_answer":False,"winner_set_correct":False}
    truth=argmin_set(errors)
    set_correct=parsed["winners"]==truth
    proof_correct=parsed["pairwise"]==pairwise_differences(errors)
    return {
        "state":"PARSED",
        "comparison_proof_correct":proof_correct,
        "winner_set_correct":set_correct,
        "minimum_correct":parsed["min_error"]==min(errors.values()),
        "tie_correct":parsed["tie"]==(len(truth)>1),
        "guarantee_correct":not parsed["guarantee"],
        "exact_answer":set_correct and proof_correct
             and parsed["min_error"]==min(errors.values())
             and parsed["tie"]==(len(truth)>1) and not parsed["guarantee"],
    }

def sigmoid_softplus(z):
    if not isinstance(z,(int,float)) or not math.isfinite(z):
        raise ValueError("V10_LOGIT_NOT_FINITE")
    return max(0.0,z)+math.log1p(math.exp(-abs(z)))

def multilabel_set_loss(errors,logits):
    """Equation: mean_i softplus(logit_i) - y_i*logit_i.
    This is a RESEARCH LOSS PROTOTYPE, not supported in llama-tq fine-tuning.
    It teaches ALL tied winners, unlike argmin over a single class.
    """
    y=argmin_set(errors)
    if set(logits)!=set(WINDOWS):
        raise ValueError("V10_MISSING_WINDOW_LOGIT")
    return sum(sigmoid_softplus(logits[w])-(w in y)*logits[w] for w in WINDOWS)/len(WINDOWS)

def contrastive_pair_loss(score_correct,score_wrong,beta=1.0):
    """Equation: softplus(-beta*(s_correct - s_wrong)); NOT a native training hook."""
    if not all(isinstance(z,(float,int)) and math.isfinite(z)
               for z in (score_correct,score_wrong,beta)) or beta<=0:
        raise ValueError("V10_NONFINITE_OR_INVALID_CONTRASTIVE_INPUT")
    return sigmoid_softplus(-beta*(score_correct-score_wrong))

def softmin_distribution(errors,temperature):
    """Analysis-only distribution, NOT tie-aware target label."""
    argmin_set(errors)
    if not isinstance(temperature,(int,float)) or \
       not math.isfinite(temperature) or temperature<=0:
        raise ValueError("V10_POSITIVE_TEMPERATURE_REQUIRED")
    minimum=min(errors.values())
    values={w:math.exp(-(errors[w]-minimum)/temperature) for w in WINDOWS}
    total=sum(values.values())
    return {w:values[w]/total for w in WINDOWS}

def brier_set_score(errors, probabilities):
    """Mean squared calibration error for INDEPENDENT winner indicators.

    A tie is represented by multiple positive labels; softmax winner
    distributions are inappropriate if the exact tied set is required.
    This is an offline metric, not a native ggml loss hook.
    """
    winners=argmin_set(errors)
    if set(probabilities)!=set(WINDOWS):
        raise ValueError("V10_PROBABILITIES_REQUIRE_ALL_WINDOWS")
    if any(not isinstance(p,(int,float)) or not math.isfinite(p) or
           not 0<=p<=1 for p in probabilities.values()):
        raise ValueError("V10_PROBABILITIES_OUTSIDE_ZERO_ONE")
    return sum((probabilities[w]-(1 if w in winners else 0))**2
               for w in WINDOWS)/len(WINDOWS)

def normalized_answer_nll(token_log_probabilities):
    """Mean -log P(correct answer token | prompt, prior target tokens).

    The current native perplexity tool does NOT expose this conditional
    per-answer score; use as a mathematical specification only.
    """
    if not isinstance(token_log_probabilities,(tuple,list)) or \
       not token_log_probabilities or \
       any(not isinstance(p,(int,float)) or not math.isfinite(p) or p>0
           for p in token_log_probabilities):
        raise ValueError("V10_INVALID_TOKEN_LOG_PROBABILITIES")
    return -sum(token_log_probabilities)/len(token_log_probabilities)

def hard_negative_margin(correct_score, wrong_scores):
    """Minimum margin to the strongest wrong candidate, not an accuracy claim.

    Scores must be comparable conditional sequence log-probabilities
    normalized for answer length. Supports exact tie-set labels.
    """
    if not isinstance(wrong_scores,(list,tuple)) or not wrong_scores or \
       not isinstance(correct_score,(int,float)) or not math.isfinite(correct_score) or \
       any(not isinstance(x,(int,float)) or not math.isfinite(x) for x in wrong_scores):
        raise ValueError("V10_INVALID_LOG_SCORE_MARGIN")
    return correct_score-max(wrong_scores)


def make_case(split, pattern, ordinal):
    if split not in RANGES or pattern not in PATTERNS or not 0<=ordinal<COUNTS[split]:
        raise ValueError("V10_CASE_PARAMETERS_INVALID")
    low,high=RANGES[split]
    salt=sum((i+1)*w*73 for i,w in enumerate(pattern))
    salt+= {"train":0,"validation":176312,"test":465983}[split]
    # Each ordinal gets a distinct minimum within its split/pattern.
    # Step 7 is coprime to our 88/89-point base intervals, preventing
    # same-pattern duplicate triples without silent deduplication.
    base=low + ((ordinal*7+salt)%(high-low+1))
    gap=GAPS[(ordinal+len(pattern))%len(GAPS)]
    errors={}
    for i,w in enumerate(WINDOWS):
        if w in pattern:
            errors[w]=base
        else:
            errors[w]=base+gap+((ordinal+i)%3)
    if argmin_set(errors)!=pattern:
        raise AssertionError("V10_GENERATOR_GROUND_TRUTH_BROKEN")
    question=(f"Observed validation errors: window 3 = {errors[3]}, "
              f"window 5 = {errors[5]}, window 8 = {errors[8]}. "
              "Select EVERY window tied for the LOWEST error; report the minimum, "
              "whether there is a tie, and whether Fibonacci guarantees generalization. "
              "Show signed pairwise differences D35=e3-e5, D38=e3-e8, D58=e5-e8. "
              "Use MIN_ERROR=...; BEST_WINDOWS=...; TIE=...; FIBONACCI_GUARANTEE=NO; "
              "PROOF_D35=...,D38=...,D58=....")
    answer=encode_label(errors)
    return {"split":split,"pattern":pattern,"ordinal":ordinal,"errors":errors,
            "question":question,"answer":answer,"gap":margin(errors)}

def bad_alternative(case):
    """Hard negative for later contrastive ranking; NEVER added as a label."""
    truth=case["pattern"]
    if len(truth)==3:
        wrong=(3,5) # omits a valid tied minimum
    elif len(truth)>1:
        wrong=(truth[0],) # tie omission
    else:
        wrong=(next(w for w in WINDOWS if w not in truth),)
    return f"MIN_ERROR={min(case['errors'].values())}; BEST_WINDOWS={','.join(map(str,wrong))}; TIE=NO; FIBONACCI_GUARANTEE=YES"

def build():
    cases={}
    signatures={}
    for split in COUNTS:
        bucket=[]
        seen=set()
        for pattern in PATTERNS:
            for ordinal in range(COUNTS[split]):
                case=make_case(split,pattern,ordinal)
                sig=tuple(case["errors"][w] for w in WINDOWS)
                if sig in seen:
                    # Do not deduplicate by hiding a collision. A deterministic
                    # hold requires redesign of the generator.
                    raise RuntimeError("V10_DUPLICATE_ERROR_TRIPLE_"+split)
                seen.add(sig)
                bucket.append(case)
        random.Random(SEED+len(split)).shuffle(bucket)
        cases[split]=bucket
        signatures[split]=seen
    if any(signatures[a]&signatures[b]
           for a,b in (("train","validation"),("train","test"),("validation","test"))):
        raise RuntimeError("V10_CROSS_SPLIT_EXACT_ERROR_LEAKAGE")
    if not (len(cases["train"])==224 and len(cases["validation"])==84 and len(cases["test"])==84):
        raise RuntimeError("V10_SPLIT_COUNTS_UNEXPECTED")
    return cases

def invariants(cases):
    checks=0
    for split,rows in cases.items():
        for case in rows:
            errors=case["errors"]
            target=argmin_set(errors)
            assert target==case["pattern"]
            assert grade_output(errors,case["answer"])["exact_answer"]
            assert not grade_output(errors,bad_alternative(case))["exact_answer"]
            # Both positive affine transformations preserve set-valued argmin.
            for multiplier,shift in ((1,17),(3,11),(7,0)):
                transformed={w:multiplier*errors[w]+shift for w in WINDOWS}
                assert argmin_set(transformed)==target
                checks+=1
            # Relabeling windows must transport the winning set equivariantly.
            permutation={3:5,5:8,8:3}
            relabeled={permutation[w]:errors[w] for w in WINDOWS}
            assert argmin_set(relabeled)==tuple(
                w for w in WINDOWS if w in {permutation[t] for t in target})
            checks+=1
    return checks

def line_json(x):
    return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n"

def render_files(cases):
    files={}
    for split,rows in cases.items():
        files[split+".jsonl"]="".join(line_json({
            "messages":[{"role":"user","content":x["question"]},
                        {"role":"assistant","content":x["answer"]}]
        }) for x in rows).encode("utf-8")
        files[split+"-ground-truth.jsonl"]="".join(line_json({
            "errors":{str(w):x["errors"][w] for w in WINDOWS},
            "best_windows":list(x["pattern"]),"min_error":min(x["errors"].values()),
            "tie":len(x["pattern"])>1,"margin":x["gap"],
            "oracle_pairwise_differences":pairwise_differences(x["errors"]),
            "question":x["question"]
        }) for x in rows).encode("utf-8")
    files["hard-negatives.jsonl"]="".join(line_json({
        "question":case["question"],
        "preferred":case["answer"],
        "rejected":bad_alternative(case),
        "source":"synthetic_ground_truth_not_model_logits"
    }) for case in cases["train"]).encode("utf-8")
    return files

def manifest_for(files,cases,checks):
    return {
        "version":VERSION,
        "purpose":"offline_tie_aware_math_supervision_no_training",
        "seed":SEED,
        "windows":list(WINDOWS),
        "pattern_sets":[list(p) for p in PATTERNS],
        "rows_per_split":{split:len(rows) for split,rows in cases.items()},
        "heldout_test_separate_from_validation":True,
        "math_invariants_checked":checks,
        "training_format":"llama-tq JSONL messages; source trainer masks assistant turn only",
        "contrasts_and_multilabel_loss":"reference equations only; NOT added to native llama-tq training backend",
        "files":{name:{"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()}
                 for name,data in files.items()},
        "live_model_changed":False,
        "original_curriculum_changed":False,
        "training_performed":False,
        "evaluation_accuracy_proven":False,
        "inference_service_changed":False,
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--write",action="store_true")
    p.add_argument("--approval",default="")
    args=p.parse_args()
    cases=build()
    checks=invariants(cases)
    files=render_files(cases)
    manifest=manifest_for(files,cases,checks)
    print("FUN_QWEN_V10_MATH_AUDIT="+json.dumps({
        "state":"VALID_CORRECTED_SET_VALUED_LABELS_AND_EQUATIONS",
        "per_split":manifest["rows_per_split"],
        "metamorphic_checks":checks,
        "hard_negatives":len(cases["train"]),
        "train_file_sha256":manifest["files"]["train.jsonl"]["sha256"],
        "training_or_model_modification":False
    },sort_keys=True),flush=True)
    if not args.write:
        print("FUN_QWEN_V10=DRY_RUN_NO_FILES_CREATED",flush=True)
        return
    if args.approval!=APPROVAL:
        raise RuntimeError("V10_EXPLICIT_DATASET_WRITE_APPROVAL_REQUIRED")
    if OUT.exists() or OUT.is_symlink():
        raise RuntimeError("V10_DESTINATION_EXISTS_NO_OVERWRITE")
    if "elektron" in str(OUT).lower():
        raise RuntimeError("V10_OUT_OF_FUN_SCOPE")
    OUT.mkdir(parents=True,exist_ok=False)
    for name,data in files.items():
        destination=OUT/name
        with destination.open("xb") as f:
            f.write(data)
        if hashlib.sha256(destination.read_bytes()).hexdigest()!=manifest["files"][name]["sha256"]:
            raise RuntimeError("V10_OUTPUT_SHA_MISMATCH_"+name)
    with (OUT/"manifest.json").open("x",encoding="utf-8") as f:
        json.dump(manifest,f,sort_keys=True,indent=2)
    print("FUN_QWEN_V10=CORRECTED_MATH_DATASET_CREATED_NOT_TRAINED",flush=True)
    print("FUN_QWEN_V10_MANIFEST="+str(OUT/"manifest.json"),flush=True)

if __name__=="__main__":
    try:
        main()
    except (OSError,ValueError,RuntimeError,AssertionError,KeyError) as exc:
        print(json.dumps({"version":VERSION,"state":"HOLD_V10_MATH_FOUNDATION_NOT_VERIFIED",
                          "reason":str(exc)[:440],"no_model_training_or_deployment":True},
                         sort_keys=True),flush=True)
        sys.exit(2)
