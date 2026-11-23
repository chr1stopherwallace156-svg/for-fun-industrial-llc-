#!/usr/bin/env python3
"""Real, deliberately opt-in Qwen3-4B QLoRA weight-adapter training.

- This is not an inference prompt, RAG module, or tokenizer rewrite.
- Offline-only training on a separately acquired matching HF safetensors base.
- Requires a free, supported NVIDIA CUDA GPU and explicit user authorization.
- Never rewrites, stops or replaces the operating llama.cpp GGUF/server.
- The produced PEFT adapter must pass separate tests/conversion before serving.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
import shutil
import sys
from pathlib import Path

VERSION = "fun-qwen-fibonacci-qlora-v1"
APPROVAL = "I_APPROVE_QWEN_FIBONACCI_WEIGHT_TRAINING"
MIN_FREE_GPU_GIB = 12
MIN_FREE_HOST_GIB = 5
DEPS = ("torch", "transformers", "peft", "bitsandbytes", "accelerate", "safetensors")
FAMILIES = {"recurrence", "zeckendorf", "fibonacci_code", "multiscale", "ratio", "state_space", "information_theory", "entropy", "meta_selection", "limits"}


def free_host_bytes():
    if sys.platform == "win32":
        import ctypes
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                        ("ullTotalPhys", ctypes.c_ulonglong),
                        ("ullAvailPhys", ctypes.c_ulonglong),
                        ("ullTotalPageFile", ctypes.c_ulonglong),
                        ("ullAvailPageFile", ctypes.c_ulonglong),
                        ("ullTotalVirtual", ctypes.c_ulonglong),
                        ("ullAvailVirtual", ctypes.c_ulonglong),
                        ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
        status = MEMORYSTATUSEX()
        status.dwLength = ctypes.sizeof(status)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
            return int(status.ullAvailPhys)
        return None
    try:
        with open("/proc/meminfo", encoding="ascii") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    return int(line.split()[1]) * 1024
    except OSError:
        pass
    return None


def base_identity(base_dir):
    if base_dir is None:
        return {"state": "NO_MATCHING_BASE_CHECKPOINT_SUPPLIED"}
    root = Path(base_dir).expanduser().resolve()
    if "elektron" in str(root).lower():
        return {"state": "ELEKTRON_PATH_REFUSED"}
    if not root.is_dir() or root.is_symlink():
        return {"state": "BASE_DIR_MISSING_OR_LINK"}
    required = ["config.json", "tokenizer_config.json", "tokenizer.json"]
    if any(not (root / x).is_file() or (root / x).is_symlink() for x in required):
        return {"state": "HF_CONFIG_OR_TOKENIZER_MISSING"}
    weights = list(root.glob("*.safetensors"))
    if not weights or any(x.is_symlink() for x in weights):
        return {"state": "HF_SAFETENSORS_MISSING"}
    try:
        config = json.loads((root / "config.json").read_text("utf-8"))
    except (ValueError, OSError):
        return {"state": "BASE_CONFIG_INVALID"}
    # Qwen3-4B differs from Qwen3-4B-Instruct-2507 and other Qwen revisions.
    # Reject non-Qwen3 family and smaller base checkpoints. User must verify
    # their GGUF provenance/revision before attempting adapter conversion.
    # Match Qwen/Qwen3-4B's published dimensions; matching dimensions alone
    # are NOT evidence that the running GGUF uses the same model revision.
    expected = {"model_type": "qwen3", "num_hidden_layers": 36,
                "hidden_size": 2560, "num_attention_heads": 32,
                "num_key_value_heads": 8, "vocab_size": 151936,
                "intermediate_size": 9728, "head_dim": 128,
                "max_position_embeddings": 40960, "rope_theta": 1000000}
    if any(config.get(k) != v for k, v in expected.items()):
        return {"state": "BASE_MODEL_ARCHITECTURE_UNEXPECTED"}
    # A full-precision source checkpoint, not a separately quantized AWQ
    # checkpoint, is required by the current CUDA-oriented QLoRA trainer.
    # Matching shapes/rope alone still cannot prove the original GGUF lineage.
    if config.get("quantization_config") is not None:
        return {"state": "PREQUANTIZED_AWQ_CHECKPOINT_REFUSED_FOR_THIS_TRAINER"}
    index = root / "model.safetensors.index.json"
    if index.exists():
        try:
            index_data = json.loads(index.read_text("utf-8"))
            names = set(index_data["weight_map"].values())
        except (OSError, ValueError, KeyError, TypeError):
            return {"state": "WEIGHT_INDEX_INVALID"}
        if not names or any(not (root / name).is_file() for name in names):
            return {"state": "WEIGHT_SHARDS_INCOMPLETE"}
    return {
        "state": "LOCAL_HF_QWEN3_CHECKPOINT_PRESENT_UNPROVEN_GGUF_MATCH",
        "base_dir": str(root), "architecture": config["model_type"],
        "hidden_size": config["hidden_size"], "layers": config["num_hidden_layers"],
        "checkpoint_files": len(weights),
        "matching_quantized_GGUF_revision_verified": False
    }


def inspect_hardware():
    host = free_host_bytes()
    info = {"host_free_gib": None if host is None else round(host / (2 ** 30), 2),
            "min_host_free_gib": MIN_FREE_HOST_GIB,
            "cuda": False, "gpu_free_gib": None, "min_gpu_free_gib": MIN_FREE_GPU_GIB}
    if importlib.util.find_spec("torch") is None:
        info["gpu_reason"] = "PYTORCH_NOT_INSTALLED"
        return info
    try:
        import torch
        info["cuda"] = bool(torch.cuda.is_available())
        if info["cuda"]:
            free, total = torch.cuda.mem_get_info()
            info.update(gpu_name=torch.cuda.get_device_name(),
                        gpu_free_gib=round(free / (2 ** 30), 2),
                        gpu_total_gib=round(total / (2 ** 30), 2),
                        torch_version=str(torch.__version__))
        else:
            info["gpu_reason"] = "NO_SUPPORTED_NVIDIA_CUDA_DEVICE"
    except Exception as exc:
        info["gpu_reason"] = "CUDA_PROBE_FAILED_" + type(exc).__name__
    return info


def verify_dataset(curriculum_dir):
    root = Path(curriculum_dir).expanduser().resolve()
    manifest = root / "manifest.json"
    if not root.is_dir() or not manifest.is_file():
        raise ValueError("CURRICULUM_MISSING")
    data = json.loads(manifest.read_text("utf-8"))
    if data.get("version") != "fun-fibonacci-weight-curriculum-v1" or set(data.get("families", [])) != FAMILIES:
        raise ValueError("CURRICULUM_IDENTITY_MISMATCH")
    results = {}
    prompts = {}
    for split in ("train", "validation"):
        fn = split + ".jsonl"
        entry = data["files"][split]
        if entry["name"] != fn:
            raise ValueError("CURRICULUM_FILENAME_CHANGED")
        path = root / fn
        if not path.is_file() or path.is_symlink() or path.stat().st_size > 2_000_000:
            raise ValueError("CURRICULUM_FILE_INVALID")
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise ValueError("CURRICULUM_SHA_MISMATCH")
        rows = [json.loads(line) for line in raw.decode("utf-8").splitlines()]
        if len(rows) != int(entry["rows"]):
            raise ValueError("CURRICULUM_COUNT_MISMATCH")
        questions = set()
        for row in rows:
            messages = row.get("messages", [])
            if row.get("family") not in FAMILIES or len(messages) != 2 or \
                    messages[0].get("role") != "user" or messages[1].get("role") != "assistant":
                raise ValueError("CURRICULUM_ROW_SCHEMA_INVALID")
            prompt = messages[0].get("content", "")
            answer = messages[1].get("content", "")
            if not isinstance(prompt, str) or not isinstance(answer, str) or \
                    len(prompt) > 2000 or len(answer) > 2000 or not prompt or not answer:
                raise ValueError("CURRICULUM_ROW_CONTENT_INVALID")
            if prompt in questions:
                raise ValueError("CURRICULUM_DUPLICATE_PROMPT")
            questions.add(prompt)
        results[split] = rows
        prompts[split] = questions
    if prompts["train"] & prompts["validation"]:
        raise ValueError("TRAIN_VALIDATION_DATA_LEAK")
    return results


def preflight(args):
    identity = base_identity(args.base_dir)
    missing = [x for x in DEPS if importlib.util.find_spec(x) is None]
    hardware = inspect_hardware()
    blocks = []
    if identity["state"] != "LOCAL_HF_QWEN3_CHECKPOINT_PRESENT_UNPROVEN_GGUF_MATCH":
        blocks.append(identity["state"])
    if missing:
        blocks.append("REQUIRED_TRAINING_LIBRARIES_NOT_INSTALLED")
    if hardware["host_free_gib"] is None or hardware["host_free_gib"] < MIN_FREE_HOST_GIB:
        blocks.append("INSUFFICIENT_AVAILABLE_HOST_RAM")
    if not hardware["cuda"] or hardware["gpu_free_gib"] is None or hardware["gpu_free_gib"] < MIN_FREE_GPU_GIB:
        blocks.append("CUDA_GPU_MEMORY_REQUIREMENT_UNMET")
    try:
        dataset = verify_dataset(args.curriculum_dir)
        rows = {k: len(v) for k, v in dataset.items()}
    except (OSError, ValueError, KeyError, TypeError) as exc:
        blocks.append("CURRICULUM_UNVERIFIED_" + str(exc)[:60])
        rows = None
    return {
        "version": VERSION,
        "state": "READY_FOR_EXPLICIT_OPERATOR_TRAINING" if not blocks else "HOLD_NOT_TRAINED",
        "blocking_reasons": blocks,
        "hardware": hardware, "checkpoint": identity, "missing_libraries": missing,
        "curriculum_rows": rows,
        "active_model_unchanged": True,
        "gguf_not_trainable_directly": True,
        "required_approval": APPROVAL,
        "estimated_runtime": "not_estimated",
    }


def encode_row(tokenizer, row, max_length):
    user, assistant = row["messages"]
    p = tokenizer.apply_chat_template(
        [user], tokenize=False, add_generation_prompt=True, enable_thinking=False)
    full = tokenizer.apply_chat_template(
        [user, assistant], tokenize=False, add_generation_prompt=False, enable_thinking=False)
    prefix = tokenizer(p, add_special_tokens=False)["input_ids"]
    complete = tokenizer(full, add_special_tokens=False)["input_ids"]
    if len(prefix) >= max_length or len(complete) > max_length or complete[:len(prefix)] != prefix:
        raise ValueError("TRAINING_SAMPLE_NOT_SAFE_TO_ENCODE")
    labels = [-100] * len(prefix) + complete[len(prefix):]
    if not any(x != -100 for x in labels):
        raise ValueError("TRAINING_SAMPLE_HAS_NO_TARGET_TOKENS")
    return {"input_ids": complete, "labels": labels, "attention_mask": [1] * len(complete)}


def train(args):
    if args.approve != APPROVAL:
        raise ValueError("OPERATOR_APPROVAL_REQUIRED")
    if args.steps < 1 or args.steps > 300 or args.max_length < 256 or args.max_length > 768:
        raise ValueError("TRAINING_BUDGET_OUT_OF_RANGE")
    output = Path(args.output_dir).expanduser().resolve()
    if "elektron" in str(output).lower():
        raise ValueError("ELEKTRON_PATH_REFUSED")
    if output.exists():
        raise FileExistsError("REFUSE_OVERWRITE_TRAINING_OUTPUT")
    report = preflight(args)
    if report["blocking_reasons"]:
        print(json.dumps(report, sort_keys=True))
        return 2

    # Avoid checkpoint downloads or network lookups even when a dependency
    # would otherwise fall back to the Hugging Face model hub.
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["HF_DATASETS_OFFLINE"] = "1"
    os.environ["TOKENIZERS_PARALLELISM"] = "false"
    os.environ["OMP_NUM_THREADS"] = "2"
    os.environ["MKL_NUM_THREADS"] = "2"
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, TrainingArguments, Trainer
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

    torch.manual_seed(6427)
    torch.cuda.manual_seed_all(6427)
    torch.set_num_threads(2)
    base = str(Path(args.base_dir).resolve())
    precision = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    tok = AutoTokenizer.from_pretrained(base, local_files_only=True, trust_remote_code=False)
    if tok.pad_token_id is None:
        tok.pad_token = tok.eos_token
    data = verify_dataset(args.curriculum_dir)
    encoded = {key: [encode_row(tok, item, args.max_length) for item in vals]
               for key, vals in data.items()}

    class Dataset(torch.utils.data.Dataset):
        def __init__(self, items):
            self.items = items
        def __len__(self):
            return len(self.items)
        def __getitem__(self, i):
            return self.items[i]

    def collator(features):
        maximum = max(len(f["input_ids"]) for f in features)
        ids = [f["input_ids"] + [tok.pad_token_id] * (maximum - len(f["input_ids"])) for f in features]
        labs = [f["labels"] + [-100] * (maximum - len(f["labels"])) for f in features]
        masks = [f["attention_mask"] + [0] * (maximum - len(f["attention_mask"])) for f in features]
        return {k: torch.tensor(v, dtype=torch.long) for k, v in
                (("input_ids", ids), ("labels", labs), ("attention_mask", masks))}
    config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=precision)
    model = AutoModelForCausalLM.from_pretrained(
        base, quantization_config=config,
        torch_dtype=precision, device_map={"": torch.cuda.current_device()},
        local_files_only=True, trust_remote_code=False)
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
    lora = LoraConfig(
        r=8, lora_alpha=16, lora_dropout=0.05, bias="none",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        task_type="CAUSAL_LM")
    model = get_peft_model(model, lora)
    model.enable_input_require_grads()
    # Capture the zero-initialized LoRA-B state. A real optimizer update must
    # produce a nonzero delta, or we refuse to label the adapter trained.
    before = {n: p.detach().float().cpu().clone()
              for n, p in model.named_parameters() if p.requires_grad and "lora_B" in n}
    if not before:
        raise ValueError("TRAINABLE_LORA_B_WEIGHTS_NOT_FOUND")

    # Validation is held out by construction. Limit samples for bounded checks.
    train_data = Dataset(encoded["train"])
    validation_data = Dataset(encoded["validation"][:min(60, len(encoded["validation"]))])
    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir=str(output), overwrite_output_dir=False, max_steps=args.steps,
            per_device_train_batch_size=1, per_device_eval_batch_size=1,
            gradient_accumulation_steps=4,
            learning_rate=1e-4, lr_scheduler_type="cosine", warmup_ratio=0.03,
            dataloader_num_workers=0, dataloader_pin_memory=False,
            logging_steps=10, save_strategy="no", report_to="none",
            remove_unused_columns=False,
            fp16=precision is torch.float16, bf16=precision is torch.bfloat16,
            gradient_checkpointing=True, max_grad_norm=1.0,
            optim="adamw_torch"),
        train_dataset=train_data, eval_dataset=validation_data, data_collator=collator)
    baseline = trainer.evaluate(metric_key_prefix="before")
    progress = trainer.train()
    after = trainer.evaluate(metric_key_prefix="after")
    before_loss, after_loss = baseline.get("before_loss"), after.get("after_loss")
    if before_loss is None or after_loss is None or not math.isfinite(before_loss) or not math.isfinite(after_loss):
        raise ValueError("VALIDATION_METRIC_UNVERIFIED")
    weight_change = max(
        (p.detach().float().cpu() - before[n]).abs().max().item()
        for n, p in model.named_parameters() if n in before)
    if not math.isfinite(weight_change) or weight_change <= 0:
        raise ValueError("NO_NEURAL_WEIGHT_UPDATE_DETECTED")

    # Save only a PEFT LoRA adapter; the original gguf and HF base stay intact.
    adapter_dir = output / "adapter_candidate"
    adapter_dir.mkdir(parents=True, exist_ok=False)
    model.save_pretrained(str(adapter_dir), safe_serialization=True)
    verified = after_loss < before_loss * 0.99
    receipt = {
        "version": VERSION, "state": "CANDIDATE_LOSS_IMPROVED_NOT_DEPLOYED" if verified else "HOLD_NO_VALIDATED_IMPROVEMENT",
        "real_adapter_weights_updated": True, "max_observed_lora_parameter_change": weight_change,
        "baseline_holdout_loss": before_loss, "adapted_holdout_loss": after_loss,
        "relative_holdout_loss_improvement": (before_loss - after_loss) / before_loss,
        "training_steps": int(progress.global_step), "heldout_rows": len(validation_data),
        "curriculum_manifest_sha256": hashlib.sha256((Path(args.curriculum_dir)/"manifest.json").read_bytes()).hexdigest(),
        "base_checkpoint": base,
        "adapter_path": str(adapter_dir), "original_gguf_unchanged": True,
        "llama_cpp_adapter_converted": False,
        "deployed_to_live_qwen": False,
        "general_reasoning_improvement_proven": False,
        "must_verify_base_checkpoint_matches_gguf": True,
        "notes": "Lower heldout loss alone does not prove mathematical reasoning or safety. Test exact heldout answers and regression before deployment."
    }
    (output/"training_receipt.json").write_text(json.dumps(receipt, indent=2, sort_keys=True), "utf-8")
    print(json.dumps(receipt, sort_keys=True))
    return 0 if verified else 3


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--base-dir", type=Path)
    parser.add_argument("--curriculum-dir", type=Path,
                        default=Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) /
                        "FunIndustrial" / "QwenFibonacciWeightsV1" / "curriculum")
    parser.add_argument("--output-dir", type=Path,
                        default=Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) /
                        "FunIndustrial" / "QwenFibonacciWeightsV1" / "train-output")
    parser.add_argument("--steps", type=int, default=100)
    parser.add_argument("--max-length", type=int, default=384)
    parser.add_argument("--approve", default="")
    args = parser.parse_args()
    if args.check_only:
        print(json.dumps(preflight(args), sort_keys=True))
        return 0
    return train(args)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, FileNotFoundError, FileExistsError, ValueError, OSError) as exc:
        print(json.dumps({"version": VERSION, "state": "HOLD_NOT_DEPLOYED", "reason": str(exc)[:240],
                          "existing_model_untouched": True}, sort_keys=True))
        sys.exit(2)
