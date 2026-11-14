# FIAL 5.2 — Grounded Qwen replies

## Existing defect

The original Fun Industrial compute chat uses an unconditional placeholder when Qwen returns empty message content: 'The model proposed a tool call. Review it before execution.' Empty content does not prove that tool_calls exist. A Qwen3 response may also exhaust a short generation budget on hidden reasoning.

## Implementation

The new standalone loopback 127.0.0.1:8806 service coordinates the existing read-only Cognee recall at 8789 with the existing Qwen llama.cpp chat endpoint at 8088. It requests non-thinking responses using chat_template_kwargs.enable_thinking=false and reasoning_effort=none. It does not submit model tools, model commands, REA actions, memory writes, or subprocess requests. Status is read-only; inference occurs only when the operator asks.

Output states distinguish ANSWERED_BY_QWEN, HOLD_EMPTY_MODEL_NO_TOOL_CALL, HOLD_UNEXPECTED_MODEL_TOOL_PROPOSAL, HOLD_QWEN_UNAVAILABLE, and REFERENCE_ONLY_MODEL_EMPTY. A memory excerpt is displayed only when selected by the existing relevance filter, and is labeled as an unverified reference rather than a Qwen answer.

## Windows one-line activation and qualification

Run this in PowerShell:

```powershell
$r=Join-Path $HOME 'FunIndustrial-FIAL52-GroundedChat';$b='feature/fial5-2-qwen-grounded-replies-20261114';$u='https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git';if(!(Test-Path -LiteralPath $r)){git clone --quiet --depth 1 --single-branch --branch $b $u $r;if($LASTEXITCODE -ne 0){throw 'FIAL52_CLONE_HOLD'}};if((git.exe -C $r remote get-url origin) -cne $u -or (git.exe -C $r branch --show-current) -cne $b){throw 'FIAL52_SOURCE_IDENTITY_HOLD'};if(@(git.exe -C $r status --porcelain=v1 --untracked-files=all).Count){throw 'FIAL52_LOCAL_CHANGES_HOLD'};git.exe -C $r pull --ff-only origin $b;if($LASTEXITCODE -ne 0){throw 'FIAL52_UPDATE_HOLD'};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $r 'Start-Fun-Qwen-Grounded-V5-2.ps1') -VerifyLive;if($LASTEXITCODE -ne 0){throw 'FIAL52_START_OR_LIVE_QUALITY_HOLD'}
```

The startup verifies existing 8088/8789/8805 dependencies, source integrity, 12 independent tests and the protected port snapshots; only port 8806 is started when needed. The VerifyLive flag authorizes one local memory/Qwen interaction to qualify a substantive answer. It never restarts or modifies other services.

Expected successful outputs: FIAL52_INDEPENDENT_TESTS=PASS, FIAL52_QWEN_GROUNDED_CHAT=ACTIVE, FIAL52_LIVE_STATE=ANSWERED_BY_QWEN, FIAL52_MEMORY_STATE=included, FIAL52_LIVE_MEMORY_GROUNDED_ANSWER=PASS, FIAL52_ACTIVATION=PASS.

Open http://127.0.0.1:8806/ on Windows. An existing authenticated Termius local-forward can connect iPhone Safari to the same local Windows port.

## Important limits

The original 8789 /api/ai/chat endpoint is not modified: it may still produce the old placeholder. The new 8806 route is the corrected answer-quality interface. A future reviewed original compute/chat update would be needed to replace the original route. This release cannot claim the live Qwen answer succeeds until the Windows -VerifyLive result passes.