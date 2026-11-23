#!/usr/bin/env python3
"""V10.6: isolated typed math-tool contract for untrusted AI proposals.

The CALLER supplies trusted source_id + numeric errors independently of the
model. The model may only *propose* a tool request. Every proposed numeric
argument must match the trusted host values exactly before read-only math
is computed. No MCP registration, no live Qwen, no network, no file writes.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

VERSION="fun-math-typed-tool-contract-v10-6"
SCHEMA="fun-math-tool-proposal-v1"
TOOL="verify_window_math"
MAX_REQUEST_BYTES=4096
SOURCE_RE=re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,63}$")
ROOT=Path(__file__).resolve().parents[1]

def module(rel):
    spec=importlib.util.spec_from_file_location("v106_v104_math",
        ROOT/"scripts"/rel)
    obj=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

v104=module("Verified-Fun-Math-Decision-V104.py")

def tool_manifest():
    """One non-mutating tool in a local contract, NOT an MCP registration."""
    bounded={"type":"integer","minimum":0,"maximum":v104.MAX_ERROR}
    return {
       "name":TOOL,
       "description":"Compute exact minimum-error windows, ties and signed arithmetic differences from host-attested values only.",
       "inputSchema":{
          "type":"object",
          "properties":{
             "e3":dict(bounded),"e5":dict(bounded),"e8":dict(bounded),
          },
          "required":["e3","e5","e8"],
          "additionalProperties":False,
       },
       "effects":"read_only_math_no_external_actions",
       "registered_with_live_qwen_or_rea":False,
    }

def host_authority(source_id, source_errors):
    """Caller-held authority; NEVER derive from model's proposed request."""
    if not isinstance(source_id,str) or not SOURCE_RE.fullmatch(source_id):
        raise ValueError("V106_HOST_SOURCE_ID_INVALID")
    original=v104.checked_errors(source_errors)
    canonical={"source_id":source_id,
               "errors":{str(k):v for k,v in original.items()}}
    fingerprint=hashlib.sha256(json.dumps(
        canonical,sort_keys=True,separators=(",",":")
        ).encode("utf-8")).hexdigest()
    return {"source_id":source_id,"errors":original,
            "fingerprint":fingerprint,
            "authority":"caller_supplied_independently_of_model",
            "fingerprint_is_not_a_signature":True}

def no_duplicate_keys(pairs):
    result={}
    for key,value in pairs:
        if key in result:
            raise ValueError("V106_DUPLICATE_JSON_KEY_"+str(key)[:50])
        result[key]=value
    return result

def forbidden_number(token):
    raise ValueError("V106_NONFINITE_JSON_NUMBER_"+token)

def parse_proposal(body):
    """Untrusted JSON-only proposal; reject duplicate keys and extensions."""
    if not isinstance(body,str) or len(body.encode("utf-8"))>MAX_REQUEST_BYTES or not body:
        raise ValueError("V106_PROPOSAL_SIZE_OR_TYPE_INVALID")
    try:
        value=json.loads(body,object_pairs_hook=no_duplicate_keys,
                         parse_constant=forbidden_number)
    except json.JSONDecodeError as error:
        raise ValueError("V106_PROPOSAL_NOT_STRICT_JSON") from error
    if not isinstance(value,dict) or set(value)!={"schema","tool","source_id","arguments"}:
        raise ValueError("V106_PROPOSAL_FIELDS_INVALID")
    if value["schema"]!=SCHEMA or type(value["schema"]) is not str:
        raise ValueError("V106_SCHEMA_NOT_APPROVED")
    if value["tool"]!=TOOL or type(value["tool"]) is not str:
        raise ValueError("V106_TOOL_NOT_IN_ALLOWLIST")
    if not isinstance(value["source_id"],str) or not SOURCE_RE.fullmatch(value["source_id"]):
        raise ValueError("V106_PROPOSAL_SOURCE_ID_INVALID")
    arg=value["arguments"]
    if not isinstance(arg,dict) or set(arg)!={"e3","e5","e8"}:
        raise ValueError("V106_ARGUMENT_SCHEMA_INVALID")
    for key in ("e3","e5","e8"):
        v104.bounded_int(arg[key])
    return value

def proposal_for_fixture(host):
    """Synthetic fixture for offline demonstration, never described as AI."""
    return json.dumps({
       "schema":SCHEMA,"tool":TOOL,"source_id":host["source_id"],
       "arguments":{"e3":host["errors"][3],"e5":host["errors"][5],
                    "e8":host["errors"][8]},
    },sort_keys=True,separators=(",",":"))

def dispatch(host,proposal_json):
    """Only allow math on the EXACT source numbers authorized by the host."""
    if not isinstance(host,dict):
        raise ValueError("V106_CALLER_AUTHORITY_MISSING")
    canonical=host_authority(host.get("source_id"),host.get("errors"))
    if canonical["fingerprint"]!=host.get("fingerprint"):
        raise ValueError("V106_HOST_AUTHORITY_FINGERPRINT_MISMATCH")
    proposal=parse_proposal(proposal_json)
    if proposal["source_id"]!=canonical["source_id"]:
        raise ValueError("V106_UNTRUSTED_SOURCE_ID_MISMATCH")
    claimed={3:proposal["arguments"]["e3"],
             5:proposal["arguments"]["e5"],
             8:proposal["arguments"]["e8"]}
    if claimed!=canonical["errors"]:
        raise ValueError("V106_UNTRUSTED_ARGUMENTS_DIFFER_FROM_HOST_SOURCE")
    verified=v104.verify(canonical["errors"])
    expected=v104.calculate(canonical["errors"])
    if verified["verified_fields"]!={k:([*v] if isinstance(v,tuple) else v)
                                    for k,v in expected.items()}:
        raise ArithmeticError("V106_ORACLE_INTERNAL_DISAGREEMENT")
    return {
       "version":VERSION,
       "state":"V106_HOST_AUTHORIZED_READONLY_MATH_EXECUTED",
       "tool":TOOL,
       "source_id":canonical["source_id"],
       "host_values_sha256":canonical["fingerprint"],
       "host_values_sha256_not_a_signature":True,
       "model_proposal_authenticated":False,
       "arguments_matched_host_authority":True,
       "verified_fields":verified["verified_fields"],
       "verified_answer":verified["verified_answer"],
       "operation_executed":"deterministic_arithmetic_only",
       "host_side_tool_effects":"none",
       "model_generated_arithmetic_trusted":False,
       "qwen_tool_request_actually_generated":False,
       "production_registration_performed":False,
       "model_training_or_inference_performed":False,
    }

def main():
    p=argparse.ArgumentParser(description="Local, not deployed, typed math-tool proposal test")
    p.add_argument("--source-id",default="OperatorDemoV106")
    p.add_argument("--e3",type=int,default=236)
    p.add_argument("--e5",type=int,default=230)
    p.add_argument("--e8",type=int,default=235)
    p.add_argument("--proposal",default=None)
    p.add_argument("--manifest-only",action="store_true")
    args=p.parse_args()
    if args.manifest_only:
        print("FUN_MATH_V106_MANIFEST="+json.dumps(tool_manifest(),sort_keys=True),flush=True)
        return
    host=host_authority(args.source_id,{3:args.e3,5:args.e5,8:args.e8})
    candidate=args.proposal if args.proposal is not None else proposal_for_fixture(host)
    response=dispatch(host,candidate)
    print("FUN_MATH_V106_MANIFEST="+json.dumps(tool_manifest(),sort_keys=True),flush=True)
    print("FUN_MATH_V106_RESULT="+json.dumps(response,sort_keys=True),flush=True)
    print("FUN_MATH_V106=HOST_AUTHORIZED_TYPED_MATH_PROTOTYPE_NOT_DEPLOYED",flush=True)

if __name__=="__main__":
    try:
        main()
    except (ValueError,TypeError,RuntimeError,ArithmeticError) as error:
        print(json.dumps({
            "version":VERSION,
            "state":"HOLD_V106_HOST_AUTHORIZATION_OR_PROPOSAL_FAILED",
            "reason":str(error)[:350],
            "model_or_services_modified":False,
        },sort_keys=True),flush=True)
        sys.exit(2)
