#!/usr/bin/env python3
"""Read-only V6 verification of the actual V5 Qwen LoRA candidate's learned B tensors.
No model loading, inference, training, package installation or service changes.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

VERSION = "fun-real-qwen-lora-learned-weight-audit-v6"
EXPECTED_ADAPTER_SHA = "da0fad2bc659c9ba29be27fab6590f4a38b2e5dd95433e70cd0b6b6a7276a193"
EXPECTED_MODEL_SHA = "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
EXPECTED_PAIRS = {"blk.35.attn_q.weight", "blk.35.attn_v.weight"}
NUM = {0:"B",1:"b",2:"H",3:"h",4:"I",5:"i",6:"f",7:"?",10:"Q",11:"q",12:"d"}
MAX_FILE_BYTES = 2*1024*1024
MAX_META_ITEMS = 256

class Read:
    def __init__(self, path):
        self.path = path
        self.f = path.open("rb")
        self.length = path.stat().st_size
    def close(self):
        self.f.close()
    def raw(self,n):
        if n < 0 or self.f.tell()+n > self.length or n > MAX_FILE_BYTES:
            raise ValueError("GGUF_READ_OUT_OF_BOUNDS")
        v = self.f.read(n)
        if len(v)!=n:
            raise ValueError("GGUF_TRUNCATED")
        return v
    def num(self, t):
        if t not in NUM:
            raise ValueError("GGUF_UNSUPPORTED_SCALAR_TYPE_"+str(t))
        f="<"+NUM[t]
        return struct.unpack(f,self.raw(struct.calcsize(f)))[0]
    def text(self):
        n=self.num(10)
        if n>8192:
            raise ValueError("GGUF_STRING_TOO_LARGE")
        return self.raw(n).decode("utf-8")
    def val(self,t):
        if t==8:
            return self.text()
        if t==9:
            elem=self.num(4)
            n=self.num(10)
            if n>MAX_META_ITEMS:
                raise ValueError("GGUF_METADATA_ARRAY_TOO_LARGE")
            return [self.val(elem) for _ in range(n)]
        return self.num(t)

def inspect_adapter(path, expected_hash=EXPECTED_ADAPTER_SHA):
    p=Path(path)
    if not p.is_file() or p.is_symlink() or "elektron" in str(p).lower():
        raise ValueError("CANDIDATE_FILE_NOT_VALID")
    size=p.stat().st_size
    if size < 512 or size > MAX_FILE_BYTES:
        raise ValueError("CANDIDATE_FILE_OUTSIDE_SIZE_LIMIT")
    data=p.read_bytes()
    digest=hashlib.sha256(data).hexdigest()
    if expected_hash and digest!=expected_hash:
        raise ValueError("ADAPTER_SHA256_MISMATCH")
    r=Read(p)
    try:
        if r.raw(4)!=b"GGUF":
            raise ValueError("NOT_GGUF")
        ver=r.num(4)
        nt=r.num(10)
        nk=r.num(10)
        if ver!=3 or nt!=4 or nk>MAX_META_ITEMS:
            raise ValueError("CANDIDATE_GGUF_STRUCTURE_UNEXPECTED")
        meta={}
        for _ in range(nk):
            key=r.text()
            t=r.num(4)
            if key in meta:
                raise ValueError("DUPLICATE_METADATA_KEY")
            meta[key]=r.val(t)
        if meta.get("general.architecture")!="qwen3" or meta.get("general.type")!="adapter" or meta.get("adapter.type")!="lora":
            raise ValueError("CANDIDATE_NOT_QWEN3_LORA_ADAPTER")
        if not math.isclose(float(meta.get("adapter.lora.alpha",0)),2.0,rel_tol=0,abs_tol=1e-6):
            raise ValueError("CANDIDATE_LORA_ALPHA_UNEXPECTED")
        align=int(meta.get("general.alignment",32))
        if align not in (8,16,32,64,128):
            raise ValueError("UNEXPECTED_ALIGNMENT")
        tensors={}
        for _ in range(nt):
            name=r.text()
            nd=r.num(4)
            if nd!=2:
                raise ValueError("UNEXPECTED_LORA_DIMENSIONS")
            dims=[r.num(10) for _ in range(nd)]
            if any(x<=0 or x>16384 for x in dims):
                raise ValueError("UNEXPECTED_TENSOR_SHAPE")
            typ=r.num(4)
            offset=r.num(10)
            if typ!=0:
                raise ValueError("LORA_NOT_F32_CANNOT_PROVE_WEIGHT_CHANGES")
            if name in tensors:
                raise ValueError("DUPLICATE_TENSOR")
            tensors[name]={"dims":dims,"offset":offset,"nbytes":math.prod(dims)*4}
        expect={name+"."+suffix for name in EXPECTED_PAIRS for suffix in ("lora_a","lora_b")}
        if set(tensors)!=expect:
            raise ValueError("TRAINED_LORA_TARGET_NAMES_UNEXPECTED")
        data_start=(r.f.tell()+align-1)//align*align
        spans=[]
        values={}
        for name,desc in tensors.items():
            begin=data_start+desc["offset"]
            end=begin+desc["nbytes"]
            if begin<data_start or end>size:
                raise ValueError("TENSOR_DATA_OUT_OF_BOUNDS")
            spans.append((begin,end))
            r.f.seek(begin)
            vals=[x[0] for x in struct.iter_unpack("<f",r.raw(desc["nbytes"]))]
            if len(vals)!=math.prod(desc["dims"]) or not all(math.isfinite(v) for v in vals):
                raise ValueError("LORA_TENSOR_NONFINITE_OR_INCOMPLETE")
            values[name]={
                "shape":desc["dims"],
                "elements":len(vals),
                "nonzero_elements":sum(v!=0.0 for v in vals),
                "max_abs":max(abs(v) for v in vals),
                "l2_norm":round(math.sqrt(sum(v*v for v in vals)),8),
            }
        spans.sort()
        if any(a[1]>b[0] for a,b in zip(spans,spans[1:])):
            raise ValueError("OVERLAPPING_GGUF_TENSORS")
        bstats={name:stats for name,stats in values.items() if name.endswith(".lora_b")}
        if len(bstats)!=2 or not all(v["nonzero_elements"]>0 and v["max_abs"]>0 for v in bstats.values()):
            raise ValueError("NO_PROVEN_LEARNED_LORA_B_WEIGHTS")
        return {
            "version":VERSION,
            "state":"PASS_REAL_QWEN_LORA_B_TENSORS_LEARNED_NOT_DEPLOYED",
            "adapter_sha256":digest,
            "adapter_bytes":size,
            "gguf_tensors":nt,
            "trained_targets":sorted(EXPECTED_PAIRS),
            "alpha":meta["adapter.lora.alpha"],
            "learned_b_tensors":bstats,
            "all_lora_tensors":values,
            "source_evidence":"Pinned llama-tq initializes B tensors to all zeros; saved nonzero B demonstrates they changed.",
            "heldout_fibonacci_improvement_proven":False,
            "inference_base_vs_adapter_tested":False,
            "model_original_weights_changed":False,
            "live_deployment":False,
        }
    finally:
        r.close()

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--adapter",required=True)
    p.add_argument("--training-log",required=True)
    p.add_argument("--receipt",required=True)
    a=p.parse_args()
    log=Path(a.training_log)
    receipt=Path(a.receipt)
    if not log.is_file() or not receipt.is_file() or log.stat().st_size>20_000_000:
        raise ValueError("TRAINING_EVIDENCE_FILES_NOT_FOUND_OR_TOO_LARGE")
    report=json.loads(receipt.read_text("utf-8"))
    if report.get("state")!="REAL_QWEN_GGUF_ADAPTER_CANDIDATE_NOT_DEPLOYED" or \
       report.get("original_qwen_gguf_sha256")!=EXPECTED_MODEL_SHA:
        raise ValueError("TRAINING_RECEIPT_NOT_MATCHING_SOURCE")
    original=log.read_bytes()
    if b"stopped after 2 windows (--stop-after)" not in original:
        raise ValueError("TRAINING_COMPLETION_MARKER_MISSING")
    audit=inspect_adapter(a.adapter)
    if report.get("adapter",{}).get("adapter_sha256")!=audit["adapter_sha256"]:
        raise ValueError("TRAINING_RECEIPT_ADAPTER_SHA_MISMATCH")
    audit["training_two_windows_attested"]=True
    print(json.dumps(audit,sort_keys=True))

if __name__=="__main__":
    try:
        main()
    except (ValueError,OSError,KeyError,TypeError,struct.error) as e:
        print(json.dumps({"version":VERSION,"state":"HOLD_REAL_LORA_ADAPTER_LEARNING_NOT_PROVEN",
                         "reason":str(e)[:500],"original_weights_changed":False},sort_keys=True))
        sys.exit(2)
