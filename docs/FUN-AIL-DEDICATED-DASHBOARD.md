# Fun Industrial AIL Control Center — first separate dashboard

The new `src/integrations/ail-dashboard.mjs` serves a **separate**, read-only web interface on `127.0.0.1:8794`. It does not install or start AIL Framework, connect to an AIL API, or change Fun Industrial's existing dashboard, Qwen, REA, Ollama or compute services.

Sections: Overview, Sources, Intelligence, Approvals, Resources. Status reads local total/free memory only and correctly reports AIL **not connected**. Source and intelligence screens are placeholders until an actual authorized AIL instance is configured. This is not a live AIL dashboard yet.

Run `node src/integrations/ail-dashboard.mjs` from a checkout to start the **new independent** local-only server, then open `http://127.0.0.1:8794/` on the Windows computer. Stop with Ctrl+C in that terminal. Port 8794 must be free. The server has no remote binding, authentication or HTTPS; **do not expose or forward it to the public Internet or VPN** until access controls are designed.

Four focused HTTP tests were added. Windows expected RAEM test total: **191** (187 previous + 4 new). The user reported 187/187 passing on Windows for RAEM-014. The new dashboard's Windows tests are pending.

Next milestone: verify an actual operator-controlled AIL deployment URL, authentication and API version; design a loopback-only, read-only server-side connection with explicit consent and no raw leak content or credentials returned to the browser. A full AIL stack may require separate Linux hardware/VM with sufficient RAM; this dashboard alone does not satisfy that requirement.
