# Fun Industrial — Offline Binary Integrity Verification V1

## Scope

Adds a standalone, read-only integrity checker for seven selected llama.cpp files on the Windows Fun Industrial host. Existing TCP scanner unchanged. Python 3.12 standard library only.

Source: `src/security/verify_llama_release.py`.
Pinned manifest: `src/security/trusted-manifests/llama-b12102-win-cpu-x64.json`.

## Reference evidence

- Official release: https://github.com/ggml-org/llama.cpp/releases/tag/b12102
- Commit: `bbb02c93e9b83255b70ac1a755bb02b0a251f9a7`
- Official asset: `llama-b12102-bin-win-cpu-x64.zip`
- Published asset SHA-256: `87d8c812e8a68a35de55c2e7caab280bf96199b79395045d7a67de4b1ad802a9`
- Seven selected file SHA-256 values were reported by the operator after matching this official ZIP manually. They are pinned in the manifest.

The tool verifies archive SHA-256 against a code-pinned official checksum, verifies each of seven selected members inside the ZIP against the manifest, and then checks each installed component. The ZIP is read as data; no executable is run.

## Run from an isolated checkout on Windows

Run unit tests:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" -m unittest discover -s .\intelligence-checks -p test_offline_binary_integrity.py -v
```

Then perform offline verification using the already downloaded official reference ZIP:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" .\src\security\verify_llama_release.py --archive "$env:TEMP\llama-b12102-bin-win-cpu-x64.zip" --installed-dir "$HOME\FunIndustrial\.runtime\llama.cpp"
```

Expected: `event=FUN_LOCAL_BINARY_INTEGRITY_RESULT`, `state=PASS`, `matched=7`, `required=7`, `archive_integrity=PASS`; exit code zero. A mismatch, missing artifact, ambiguous or corrupt ZIP, or altered reference results in HOLD with nonzero exit status. Do not auto-replace files after a HOLD.

## Operational boundaries

- Local-only, read-only, offline. No shell invocation, external package, network access, process stop, filesystem modification, scheduler, daemon, REA access, or dashboard modification.
- No Ollama; no other installed Fun Industrial modules changed.
- No executables are run; no ZIP members extracted.
- Exact SHA-256 matches prove byte identity with the specified release, **not** that the software is free of vulnerabilities or malicious behavior.
- Scope is only seven selected executable/DLL components, not all DLLs, the model, Python packages, memory state, or the entire Fun Industrial platform.
- Streaming reads and per-file size limits reduce resource use. Locally malicious actors with write privileges could still manipulate the verifier or its references.
- The trust anchor remains the official published archive digest. Do not accept arbitrary new manifest contents without a separate review.

## Qualification

Offline synthetic fixtures test matching, modified installed files, deleted files, archive hash mismatch, member hash mismatch, missing/duplicated members, symlink handling, and nonofficial manifest rejection.

CI tests synthetic fixtures on Windows and Linux only. A live comparison must be executed by the operator on the Windows host and reported; it has not been performed by CI.
