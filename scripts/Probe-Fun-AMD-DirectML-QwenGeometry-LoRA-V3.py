#!/usr/bin/env python3
"""Bounded DirectML one-block Qwen3-style LoRA shape / memory qualification.

Synthetic *random* frozen weights, no checkpoint, no downloads, no model loading,
no running-service access. Full geometry matches dimensions of Qwen/Qwen3-4B
but is NOT the trained 36-layer Qwen model or proof of 4-bit QLoRA compatibility.
"""
import argparse
import ctypes
import json
import math
import os
import sys
import time

VERSION = "fun-amd-directml-qwen-geometry-lora-v3"
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")

PROFILES = {
    "scaled": {"hidden": 512, "heads": 8, "kv_heads": 2, "head_dim": 64,
               "intermediate": 2048, "sequence": 6, "steps": 12, "min_free_gib": 2.5},
    "qwen3-4b-layer": {"hidden": 2560, "heads": 32, "kv_heads": 8, "head_dim": 128,
                       "intermediate": 9728, "sequence": 4, "steps": 4, "min_free_gib": 3.3}
}


def free_ram_gib():
    if sys.platform != "win32":
        raise RuntimeError("WINDOWS_REQUIRED")
    class Memory(ctypes.Structure):
        _fields_ = [("size", ctypes.c_ulong), ("load", ctypes.c_ulong),
                    ("total", ctypes.c_ulonglong), ("available", ctypes.c_ulonglong),
                    ("page_total", ctypes.c_ulonglong), ("page_available", ctypes.c_ulonglong),
                    ("virtual_total", ctypes.c_ulonglong), ("virtual_available", ctypes.c_ulonglong),
                    ("extended", ctypes.c_ulonglong)]
    m = Memory()
    m.size = ctypes.sizeof(m)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):
        raise RuntimeError("HOST_MEMORY_PROBE_FAILED")
    return m.available / (1024**3)


def weight_count(c):
    d = c["hidden"]
    hq = c["heads"] * c["head_dim"]
    hk = c["kv_heads"] * c["head_dim"]
    f = c["intermediate"]
    # q,k,v,o,gate,up,down
    return hq*d + hk*d*2 + d*hq + 3*d*f


def lora_count(c, r=4):
    d = c["hidden"]
    return r*(d + c["heads"]*c["head_dim"]) + r*(d + c["kv_heads"]*c["head_dim"])


def operate(c, torch, device):
    nn = torch.nn
    F = torch.nn.functional
    d, h, hk, hd, ff = (c[x] for x in
                         ("hidden", "heads", "kv_heads", "head_dim", "intermediate"))
    n, steps = c["sequence"], c["steps"]

    torch.manual_seed(424242)
    torch.set_num_threads(2)

    class Layer(nn.Module):
        def __init__(self):
            super().__init__()
            for name, output, input in (
                ("wq", h*hd, d), ("wk", hk*hd, d), ("wv", hk*hd, d),
                ("wo", d, h*hd), ("wg", ff, d), ("wu", ff, d), ("wd", d, ff)):
                # Frozen single-block float32 tensors, no optimizer moment states.
                self.register_buffer(name, torch.randn(output, input) * (0.7 / math.sqrt(input)))
            self.qa = nn.Parameter(torch.randn(4, d) * (0.05 / math.sqrt(d)))
            self.qb = nn.Parameter(torch.zeros(h*hd, 4))
            self.va = nn.Parameter(torch.randn(4, d) * (0.05 / math.sqrt(d)))
            self.vb = nn.Parameter(torch.zeros(hk*hd, 4))

        def forward(self, x, cos, sin, mask):
            bs, seq, _ = x.shape
            x_norm = x * torch.rsqrt(x.square().mean(-1, keepdim=True) + 1e-6)
            q = F.linear(x_norm, self.wq) + F.linear(F.linear(x_norm, self.qa), self.qb)
            k = F.linear(x_norm, self.wk)
            v = F.linear(x_norm, self.wv) + F.linear(F.linear(x_norm, self.va), self.vb)
            q = q.reshape(bs, seq, h, hd).transpose(1, 2)
            k = k.reshape(bs, seq, hk, hd).transpose(1, 2)
            v = v.reshape(bs, seq, hk, hd).transpose(1, 2)
            q = q * torch.rsqrt(q.square().mean(-1, keepdim=True) + 1e-6)
            k = k * torch.rsqrt(k.square().mean(-1, keepdim=True) + 1e-6)

            def rope(a):
                even, odd = a[..., 0::2], a[..., 1::2]
                return torch.stack((even*cos - odd*sin, even*sin + odd*cos), dim=-1).flatten(-2)

            q = rope(q)
            k = rope(k)
            repeat = h // hk
            k = k.repeat_interleave(repeat, dim=1)
            v = v.repeat_interleave(repeat, dim=1)
            scores = (q @ k.transpose(-1, -2)) * (hd**-0.5) + mask
            attention = torch.softmax(scores, dim=-1)
            a = (attention @ v).transpose(1, 2).reshape(bs, seq, h*hd)
            o = F.linear(a, self.wo)
            residual = x + o
            ff_norm = residual * torch.rsqrt(residual.square().mean(-1, keepdim=True) + 1e-6)
            gated = F.silu(F.linear(ff_norm, self.wg)) * F.linear(ff_norm, self.wu)
            return residual + F.linear(gated, self.wd)

    # Device-aware deterministic one-block workload, not actual Qwen inference.
    model = Layer().to(device)
    x = (torch.randn(1, n, d) * 0.25).to(device)
    angles = torch.arange(n, dtype=torch.float32)[:, None] * torch.pow(
        torch.tensor(1000000.0, dtype=torch.float32),
        -(torch.arange(0, hd, 2, dtype=torch.float32)/hd))[None, :]
    cos = angles.cos()[None, None, :, :].to(device)
    sin = angles.sin()[None, None, :, :].to(device)
    mask = torch.triu(torch.ones(n, n, dtype=torch.float32)*(-10000.0), diagonal=1).to(device)
    expected_params = {"qa", "qb", "va", "vb"}
    if set(n for n, _ in model.named_parameters()) != expected_params:
        raise RuntimeError("TRAINABLE_PARAMETERS_NOT_EXACTLY_QV_LORA")
    if any(p.device.type != device.type for p in model.parameters()):
        raise RuntimeError("LORA_NOT_ON_GPU")
    # A synthetic target from the exact same frozen base plus nonzero B values.
    # Purpose: isolate backward-operator compatibility and changing adapter.
    with torch.no_grad():
        model.qb.copy_(torch.randn_like(model.qb.cpu()).to(device)*0.4)
        model.vb.copy_(torch.randn_like(model.vb.cpu()).to(device)*0.5)
        teacher = model(x, cos, sin, mask).detach()
        model.qb.zero_()
        model.vb.zero_()
    before_weights = {name: p.detach().cpu().clone() for name,p in model.named_parameters()}
    starting = float(((model(x,cos,sin,mask)-teacher)**2).mean().detach().cpu().item())
    if not math.isfinite(starting) or starting < 1e-12:
        raise RuntimeError("SYNTHETIC_TARGET_UNDISTINGUISHABLE")
    changed_gradients = set()
    t0 = time.monotonic()
    for j in range(steps):
        loss = ((model(x,cos,sin,mask) - teacher)**2).mean()
        loss.backward()
        with torch.no_grad():
            for name, p in model.named_parameters():
                if p.grad is None or p.grad.device.type != device.type:
                    raise RuntimeError("MISSING_ON_GPU_GRADIENT_"+name)
                gmax = float(p.grad.abs().max().cpu().item())
                if not math.isfinite(gmax):
                    raise RuntimeError("NONFINITE_GRADIENT_"+name)
                if gmax > 0:
                    changed_gradients.add(name)
                    # Sign-normalized bounded step; numerical operator probe only.
                    p.add_(p.grad/(p.grad.abs().max()+1e-12), alpha=-0.006)
                p.grad = None
    elapsed = round(time.monotonic()-t0, 3)
    ending = float(((model(x,cos,sin,mask)-teacher)**2).mean().detach().cpu().item())
    deltas = {name: float((p.detach().cpu()-before_weights[name]).abs().max().item())
              for name,p in model.named_parameters()}
    if not math.isfinite(ending) or any(not math.isfinite(v) for v in deltas.values()):
        raise RuntimeError("TRAINING_NUMERICS_NONFINITE")
    if not {"qb", "vb"}.issubset(changed_gradients) or min(deltas["qb"],deltas["vb"]) <= 0:
        raise RuntimeError("Q_V_LORA_B_WEIGHTS_DID_NOT_UPDATE")
    if ending >= starting:
        raise RuntimeError("LOSS_DID_NOT_IMPROVE:initial="+str(starting)+" final="+str(ending))
    return dict(
        state="PASS_DIRECTML_QWEN_LAYER_GEOMETRY_LORA_ONLY",
        geometry=c, random_frozen_one_block=True,
        qwen_original_checkpoint_loaded=False, qwen_weights_changed=False,
        qwen_gguf_modified=False, trainable_parameters=sum(x.numel() for x in model.parameters()),
        frozen_base_parameters=sum(x.numel() for x in model.buffers()),
        qv_lora_gradients_observed=sorted(changed_gradients),
        qv_lora_weights_changed={name:round(value,8) for name,value in deltas.items()},
        initial_training_loss=starting, final_training_loss=ending,
        relative_training_loss_reduction=(starting-ending)/starting,
        optimizer_steps=steps, elapsed_seconds=elapsed,
        full_qwen3_4b_training_qualified=False,
        gpu_vram_peak_verified=False,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", choices=tuple(PROFILES), default="scaled")
    a = ap.parse_args()
    c = PROFILES[a.profile]
    before = free_ram_gib()
    if before < c["min_free_gib"]:
        raise RuntimeError("RAEM_HOST_RAM_GUARD:required="+str(c["min_free_gib"])+
                           " observed="+str(round(before,2)))
    frozen = weight_count(c)
    if a.profile == "qwen3-4b-layer" and frozen > 105_000_000:
        raise RuntimeError("QWEN_SINGLE_LAYER_MEMORY_BOUND_EXCEEDED")
    import torch
    import torch_directml
    device = torch_directml.device()
    if device.type != "privateuseone":
        raise RuntimeError("DIRECTML_UNAVAILABLE")
    result = operate(c, torch, device)
    result.update(version=VERSION, profile=a.profile, gpu_name=str(torch_directml.device_name(0)).strip("\0"),
                  directml_device=str(device),
                  total_allocated_frozen_weight_bytes_theoretical=frozen*4,
                  total_allocated_lora_bytes_theoretical=lora_count(c)*4,
                  host_free_before_gib=round(before,2), host_free_after_gib=round(free_ram_gib(),2),
                  actual_peak_vram_bytes=None,
                  max_host_memory_usage_verified=False,
                  model_training_not_started=True)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"version":VERSION,"state":"HOLD_DIRECTML_QWEN_GEOMETRY_LORA_UNVERIFIED",
                          "error_type":type(e).__name__,"reason":str(e)[:500],
                          "qwen_weights_changed":False,
                          "full_qwen3_4b_training_qualified":False},sort_keys=True))
        sys.exit(2)
