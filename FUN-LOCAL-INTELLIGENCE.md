# Fun Industrial — Cognee persistent memory + json-rules-engine

Additive integration, **not** Elektron. Existing 8789 Fun Industrial, 8792 Sidequest, 229 REA tools/permissions and the retirement of domestic and international sourcing remain unchanged.

## What is installed

- Node `json-rules-engine` **7.3.1**, isolated in `src/intelligence/node_modules`. It evaluates fixed safety/context facts locally with zero LLM calls and zero tool execution.
- Python `cognee[gliner]==1.6.7` in a dedicated Python 3.12 venv. It builds/queries memory with small CPU-capable models, SQLite + embedded vector/graph stores. Storage is under `%LOCALAPPDATA%\FunIndustrial\CognitiveMemory`. No cloud credentials passed to the subprocess.
- APIs on the existing local 8789 app: `GET /api/intelligence/status`, `POST /api/intelligence/evaluate`, `POST /api/intelligence/memory/remember`, and `POST /api/intelligence/memory/recall`. No automatic file/chat ingestion or REA execution.

**Disk-space warning:** Cognee's GLiNER extractor may download about **750 MB** on first remember/recall, with additional embedding weights, pip packages and venv data. Nothing downloads a memory model merely by checking status. There is no connection to Elektron's Ollama; the existing Fun Industrial llama.cpp GGUF is not automatically reused by Cognee.

## One-line install on Windows (both projects)

```powershell
$ErrorActionPreference='Stop';$d=Join-Path $env:USERPROFILE 'FunIndustrial-Local-Intelligence';if(-not(Test-Path $d)){& git clone --depth 1 --single-branch --branch feature/fun-local-cognee-rules-20261108 https://github.com/chr1stopherwallace156-svg/for-fun-industrial-llc-.git $d;if($LASTEXITCODE -ne 0){throw 'CLONE_FAILED'}}else{& git -C $d pull --ff-only;if($LASTEXITCODE -ne 0){throw 'PULL_FAILED'}};& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $d 'Install-Fun-Intelligence.ps1') -InstallCognee -EnableMemoryWrites;if($LASTEXITCODE -ne 0){throw 'INTELLIGENCE_INSTALL_HOLD'}
```

The installer checks the already retired sourcing endpoints, REA 229 tools and current 8789 process identity, stages and syntax-checks a server patch, installs isolated npm and Python packages, runs rules/patcher tests, restarts only the verified 8789 Node process, verifies the new policy route and previous REA/sourcing state, and attempts rollback if something fails. Cognee memory writes are enabled only for explicit operator requests; background ingestion remains off.

## Test after installation

Read-only status:

```powershell
Invoke-RestMethod http://127.0.0.1:8789/api/intelligence/status | ConvertTo-Json -Depth 8
```

Evaluate deterministic conditions (the output should be `PROPOSE_FOR_OPERATOR_REVIEW`, with `executeAuthorized=false`):

```powershell
$facts=@{mode='propose';risk_level='low';source_trusted=$true;context_complete=$true;service_ready=$true;evidence_verified=$true;emergency_stop=$false}|ConvertTo-Json;Invoke-RestMethod http://127.0.0.1:8789/api/intelligence/evaluate -Method POST -ContentType 'application/json' -Body $facts|ConvertTo-Json -Depth 5
```

Remember one text manually (first memory use can download large models):

```powershell
Invoke-RestMethod http://127.0.0.1:8789/api/intelligence/memory/remember -Method POST -ContentType 'application/json' -Body '{"text":"The operator requires review before any external execution."}'
```

Recall a stored text (returns evidence, not a generative answer):

```powershell
Invoke-RestMethod http://127.0.0.1:8789/api/intelligence/memory/recall -Method POST -ContentType 'application/json' -Body '{"query":"What is the operator review policy?"}' | ConvertTo-Json -Depth 5
```

Measure model+venv storage usage:

```powershell
$p=Join-Path $env:LOCALAPPDATA 'FunIndustrial\CognitiveMemory';$b=(Get-ChildItem -LiteralPath $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum;"COGNEE_TOTAL_MIB=$([math]::Round($b/1MB,2))"
```

## Boundaries

Rules do not make decisions involving physical devices or execute API tools. All `execute` scenarios HOLD, even if input claims `operator_approved=true`. Missing/risky/untrusted facts HOLD. Cognee retrieval does not authorize actions and is not automatically injected into Qwen chat prompts. REA remains governed by its existing permissions. This is a reviewed integration surface, **not a claim of universal reasoning** or autonomously learning from every interaction.

Cognee keyless GLiNER graph extraction is still described by its creators as a demo and has not been independently qualified for a production-critical decision process. The stored graph may contain mistakes. The Windows installer and real memory model retrieval have not yet been tested on the user's PC; no activation is claimed until the install output says `FUN_INTELLIGENCE=PASS`.

Upstream: https://github.com/topoteretes/cognee (Apache-2.0), https://github.com/CacheControl/json-rules-engine (MIT).
