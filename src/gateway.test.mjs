import test from "node:test";
import assert from "node:assert/strict";
import {createGatewayConfig} from "./gateway.mjs";
const base={FI_GATEWAY_BIND_IP:"100.90.0.2",FI_GATEWAY_ALLOWED_CLIENT_IPS:"100.90.0.3,100.90.0.4",FI_GATEWAY_USERNAME:"operator",FI_GATEWAY_PASSWORD:"a-very-long-test-password-that-is-over-24",FI_GATEWAY_TLS_KEY:"key.pem",FI_GATEWAY_TLS_CERT:"cert.pem",FI_GATEWAY_PUBLIC_HOST:"fun-industrial.example.net:8443"};
test("gateway requires explicit VPN interface and peer allowlist",()=>{const c=createGatewayConfig(base);assert.equal(c.bindIp,"100.90.0.2");assert.deepEqual([...c.allowed],["100.90.0.3","100.90.0.4"]);});
test("gateway rejects wildcard and loopback listeners",()=>{assert.throws(()=>createGatewayConfig({...base,FI_GATEWAY_BIND_IP:"0.0.0.0"}),/explicit non-loopback/);assert.throws(()=>createGatewayConfig({...base,FI_GATEWAY_BIND_IP:"127.0.0.1"}),/explicit non-loopback/);});
test("gateway rejects wildcard client access and weak credentials",()=>{assert.throws(()=>createGatewayConfig({...base,FI_GATEWAY_ALLOWED_CLIENT_IPS:"*"}),/wildcards/);assert.throws(()=>createGatewayConfig({...base,FI_GATEWAY_PASSWORD:"weak"}),/24 characters/);});
test("gateway requires explicit TLS identity and public host",()=>{assert.throws(()=>createGatewayConfig({...base,FI_GATEWAY_TLS_CERT:""}),/FI_GATEWAY_TLS_CERT is required/);assert.throws(()=>createGatewayConfig({...base,FI_GATEWAY_PUBLIC_HOST:"https://evil.example"}),/exact public VPN DNS name/);});

test("gateway rejects malformed IPv4 interface and peer addresses",()=>{assert.throws(()=>createGatewayConfig({...base,FI_GATEWAY_BIND_IP:"999.1.1.1"}),/explicit non-loopback/);assert.throws(()=>createGatewayConfig({...base,FI_GATEWAY_ALLOWED_CLIENT_IPS:"100.90.0.3,999.1.1.1"}),/valid IPv4/);});
