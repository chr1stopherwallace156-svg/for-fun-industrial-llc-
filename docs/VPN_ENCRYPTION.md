# VPN encryption architecture

## Decision

Use NetBird with its WireGuard-based encrypted overlay as the first VPN integration. Do not implement a custom VPN protocol or cryptographic primitive in this application. NetBird supplies peer discovery, WireGuard tunnel management, policy control, and relay fallback; this repository owns only the local operator experience and integration boundary.

Upstream: https://github.com/netbirdio/netbird  
Documentation: https://docs.netbird.io/

## Security properties and boundaries

- Data-plane traffic is carried over WireGuard-encrypted peer tunnels.
- Management and signaling coordinate identity, peer configuration, and connectivity; control-plane reachability is not proof that a peer tunnel is established.
- Restrict access with explicit peer groups and least-privilege network policies.
- Use SSO with MFA for operator identity where available. Setup keys are secrets; never commit them or place them in ordinary logs.
- The NetBird client owns private WireGuard key material. This application must not read, export, print, or persist those private keys.
- Client-reported connected state is a health signal, not an independent cryptographic audit.

## v0.2 integration behavior

- NETBIRD_ENABLED=true enables the adapter.
- Dashboard Connect VPN invokes the installed netbird up command after an operator click.
- Dashboard Disconnect VPN invokes netbird down after an operator click.
- NETBIRD_AUTOCONNECT=true opts the operator into running netbird up as part of Start platform.
- Default is false. No silent enrollment or account login is performed.
- Status uses detailed client output and reports connected/disconnected only when a recognized daemon state is present.
- Platform Stop deliberately does not disconnect VPN; network continuity is separate from application process shutdown.

## Deployment choices

Start with NetBird Cloud for a first operator-managed deployment. Evaluate self-hosted management later if data residency, independent control-plane ownership, or operational requirements justify running management, signal, relay, and identity-provider components. A self-hosted control plane does not replace WireGuard peer encryption.

## Required operator steps

1. Install the official NetBird client on each device joining the private network.
2. Authenticate and enroll each device through the approved NetBird login flow.
3. Create device groups and least-privilege access policies before sharing resources.
4. Enable NETBIRD_ENABLED=true locally.
5. Use Connect VPN in the dashboard, or deliberately set NETBIRD_AUTOCONNECT=true if platform startup should connect it.
6. Verify peer list, overlay addresses, access policy, and actual allowed/denied connectivity in the NetBird admin console.

## Acceptance gates

- A device is not enrolled merely because the CLI is installed.
- Daemon connected is not proof that the intended peer is reachable.
- Confirm peer-to-peer connection or documented relay path, expected overlay address, and policy enforcement.
- Test that unauthorized peers and ports are denied.
- Verify DNS behavior and route scope; do not enable exit-node or broad subnet routing by default.
- Document NetBird release version and license used for each packaged release.
- Do not expose the local dashboard remotely. VPN membership does not automatically authorize dashboard access.

## Upstream references

- NetBird overview: https://github.com/netbirdio/netbird
- Architecture: https://docs.netbird.io/about-netbird/how-netbird-works
- Installation and enrollment: https://docs.netbird.io/get-started
- Access policies: https://docs.netbird.io/how-to/manage-network-access
