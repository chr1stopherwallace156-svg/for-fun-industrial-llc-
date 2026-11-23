#!/usr/bin/env python3
"""Actual *pretrained Qwen GGUF* LoRA training, CPU-first on Windows.

Opt-in isolated source build of pinned MIT llama-tq (independent GGUF-native
finetune research fork), and resource-watched REAL quantized-GGUF adapter
training. Never patches, replaces, restarts or attaches to the live Qwen server.
This is not the previous 1-layer synthetic LoRA probe.

A HOLD is a successful safety boundary, not trained Qwen. Training output is
a CANDIDATE only, never automatically deployed or called proven understanding.
"""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

VERSION = "fun-real-qwen-gguf-native-lora-v5"
CONSENT = "I_APPROVE_ISOLATED_REAL_QWEN_LORA_TRAINING"
PIN_TAG = "v2026.10.31"
PIN_SHA = "fed4890a4ccd775d5c04b921720eda947d990f7d"
ORIGIN = "https://github.com/LL4nc33/llama-tq.git"
EXPECTED_GGUF_SHA = "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
EXPECTED_CURRICULUM_VERSION = "fun-fibonacci-weight-curriculum-v1"
EXPECTED_FAMILIES = {
    "recurrence", "zeckendorf", "fibonacci_code", "multiscale", "ratio",
    "state_space", "information_theory", "entropy", "meta_selection", "limits"
}
MIN_HOST_FREE_GIB = 2.9
MIN_COMMIT_HEADROOM_GIB = 3.5
KILL_HOST_FREE_GIB = 1.25
KILL_COMMIT_HEADROOM_GIB = 0.8
MAX_CHILD_PRIVATE_COMMIT_GIB = 5.0
MAX_BUILD_SECONDS = 1800
MAX_TRAIN_SECONDS = 2400
APP = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "FunIndustrial" / "QwenActualGGUFLoRAV5"
LIVE_GGUF = Path.home() / "FunIndustrial" / ".runtime" / "models" / "Qwen3-4B-Q4_K_M.gguf"
CURRICULUM = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "FunIndustrial" / "QwenFibonacciWeightsV1" / "curriculum"

def gib(n):
    return round(n/(1024**3), 3)

def memory():
    if sys.platform != "win32":
        raise RuntimeError("WINDOWS_11_REQUIRED")
    class Mem(ctypes.Structure):
        _fields_ = [
            ("size", ctypes.c_ulong), ("load", ctypes.c_ulong),
            ("total", ctypes.c_ulonglong), ("available", ctypes.c_ulonglong),
            ("page_total", ctypes.c_ulonglong), ("page_available", ctypes.c_ulonglong),
            ("virtual_total", ctypes.c_ulonglong), ("virtual_available", ctypes.c_ulonglong),
            ("extended", ctypes.c_ulonglong)]
    class Perf(ctypes.Structure):
        S = ctypes.c_size_t
        _fields_ = [
            ("size", ctypes.c_ulong),
            ("committed", S), ("limit", S), ("peak", S),
            ("total", S), ("available", S), ("cache", S),
            ("kernel", S), ("paged", S), ("nonpaged", S),
            ("page_size", S), ("handles", ctypes.c_ulong),
            ("processes", ctypes.c_ulong), ("threads", ctypes.c_ulong)]
    m, p = Mem(), Perf()
    m.size = ctypes.sizeof(m)
    p.size = ctypes.sizeof(p)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):
        raise RuntimeError("HOST_MEMORY_REPORT_UNAVAILABLE")
    if not ctypes.windll.psapi.GetPerformanceInfo(ctypes.byref(p), ctypes.sizeof(p)):
        raise RuntimeError("COMMIT_MEMORY_REPORT_UNAVAILABLE")
    return {"host_free_gib":gib(m.available),
            "commit_headroom_gib":gib((p.limit-p.committed)*p.page_size),
            "host_total_gib":gib(m.total)}

def private_commit_gib(pid):
    # Limit directly supervised process private bytes (not whole process tree).
    import ctypes.wintypes
    class PMC(ctypes.Structure):
        fields = [
            ("cb", ctypes.wintypes.DWORD),
            ("PageFaultCount", ctypes.wintypes.DWORD),
            ("PeakWorkingSetSize", ctypes.c_size_t),
            ("WorkingSetSize", ctypes.c_size_t),
            ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
            ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
            ("PagefileUsage", ctypes.c_size_t),
            ("PeakPagefileUsage", ctypes.c_size_t),
            ("PrivateUsage", ctypes.c_size_t),
        ]
        _fields_ = fields
    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    PROCESS_VM_READ = 0x10
    h = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|PROCESS_VM_READ, False, pid)
    if not h:
        return None
    try:
        p = PMC()
        p.cb = ctypes.sizeof(p)
        if not ctypes.windll.psapi.GetProcessMemoryInfo(h, ctypes.byref(p), p.cb):
            return None
        return gib(p.PrivateUsage)
    finally:
        ctypes.windll.kernel32.CloseHandle(h)

def checked_hash(path, expected):
    if not path.is_file() or path.is_symlink():
        raise RuntimeError("LIVE_QWEN_GGUF_MISSING_OR_SYMLINK")
    s = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(4*1024*1024), b""):
            s.update(chunk)
    got = s.hexdigest().lower()
    if got != expected:
        raise RuntimeError("GGUF_SHA_NOT_OFFICIAL_QWEN_ARTIFACT")
    return got

def dataset_verified():
    path = CURRICULUM
    manifest = json.loads((path/"manifest.json").read_text("utf-8"))
    if manifest.get("version") != EXPECTED_CURRICULUM_VERSION or \
            set(manifest.get("families", [])) != EXPECTED_FAMILIES:
        raise RuntimeError("CURRICULUM_MANIFEST_INCOMPATIBLE")
    rows = {}
    for split in ("train", "validation"):
        entry = manifest["files"][split]
        fp = path/(split+".jsonl")
        if entry["name"] != fp.name or fp.is_symlink() or fp.stat().st_size > 3_000_000:
            raise RuntimeError("CURRICULUM_FILE_UNTRUSTED")
        data = fp.read_bytes()
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise RuntimeError("CURRICULUM_HASH_CHANGED")
        rows[split] = [json.loads(line) for line in data.decode("utf-8").splitlines()]
        if len(rows[split]) != entry["rows"]:
            raise RuntimeError("CURRICULUM_COUNT_CHANGED")
    train_set = {r["messages"][0]["content"] for r in rows["train"]}
    val_set = {r["messages"][0]["content"] for r in rows["validation"]}
    if train_set & val_set:
        raise RuntimeError("TRAIN_VALIDATION_LEAKAGE")
    return rows

def write_small_training_slice(rows, output):
    # Each family participates, but this short smoke run does not claim to
    # teach ten domains or generalize. Holdout stays excluded from train input.
    by_family = {family:[] for family in EXPECTED_FAMILIES}
    for row in rows["train"]:
        if row["family"] in by_family and len(by_family[row["family"]]) < 3:
            by_family[row["family"]].append(row)
    if any(len(v) != 3 for v in by_family.values()):
        raise RuntimeError("NOT_ENOUGH_ROWS_PER_FAMILY")
    order = [
        "recurrence", "zeckendorf", "fibonacci_code", "multiscale",
        "ratio", "state_space", "information_theory", "entropy",
        "meta_selection", "limits"
    ]
    selected = [by_family[f][i] for i in range(3) for f in order]
    data = "".join(json.dumps({"messages":r["messages"]},separators=(",",":"),ensure_ascii=False)+"\n"
                   for r in selected).encode("utf-8")
    if output.exists():
        if output.read_bytes() != data:
            raise RuntimeError("TRAINING_SLICE_ALREADY_EXISTS_DIFFERENT")
    else:
        with output.open("xb") as f:
            f.write(data)
    return {"records":len(selected),"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()}

def command_exists(name):
    return shutil.which(name) is not None

def safe_run(command, log_path, max_seconds, expected_cwd=None, memory_watch=True):
    # Start only the supplied *isolated build or training process*. Capture
    # everything in a local log. Kill only this child on budget breach.
    with log_path.open("xb") as log:
        start = time.monotonic()
        proc = subprocess.Popen(command, cwd=expected_cwd, stdout=log, stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL)
        print("FUN_TRAIN_V5_CHILD="+str(proc.pid)+" STAGE="+log_path.stem, flush=True)
        reason = None
        peak_private = 0.0
        baseline = memory()
        while proc.poll() is None:
            if time.monotonic()-start > max_seconds:
                reason = "STAGE_TIME_BUDGET_REACHED"
                break
            if memory_watch:
                current = memory()
                usage = private_commit_gib(proc.pid)
                if usage is not None:
                    peak_private = max(peak_private, usage)
                if current["host_free_gib"] < KILL_HOST_FREE_GIB:
                    reason = "HOST_RAM_RESERVE_CROSSED"
                    break
                if current["commit_headroom_gib"] < KILL_COMMIT_HEADROOM_GIB:
                    reason = "COMMIT_MEMORY_RESERVE_CROSSED"
                    break
                if usage is not None and usage > MAX_CHILD_PRIVATE_COMMIT_GIB:
                    reason = "TRAINER_PRIVATE_COMMIT_CEILING"
                    break
            time.sleep(0.5)
        if reason:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
            raise RuntimeError(reason+" LOG="+str(log_path))
        if proc.returncode:
            raise RuntimeError("CHILD_EXIT_"+str(proc.returncode)+" LOG="+str(log_path))
        return {"seconds":round(time.monotonic()-start,1),
                "peak_child_private_commit_gib_observed":round(peak_private,3),
                "host_ram_before_gib":baseline["host_free_gib"],
                "host_ram_after_gib":memory()["host_free_gib"]}

def requirements():
    expected = {"git":command_exists("git"),"cmake":command_exists("cmake")}
    if not all(expected.values()):
        raise RuntimeError("BUILD_PREREQUISITES_MISSING_"+",".join(k for k,v in expected.items() if not v))
    cmake = subprocess.run(["cmake","--version"],capture_output=True,text=True,timeout=15)
    if cmake.returncode:
        raise RuntimeError("CMAKE_UNAVAILABLE")
    # Build configuration itself detects missing MSVC Build Tools.
    return {"git":True,"cmake":cmake.stdout.splitlines()[0] if cmake.stdout else "available"}

def prepare_source(root):
    target = root/"llama-tq-pinned-source"
    if not target.exists():
        safe_run(["git","clone","--depth","1","--branch",PIN_TAG,"--single-branch",ORIGIN,str(target)],
                 root/"clone.log",300,expected_cwd=root,memory_watch=True)
    if not (target/".git").is_dir():
        raise RuntimeError("PINNED_SOURCE_CHECKOUT_INVALID")
    proc = subprocess.run(["git","-C",str(target),"rev-parse","HEAD"],
                          capture_output=True,text=True,timeout=15)
    if proc.returncode or proc.stdout.strip().lower()!=PIN_SHA:
        raise RuntimeError("PINNED_SOURCE_SHA_DIFFERENT_NO_BUILD")
    proc = subprocess.run(["git","-C",str(target),"status","--porcelain","--untracked-files=all"],
                          capture_output=True,text=True,timeout=15)
    if proc.returncode or proc.stdout.strip():
        raise RuntimeError("PINNED_SOURCE_DIRTY_NO_BUILD")
    return target

def prepare_binary(root, source):
    build = root/"cpu-train-build"
    bins = list(build.glob("**/llama-finetune.exe")) if build.exists() else []
    if bins:
        return bins[0]
    # Explicit CPU-only: no DirectML/CUDA/Vulkan backend, no modification
    # to existing .runtime or global Python. This builds an external research
    # fork under a new isolated directory.
    safe_run(["cmake","-S",str(source),"-B",str(build),
              "-DGGML_CUDA=OFF","-DGGML_VULKAN=OFF",
              "-DLLAMA_BUILD_TESTS=OFF","-DLLAMA_BUILD_EXAMPLES=ON",
              "-DGGML_NATIVE=OFF"],root/"cmake-configure.log",
             300,expected_cwd=root)
    safe_run(["cmake","--build",str(build),"--config","Release",
              "--target","llama-finetune","--parallel","2"],
             root/"cmake-build.log",MAX_BUILD_SECONDS,expected_cwd=root)
    bins = list(build.glob("**/llama-finetune.exe"))
    if len(bins)!=1:
        raise RuntimeError("TRAINER_BINARY_NOT_FOUND_AFTER_BUILD")
    return bins[0]

def validate_trained_adapter(output_prefix):
    # This fork names output <prefix>.lora.gguf (or <prefix>.gguf with a
    # corresponding .lora.gguf suffix); select candidate by explicit folder.
    matches = list(output_prefix.parent.glob("*.lora.gguf"))
    if len(matches)!=1:
        raise RuntimeError("NO_SINGLE_TRAINED_LORA_GGUF_ARTIFACT")
    file = matches[0]
    if file.is_symlink() or file.stat().st_size < 4096:
        raise RuntimeError("LORA_GGUF_MISSING_OR_TOO_SMALL")
    with file.open("rb") as f:
        if f.read(4)!=b"GGUF":
            raise RuntimeError("LORA_GGUF_HEADER_BAD")
    digest = hashlib.sha256(file.read_bytes()).hexdigest()
    return {"adapter_path":str(file),"adapter_bytes":file.stat().st_size,
            "adapter_sha256":digest}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--approve",default="")
    parser.add_argument("--check-only",action="store_true")
    args = parser.parse_args()
    if sys.platform!="win32":
        raise RuntimeError("WINDOWS_REQUIRED")
    memory_before = memory()
    model_sha = checked_hash(LIVE_GGUF,EXPECTED_GGUF_SHA)
    dataset = dataset_verified()
    if os.path.normcase(str(APP.resolve())).find("elektron")>=0:
        raise RuntimeError("ELEKTRON_PATH_REFUSED")
    if APP.is_symlink():
        raise RuntimeError("ISOLATED_ROOT_SYMLINK_REFUSED")
    info = {"version":VERSION,
            "state":"PREFLIGHT_VALID",
            "model_source":"Qwen/Qwen3-4B-GGUF official pinned artifact",
            "model_sha256":model_sha,"source_commit_tag":PIN_TAG,
            "pinned_train_source_sha":PIN_SHA,
            "curriculum_rows":{k:len(v) for k,v in dataset.items()},
            "hardware":memory_before,
            "actual_pretrained_qwen_weights_will_be_used":True,
            "live_qwen_model_replaced":False,
            "training_is_cpu_only":True,
            "target":"last_block_attention_query_value_low_rank_adapter",
            "remote_source_compile_required":True,
            "third_party_source":"LL4nc33/llama-tq research fork"}
    print(json.dumps(info,sort_keys=True),flush=True)
    if args.check_only:
        return
    if args.approve != CONSENT:
        raise RuntimeError("EXPLICIT_NATIVE_TRAINING_APPROVAL_REQUIRED")
    if memory_before["host_free_gib"] < MIN_HOST_FREE_GIB or \
       memory_before["commit_headroom_gib"] < MIN_COMMIT_HEADROOM_GIB:
        raise RuntimeError("RAEM_INSUFFICIENT_FREE_RAM_OR_COMMIT_HEADROOM")
    if shutil.disk_usage(APP.parent).free < 6 * 1024**3:
        raise RuntimeError("INSUFFICIENT_FREE_DISK_FOR_PINNED_BUILD_AND_ADAPTER")
    requirements()
    if APP.exists() and not APP.is_dir():
        raise RuntimeError("ISOLATED_ROOT_NOT_DIRECTORY")
    APP.mkdir(parents=True,exist_ok=True)
    out = APP/"candidate"
    if out.exists():
        raise RuntimeError("EXISTING_TRAINING_OUTPUT_REQUIRES_REVIEW")
    train_file=APP/"fibonacci-train-30.jsonl"
    subset=write_small_training_slice(dataset,train_file)
    print("FUN_QWEN_V5_REAL_DATASET="+json.dumps(subset,sort_keys=True),flush=True)
    source=prepare_source(APP)
    exe=prepare_binary(APP,source)
    print("FUN_QWEN_V5_REAL_TRAINER="+str(exe),flush=True)
    # Run actual pretrained Qwen3-4B GGUF backward: one or two small windows,
    # only last attention Q/V LoRA tensors, rank 2. Bound every resource.
    out.mkdir(parents=False)
    prefix=out/"qwen-fibonacci-smoke"
    # --stop-after 2 caps windows and saves resumable adapter/state. This
    # smoke test is not full curriculum training and proves no generalization.
    cmd=[str(exe),
         "-m",str(LIVE_GGUF),"-f",str(train_file),
         "-o",str(prefix)+".gguf",
         "--lora-train-target",r"^blk\.35\.attn_(q|v)\.weight$",
         "--lora-train-rank","2","--lora-train-alpha","2",
         "-opt","sgd","-lr","0.0001","--epochs","1",
         "-val-split","0.1","--stop-after","2",
         "--grad-checkpoint","--reasoning","off",
         "-ngl","0","-c","128","-b","32","-ub","32",
         "-t","4","-tb","4"]
    metrics=safe_run(cmd,APP/"training.log",MAX_TRAIN_SECONDS,expected_cwd=exe.parent)
    adapter=validate_trained_adapter(prefix)
    report={"version":VERSION,"state":"REAL_QWEN_GGUF_ADAPTER_CANDIDATE_NOT_DEPLOYED",
            "actual_pretrained_qwen_gguf_used":True,
            "original_qwen_gguf_sha256":model_sha,
            "adapter":adapter,"curriculum_training_slice":subset,
            "resource_watch":metrics,"training_backend":"llama-tq GGUF-native CPU",
            "trained_only_late_attention_qv":True,
            "live_qwen_server_restarted":False,
            "original_qwen_weights_modified":False,
            "qwen_full_curriculum_training_completed":False,
            "fibonacci_understanding_proven":False,
            "independent_inference_regression_passed":False,
            "auto_deployed":False,
            "next":"Check native log for actual nonzero gradient/steps and run isolated baseline-vs-adapter evaluation before considering real training continuation"}
    (APP/"receipt.json").write_text(json.dumps(report,sort_keys=True,indent=2),encoding="utf-8")
    print(json.dumps(report,sort_keys=True),flush=True)

if __name__=="__main__":
    try:
        main()
    except (RuntimeError,ValueError,OSError,KeyError,subprocess.SubprocessError) as err:
        print(json.dumps({"version":VERSION,
            "state":"HOLD_REAL_QWEN_TRAINING_NOT_VERIFIED",
            "reason":str(err)[:500],
            "live_model_changes_requested":False,
            "fibonacci_understanding_proven":False},sort_keys=True),flush=True)
        sys.exit(2)
