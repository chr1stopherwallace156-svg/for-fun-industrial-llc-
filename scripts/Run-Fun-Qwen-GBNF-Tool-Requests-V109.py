#!/usr/bin/env python3
"""Fun Industrial V10.9: real Qwen JSON requests with grammar-constrained decoding.

Same EXACT seven V10.7 validation questions, same baseline GGUF, same
non-thinking prompt and CPU parameters. Only the pinned completion CLI's
--grammar-file sampler option is newly enabled. Raw outputs are fed to
the UNCHANGED V10.6 strict host contract (never silently repaired).
No Qwen training, LoRA, live services, REA, MCP, Elektron, frozen test.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import time

VERSION="fun-qwen-grammar-constrained-tool-request-v10-9"
CONSENT="I_APPROVE_ISOLATED_QWEN_V109_GBNF_TOOL_REQUEST_EVALUATION"
MODEL_SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
ROOT=Path(__file__).resolve().parents[1]
GRAMMAR=ROOT/"intelligence-checks"/"fun-qwen-v109-typed-request.gbnf"
CASES=7

def load(name,rel):
    spec=importlib.util.spec_from_file_location(name,ROOT/"scripts"/rel)
    obj=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

v108=load("v109_original_real_qwen_json_forensics","Audit-Fun-Qwen-Tool-JSON-V108.py")
v107=v108.v107
v106=v107.v106
v104=v107.v104
v10=v107.v10
v7=v107.v7
v5=v107.v5
RUN=v5.APP/"math-grammar-constrained-tool-requests-v109"

def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda:file.read(1024*1024),b""):
            h.update(block)
    return h.hexdigest()

def checked_grammar():
    if not GRAMMAR.is_file() or GRAMMAR.is_symlink() or \
       not 80<=GRAMMAR.stat().st_size<=4096:
        raise RuntimeError("V109_REVIEWED_GRAMMAR_NOT_FOUND_OR_UNTRUSTED")
    source=GRAMMAR.read_text("utf-8")
    required=(
        "root ::=", "source-id ::=", "uint ::=", "ws ::=",
        '"fun-math-tool-proposal-v1"', '"verify_window_math"',
        r'"\"source_id\""',r'"\"arguments\""',
        r'"\"e3\""',r'"\"e5\""',r'"\"e8\""',
    )
    if not all(x in source for x in required):
        raise RuntimeError("V109_GBNF_RULES_UNEXPECTED")
    # These must be inferred by the model, NOT fixed in the grammar.
    if "V107Val" in source or '"e3":236' in source or '"e5":230' in source:
        raise RuntimeError("V109_GRAMMAR_MUST_NOT_EMBED_HOST_SOURCE_VALUES")
    return sha(GRAMMAR)

def check_native_grammar_option(binary):
    """Runtime gate: use only the already-built completion.exe.

    '--grammar-file' appears in pinned llama-tq v2026.10.31 common/arg.cpp.
    Still verify the user's installed executable itself supports it.
    """
    try:
        probe=subprocess.run([str(binary),"--help"],cwd=str(binary.parent),
             stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
             stdin=subprocess.DEVNULL,timeout=20,check=False,
             creationflags=subprocess.CREATE_NO_WINDOW if sys.platform=="win32" else 0)
    except (OSError,subprocess.TimeoutExpired) as exc:
        raise RuntimeError("V109_PINNED_BINARY_HELP_PROBE_FAILED") from exc
    output=probe.stdout.decode("utf-8",errors="replace")
    if "--grammar-file" not in output or "--temp" not in output:
        raise RuntimeError("V109_PINNED_COMPLETION_BINARY_LACKS_GBNF_FLAG_NO_BUILD")
    return {"grammar_flag_supported_in_binary_help":True,
            "binary_help_returncode":probe.returncode}

def select_paired_cases():
    original=v108.verified_evidence()
    rows=original["original"]["records"]
    cases=[original["cases"][record["id"]] for record in rows]
    if (len(cases)!=CASES or len({c["id"] for c in cases})!=CASES or
        set(c["pattern"] for c in cases)!=set(v10.PATTERNS) or
        any(record.get("host_math_tool_dispatched") is not False for record in rows)):
        raise RuntimeError("V109_PAIRED_VALIDATION_OR_PRIOR_REJECTION_INVALID")
    return {
        "cases":cases,
        "source_hashes":original["source_hashes"],
        "source_v107_sha256":original["sha256"],
        "source_v101_sha256":original["v101_sha256"],
        "source_v105_sha256":original["v105_sha256"],
        "prior_requests":[{"id":r["id"],"sha":r["raw_qwen_sha256"],
                           "status":r["proposal_status"]} for r in rows],
    }

def evaluate_raw(case,text):
    if not isinstance(text,str) or not text:
        raise ValueError("V109_EMPTY_GENERATION")
    # No removing trailing braces, extracting JSON substrings, or making
    # a host fixture on the model's behalf. Accept or reject RAW output.
    decision=v107.evaluate_proposal(case,text)
    if decision["host_math_tool_dispatched"]:
        strict=v106.parse_proposal(text)
        if strict["source_id"]!=case["source_id"] or \
           strict["arguments"]!={"e3":case["errors"][3],
                                 "e5":case["errors"][5],
                                 "e8":case["errors"][8]}:
            raise RuntimeError("V109_STRICT_MODEL_REQUEST_OR_HOST_MATH_MISMATCH")
    return decision

def run_native_case(binary,case):
    """Same guarded CPU inference as V7, with ONLY --grammar-file added."""
    v7.initial_resources()
    prefix=RUN/(case["id"]+"--grammar")
    stdout=Path(str(prefix)+".stdout.txt")
    stderr=Path(str(prefix)+".stderr.txt")
    if stdout.exists() or stderr.exists():
        raise RuntimeError("V109_NATIVE_LOG_EXISTS_NO_OVERWRITE_"+case["id"])
    cmd=[str(binary),"-m",str(v7.MODEL),"-no-cnv","-st",
        "-p",v7.qwen_nonthinking_prefill(v107.tool_request_prompt(case)),
        "--no-display-prompt","--simple-io",
        "-n",str(v7.MAX_GENERATION_TOKENS),"--temp","0",
        "--seed",str(v7.GENERATION_SEED),
        "-ngl","0","-c","512","-b","128","-ub","128","-t","4",
        "--grammar-file",str(GRAMMAR)]
    start=time.monotonic()
    with stdout.open("xb") as out,stderr.open("xb") as err:
        proc=subprocess.Popen(cmd,cwd=binary.parent,stdout=out,stderr=err,
            stdin=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        observed_commit=0.0
        while proc.poll() is None:
            m=v5.memory()
            private=v5.private_commit_gib(proc.pid)
            if private is not None:
                observed_commit=max(observed_commit,private)
            reason=None
            if m["host_free_gib"]<v5.KILL_HOST_FREE_GIB:
                reason="V109_HOST_RAM_RESERVE_CROSSED"
            if m["commit_headroom_gib"]<v5.KILL_COMMIT_HEADROOM_GIB:
                reason="V109_COMMIT_RESERVE_CROSSED"
            if private is not None and private>v5.MAX_CHILD_PRIVATE_COMMIT_GIB:
                reason="V109_CHILD_PRIVATE_COMMIT_LIMIT"
            if time.monotonic()-start>v7.MAX_CHILD_SECONDS:
                reason="V109_CHILD_TIME_BUDGET_REACHED"
            if reason:
                subprocess.run(["taskkill","/PID",str(proc.pid),"/T","/F"],
                    stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                    timeout=15,check=False)
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()
                raise RuntimeError(reason+"_CASE_"+case["id"])
            time.sleep(0.5)
        if proc.returncode!=0:
            raise RuntimeError("V109_NATIVE_COMPLETION_EXIT_"+str(proc.returncode)+
                               "_CASE_"+case["id"])
    stdout_text=stdout.read_text("utf-8",errors="replace")
    stderr_text=stderr.read_text("utf-8",errors="replace")
    if "loaded 4 tensors from lora file" in stderr_text:
        raise RuntimeError("V109_BASELINE_UNEXPECTEDLY_LOADED_ADAPTER")
    generated=v7.ANSI.sub("",stdout_text)
    generated=generated.replace(" [end of text]","").replace("<|im_end|>","").strip()
    if not generated or len(generated)>4000:
        raise RuntimeError("V109_NATIVE_GENERATED_OUTPUT_MISSING_OR_TOO_LARGE")
    if "<think>" in generated or "</think>" in generated:
        raise RuntimeError("V109_NONTHINKING_PROMPT_NOT_HONORED")
    return {
        "generated_text":generated,
        "generated_sha256":hashlib.sha256(generated.encode("utf-8")).hexdigest(),
        "stdout_log":str(stdout),"stderr_log":str(stderr),
        "elapsed_seconds":round(time.monotonic()-start,3),
        "peak_private_commit_gib":round(observed_commit,3),
        "grammar_cli_argument_present":True,
    }

def preflight():
    if sys.platform!="win32":
        raise RuntimeError("V109_WINDOWS_ONLY")
    if RUN.exists() or RUN.is_symlink():
        raise RuntimeError("V109_DESTINATION_EXISTS_PRESERVE_EVIDENCE")
    gsha=checked_grammar()
    selected=select_paired_cases()
    model_sha=v5.checked_hash(v5.LIVE_GGUF,MODEL_SHA)
    binary=v7.inspect_existing_binary()
    if binary is None:
        raise RuntimeError("V109_EXISTING_PINNED_COMPLETION_BINARY_REQUIRED_NO_BUILD")
    capability=check_native_grammar_option(binary)
    resources=v7.initial_resources()
    return {"selected":selected,"grammar_sha":gsha,
            "model_sha":model_sha,"binary":binary,
            "capability":capability,"resources":resources}

def run():
    ready=preflight()
    selection=ready["selected"]
    print("FUN_QWEN_V109_PREFLIGHT="+json.dumps({
        "state":"PINNED_ORIGINAL_QWEN_GBNF_OPTION_VERIFIED",
        "paired_cases":len(selection["cases"]),
        "source_v107_sha256":selection["source_v107_sha256"],
        "grammar_sha256":ready["grammar_sha"],
        "model_sha256":ready["model_sha"],
        "memory":ready["resources"],
        "frozen_test_opened":False,"training_or_deployment":False,
        **ready["capability"],
    },sort_keys=True),flush=True)
    RUN.mkdir()
    records=[]
    for count,case in enumerate(selection["cases"],start=1):
        print("FUN_QWEN_V109_CASE="+json.dumps({"n":count,"id":case["id"],
          "source_id":case["source_id"],"pattern":list(case["pattern"])},
          sort_keys=True),flush=True)
        original=run_native_case(ready["binary"],case)
        graded=evaluate_raw(case,original["generated_text"])
        row={
            "id":case["id"],"pattern":list(case["pattern"]),
            "raw_model_generated_text":original["generated_text"],
            "raw_model_sha256":original["generated_sha256"],
            "request_accepted":graded["host_math_tool_dispatched"],
            "rejection_reason":graded["proposal_rejection_reason"],
            "model_authority_used":False,
            "host_verified_answer":graded["verified_tool_answer"],
            "oracle_for_diagnostics_only":graded["host_oracle_reference_for_diagnostics"],
            "original_v107_request_sha256":
                selection["prior_requests"][count-1]["sha"],
            "native":{k:v for k,v in original.items()
                      if k!="generated_text"},
        }
        records.append(row)
        print("FUN_QWEN_V109_CASE_RESULT="+json.dumps({
            "id":case["id"],"accepted":row["request_accepted"],
            "reason":row["rejection_reason"],
            "raw_request":row["raw_model_generated_text"][:600],
            "verified_response":row["host_verified_answer"],
        },sort_keys=True),flush=True)
    # Recheck all independently established evidence and original weights.
    for path,expected in selection["source_hashes"].items():
        if sha(Path(path))!=expected:
            raise RuntimeError("V109_VERIFIED_V10_SOURCE_CHANGED")
    if sha(v108.SOURCE)!=selection["source_v107_sha256"] or \
       sha(v107.v102.REPORT)!=selection["source_v101_sha256"] or \
       sha(v107.PREVIOUS)!=selection["source_v105_sha256"]:
        raise RuntimeError("V109_PREVIOUS_REPORT_CHANGED")
    if sha(v5.LIVE_GGUF)!=MODEL_SHA or sha(GRAMMAR)!=ready["grammar_sha"]:
        raise RuntimeError("V109_MODEL_OR_GRAMMAR_CHANGED_DURING_RUN")
    accepted=sum(row["request_accepted"] for row in records)
    result={
        "version":VERSION,
        "state":"V109_REAL_GBNF_QWEN_REQUESTS_MEASURED_NOT_DEPLOYED",
        "case_count":CASES,
        "same_seven_questions_and_host_values_as_v107":True,
        "experimental_difference":"grammar_file_sampling_requested_only",
        "original_v107_valid_requests":0,
        "v109_raw_valid_model_generated_requests":accepted,
        "v109_invalid_model_requests_rejected":CASES-accepted,
        "v109_actual_host_math_dispatches":accepted,
        "v109_correct_tool_outputs":sum(r["request_accepted"] and
           r["host_verified_answer"]==r["oracle_for_diagnostics_only"]
           for r in records),
        "v108_hypothetical_one_brace_corrections_not_counted_as_real":True,
        "static_grammar_embedded_model_specific_inputs":False,
        "unmodified_v106_strict_host_authority":True,
        "source_model_sha256":MODEL_SHA,
        "source_v107_sha256":selection["source_v107_sha256"],
        "grammar_sha256":ready["grammar_sha"],
        "native_tool_call_protocol_proven":False,
        "external_host_orchestration_only":True,
        "frozen_test_opened":False,
        "original_qwen_weights_modified":False,
        "no_training_or_production_deployment":True,
        "live_services_and_elektron_unchanged_by_workflow":True,
        "records":records,
    }
    with (RUN/"gbnf-tool-request-report.json").open("x",encoding="utf-8") as file:
        json.dump(result,file,indent=2,ensure_ascii=False,sort_keys=True)
    print("FUN_QWEN_V109_RESULT="+json.dumps(
        {k:v for k,v in result.items() if k!="records"},sort_keys=True),flush=True)
    print("FUN_QWEN_V109_REPORT="+str(RUN/"gbnf-tool-request-report.json"),flush=True)
    print("FUN_QWEN_V109=CONSTRAINED_QWEN_TOOL_REQUESTS_MEASURED_NOT_DEPLOYED",flush=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--preflight",action="store_true")
    parser.add_argument("--approval",default="")
    args=parser.parse_args()
    if args.preflight:
        info=preflight()
        print("FUN_QWEN_V109_PREFLIGHT="+json.dumps({
            "state":"V109_PINNED_GBNF_TOOL_REQUESTS_READY_NO_INFERENCE",
            "cases":len(info["selected"]["cases"]),
            "grammar_flag_supported":info["capability"]["grammar_flag_supported_in_binary_help"],
            "grammar_sha256":info["grammar_sha"],
            "model_sha256":info["model_sha"],
            "memory":info["resources"],
            "frozen_test_unopened":True,
        },sort_keys=True),flush=True)
        return
    if args.approval!=CONSENT:
        raise RuntimeError("V109_EXPLICIT_NEW_OPERATOR_APPROVAL_REQUIRED")
    run()

if __name__=="__main__":
    try:
        main()
    except (RuntimeError,ValueError,KeyError,TypeError,OSError,
            ArithmeticError,subprocess.SubprocessError) as e:
        print(json.dumps({"version":VERSION,
            "state":"HOLD_V109_GBNF_TOOL_REQUEST_MEASUREMENT_UNVERIFIED",
            "reason":str(e)[:470],
            "model_training_or_production_changes":False},
            sort_keys=True),flush=True)
        sys.exit(2)
