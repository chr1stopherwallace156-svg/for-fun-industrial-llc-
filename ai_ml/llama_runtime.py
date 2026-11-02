import subprocess
from pathlib import Path

class LlamaCppRuntime:
    """Explicit local llama.cpp adapter; no download, shell, or non-loopback bind."""
    def __init__(self): self.process=None; self.model_path=None
    def start(self,executable,model_path,port=8088):
        if self.process is not None and self.process.poll() is None: raise RuntimeError("already running")
        binary,model=Path(executable),Path(model_path)
        if not binary.is_file() or not model.is_file(): raise FileNotFoundError("local llama-server and GGUF model required")
        if not isinstance(port,int) or not 1024<=port<=65535: raise ValueError("invalid port")
        self.process=subprocess.Popen([str(binary),"--model",str(model),"--host","127.0.0.1","--port",str(port)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,shell=False)
        self.model_path=str(model.resolve()); return {"state":"process-started","pid":self.process.pid,"host":"127.0.0.1","port":port,"readiness":"pending"}
    def status(self):
        if self.process is None:return {"state":"not-started"}
        code=self.process.poll(); return {"state":"running" if code is None else "exited","pid":self.process.pid,"exit_code":code,"model_path":self.model_path}
    def stop(self):
        if self.process is None or self.process.poll() is not None:return {"state":"not-running"}
        self.process.terminate()
        try:self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:self.process.kill(); self.process.wait(timeout=5)
        return {"state":"stopped"}
