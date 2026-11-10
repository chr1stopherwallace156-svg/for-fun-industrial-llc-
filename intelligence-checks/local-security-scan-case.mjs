// No external hosts are contacted by these tests.
import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import {DEFAULT_PORTS,validateTarget,parsePorts,planScan,scanApproved} from "../src/security/local-scan.mjs";

test("default plan performs no network connections", () => {
  const p=planScan();
  assert.equal(p.state,"preview_only");
  assert.equal(p.connections_started,0);
  assert.deepEqual(p.ports,[...DEFAULT_PORTS]);
});

test("restrict targets to literal private IPv4 or localhost", () => {
  assert.equal(validateTarget("localhost"),"127.0.0.1");
  assert.equal(validateTarget("10.0.0.5"),"10.0.0.5");
  assert.equal(validateTarget("172.16.2.1"),"172.16.2.1");
  assert.equal(validateTarget("192.168.1.10"),"192.168.1.10");
  for (const value of ["8.8.8.8","169.254.1.1","172.32.1.1","example.com","0.0.0.0","::1","127.0.0.1/24"]) {
    assert.throws(() => validateTarget(value));
  }
});

test("port input is bounded, numeric and explicit", () => {
  assert.deepEqual(parsePorts("8788,8788,8088"),[8788,8088]);
  for (const value of ["0","65536","22-80","22,","-1","22;rm -rf /","1,".repeat(17)+"1"]) {
    assert.throws(() => parsePorts(value));
  }
});

test("scan requires a separate affirmative operator flag", async () => {
  await assert.rejects(scanApproved({target:"127.0.0.1",ports:[8788]}),/AUTHORIZATION_REQUIRED/);
});

test("scan only performs a TCP connection to a disposable loopback listener", async () => {
  const server=net.createServer(socket => socket.end());
  await new Promise((resolve,reject) => {
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  try {
    const port=server.address().port;
    const result=await scanApproved({target:"127.0.0.1",ports:[port],authorized:true,timeoutMs:500});
    assert.equal(result.state,"completed");
    assert.deepEqual(result.results,[{port,status:"open"}]);
    assert.equal(result.rea_tools_executed,0);
    assert.equal(result.credential_attempts,0);
    assert.equal(result.exploitation_attempts,0);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
