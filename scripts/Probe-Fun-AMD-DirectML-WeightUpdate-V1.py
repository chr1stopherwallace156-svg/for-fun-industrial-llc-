#!/usr/bin/env python3
"""Standalone tiny DirectML gradient/weight-update qualification.

Never loads Qwen weights, sees no service credentials, downloads no model,
contacts no LAN device and never modifies the current Qwen GGUF or server.
This script is a *backend probe*, not evidence of Qwen3-4B training support.

Execute from an operator-installed, isolated Python env with torch-directml.
"""
import ctypes
import json
import math
import os
import sys
import time

VERSION = "fun-amd-directml-weight-probe-v1"
MIN_FREE_HOST_GIB = 2.0
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")


def available_ram_gib():
    if sys.platform != "win32":
        raise RuntimeError("WINDOWS_REQUIRED")
    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
    status = MEMORYSTATUSEX()
    status.dwLength = ctypes.sizeof(status)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        raise RuntimeError("MEMORY_PROBE_FAILED")
    return status.ullAvailPhys / (1024 ** 3)


def main():
    free_before = available_ram_gib()
    if free_before < MIN_FREE_HOST_GIB:
        raise RuntimeError("AVAILABLE_HOST_RAM_BELOW_2GIB")
    import torch
    import torch_directml

    torch.set_num_threads(2)
    device = torch_directml.device()
    if device.type != "privateuseone":
        raise RuntimeError("DIRECTML_DEVICE_NOT_SELECTED")
    # Fixed, tiny dataset. The 8x8 identity matrix makes the optimal weights
    # exactly known. No external data, no Qwen weights or second inference model.
    X = torch.eye(8, dtype=torch.float32).to(device)
    expected = torch.tensor(
        [[0.5], [-0.75], [0.25], [1.0],
         [-0.125], [0.875], [-0.5], [0.625]],
        dtype=torch.float32).to(device)
    if X.device != device or expected.device != device:
        raise RuntimeError("DIRECTML_TENSOR_PLACEMENT_FAILED")
    w = torch.nn.Parameter(torch.zeros((8, 1), dtype=torch.float32).to(device))
    initial = w.detach().cpu().clone()
    target = X @ expected
    initial_loss = None
    gradient_observed = False
    start = time.monotonic()
    for step in range(16):
        result = X @ w
        difference = result - target
        loss = (difference * difference).mean()
        numeric_loss = float(loss.detach().cpu().item())
        if not math.isfinite(numeric_loss):
            raise RuntimeError("NONFINITE_LOSS")
        if initial_loss is None:
            initial_loss = numeric_loss
        loss.backward()
        if w.grad is None or w.grad.device != device:
            raise RuntimeError("DIRECTML_GRADIENT_MISSING_OR_WRONG_DEVICE")
        grad_norm = float(w.grad.detach().abs().max().cpu().item())
        if not math.isfinite(grad_norm):
            raise RuntimeError("NONFINITE_GRADIENT")
        gradient_observed = gradient_observed or grad_norm > 0.0
        with torch.no_grad():
            w.add_(w.grad, alpha=-1.0)
        w.grad = None
    final_loss = float((((X @ w) - target) ** 2).mean().detach().cpu().item())
    weight_delta = float((w.detach().cpu() - initial).abs().max().item())
    elapsed = time.monotonic() - start
    if not gradient_observed or weight_delta <= 0 or not math.isfinite(weight_delta):
        raise RuntimeError("NO_VERIFIED_WEIGHT_UPDATE")
    if not math.isfinite(final_loss) or final_loss >= initial_loss * 0.2:
        raise RuntimeError("LOSS_NOT_REDUCED_AS_EXPECTED")
    info = {
        "version": VERSION,
        "state": "PASS_DIRECTML_TINY_WEIGHT_UPDATE",
        "device": str(device),
        "torch_version": str(torch.__version__),
        "directml_device_name": str(torch_directml.device_name(0)) if
            callable(getattr(torch_directml, "device_name", None)) else "unknown",
        "host_ram_free_before_gib": round(free_before, 2),
        "host_ram_free_after_gib": round(available_ram_gib(), 2),
        "parameter_count": 8, "optimizer": "fixed_step_sgd",
        "optimizer_steps": 16,
        "initial_loss": initial_loss,
        "final_loss": final_loss,
        "max_weight_delta": weight_delta,
        "elapsed_seconds": round(elapsed, 3),
        "qwen_weights_changed": False,
        "model_server_restarted": False,
        "gpu_backend_ops_performed": True,
        "full_qwen_training_qualified": False,
        "next": "Benchmark supported transformer operators, VRAM, and matching original checkpoint before attempting Qwen LoRA."
    }
    print(json.dumps(info, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(json.dumps({
            "version": VERSION,
            "state": "HOLD_DIRECTML_BACKEND_UNVERIFIED",
            "exception_type": type(err).__name__,
            "reason": str(err)[:360],
            "qwen_weights_changed": False,
            "model_server_restarted": False,
            "full_qwen_training_qualified": False,
        }, sort_keys=True))
        sys.exit(2)
