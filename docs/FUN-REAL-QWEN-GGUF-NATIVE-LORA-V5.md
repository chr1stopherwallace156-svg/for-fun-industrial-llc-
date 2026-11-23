# Fun Industrial — Real pretrained Qwen3-4B GGUF LoRA Training V5

## What changes

This is the first **actual pretrained Qwen** training attempt in this sequence.
All earlier experiments (V1–V3) trained synthetic matrices; V4 fingerprinted
the live GGUF. V5 *attempts a real gradient update* against that existing
official quantized model, with separate GGUF-native LoRA adapter tensors.

The active Qwen3-4B original pretrained weights stay frozen and unchanged.
If a run succeeds, the artifact is a new **candidate LoRA adapter** that
would influence actual Qwen inference only if separately loaded. Qwen's
tokenizer, architecture, model GGUF, existing 8088 server, 8802 dashboard,
EleKtron and tool authority are not modified.

The GGUF original SHA-256 is pinned to:
7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5
This matches the official Qwen/Qwen3-4B-GGUF Q4_K_M artifact from Hugging Face.

## Actual training backend

A *separate, pinned* third-party research fork:
- Repository: https://github.com/LL4nc33/llama-tq
- Release: v2026.10.31, commit fed4890a4ccd775d5c04b921720eda947d990f7d
- Documentation: https://llama-tq.com/docs/fine-tuning
- License: MIT

This fork's llama-finetune executable supports genuine LoRA training directly
on quantized GGUF and CPU (-ngl 0). Its Windows build or behavior **has not
been qualified on the operator's machine**. It will require Git, CMake and a
suitable C/C++ toolchain (typically MSVC Build Tools or compatible alternative).

Because this uses a third-party research fork, inspect the pinned source and
be aware that the operator-authorized Git clone/compilation runs third-party
code locally. It is not part of upstream llama.cpp and has no endorsement
from Qwen or OpenAI.

This first V5 run is **CPU-based**. The previously proven AMD DirectML LoRA
experiments do not imply that GGUF-native training has a DirectML backend.

## Resource-aware smoke configuration

- Uses existing official local GGUF; does not download another model.
- Uses previously generated, hashed Fibonacci math curriculum.
- Selects **30 train examples** (three per each of ten families).
- Holds validation rows out of the training file; the tool's -val-split 0.1
  is a diagnostic only, not independent evaluation.
- Attempts two real training context windows, batch/ubatch 32, context 128,
  SGD 1e-4, rank 2, last-block blk.35 attention Q/V LoRA only.
- Runs only from a separate working directory under
  %LOCALAPPDATA%\FunIndustrial\QwenActualGGUFLoRAV5.
- Windows RAM and commit-memory watchdog checks before and during compile
  and training. Limits host process private committed memory and wall-clock
  budget. On breach terminates only isolated process tree.
- Does not stop, restart, alter Qwen 8088, or change global Python, packages,
  GPU drivers, or Elektron. No automatic adapter activation or model overwrite.
- A compile/training hold is not an assertion of success.

**Limit:** host RAM has recently been about 4 GiB available while the current
Qwen inference instance occupies ~4 GiB resident. Running CPU training in
parallel may exceed the safe memory budget and cause the V5 watchdog to hold
before producing a trained adapter. Do not remove memory guards to push ahead.
A separately operator-approved training session with different resource
allocation may be needed after reviewing the results.

## Windows toolchain follow-up (after operator's build hold)

The operator's initial V5 run passed six offline tests, verified the pinned
Qwen GGUF, created 30 training records, and cloned the pinned source. CMake
4.4.4 was subsequently installed. The first CMake configure failed because
the selected NMake generator could not find CMAKE_C_COMPILER or
CMAKE_CXX_COMPILER, while cl.exe, ninja.exe, g++.exe, clang++.exe, and
vswhere.exe were not found. **No native training had started.**

The runner now explicitly requires Visual Studio **2022** Build Tools with
the MSVC v143 x64/x86 compiler component and requests the CMake
"Visual Studio 17 2022" x64 generator. It uses an entirely new build folder
cpu-train-build-vs2022-x64 rather than reusing the failed
cpu-train-build/CMakeCache.txt NMake configuration. Build logs use unique
run-numbered files.

Microsoft's Visual Studio 2022 Build Tools package may be installed separately
via winget, with the workload Microsoft.VisualStudio.Workload.VCTools and
recommended components (MSVC compiler and Windows SDK). This is a large
third-party installer and requires operator authorization and Windows admin
permission; no automatic driver or Qwen model changes are needed.

The compiler itself may not appear in a normal PowerShell PATH after a
successful Build Tools installation. That is normal when CMake uses its Visual
Studio generator. Use vswhere to verify the installed MSVC workload rather
than requiring cl.exe on ordinary PATH.

One more limitation: the V5 native trainer runs on CPU, independent of the
successful AMD DirectML synthetic probes. A successful compiler setup cannot
guarantee that its full-model training graph will fit the PC's available RAM;
the resource watchdog may safely hold before writing any adapter.

## Windows CMake 4.4 CMP0194 / assembly-language follow-up

The operator confirmed the Visual Studio 2022 C/C++ compilers and Windows
SDK 10.0.26100.0 are installed and recognized, but CMake configuration then
stopped at ggml/CMakeLists.txt:9 with CMAKE_ASM_COMPILER not found.

The pinned fork has:

    if (POLICY CMP0194)
        cmake_policy(SET CMP0194 NEW)
    endif()
    project("ggml" C CXX ASM)

With MSVC, CMake 4.1+ CMP0194 NEW explicitly disallows treating cl.exe as
a valid assembler. This CPU-only Windows training build has no reason to
enable generic ASM language in the GGML root project.

V5 therefore creates a **separate build-source copy** under
%LOCALAPPDATA%/FunIndustrial/QwenActualGGUFLoRAV5/
llama-tq-build-source-msvc-noasm-v1, verifies the original source is pinned
to commit fed4890a..., and applies a one-expression source patch:

    if(MSVC)
        project("ggml" C CXX)
    else()
        project("ggml" C CXX ASM)
    endif()

All other source contents are preserved. This conditional only affects the
CMake language list when compiling with MSVC. The fork's pristine Git
checkout remains untouched and clean; the patch is accompanied by a JSON
marker recording exact before/after file SHA-256 values. The runner refuses
unexpected patches or partial overlays instead of silently overwriting
them. The patched source is not installed globally, and the program
builds in a brand-new cpu-train-build-vs2022-noasm-v1 directory, leaving
both earlier failed CMake caches alone.

The offline harness now has 10 tests including overlay immutability and
integrity checks. Passing those tests proves the *source patch construction*,
not that a full Visual Studio build or Qwen training succeeds. The next
operator run can encounter additional native compiler errors or a RAM guard
hold; review the new cmake-configure-vs2022-noasm and
cmake-build-vs2022-noasm run-specific logs if that occurs.

## One-command execution (explicit external source approval)

First, update your clean Git checkout to V5 and run the command in the
ChatGPT response. It runs the offline test suite, verifies official model
hash and training data manifest, validates RAM/disk/compiler prerequisites,
clones the *pinned third-party source*, compiles the isolated CPU trainer,
and attempts the two training windows.

Internal invocation from repository root:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Train-Fun-Qwen-Fibonacci-GGUF-Native-V5.ps1 -Execute -Approval I_APPROVE_ISOLATED_REAL_QWEN_LORA_TRAINING

For read-only preflight (no download, compile or training):

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Train-Fun-Qwen-Fibonacci-GGUF-Native-V5.ps1

When all stages succeed:
- FUN_REAL_QWEN_V5_OFFLINE_TESTS=PASS
- FUN_REAL_QWEN_V5_TRAINING_ATTEMPT=COMPLETED_CANDIDATE_REQUIRES_EVALUATION
- A JSON receipt with state REAL_QWEN_GGUF_ADAPTER_CANDIDATE_NOT_DEPLOYED
- A GGUF LoRA candidate under ...\QwenActualGGUFLoRAV5\candidate\
- Logs in ...\QwenActualGGUFLoRAV5\clone.log, cmake-configure.log,
  cmake-build.log and training.log.

On a failure:
- State HOLD_REAL_QWEN_TRAINING_NOT_VERIFIED (diagnostic)
- PowerShell FUN_REAL_QWEN_LORA_V5_HOLD with the exit code.
- Inspect logs *without executing another model build or training step*.
- The candidate folder, if present, must be reviewed before reattempt; no
  unattended retry or overwrite is allowed.

## What a candidate does not mean

Even a saved adapter is not yet proof of mathematical generalization, a
significant behavioral gain, or an improved reasoning process. A two-window
training run is intentionally too small for that. Later work requires:
- inspect actual optimizer gradient and tensor-delta evidence;
- compare original Qwen inference vs base+adapter on held-out examples;
- measure regressions on ordinary non-Fibonacci questions;
- train the complete verified curriculum only after assessing memory and
  model behavior, with a separate operator approval;
- verify adapter compatibility with the *existing* llama.cpp server and a
  rollback option before loading anything into live Qwen.

Read-only preflight and GitHub script commits are not local training; only the
operator's PC execution results establish that real Qwen weights were used.
