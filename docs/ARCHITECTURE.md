# Architecture

The application is a local control plane coordinating independent upstream tools.

- Dashboard: browser UI served by Node.
- HTTP API: local lifecycle, VPN, and compute proxy endpoints.
- Coordinator: sequential startup and aggregated health reporting.
- NetBird adapter: status/connect/disconnect interface to the separately installed client.
- Compute adapter: starts the isolated Python service on 127.0.0.1:8790.
- REA adapter: starts the separately installed REA CLI/MCP process when explicitly enabled.

Operator -> dashboard -> loopback API -> lifecycle coordinator -> NetBird / compute / REA adapters.

The compute service exposes bounded graph analysis, tensor contraction, neural training and prediction. It uses NetworkX, Quimb, and PyTorch CPU. Graphs and neural training loss are rendered in the dashboard.

Startup sequence: check NetBird state; start compute if enabled; start REA only if explicitly enabled; aggregate health. Activate Fun Industrial runs this sequence. A degraded result is reported when an enabled service fails. NetBird first-time identity enrollment remains an operator-controlled SSO flow.

Non-goals: custom cryptography, replacing WireGuard, automatic secret provisioning, modifying upstream repos, remote administration, privilege elevation, or arbitrary shell execution.
