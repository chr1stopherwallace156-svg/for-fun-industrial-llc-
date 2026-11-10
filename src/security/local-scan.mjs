// FUN_LOCAL_SCAN_V1 — original, dependency-free, English-only defensive inventory.
// No source from Fscan is copied. No shell, auth attempts, exploits, persistence, or REA.
import net from "node:net";
import {pathToFileURL} from "node:url";

export const DEFAULT_PORTS = Object.freeze([8788, 8790, 8088, 8791]);

export function validateTarget(host) {
  if (host === "localhost") return "127.0.0.1";
  if (typeof host !== "string" || net.isIP(host) !== 4) {
    throw Error("SCAN_TARGET_MUST_BE_LITERAL_IPV4_OR_LOCALHOST");
  }
  const [a,b] = host.split(".").map(Number);
  if (!(a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168))) {
    throw Error("SCAN_TARGET_NOT_PRIVATE_OR_LOOPBACK");
  }
  return host;
}

export function parsePorts(value) {
  if (typeof value !== "string" || !/^[0-9]{1,5}(,[0-9]{1,5}){0,15}$/.test(value)) {
    throw Error("SCAN_PORTS_INVALID_FORMAT_OR_COUNT");
  }
  const ports = [...new Set(value.split(",").map(Number))];
  if (!ports.length || ports.length > 16 || ports.some(x => !Number.isInteger(x) || x < 1 || x > 65535)) {
    throw Error("SCAN_PORT_OUT_OF_RANGE");
  }
  return ports;
}

export function planScan({target="127.0.0.1", ports=DEFAULT_PORTS}={}) {
  const host = validateTarget(target);
  if (!Array.isArray(ports) || ports.length < 1 || ports.length > 16 ||
      ports.some(x => !Number.isInteger(x) || x < 1 || x > 65535)) {
    throw Error("SCAN_PORTS_INVALID");
  }
  return {
    event: "FUN_LOCAL_SECURITY_SCAN_PLAN",
    state: "preview_only",
    host,
    ports: [...new Set(ports)],
    protocol: "TCP_CONNECT_ONLY",
    authorization_required: true,
    connections_started: 0
  };
}

function tcpConnect(host, port, timeoutMs) {
  return new Promise(resolve => {
    const socket = net.createConnection({host, port});
    let complete = false;
    function finish(status) {
      if (complete) return;
      complete = true;
      socket.destroy();
      resolve({port, status});
    }
    socket.once("connect", () => finish("open"));
    socket.once("error", err => finish(err?.code === "ECONNREFUSED" ? "closed" : "unreachable"));
    socket.setTimeout(timeoutMs, () => finish("timeout"));
  });
}

export async function scanApproved({target="127.0.0.1",ports=DEFAULT_PORTS,authorized=false,timeoutMs=500}={}) {
  if (authorized !== true) throw Error("SCAN_EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED");
  const p = planScan({target,ports});
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 2000) {
    throw Error("SCAN_TIMEOUT_INVALID");
  }
  const queue = [...p.ports];
  const results = [];
  const workers = Array.from({length:Math.min(4,queue.length)}, async () => {
    while (queue.length) {
      const port = queue.shift();
      results.push(await tcpConnect(p.host,port,timeoutMs));
    }
  });
  await Promise.all(workers);
  results.sort((a,b) => a.port-b.port);
  return {
    event: "FUN_LOCAL_SECURITY_SCAN_RESULT",
    state: "completed",
    host:p.host,
    protocol:p.protocol,
    results,
    rea_tools_executed:0,
    exploitation_attempts:0,
    credential_attempts:0
  };
}

function argumentsFromCLI(args) {
  const options = {target:"127.0.0.1",ports:[...DEFAULT_PORTS],authorized:false};
  for (let i=0;i<args.length;i++) {
    if (args[i] === "--authorize" && !options.authorized) {
      options.authorized = true;
    } else if (args[i] === "--target" && args[i+1]) {
      options.target = args[++i];
    } else if (args[i] === "--ports" && args[i+1]) {
      options.ports = parsePorts(args[++i]);
    } else {
      throw Error("SCAN_USAGE: --target PRIVATE_IPV4 --ports 8788,8790 --authorize");
    }
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = argumentsFromCLI(process.argv.slice(2));
    const result = options.authorized
      ? await scanApproved(options)
      : planScan(options);
    console.log(JSON.stringify(result));
  } catch (e) {
    console.error("FUN_LOCAL_SECURITY_SCAN_HOLD=" + String(e?.message || e));
    process.exitCode = 1;
  }
}
