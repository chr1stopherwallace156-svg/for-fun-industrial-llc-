# Windows installation and back-to-back qualification

## Objective

Provide a repeatable local sequence after cloning the public repository. Installation and qualification are distinct: activation installs the direct dependencies and runs baseline tests; the qualification script then performs a second sequential pass and writes a timestamped JSON evidence report.

## Host constraints

The intended initial host profile is a Windows 11 system with 16 GiB RAM and an AMD Radeon RX 6600. The first release is CPU-first. Avoid CUDA-only packages, large model downloads, or concurrent heavy jobs. The optional Ghidra distribution is approximately 570 MB and requires 64-bit JDK 25 per the official release notes. Model weights and malware samples are not downloaded by setup or CI.

## Back-to-back sequence

Run from the cloned repository root in PowerShell. Keep the repository on the feature branch until its PR is reviewed and merged. The first step installs Eclipse Temurin JDK 25 and downloads the official Ghidra 12.2 archive (approximately 570 MB), verifies its SHA-256 before extraction, and writes an install receipt. The activation step can install Git, Node LTS, Python 3.12, Python dependencies, CPU PyTorch, NetBird, run baseline tests, and start local services. NetBird login is an explicit operator step. The second command re-runs dependency consistency, compute/AI/ML/malware unit tests, Node syntax checks, Node regression tests, and license checks, then records a report.

~~~powershell
Set-ExecutionPolicy -Scope Process RemoteSigned -Force; .\scripts\Install-Ghidra.ps1; if ($LASTEXITCODE -ne 0) { throw 'Ghidra installation failed; preserve its output and stop.' }; .\scripts\Activate-FunIndustrial.ps1; if ($LASTEXITCODE -ne 0) { throw 'Activation failed; preserve the report and stop.' }; .\scripts\Qualify-FunIndustrial.ps1 -GhidraRoot "$env:LOCALAPPDATA\FunIndustrial\tools\ghidra_12.2_PUBLIC" -GhidraArchivePath "$env:USERPROFILE\Downloads\ghidra_12.2_PUBLIC_20261016.zip"
~~~

To receive a full Ghidra integrity PASS, provide both -GhidraRoot and -GhidraArchivePath; the latter must be the official 12.2 release ZIP whose SHA-256 matches the published digest. If Ghidra has not yet been installed, omit both arguments. The report will state PASS_WITH_ACTIONS_REQUIRED; it will not claim decompilation is qualified. Do not chain onward after activation fails. Preserve the failure report and logs before any repair attempt.

## Expected result

- QUALIFICATION_FINAL=PASS only when all scripted stages pass, Ghidra is found, and the supplied archive digest matches.
- QUALIFICATION_FINAL=PASS_WITH_ACTIONS_REQUIRED when tests pass but an optional prerequisite such as Ghidra is missing or the branch is not the expected feature branch.
- QUALIFICATION_FINAL=FAILED for a failed test, dependency issue, missing required environment, or other blocking error.
- A timestamped reports/qualification-*.json records each stage and explicitly states that real malware-sample qualification was not performed.

The existing Activate-FunIndustrial.ps1 report and the new qualification report must both be retained. Do not interpret service running as proof of VPN peer reachability, model quality, or malware analysis safety.

## Additional release gates

GitHub CI must pass on Windows and Ubuntu. Before merge, independently review the code, third-party notices, resolved dependency versions, and the Apache-2.0 license. Before real-sample work, separately validate the disposable offline VM and Ghidra setup as described in MALWARE_STATIC_ANALYSIS.md. Never use a production workstation or a connected host as a malware detonation environment.
