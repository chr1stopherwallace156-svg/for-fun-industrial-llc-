# Fun Industrial — REA 8797 guarded refresh

## Why
V3.2's first operator-approved real `inspect_binary_layout` returned an MCP `isError`. The original REA 8797 exact-call runner discarded provider detail. V3.3 adds bounded, non-verbatim error evidence but requires its code to be loaded in the **existing independently owned 8797 sidecar**. `Start-Fun-Rea229-Sidecar8797.ps1` is a start-only script and refuses an occupied port.

## Guarded repair source
`Repair-Fun-Rea229-Sidecar8797.ps1` introduces a separate dry-run mode and a separately approved update. It is not invoked by GitHub Actions and does not run itself on source checkout.

### Dry run
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Repair-Fun-Rea229-Sidecar8797.ps1 -CheckOnly`

It validates source syntax, all 131 focused tests, the exact live 8797 Node listener and script ownership, original and dependent service readiness, 229 real REA tools and 19 local tools, no pending approvals on 8798, and a **single direct known MCP child** with verified process ancestry. It records exact listener identities on ports 8789, 8796, 8798, 8088, 8791 and optional 8794/4479.

It does **not** stop or launch the live REA sidecar, execute any live MCP tool, or restart other services. Offline fixture tests may spawn short-lived synthetic child processes and use temporary test files. If the running child topology differs, it deliberately reports HOLD instead of guessing what to kill.

### Separately approved apply
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Repair-Fun-Rea229-Sidecar8797.ps1 -Apply -ApprovalPhrase 'AUTHORIZE REA 8797 RESTART'`

This command **is not authorized by preparing the code or running `-CheckOnly`**. It is only to be used after the operator explicitly approves a brief interruption to the 8797 MCP session. Preflight must pass again; it rechecks process creation identity before stopping **only two exact verified PIDs** (8797 owner and its direct MCP child), never `taskkill /T` or kill-by-name. It then invokes the existing start-only launcher, verifies a new 8797 loopback listener, 229 exact catalogue names, a new clean MCP session, and protected service listener identities. It **does not** stop or restart Qwen 8088, original dashboard/REA 8789, local 8796, Unified Chat 8798, compute 8791, or Elektron Ollama.

### Failure modes
- Any ambiguous owner, child, pending authorization, changed catalogue, busy REA, changed listener, failing offline tests, or unexpected process tree => HOLD **before stopping**.
- Race conditions remain possible between checks; the script is not an atomic Windows service manager.
- Termination is not reversible: a failure after stopping the old exact PIDs may leave 8797 unavailable. If it fails, manually review logs and PIDs; never automatically repeat a command.
- Since the 8798 process already loaded the old V3.2 source, a **second independently approved guarded 8798-only refresh** is needed after 8797 is healthy to consume V3.3 response evidence. This is not performed by the 8797 script.
- Updating the REA error boundary does not authorize replaying the original failed `inspect_binary_layout` request.

## Expected dry-run marker
```
REA8797_GUARDED_PREFLIGHT=PASS OLD_PID=... MCP_TOOLS=229 LOCAL_TOOLS=19
REA8797_PROCESS_TREE_REVIEW=...,...
REA8797_PENDING_APPROVALS=NONE
REA8797_CHECK_ONLY=PASS RESTARTS=0 MCP_CALLS=0 PROTECTED_SERVICES_UNCHANGED=TRUE
```

## Qualification scope
GitHub CI checks the Windows PowerShell parser and inert default, source-level no-broad-kill safety assertions, and synthetic REA offline tests on Windows and Linux. No GitHub CI test can confirm the operator's live Windows process tree or the real provider's analysis capability.
