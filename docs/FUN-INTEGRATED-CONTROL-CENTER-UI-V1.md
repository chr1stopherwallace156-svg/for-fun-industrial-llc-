# Fun Industrial Integrated Control Center UI V1

## Purpose
Replace the long appended integrated dashboard on **port 8802** with a professional, responsive, task-focused shell **without modifying the original 8789 or unified 8798 HTML, event handlers, Qwen logic, REA authorization, or ML authority**.

## Workspaces
- **Overview** (default): six service/connection cards and quick links. Read-only GET checks once after page load, with a manual refresh button; no timers or automatic external feeds.
- **Commerce**: existing Google Trending Now, Shopify API synchronization and V1.1 opportunity research queue, with existing explicit refresh authorizations.
- **Machine Learning**: existing scikit-learn task form, exact input validation and separately approved training.
- **Qwen Chat**: conversation-focused original 8798 interface; tool-inspection sections are hidden but preserved in the document.
- **Tools & Review**: exact staged inspection and REA review panels from original 8798 with the same confirmation gates.
- **Original Workspace**: existing original 8789 UI with its unchanged live controls and scripts.

Navigation on one route uses browser history, avoiding re-render and loss of unsent form content. Switching between the original and unified source pages performs a regular navigation while preserving independent services.

## Compatibility and safety
The 8802 hub injects one static shell, one CSS file and one presentation-only JS file into the already proxied HTML pages:
- `GET /api/ui/style.css`
- `GET /api/ui/client.js`

CSP explicitly authorizes same-origin static assets and retains the original page's necessary inline script/style compatibility. No new POST routes, no new tools, no model prompts and no background jobs.

The upstream native DOM stays intact and unmodified; clients use CSS classes to show/hide views. If the UI initializer cannot find required nodes, it returns without hiding the old interface. The shell CSS is hidden until JS successfully activates it.

UI health uses only bounded, read-only requests to:
`/api/unified/status`, `/api/ml/dashboard/status`, `/api/commerce/status`, and `/api/commerce/opportunities`.
Data is assigned using `textContent`, not untrusted HTML. The shell does not expand permissions or expose new private HTTP routes.

## Testing
The startup preflight runs `node --test intelligence-checks/integrated-hub-ui-v1-case.mjs` alongside all previous integration tests. UI tests verify preserved original/chat IDs, asset routing, CSP, responsive/fallback CSS and no implicit action execution.

The existing guarded `Activate-Fun-Commerce-V1.ps1` now recognizes the new UI assets. If old port 8802 is active, it checks owner identity, saves a fallback worktree at known good commit `404752943e6d3dcbb164784ef9dc371d75ce8ecf`, replaces **only port 8802**, and verifies both pages and new resources. All other critical port owners are checked before and after and are not intentionally restarted.

For UI-only changes call `Activate-Fun-Commerce-V1.ps1 -SkipGoogleRefresh`. It leaves the latest captured Google RSS and Commerce Intelligence evidence untouched. A zero-match research queue is valid and is not modified.

## Device access
- Windows PC: `http://127.0.0.1:8802/`
- Unified chat: `http://127.0.0.1:8802/unified/?view=chat`
- Qwen tools: `http://127.0.0.1:8802/unified/?view=tools`
- On iPhone, forward local port 8802 in Termius to the Windows PC. The already-running NetBird HTTPS gateway on 8443 continues to serve the original 8789 dashboard; no route changes are made.

## Limitations
This is a presentation and workflow-organization update, not a new AI inference model, Shopify supplier feed, autonomous buying agent, or replacement of the existing original dashboard. The 8802 navigation code and responsive layout require real Windows/Safari rendering verification after activation; source checks are not equivalent to testing in Safari.
