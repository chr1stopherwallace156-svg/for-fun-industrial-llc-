# Operations

1. Install Node.js 22.23.4 or newer.
2. Clone the repository and check out the implementation branch.
3. Optionally copy .env.example to .env and enable only installed adapters.
4. Run npm run check, npm test, then npm start.
5. Open http://127.0.0.1:8787.

REA: install independently from upstream, verify its runtime prerequisites, then set REA_ENABLED=true. Current adapter starts its process but does not perform an MCP initialize handshake.

NetBird: install and enroll the official client through its documented operator flow. Set NETBIRD_ENABLED=true to display status. The adapter does not invoke login, up, down, or setup-key operations.

Stop terminates the managed REA child process. NetBird remains untouched. A degraded state requires independent diagnosis of the external service.
