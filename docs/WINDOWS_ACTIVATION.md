# One-pass Windows activation

From a PowerShell terminal in the repository root:

    Set-ExecutionPolicy -Scope Process Bypass -Force; .\scripts\Activate-FunIndustrial.ps1

The script validates Git and Node 22+, creates an isolated Python 3.12 environment, installs the pinned graph/tensor/API dependencies and official CPU-only PyTorch wheel, runs compute tests, installs Node dependencies, runs application tests, creates or safely completes a loopback-only .env, installs NetBird with winget if available, invokes the NetBird SSO flow, starts the local dashboard, calls the platform activation endpoint, and writes a timestamped JSON report under reports/.

NetBird SSO requires the operator to complete browser authentication. The script does not store VPN setup keys, change firewall policy, expose APIs to the LAN, disable security software, or enable remote access. To defer SSO, use -SkipNetBirdLogin.

The dashboard provides one Activate Fun Industrial control, plus explicit VPN connect/disconnect, graph analysis, tensor contraction, neural training, and prediction.

NetBird peer reachability and access-policy enforcement still require verification from the NetBird console and a second enrolled device. The report distinguishes ready from ready-with-actions-required.

The script is safe to rerun. Existing .env values are preserved; missing compute and NetBird settings are appended. It warns if run from a branch other than integration/bootstrap-architecture-v1 and never switches branches automatically.
