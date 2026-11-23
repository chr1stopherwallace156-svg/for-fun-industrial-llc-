# Fun Industrial — Organized Workspace Preview V1

This branch adds a simplified, responsive user interface **only at `http://127.0.0.1:8802/ui-preview/`**. It does **not** change the HTML or JavaScript for the existing `/` homepage and does not remove the existing Qwen, research, executive operations, commerce, optimization or REA workflows.

## Design principles

- Seven clearly named destinations: Home, AI Chat, Research, Operations, Commerce, Tools & ML, System.
- Primary actions at the surface, advanced / legacy controls one level deeper.
- Responsive layout for Windows and the iPhone browser, predictable menu navigation, keyboard search (Ctrl+K).
- Chat is a single existing 8802 → Qwen 8088 request per operator send. V2 / V3 report context is opt-in. Replies are displayed as text, not interpreted as HTML or tool commands.
- Research V3 summaries, Qwen 8088 health, ML and operations are read via fixed, same-origin, *on-demand* GETs. No recurring polling.
- No startup scripts, model downloads, external CDNs, WebSocket connections, new services, persistent client storage or autonomous REA execution.
- Original homepage accessible via `/`; existing advanced modules accessible by their original routes.
- System checks are read-only. A configured chat route is not counted as Qwen being online unless the real local 8088 health responds.

## Installation

Clone `feature/fun-ui-redesign-preview-20261123` and run the top-level `Activate-Fun-Organized-Preview.ps1` from that clean checkout.

The activation script preflights syntax and `node --test test/organized-ui-preview-v1.test.mjs`, confirms any existing port 8802 process is the known reviewed Node dashboard source, and replaces **only** that 8802 process. Other TCP listeners, including Qwen 8088, REA, Elektron Ollama 11434 and the scheduled Math V3 worker, are protected. If preview health checks fail, the script attempts to restore the previous 8802 Node dashboard.

Do not overwrite the production homepage until the operator approves the design. The final adoption step is a separate, reviewed change.

## UI test coverage

- Original production homepage retains its existing version, markup and response.
- Preview has seven nonempty navigation views, keyboard search, mobile navigation, clear optional advanced destinations.
- Same-origin CSP (no external assets), read-only service health, verified Qwen status, and operator-click chat.
- Preview routes actually return the HTML, CSS and JS on an ephemeral local HTTP test listener. POST to read-only preview routes is rejected.
- No model training, tool execution authority or changes to business logic.

## Known limits

The interface uses existing API routes and modules, so some business panels still rely on their original advanced workflows. It does not claim to unify every tool's visual style yet. This is a usability-preview architecture, not a new AI, permission grant, or backend rewrite.
