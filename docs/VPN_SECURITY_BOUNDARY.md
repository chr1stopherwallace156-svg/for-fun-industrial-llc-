# VPN security boundary and qualification

## Current enforcement implemented

- Dashboard and compute API bind to 127.0.0.1 only.
- Browser requests are checked for loopback Host and expected Origin.
- NetBird is checked through its local client status command.
- REA MCP startup and all REA catalogue/tool operations are blocked unless VPN_REQUIRED=true is satisfied.
- VPN_REQUIRE_EXIT_NODE=true additionally requires the NetBird status output to advertise 0.0.0.0/0.
- A five-second control-plane monitor stops REA when the required route or connected state is lost.
- NetBird private keys remain managed by the NetBird client.
- The dashboard does not add firewall rules, install routes, set DNS, or modify the NetBird management policy.

## What is not guaranteed yet

This is application-level gating, not a Windows Firewall kill switch. It cannot force every process on Windows to send all internet traffic through NetBird. It also cannot prove that an exit node's firewall, DNS, IPv6 policy, or upstream egress is correctly configured.

NetBird's exit-node Auto Apply is a convenience, not an immutable enforcement control. A device user may deselect an exit node. For true whole-device VPN-only egress, configure and independently qualify a host firewall policy that blocks direct egress when the tunnel is absent. Such a policy can interrupt internet access or management if misconfigured; it must have a documented backup, recovery path, and rollback before deployment.

## Required operator checks

1. Enroll the computer in the intended NetBird network using the official client.
2. Configure a trusted routing peer as an exit node and assign only the intended device group.
3. Verify NetBird reports the peer connected and advertises 0.0.0.0/0.
4. Check the public IPv4 egress address against the expected exit-node location.
5. Check IPv6 egress separately. Confirm it is routed through the tunnel or demonstrably blocked; do not assume IPv4 routing proves IPv6 safety.
6. Check DNS behavior and DNS leak behavior.
7. Disconnect NetBird deliberately. Confirm REA is stopped/blocked and the dashboard reports VPN gate blocked.
8. Confirm the host firewall kill-switch behavior separately, if installed. Verify no direct egress is possible and that the rollback/recovery procedure works.
9. Reconnect NetBird and confirm REA starts only after the exit route is again present.
10. Preserve timestamped logs, command outputs, route state, test destination, observed egress IP, DNS result, IPv6 result, and firewall policy hash.

## Release state

Until these host-level checks pass, the correct claim is: “Fun Industrial loopback services are local; REA is gated on NetBird connection and an observed exit-node route.” Do not claim the entire Windows computer is permanently VPN-enforced.
