# Fun Industrial — Visual Control Deck V1

## Purpose

A visually richer, responsive workspace on the **existing 127.0.0.1:8802 host** at `http://127.0.0.1:8802/control/`. The prior homepage (`/`) is **not modified** and remains the original layout. This is one additional UI page, not a new port or an additional AI server.

The goal is to consolidate real capabilities and introduce a safe UI for device orchestration **without fabricating device control or screen-sharing functionality**.

## What works now

- Responsive dark UI with dedicated navigation to the existing Fun Industrial dashboard, Qwen chat (`/chat/`), reviewed ML and optimization panel, FISRE source reasoning (`/fisre/`), and executive operations (`/operations/`).
- Operator-click **Check services** queries one fixed same-origin endpoint `GET /api/fun/control/status`. It performs only bounded read-only health checks of local Qwen 8088, local REA 8797, and the already-verified scikit-learn adapter 8801. The current UI response proves 8802 is serving the page. No polling, service starts or automation.
- Device workspace for PlayStation 5, Roku, MacBook, and iPad. Cards open an inspector with device-specific setup guidance and explicit disabled states for discovery, pairing, control and screen streaming.
- Device nicknames can be saved/reset in browser `localStorage` only. No credentials, network addresses, saved passwords, transmitted device data, or changes to another device. Copy setup steps works only from an explicit browser click.
- Existing Qwen chat has a plain link to the new deck. **No original homepage CSS/HTML is altered.**

## Device control: what is NOT implemented

This first phase does **not** discover, pair with, turn on, control, or mirror a PS5, Roku, MacBook, or iPad. It does not scan LAN devices or use Starlink administrative APIs. All device profiles start `not_paired`; `deviceControlEnabled=false`; `videoEnabled=false`. They are **not detected network devices**.

The PS5 would require an operator-configured compatible Remote Play session and permitted wake from Rest Mode, and a separately reviewed bridge to request or capture its display. Roku remote control is separate from receiving Roku video. Mac requires authenticated desktop/screen-sharing software. iPad mirroring is constrained by iPadOS and compatible receiving hardware.

Future control adapters require a separate security review, an explicit pairing and device owner, device-specific command allowlists, explicit operator confirmation and real receipts. Qwen is never allowed to issue arbitrary LAN commands.

## Deployment

Use the already reviewed `Activate-Fun-FISRE-Live-V4.ps1` after updating the `feature/fun-fisre-live-8802-20261122` checkout.

The script attests:
- The existing home page, chat, FISRE routes and operator approval invariants.
- The new `/control/` page and separate local stylesheet and client JS respond.
- `GET /api/fun/control/status` reports `fun-control-deck-v1` with `read_only_observation`, four disabled device profiles, and zero external actions.
- Other service listener snapshots remain unchanged.
- Controlled 8802 ownership/rollback protections remain active.

Expected marker: `FUN_CONTROL_DECK=READONLY_UI_ACTIVE_AT_8802_CONTROL`. This proves the new visual page and the bounded status route are served; it does **not** prove devices are connected.

Use `http://127.0.0.1:8802/control/` on the **Windows PC**. iPhone must use an authenticated SSH forward to the PC’s port 8802. Do not expect `127.0.0.1:8802` to work on the iPhone without a tunnel.

## Constraints kept intact

No Elektron changes, Qwen model weight changes, REA allowlist changes, 8798 repairs, Starlink setup changes, LAN broadcast discovery, service restarts outside known 8802 handoff, credential import, background polling, paid actions, arbitrary shell tool invocations, or automatic device control.
