#!/usr/bin/env python3
"""Deterministic model-weight adaptation curriculum. Standard library only.
Real Qwen LoRA fine-tuning uses the separate guarded trainer. This script
NEVER accesses or modifies the running GGUF model, model server or tokenizer.
"""
import argparse
import hashlib
import json
import os
import random
import sys
from pathlib import Path

VERSION = "fun-fibonacci-weight-curriculum-v1"
FAMILIES = ("recurrence", "zeckendorf", "fibonacci_code", "multiscale", "ratio", "limits")
DEFAULT_OUTPUT = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "FunIndustrial" / "QwenFibonacciWeightsV1" / "curriculum"


def fib(n):
    if n < 0:
        raise ValueError("NONNEGATIVE_ONLY")
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


def unique_fib(n):
    """Zeckendorf weights: 1, 2, 3, 5 ... (no duplicate 1)."""
    if n < 1:
        raise ValueError("POSITIVE_ONLY")
    weights = [1, 2]
    while weights[-1] <= n:
        weights.append(weights[-1] + weights[-2])
    return weights[:-1] if weights[-1] > n else weights


def components(n):
    if n < 1:
        raise ValueError("POSITIVE_ONLY")
    result = []
    for weight in reversed(unique_fib(n)):
        if weight <= n:
            result.append(weight)
            n -= weight
    if n != 0:
        raise AssertionError("INVALID_ZECKENDORF")
    return result


def fibonacci_code(n):
    weights = unique_fib(n)
    selected = set(components(n))
    word = "".join("1" if v in selected else "0" for v in weights) + "1"
    if not word.endswith("11"):
        raise AssertionError("MISSING_TERMINATOR")
    return word


def make_example(family, i, validation, seed=6427):
    # Disjoint numeric ranges for held-out extrapolation; no copied examples.
    rng = random.Random(seed + i * 10007 + FAMILIES.index(family) * 918173 + (900001 if validation else 0))
    if family == "recurrence":
        a = rng.randint(2001, 25000) if validation else rng.randint(2, 2000)
        b = rng.randint(25001, 50000) if validation else rng.randint(3, 2000)
        question = f"A sequence obeys x[n+2]=x[n+1]+x[n]. If two adjacent values are {a} and {b}, what is the next value? Show the rule."
        answer = f"The next value is {a}+{b}={a+b}. This recurrence is Fibonacci-like; arbitrary starting values do not make it the standard Fibonacci sequence."
    elif family == "zeckendorf":
        n = rng.randint(3001, 25000) if validation else rng.randint(15, 3000)
        parts = components(n)
        question = f"Write the positive integer {n} as a sum of distinct nonconsecutive Fibonacci numbers (Zeckendorf form)."
        answer = f"{n} = " + " + ".join(map(str, parts)) + ". These are distinct nonconsecutive Fibonacci weights."
    elif family == "fibonacci_code":
        n = rng.randint(3001, 25000) if validation else rng.randint(15, 3000)
        question = f"Using Fibonacci universal coding (Zeckendorf bits low-to-high plus final terminating 1), encode integer {n}. Return the exact bit string."
        answer = f"The Fibonacci code for {n} is {fibonacci_code(n)}. The final '11' terminates this positive integer codeword."
    elif family == "multiscale":
        vals = [rng.randint(45, 180) if validation else rng.randint(1, 40) for _ in range(13)]
        a = sum(vals[-3:]) / 3
        b = sum(vals[-5:]) / 5
        c = sum(vals[-8:]) / 8
        question = f"For the ordered measurements {vals}, calculate trailing means at Fibonacci window sizes 3, 5, and 8. Round each to two decimals."
        answer = f"The trailing 3-, 5-, and 8-measurement means are {a:.2f}, {b:.2f}, and {c:.2f}, respectively. Fibonacci windows are one feature choice, not guaranteed optimal."
    elif family == "ratio":
        n = rng.randint(21, 32) if validation else rng.randint(7, 20)
        question = f"Evaluate F({n+1})/F({n}) for Fibonacci F(0)=0, F(1)=1. Report six decimal places and explain what it approaches."
        v = fib(n+1) / fib(n)
        answer = f"F({n+1})/F({n}) = {fib(n+1)}/{fib(n)} = {v:.6f}. As n grows the ratio approaches the golden ratio (1+sqrt(5))/2, approximately 1.618034."
    else:
        domains = [
            ("a random Wi-Fi signal", "No. A Fibonacci law cannot be assumed from arbitrary wireless measurements."),
            ("a company's monthly revenue", "No. Revenue requires observed data and testing; Fibonacci patterns are not universal."),
            ("a DNA sequence", "No. DNA sequence statistics do not universally follow the Fibonacci recurrence."),
            ("the outcome of a fair coin toss", "No. Fibonacci does not predict independent random coin tosses."),
            ("a plant's leaf arrangement", "Sometimes a Fibonacci-related phyllotactic pattern occurs, but it is not universal and must be verified."),
            ("a model's training loss", "No. Training loss depends on optimization and data, not an inherent Fibonacci law."),
            ("device retry intervals", "One can choose Fibonacci-spaced intervals, but they must be benchmarked against backoff alternatives."),
            ("the ordering of time-series windows", "Fibonacci-sized windows can be engineered as features; their predictive value requires held-out evaluation."),
        ]
        idx = (i + (3 if validation else 0)) % len(domains)
        topic, response = domains[idx]
        question = f"Does {topic} necessarily follow Fibonacci? Give a careful technical answer. Scenario number: {i+1}."
        answer = response + " Distinguish a designed method or observed correlation from a mathematical law."
    return {
        "family": family,
        "messages": [
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer}
        ]
    }


def generate(train_per_family=96, validation_per_family=32, seed=6427):
    if not (8 <= train_per_family <= 400 and 8 <= validation_per_family <= 200):
        raise ValueError("BOUNDED_DATASET_SIZES_REQUIRED")
    rows = {"train": [], "validation": []}
    for family in FAMILIES:
        for part, count, held in (("train", train_per_family, False), ("validation", validation_per_family, True)):
            rows[part].extend(make_example(family, i, held, seed) for i in range(count))
    for part in rows:
        random.Random(seed + (1 if part == "train" else 2)).shuffle(rows[part])
    # No identical user prompts across splits (independently sampled domains).
    train_prompts = {r["messages"][0]["content"] for r in rows["train"]}
    val_prompts = {r["messages"][0]["content"] for r in rows["validation"]}
    if train_prompts & val_prompts:
        raise AssertionError("TRAIN_VALIDATION_PROMPT_LEAKAGE")
    return rows


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def write_dataset(output, rows, seed):
    output = Path(output).resolve()
    if output.exists() and output.is_symlink():
        raise ValueError("SYMLINK_OUTPUT_DENIED")
    output.mkdir(parents=True, exist_ok=True)
    files = {}
    for part in ("train", "validation"):
        path = output / (part + ".jsonl")
        if path.exists():
            raise FileExistsError(f"REFUSE_OVERWRITE_EXISTING_{part}")
        data = "".join(json.dumps(r, ensure_ascii=True, sort_keys=True, separators=(",", ":"))+"\n" for r in rows[part]).encode("utf-8")
        with path.open("xb") as f:
            f.write(data)
        files[part] = {"name": path.name, "rows": len(rows[part]), "sha256": sha256(data)}
    meta = {
        "version": VERSION, "purpose": "supervised_weight_adapter_training",
        "seed": seed, "files": files, "families": list(FAMILIES),
        "model_weights_modified": False, "tokenizer_modified": False,
        "gguf_overwritten": False, "advice": "Train only after offline preflight and separate explicit operator approval."
    }
    manifest = output / "manifest.json"
    with manifest.open("x", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, sort_keys=True)
    return meta


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--seed", type=int, default=6427)
    parser.add_argument("--train-per-family", type=int, default=96)
    parser.add_argument("--validation-per-family", type=int, default=32)
    args = parser.parse_args()
    rows = generate(args.train_per_family, args.validation_per_family, args.seed)
    result = write_dataset(args.output, rows, args.seed)
    print(json.dumps({"state":"CURRICULUM_PREPARED_NOT_TRAINED","path":str(args.output.resolve()),**result}, sort_keys=True))


if __name__ == "__main__":
    main()
