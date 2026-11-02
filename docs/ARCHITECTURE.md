# Architecture

The application is a local control plane, not a replacement for upstream tools.

- Dashboard: static browser UI served by the local Node.js process.
- HTTP API: status and lifecycle endpoints.
- Coordinator: serial adapter startup and aggregated health.
- Adapters: narrow boundaries around independently installed external executables.

Operator -> local dashboard -> loopback HTTP API -> lifecycle coordinator -> REA adapter / NetBird adapter -> upstream tools.

Startup order: query NetBird status (read-only), start REA only when explicitly enabled, then aggregate states. The application-level ready state is bounded; it is not proof of VPN security or MCP protocol readiness.

Non-goals: implementing cryptography, replacing WireGuard, automatic enrollment, rewriting REA, remote administration, privilege elevation, or arbitrary shell execution.
