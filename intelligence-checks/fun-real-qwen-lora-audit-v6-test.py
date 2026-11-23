"""Read-only GGUF LoRA B-tensor audit unit tests with synthetic small adapters."""
import importlib.util
import json
import math
from pathlib import Path
import struct
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("v6",ROOT/"scripts"/"Audit-Fun-Qwen-Real-LoRA-V6.py")
v6=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v6)

def st(s):
    b=s.encode("utf-8")
    return struct.pack("<Q",len(b))+b

def make(path, nonzero_b=True, wrong_target=False):
    metadata=[
        ("general.type",8,"adapter"),
        ("general.architecture",8,"qwen3"),
        ("adapter.type",8,"lora"),
        ("adapter.lora.alpha",6,2.0)
    ]
    base=["blk.35.attn_q.weight","blk.35.attn_v.weight"]
    if wrong_target:
        base[1]="blk.34.attn_v.weight"
    items=[]
    for name in base:
        for suffix in ("lora_a","lora_b"):
            v=[0.015,0.02,0.025,0.03] if suffix=="lora_a" or nonzero_b else [0.0]*4
            items.append((name+"."+suffix,[2,2],struct.pack("<4f",*v)))
    raw=b"GGUF"+struct.pack("<IQQ",3,len(items),len(metadata))
    for name,kind,val in metadata:
        raw+=st(name)+struct.pack("<I",kind)
        if kind==8: raw+=st(val)
        elif kind==6: raw+=struct.pack("<f",val)
    offsets=[];cursor=0
    for name,dims,data in items:
        offsets.append(cursor)
        raw+=st(name)+struct.pack("<I",2)+struct.pack("<QQ",*dims)+struct.pack("<IQ",0,cursor)
        cursor+=len(data)
    raw+=bytes((-len(raw))%32)
    raw+=b"".join(x[2] for x in items)
    # The parser deliberately refuses implausibly small adapter files.
    # The synthetic fixtures are padded beyond that minimum; bytes are
    # appended after the referenced tensors, never before their offsets.
    raw+=bytes(max(0,1024-len(raw)))
    path.write_bytes(raw)

class AuditV6(unittest.TestCase):
    def test_valid_learned_adapter(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/"synthetic.lora.gguf"
            make(p)
            a=v6.inspect_adapter(p,expected_hash=None)
            self.assertEqual(a["state"],"PASS_REAL_QWEN_LORA_B_TENSORS_LEARNED_NOT_DEPLOYED")
            self.assertEqual(len(a["learned_b_tensors"]),2)
            self.assertFalse(a["inference_base_vs_adapter_tested"])
            self.assertTrue(all(x["nonzero_elements"]==4 for x in a["learned_b_tensors"].values()))

    def test_initial_zero_b_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/"initial.lora.gguf"
            make(p,nonzero_b=False)
            with self.assertRaisesRegex(ValueError,"NO_PROVEN_LEARNED_LORA_B_WEIGHTS"):
                v6.inspect_adapter(p,expected_hash=None)

    def test_wrong_target_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/"wrong.lora.gguf"
            make(p,wrong_target=True)
            with self.assertRaisesRegex(ValueError,"TRAINED_LORA_TARGET_NAMES_UNEXPECTED"):
                v6.inspect_adapter(p,expected_hash=None)

    def test_hash_mismatch_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/"wrong_hash.lora.gguf"
            make(p)
            with self.assertRaisesRegex(ValueError,"ADAPTER_SHA256_MISMATCH"):
                v6.inspect_adapter(p)

    def test_invalid_path(self):
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaises(ValueError):
                v6.inspect_adapter(Path(t)/"absent.lora.gguf")

if __name__=="__main__":
    unittest.main()
