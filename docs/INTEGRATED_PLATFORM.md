# Integrated Fun Industrial architecture — v0.3

## Goal

One local control center that connects open-source AI inference, AI/ML capabilities, REA MCP, graph/tensor compute, and NetBird networking while keeping each subsystem separately installable and removable. The platform is independent of Elektron.

## Components and boundaries

| Component | Process / boundary | Responsibility |
|---|---|---|
| Dashboard + control plane | Node.js, 127.0.0.1:8787 | UI, lifecycle, API gateway, VPN state monitor |
| Compute service | Python/FastAPI, 127.0.0.1:8790 | Graph, tensor, neural compute, Hopfield, vector universes |
| Local LLM | llama.cpp, 127.0.0.1:8088 | GGUF chat and structured tool proposals |
| REA | Pinned rea-agents 6.8.0 stdio child process | MCP reverse-engineering tool server |
| VPN | NetBird-managed WireGuard client | Encrypted peer network and optional exit-node egress |
| Ghidra | Separate operator-installed program | Static decompilation of authorized samples |

No public listener is created. The dashboard proxies to compute only over loopback. The LLM has no direct remote bind. REA is a separate process, connected through MCP stdio. NetBird owns its keys; Fun Industrial never reads or stores them.

## Startup and shutdown order

Activation proceeds in dependency order:

1. Check NetBird client state.
2. Connect if required.
3. Require the configured IPv4 default exit-node route when VPN_REQUIRE_EXIT_NODE=true.
4. Start and health-check the compute service.
5. Start llama.cpp if a local server executable and GGUF model are configured and AI_AUTOSTART=true.
6. Start REA only when VPN_REQUIRED is satisfied.
7. Complete MCP initialize, initialized notification, and tools/list. Process creation alone is not readiness.
8. Publish service states and qualification evidence.

If NetBird disconnects or the required default route disappears, the controller's five-second monitor stops REA, AI inference, and the managed compute service. The API gateway rejects chat, tool, graph, tensor, Hopfield, vector, and neural operations until the VPN gate is restored. The local dashboard and health/status controls remain available for recovery. The platform does not silently claim that local traffic is routed through a VPN.

Shutdown order is REA, AI runtime, compute, then platform. The NetBird client is not globally disconnected or uninstalled by Stop because it may be used by other applications.

## VPN meaning and full-tunnel requirement

VPN_REQUIRED=true and VPN_REQUIRE_EXIT_NODE=true are defaults. REA is gated on NetBird connected status plus an observed 0.0.0.0/0 route. That route must be configured by the NetBird administrator using an approved exit node and distribution policy.

This is not yet an OS-level firewall kill switch. NetBird's Auto Apply option is not an enforcement lock: the device user can deselect the exit node. A true whole-device no-leak policy additionally needs a Windows Firewall/endpoint-security rule set that blocks direct egress when the tunnel is absent, with a tested recovery/rollback procedure. Fun Industrial does not silently change Windows Firewall, default routes, DNS, or system-wide network policy. Until those host-level controls are separately configured and tested, do not describe the entire computer as guaranteed VPN-only.

The current application security boundary is: loopback-only dashboard and compute; all functional APIs require the NetBird exit-node gate by default; compute/AI/REA processes are stopped or denied on loss of that gate; external network access by other Windows applications is outside this app's control.

## AI conversation and tool-use policy

The dashboard includes a local conversation panel. The AI uses llama.cpp's OpenAI-compatible chat-completions endpoint on loopback. Conversation history is held in the browser session and is not persisted to a server database.

The AI receives a fixed built-in tool registry for graph analytics, tensor contraction, classic/modern Hopfield retrieval, isolated universe creation, vector search/topology, directed memory bridges, and per-universe neural training/prediction. The UI also fetches REA's live tool catalogue. The model receives only REA tools explicitly named in REA_ALLOWED_TOOLS. The default allowlist is empty. A proposed local or REA tool call is displayed with its JSON arguments and must be approved by a separate operator click. Built-in tools dispatch only to fixed local API routes; they cannot execute shell commands or arbitrary URLs. Tool results are shown as untrusted data; the model is asked to summarize rather than execute follow-on actions.

Do not allowlist a tool until its name, description, schema, side effects, filesystem scope, and network scope have been reviewed. Prefer read-only analysis and evidence tools. Do not allowlist shell, arbitrary command, write, delete, install, upload, persistence, or execution capabilities for routine chat.

## REA installation and operation

Activation installs rea-agents 6.8.0 under .runtime/rea using a private npm prefix; no global REA install or third-party client registration is performed. Node 22.23.4 or newer in the supported REA release range is required. REA is launched from the repository's private package directory through the existing Node executable. Its actual MCP initialize/initialized and tools/list exchange is required before status is READY.

REA upstream is MIT licensed and remains separately maintained: https://github.com/morluto/rea. REA may expose tools backed by independently licensed analysis engines; those tools and engines require their own review. REA's MCP connection does not grant unrestricted permission to use every tool.

## Local model

The local model is optional until the operator configures it. Fun Industrial does not download model weights. Recommended first CPU model for the 16 GiB host is Qwen/Qwen3-4B-GGUF Q4_K_M (approximately 2.5 GB), published under Apache-2.0 by Qwen. Review the model card and license before use: https://huggingface.co/Qwen/Qwen3-4B-GGUF.

Download an official Windows x64 CPU llama.cpp release archive from https://github.com/ggml-org/llama.cpp/releases and note the SHA-256 published by the release. The Qwen model download is pinned to revision `bc640142c66e1fdd12af0bd68f40445458f3869b`, expected size `2,497,280,256` bytes, and SHA-256 `7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5`; the script verifies both size and digest before accepting the file. Install it privately and download the pinned Qwen model into .runtime:

~~~powershell
.\scripts\Install-LlamaCpp.ps1 -ArchivePath "$HOME\Downloads\llama-cpp-windows-x64-cpu.zip" -ExpectedSha256 "PASTE_OFFICIAL_RELEASE_SHA256"
.\scripts\Download-QwenModel.ps1
.\scripts\Configure-LocalModel.ps1 -LlamaServerPath "$PWD\.runtime\llama.cpp\llama-server.exe" -ModelPath "$PWD\.runtime\models\Qwen3-4B-Q4_K_M.gguf" -Threads 4 -Context 4096
~~~

Then restart the platform. AI_AUTOSTART=true starts the local model during Activate. The first load may take time. If the model is not configured, the AI service is reported as not-configured rather than falsely ready.

## Isolated removal

Keep the llama.cpp binary and GGUF model inside .runtime (for example .runtime\llama.cpp and .runtime\models) so the repository-scoped uninstaller removes them. If you deliberately store a model elsewhere, that external file is not deleted by the uninstaller. .venv, .runtime, node_modules, reports, .env, and Python caches are ignored by Git.

Stop and remove only Fun Industrial's private runtime:

~~~powershell
.\scripts\Remove-FunIndustrial.ps1
~~~

To delete the entire clone after stopping services:

~~~powershell
.\scripts\Remove-FunIndustrial.ps1 -DeleteRepository
~~~

Optional Ghidra removal:

~~~powershell
.\scripts\Remove-FunIndustrial.ps1 -RemoveGhidra
~~~

The installer records whether it installed Git, Node.js, Python 3.12, JDK 25, and NetBird. By default the removal script leaves system-wide packages alone. To remove only packages recorded as installed by Fun Industrial, use -RemoveOwnedPrerequisites. A full project removal, including Ghidra and owned prerequisites, is: ` .\scripts\Remove-FunIndustrial.ps1 -RemoveGhidra -RemoveOwnedPrerequisites -DeleteRepository`. This never uninstalls a package the ownership manifest does not identify as project-installed. It does not touch Elektron.

## Qualification gates

- Unit tests for Hopfield, vector ranking, universe isolation, graph/tensor compute, malware metadata intake, and MCP handshake/tool-call framing.
- Windows and Ubuntu CI.
- Actual Windows installation and activation report.
- Actual llama.cpp health and chat test with the selected GGUF model.
- Actual NetBird peer connection and default-route evidence; verify IPv4 and IPv6 egress behavior independently.
- MCP tools/list inventory and operator-approved allowlist.
- REA tool-call tests for selected read-only operations.
- Review dependency provenance, Apache-2.0 project files, model license, REA MIT license, and all upstream notices.
- Independent security review before declaring the platform release-ready.

A green CI run does not prove real VPN, real model inference, real REA tool operations, Windows host isolation, or whole-device VPN enforcement.
