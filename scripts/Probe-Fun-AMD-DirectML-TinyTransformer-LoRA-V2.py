#!/usr/bin/env python3
"""Tiny Qwen-inspired GQA/SwiGLU/RMSNorm DirectML LoRA training qualification.

No model downloads; no Qwen model loads/updates; no process/service changes.
Only frozen miniature base matrices and trained low-rank q/v adapters.
"""
import ctypes
import json
import math
import os
import sys
import time

os.environ.setdefault('OMP_NUM_THREADS', '2')
os.environ.setdefault('MKL_NUM_THREADS', '2')
VERSION = 'fun-amd-directml-tiny-transformer-lora-v2'


def free_host_gib():
    if sys.platform != 'win32':
        raise RuntimeError('WINDOWS_REQUIRED')
    class M(ctypes.Structure):
        _fields_ = [('dwLength', ctypes.c_ulong), ('dwMemoryLoad', ctypes.c_ulong),
                    ('ullTotalPhys', ctypes.c_ulonglong), ('ullAvailPhys', ctypes.c_ulonglong),
                    ('ullTotalPageFile', ctypes.c_ulonglong), ('ullAvailPageFile', ctypes.c_ulonglong),
                    ('ullTotalVirtual', ctypes.c_ulonglong), ('ullAvailVirtual', ctypes.c_ulonglong),
                    ('ullAvailExtendedVirtual', ctypes.c_ulonglong)]
    m = M()
    m.dwLength = ctypes.sizeof(m)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):
        raise RuntimeError('WIN32_MEMORY_READ_FAILED')
    return round(m.ullAvailPhys / (1024**3), 2)


def run(device, torch, steps=64):
    torch.manual_seed(20261123)
    torch.set_num_threads(2)
    nn = torch.nn
    F = torch.nn.functional

    class Block(nn.Module):
        def __init__(self):
            super().__init__()
            d, r = 32, 4
            for name, shape, scale in [
                    ('wq', (d, d), 0.14), ('wk', (16, d), 0.14),
                    ('wv', (16, d), 0.14), ('wo', (d, d), 0.14),
                    ('wg', (64, d), 0.12), ('wu', (64, d), 0.12),
                    ('wd', (d, 64), 0.10)]:
                self.register_buffer(name, torch.randn(shape) * scale)
            # Only these four LoRA matrices can be updated. B starts at zero.
            self.aq = nn.Parameter(torch.randn(r, d) * 0.35)
            self.bq = nn.Parameter(torch.zeros(d, r))
            self.av = nn.Parameter(torch.randn(r, d) * 0.35)
            self.bv = nn.Parameter(torch.zeros(16, r))

        def forward(self, x):
            bs, seqlen, _ = x.shape
            xn = x * torch.rsqrt(x.square().mean(dim=-1, keepdim=True) + 1e-5)
            q = F.linear(xn, self.wq) + F.linear(F.linear(xn, self.aq), self.bq)
            k = F.linear(xn, self.wk)
            v = F.linear(xn, self.wv) + F.linear(F.linear(xn, self.av), self.bv)
            q = q.reshape(bs, seqlen, 4, 8).transpose(1, 2)
            k = k.reshape(bs, seqlen, 2, 8).transpose(1, 2).repeat_interleave(2, dim=1)
            v = v.reshape(bs, seqlen, 2, 8).transpose(1, 2).repeat_interleave(2, dim=1)
            attn = torch.softmax(torch.matmul(q, k.transpose(-1, -2)) / math.sqrt(8), dim=-1)
            o = torch.matmul(attn, v).transpose(1, 2).reshape(bs, seqlen, 32)
            o = F.linear(o, self.wo)
            h = o + x
            h = h * torch.rsqrt(h.square().mean(dim=-1, keepdim=True) + 1e-5)
            ffn = F.silu(F.linear(h, self.wg)) * F.linear(h, self.wu)
            return o + 0.1 * F.linear(ffn, self.wd)

    model = Block().to(device)
    inputs = torch.randn(2, 6, 32).to(device)
    if inputs.device.type != device.type:
        raise RuntimeError('DIRECTML_INPUT_TENSOR_NOT_ON_DEVICE')
    # Construct a teacher from the SAME frozen base network with different
    # q/v LoRA weights, then reset B to zero. No second model is loaded.
    with torch.no_grad():
        target_bq = torch.randn_like(model.bq.detach().cpu()).to(device) * 0.20
        target_bv = torch.randn_like(model.bv.detach().cpu()).to(device) * 0.40
        model.bq.copy_(target_bq)
        model.bv.copy_(target_bv)
        target = model(inputs).detach()
        model.bq.zero_()
        model.bv.zero_()
    before_params = {n: p.detach().cpu().clone() for n, p in model.named_parameters()}
    expected_names = {'aq', 'av', 'bq', 'bv'}
    if set(before_params) != expected_names:
        raise RuntimeError('UNEXPECTED_TRAINABLE_PARAMETER_NAMES')
    before = float(((model(inputs) - target)**2).mean().detach().cpu().item())
    if not math.isfinite(before) or before <= 1e-9:
        raise RuntimeError('NO_MEANINGFUL_INITIAL_ERROR')
    started = time.monotonic()
    grads = set()
    for step in range(steps):
        output = model(inputs)
        loss = ((output-target)**2).mean()
        loss.backward()
        with torch.no_grad():
            for n, p in model.named_parameters():
                if p.grad is None:
                    raise RuntimeError('MISSING_LORA_GRADIENT_'+n)
                if p.grad.device.type != device.type:
                    raise RuntimeError('LORA_GRADIENT_NOT_ON_DIRECTML_'+n)
                maxgrad = float(p.grad.detach().abs().max().cpu().item())
                if not math.isfinite(maxgrad):
                    raise RuntimeError('NONFINITE_LORA_GRADIENT_'+n)
                if maxgrad > 0:
                    grads.add(n)
                p.add_(p.grad, alpha=-0.9)
                p.grad = None
    after = float(((model(inputs)-target)**2).mean().detach().cpu().item())
    delta = {n: float((p.detach().cpu()-before_params[n]).abs().max().item())
             for n, p in model.named_parameters()}
    if any(not math.isfinite(v) for v in delta.values()) or not math.isfinite(after):
        raise RuntimeError('NONFINITE_TRAINING_RESULTS')
    if not {'bq', 'bv'}.issubset(grads) or min(delta['bq'], delta['bv']) <= 1e-9:
        raise RuntimeError('NO_EFFECTIVE_Q_AND_V_LORA_UPDATE')
    if after >= before * 0.90:
        raise RuntimeError('LORA_LOSS_NOT_REDUCED_ENOUGH:before='+str(before)+':after='+str(after))
    if any(p.device.type != device.type for _, p in model.named_parameters()):
        raise RuntimeError('TRAINABLE_WEIGHTS_NOT_ON_DEVICE')
    return {
        'state': 'PASS_DIRECTML_TINY_TRANSFORMER_LORA',
        'torch_version': str(torch.__version__),
        'device': str(device),
        'architecture': 'miniature_GQA_RMSNorm_SwiGLU_QV_LoRA',
        'trainable_parameters': sum(p.numel() for p in model.parameters()),
        'frozen_base_weights': sum(x.numel() for n, x in model.named_buffers()),
        'optimizer_steps': steps,
        'initial_loss': before,
        'final_loss': after,
        'relative_loss_reduction': (before - after) / before,
        'changed_lora_parameters_max_abs': delta,
        'gradient_observed': sorted(grads),
        'elapsed_seconds': round(time.monotonic()-started, 3),
        'qwen_weights_changed': False,
        'full_qwen3_4b_training_qualified': False,
        'gpu_vram_peak_verified': False,
    }


def main():
    before_ram = free_host_gib()
    if before_ram < 2.0:
        raise RuntimeError('HOST_RAM_BELOW_2GIB')
    import torch
    import torch_directml
    dev = torch_directml.device()
    if dev.type != 'privateuseone':
        raise RuntimeError('DIRECTML_DEVICE_NOT_SELECTED')
    result = run(dev, torch)
    result.update(version=VERSION, host_ram_before_gib=before_ram,
                  host_ram_after_gib=free_host_gib(),
                  gpu_name=str(torch_directml.device_name(0)).strip('\0'))
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'version': VERSION, 'state': 'HOLD_DIRECTML_TINY_TRANSFORMER_LORA_UNVERIFIED',
                          'error_type': type(exc).__name__, 'reason': str(exc)[:500],
                          'qwen_weights_changed': False,
                          'full_qwen3_4b_training_qualified': False}, sort_keys=True))
        sys.exit(2)
