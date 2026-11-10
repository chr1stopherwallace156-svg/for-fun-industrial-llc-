# Fun Industrial — English-Only Local Security Inventory V1

## Purpose

Original, narrow implementation inspired by the general network-inventory *idea* in shadow1ng/fscan. No Fscan source code, binary, payload, fingerprint database, rule bundle, or dependencies are copied or installed.

Upstream reference: https://github.com/shadow1ng/fscan — inspected tree at commit `2ede41d743b87743b11f69e85dd37c634c1c0ef6`.
Upstream Fscan source license is MIT (copyright 2021 shadow1ng); see https://github.com/shadow1ng/fscan/blob/main/LICENSE.txt. Any future reuse of upstream code must retain its applicable notices and be separately reviewed.

## What was and was not reviewed

- Confirmed upstream license, English README, complete recursive path inventory (1,232 file/directory entries), and general module families.
- Did NOT finish a file-by-file security audit of upstream code, transitive dependencies, compiled releases or network behavior. Security result for original Fscan: `HOLD_NOT_AUDITED`.
- Chinese-language text is not a malware signal. An English-only rewrite is a trust/maintainability choice, not a security proof.

## Deliberately supported

- Preview-first CLI: no connection is made unless `--authorize` is supplied.
- Explicit IPv4 loopback/private-network target only; no DNS names (except literal `localhost` -> `127.0.0.1`).
- Up to 16 explicitly listed TCP ports; maximum four concurrent connections; bounded timeouts.
- TCP connect result classification: open, closed, unreachable or timeout.
- JSON output; no third-party packages or cloud services required.

## Explicitly excluded

- No password guessing, NTLM/hash handling, exploitation, payloads, persistence, reverse shells, keylogging, credential access, privilege escalation, or log cleaning.
- No auto-discovery, CIDR sweeps, arbitrary public targets, network listeners, background schedulers, installers, or service restarts.
- No dashboard integration, REA allowlist changes, Ollama access, llama.cpp model control, or Python compute changes.

## Windows PowerShell — inspect the plan first

```powershell
node .\src\security\local-scan.mjs --target 127.0.0.1 --ports 8788,8790,8088,8791
```

Output remains `preview_only`, `connections_started=0`.

## Run a *separately authorized* TCP inventory on your own loopback

```powershell
node .\src\security\local-scan.mjs --target 127.0.0.1 --ports 8788,8790,8088,8791 --authorize
```

This makes TCP connection attempts only. It does not probe application routes, log in, or test vulnerabilities. A discovered open port is not evidence that its service is safe.

## Offline qualification

```powershell
node --test intelligence-checks/local-security-scan-case.mjs
```

Node must satisfy the project's existing engine requirement. Tests contact only an ephemeral disposable loopback listener. CI and an operator's Windows verification remain required before qualification.

## Policy

Only scan infrastructure you own or have explicit permission to assess. The command-line approval flag is an operator declaration, not an independently verified target-ownership check. Review each proposed expansion as a separate change. Do not run original Fscan executables or copy third-party scanners into the Fun Industrial production environment.
