import { spawn } from "node:child_process";
export function runCommand(command, args, {timeoutMs = 5000} = {}) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };
    let child;
    try { child = spawn(command, args, {shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"]}); }
    catch (e) { finish({ok:false, error:e.message}); return; }
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", x => { stdout = (stdout + x).slice(-8192); });
    child.stderr.setEncoding("utf8").on("data", x => { stderr = (stderr + x).slice(-8192); });
    const timer = setTimeout(() => { child.kill(); finish({ok:false,error:"command timed out"}); }, timeoutMs);
    child.on("error", e => { clearTimeout(timer); finish({ok:false,error:e.message}); });
    child.on("close", code => { clearTimeout(timer); finish({ok:code === 0,code,stdout:stdout.trim(),stderr:stderr.trim()}); });
  });
}
