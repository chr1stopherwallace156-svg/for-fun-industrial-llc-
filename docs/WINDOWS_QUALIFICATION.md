# Windows installation and back-to-back qualification

## Objective

Install Fun Industrial into a repository-private runtime, bind the local AI chat to the built-in compute/ML tools and REA MCP, and run the qualification chain. The platform must report unconfigured or blocked components honestly rather than claiming readiness.

## Host profile and model

The target Windows 11 host has 16 GiB RAM and an AMD Radeon RX 6600. The first release is CPU-first. Start with Qwen3-4B-GGUF Q4_K_M (about 2.5 GB, Apache-2.0) and 2,048 context tokens, 4 CPU threads. No CUDA or NVIDIA runtime is installed. The model download script verifies the pinned file size and SHA-256.

## Before running the command sequence

1. Clone this public repository's feature branch and open PowerShell at the repository root.
2. Download the official Windows x64 CPU llama.cpp release archive from https://github.com/ggml-org/llama.cpp/releases. Record the SHA-256 published by that exact release. Do not use a CUDA-only or NVIDIA build. The archive is moved into .runtime after verification.
3. Have an approved NetBird account and exit node configured by the NetBird administrator. The default policy requires both a connected peer and the advertised IPv4 default route (0.0.0.0/0). A peer connection alone is not sufficient.
4. Ghidra is installed by the first command. It downloads the official 12.2 archive, verifies its pinned SHA-256, and installs JDK 25 if one is not already present.

## Complete sequential PowerShell run

Run the sequence after downloading the llama.cpp archive. Replace the archive filename and SHA-256 with the exact values from the official release. This is intentionally fail-fast: if any stage returns nonzero, stop and preserve its report rather than continuing into a partially installed environment.

~~~powershell
Set-ExecutionPolicy -Scope Process RemoteSigned -Force
.\scripts\Install-Ghidra.ps1
if ($LASTEXITCODE -ne 0) { throw 'Ghidra/JDK installation failed; preserve output and stop.' }
.\scripts\Activate-FunIndustrial.ps1
if ($LASTEXITCODE -ne 0) { throw 'Initial activation failed; preserve reports and stop.' }
.\scripts\Install-LlamaCpp.ps1 -ArchivePath "$HOME\Downloads\llama-cpp-windows-x64-cpu.zip" -ExpectedSha256 "PASTE_OFFICIAL_RELEASE_SHA256"
if ($LASTEXITCODE -ne 0) { throw 'llama.cpp archive verification/extraction failed; stop.' }
.\scripts\Download-QwenModel.ps1
if ($LASTEXITCODE -ne 0) { throw 'Qwen model download or SHA-256 verification failed; stop.' }
$llamaServer = Get-ChildItem .\.runtime\llama.cpp -Recurse -File -Filter "llama-server.exe" | Select-Object -First 1 -ExpandProperty FullName
if (-not $llamaServer) { $llamaServer = Get-ChildItem .\.runtime\llama.cpp -Recurse -File -Filter "llama.exe" | Select-Object -First 1 -ExpandProperty FullName }
if (-not $llamaServer) { throw 'No llama-server.exe or llama.exe found in the verified runtime archive.' }
.\scripts\Configure-LocalModel.ps1 -LlamaServerPath $llamaServer -ModelPath "$PWD\.runtime\models\Qwen3-4B-Q4_K_M.gguf" -Threads 4 -Context 2048
if ($LASTEXITCODE -ne 0) { throw 'Local model configuration failed; stop.' }
.\scripts\Activate-FunIndustrial.ps1
if ($LASTEXITCODE -ne 0) { throw 'Integrated activation/model startup failed; preserve reports and stop.' }
.\scripts\Qualify-FunIndustrial.ps1 -GhidraRoot "$env:LOCALAPPDATA\FunIndustrial\tools\ghidra_12.2_PUBLIC" -GhidraArchivePath "$PWD\.runtime\downloads\ghidra_12.2_PUBLIC_20261016.zip"
if ($LASTEXITCODE -ne 0) { throw 'Qualification failed; preserve the evidence report.' }
~~~

Activation installs Git/Node/Python only when missing, creates the isolated .venv, installs pinned Python and CPU PyTorch dependencies, installs rea-agents 6.8.0 privately under .runtime, configures loopback-only services, checks/installs NetBird, runs tests, and starts the controller. The second activation restarts only the exact Fun Industrial dashboard instance and starts the local GGUF model if configured. Existing .env values are preserved unless a legacy default REA launcher is migrated to the private package path.

## REA MCP allowlist

REA is installed and must complete initialize/initialized and tools/list before it is reported ready. Its complete catalogue is visible in the dashboard only while the VPN/exit-node gate is satisfied. The default REA_ALLOWED_TOOLS list is empty. Review tool names, schemas, side effects, filesystem and network access before allowlisting. Add only selected tools:

~~~powershell
.\scripts\Set-REAAllowlist.ps1 -ToolNames "exact_read_only_tool_name","another_reviewed_tool"
~~~

Restart the platform after changing the allowlist. The AI receives only those exact REA tools; each call is shown with its arguments and requires a separate approval click. Built-in graph, tensor, Hopfield, vector, neural, and multi-universe tools are available independently of REA and also require approval.

## Expected qualification states

- QUALIFICATION_FINAL=PASS: tests, local control plane, built-in tool dispatch, configured model inference, VPN exit-node gate, REA MCP handshake, and Ghidra install/hash checks all pass.
- QUALIFICATION_FINAL=PASS_WITH_ACTIONS_REQUIRED: deterministic tests pass but a component remains unconfigured or blocked, such as missing exit node, empty REA allowlist, or optional model/Ghidra.
- QUALIFICATION_FINAL=FAILED: a required test, dependency, API integration, or configured model fails.

A timestamped JSON report records source identity, resolved package inventories, built-in tool dispatch, model readiness/chat test, VPN state, REA handshake/tool catalogue, Ghidra version/archive integrity, and the fact that no real malware sample was executed or qualified. The script does not prove a Windows Firewall kill switch, IPv6/DNS no-leak behavior, or real malware-sample safety.

## Separate host-level VPN qualification

The app is loopback-only. REA is gated on NetBird and the advertised IPv4 default route. A true whole-device no-leak policy still needs a separately tested Windows Firewall/endpoint-security kill switch. Follow docs/VPN_SECURITY_BOUNDARY.md. Do not claim all Windows traffic is VPN-enforced until that separate test passes.

## Failure handling

If a command fails, do not keep executing the remaining chain. Preserve the original output, reports, logs, current branch/commit, and exact command. Repairs must create a new run and rerun the relevant full regression chain. Do not overwrite the original failed evidence.

## Removal

Default removal stops the platform and removes repository-private .venv, .runtime (including local llama.cpp/model/REA/Ghidra archives), node_modules, reports, .env, and caches. Use scripts/Remove-FunIndustrial.ps1 -RemoveGhidra -RemoveOwnedPrerequisites -DeleteRepository for full removal including only those system-wide prerequisites the ownership manifest says this setup installed. Existing Git, Node, Python, JDK, or NetBird installations are not uninstalled unless the manifest records them as Fun Industrial-owned. No Elektron files or processes are touched.
