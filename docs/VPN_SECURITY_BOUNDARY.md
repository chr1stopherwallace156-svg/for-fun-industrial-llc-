# VPN security boundary and qualification

## Current enforcement implemented

- Dashboard and compute API bind to 127.0.0.1 only.
- Browser requests are checked for loopback Host and expected Origin.
- NetBird is checked through its local client status command.
- All compute, AI chat, built-in AI/ML tool calls, and REA MCP operations are blocked unless VPN_REQUIRED=true and the required exit-node route are satisfied.
- VPN_REQUIRE_EXIT_NODE=true additionally requires the NetBird status output to advertise 0.0.0.0/0.
- A five-second control-plane monitor stops managed compute, local AI inference, and REA when the required route or connected state is lost. The API gateway also checks the gate on each functional request.
- NetBird private keys remain managed by the NetBird client.
- The dashboard does not add firewall rules, install routes, set DNS, or modify the NetBird management policy.

## What is not guaranteed yet

This is application-level gating, not a Windows Firewall kill switch. It cannot force every process on Windows to send all internet traffic through NetBird. It also cannot prove that an exit node's firewall, DNS, IPv6 policy, or upstream egress is correctly configured.

NetBird's exit-node Auto Apply is a convenience, not an immutable enforcement control. A device user may deselect an exit node. For true whole-device VPN-only egress, configure and independently qualify a host firewall policy that blocks direct egress when the tunnel is absent. Such a policy can interrupt internet access or management if misconfigured; it must have a documented backup, recovery path, and rollback before deployment.

## Required operator checks

1. Enroll the computer in the intended NetBird network using the official client.
2. Configure a trusted, preferably isolated routing peer as an exit node and assign only the intended device group. Ensure the required source-group-to-routing-peer access policy (including ICMP) is present.
3. Configure a NetBird nameserver with match domain ALL so DNS follows the exit-node path. Restrict the exit node's access to internal LANs (for example, Block LAN access or a dedicated isolated network segment). The default route can otherwise reach networks available to the routing peer.
4. Verify NetBird reports the peer connected and advertises 0.0.0.0/0.
5. Check the public IPv4 egress address against the expected exit-node location.
6. Check IPv6 egress separately. Confirm it is routed through the tunnel or demonstrably blocked; do not assume IPv4 routing proves IPv6 safety.
7. Check DNS behavior and DNS leak behavior.
8. Disconnect NetBird deliberately. Confirm REA is stopped/blocked and the dashboard reports VPN gate blocked.
9. Confirm the host firewall kill-switch behavior separately, if installed. Verify no direct egress is possible and that the rollback/recovery procedure works.
10. Reconnect NetBird and confirm REA starts only after the exit route is again present.
11. Preserve timestamped logs, command outputs, route state, test destination, observed egress IP, DNS result, IPv6 result, and firewall policy hash.

## Release state

Until these host-level checks pass, the correct claim is: “Fun Industrial loopback services are local; REA is gated on NetBird connection and an observed exit-node route.” Do not claim the entire Windows computer is permanently VPN-enforced.
