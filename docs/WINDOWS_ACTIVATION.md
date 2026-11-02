# One-pass Windows activation

Run from a PowerShell terminal in the repository:

    Set-ExecutionPolicy -Scope Process Bypass -Force; .\scripts\Activate-FunIndustrial.ps1

The script validates Git and Node, creates an isolated Python 3.12 environment, installs the pinned compute stack, runs graph/tensor/neural tests, installs Node dependencies, runs application checks, creates a loopback-only .env if absent, installs NetBird with winget if available, invokes the NetBird SSO flow, checks status, starts the dashboard, and writes a timestamped JSON report under reports/.

NetBird SSO requires the operator to complete the browser login. The script does not store VPN setup keys, change firewall policy, expose APIs to the LAN, disable security software, or enable remote access. To defer SSO, use -SkipNetBirdLogin.

The dashboard's Activate Fun Industrial operation starts compute and all enabled integrations. NetBird peer reachability and access-policy enforcement still require verification from the NetBird console and a second enrolled device.

The script is safe to rerun. Existing .env is preserved. It warns if run from a branch other than integration/bootstrap-architecture-v1 and never switches branches automatically.
