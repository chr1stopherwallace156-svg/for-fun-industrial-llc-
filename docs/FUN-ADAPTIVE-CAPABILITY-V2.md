# Fun Industrial — Adaptive Capability Orchestration V2

## Scope

V2 is read-only adaptive capability discovery embedded in the existing unified chat at http://127.0.0.1:8798. It queries live REA 8797 and local 8789/8796 registries, ranks relevant tool definitions by bounded deterministic lexical matching, identifies missing required inputs and provider readiness, and returns a proposed workflow. Qwen3 via external llama.cpp 8088 and compute 8791 remain unchanged. Elektron's Ollama is not used.

**Discovery never executes registered tools or grants authority.** All candidate matches are advisory. Registration does not establish that a binary analysis provider is installed, that a local asset exists or that a capability will work.

## Live capability contract

- REA must report ready with exactly 229 unique schema-bearing tools. An invalid or inaccessible REA catalogue contributes zero verified REA tools and a discovery HOLD.
- Local must report 8796 sidecar and exactly 19 named fi_ tools from 8789. REA aliases are not treated as local tools.
- The planner makes four GET requests to currently running loopback endpoints, with no model inference, MCP tools/call, filesystem writes or background work.
- Candidates expose source, name, description, required argument names, providerVerified=false, executionAllowed=false, and operatorApprovalRequired=true.
- V2 returns executedActions=0, approvalGranted=false and a list of prerequisites. Scores are relevance heuristics, not probabilities of success.

## Use the same chat

Ask: Find tools to inspect a Rust executable
Ask: Which capabilities can analyze a graph?

These route to capability_plan and display grounded matches inside the existing 8798 conversation, with no tool execution. The same-origin programmatic endpoint is POST /api/unified/capabilities/plan with JSON body containing a prompt and the original Origin and x-fi-unified=operator-click headers.

The standalone read-only preflight runs:

    node scripts/Diagnose-Fun-Adaptive-V2.mjs --plan "Find tools to inspect a Rust binary"

The output reports live registration counts, matching candidate tools, required arguments, blockers, executedActions=0, and approvalGranted=false. Exit code 2 indicates incomplete live catalogues.

## Controlled operator activation

The existing running 8798 process was started from C:\Users\alxar\FunIndustrial-UnifiedChat-V1. In that SAME clean checkout, fetch and switch to feature/fun-adaptive-capability-v2-20261111. Then execute Repair-Fun-Unified-Web8798.ps1 -Apply. The repair first checks a real public example.org fetch and the 248-tool live discovery BEFORE touching any live process. It verifies the exact 8798 Node owner and unchanged original 8789/8796/8797/8088/8791 listeners, and restarts ONLY the verified port 8798 process. The starter tests V1 plus V2 offline suites before the new 8798 launches.

On a failed preflight, do NOT force a restart. The old 8798 process continues. The source branch has not been deployed onto the operator's Windows machine at authoring time.

## Limitations / follow-up

V2 is NOT autonomous universal tool execution, provider installation, app download, game porting, web browser automation, or self-healing. Existing read-only REA tools and separately authorized 19-local/229-REA executor buttons are preserved, but V2's discovered candidates are **not** passed directly into those execution paths. Exact approved tool identity and schema-bound argument execution with evidence verification is a future distinct qualification phase.

## Tests

The CI suite on Windows and Linux runs the prior Unified Task Chat tests and the new V2 tests, including schema validation, missing/duplicate catalogues, no-guess routing, zero tool calls, same-origin endpoint and inert CLI. These tests use fixtures; the Windows live preflight is still necessary.
