#!/usr/bin/env python3
"""Read-only bridge from V2 registered bench artifacts to V1 engineering contracts."""
import argparse,hashlib,json,sys
from pathlib import Path
def sha(b):return hashlib.sha256(b).hexdigest()
def run(root,source):
 root=root.resolve(strict=True)
 if root.name.lower()!="funindustrial" or root.is_symlink():raise ValueError("ROOT_SCOPE_HOLD")
 if source.is_symlink() or source.resolve()!=root/"ev-artifact-registry-v2.json":raise ValueError("REGISTRY_SCOPE_HOLD")
 raw=source.read_bytes();registry=json.loads(raw)
 manifest_path=Path(__file__).with_name("integration-manifest-v1.json")
 mraw=manifest_path.read_bytes();m=json.loads(mraw)
 if registry.get("schema")!="fun.ev.artifact_registry.v2" or registry.get("manifestSha256")!=sha(mraw):raise ValueError("REGISTRY_MANIFEST_HOLD")
 if registry.get("registeredCount")!=9 or len(registry.get("registeredArtifacts",[]))!=9:raise ValueError("REGISTRY_COUNT_HOLD")
 if registry.get("registeredContracts")!=["mechanical_cad","harness_documentation"]:raise ValueError("REGISTRY_CONTRACT_HOLD")
 if registry.get("engineeringReleased") is not False or registry.get("manufacturingAuthorized") is not False or registry.get("nativeRuntimeRechecked") is not False:raise ValueError("AUTHORITY_HOLD")
 from importlib.util import spec_from_file_location,module_from_spec
 spec=spec_from_file_location("registry_v2",str(Path(__file__).with_name("register-existing-v2.py")));mod=module_from_spec(spec);spec.loader.exec_module(mod)
 actual=mod.validate(root,m)
 if actual!=registry["registeredArtifacts"]:raise ValueError("REGISTRY_PROVENANCE_HOLD")
 contracts=[]
 for c in m["contracts"]:
  observed=[x["relativePath"] for x in actual if x["contract"]==c["id"]]
  contracts.append({"id":c["id"],"benchArtifactCount":len(observed),"benchArtifacts":observed,
   "state":"BENCH_ARTIFACT_REUSED_ENGINEERING_HOLD" if observed else "MISSING_QUALIFIED_ADAPTER_AND_EVIDENCE",
   "vehicleSpecificQualified":False,"runtimeConnected":False,"engineeringApproved":False})
 result={"schema":"fun.ev.adapter_readiness.v3","registrySha256":sha(raw),"manifestSha256":sha(mraw),
  "registeredArtifactCount":9,"benchCoveredContracts":2,"qualifiedVehicleContracts":0,
  "contracts":contracts,"engineeringReleased":False,"manufacturingAuthorized":False,"externalActionsExecuted":False}
 print(json.dumps(result,indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--root",required=True,type=Path);a=p.parse_args()
 try:run(a.root,a.root/"ev-artifact-registry-v2.json")
 except Exception as e:print("FUN_EV_ADAPTER_V3_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
