#!/usr/bin/env python3
"""Register existing Fun Industrial bench CAD/wiring artifacts; no tool execution."""
import argparse,hashlib,json,sys
from pathlib import Path
ARTIFACTS=[
 ("mechanical_cad","EVEngineering/FreeCADNativeV8/run-3ace22ff66f649b68b95b87b1e8678aa/bench.FCStd","051f171a180f96eba1c2e42201cdeff8443fbedf413f900b23cb3f64e0334183"),
 ("mechanical_cad","EVEngineering/FreeCADNativeV8/run-3ace22ff66f649b68b95b87b1e8678aa/bench.step","50c2e11464f43fdf4abed15e0a6b92ba1fb4da2af3500e9a3c1483fba1a1f98f"),
 ("harness_documentation","EVEngineering/Prototypes/bench-4d5012c1/native-wireviz-v3/bench-harness.svg","fbb8bbff9cbfca2f5c19fc04c965623caa35af728802d3627aa8a77b9479afca"),
 ("harness_documentation","EVEngineering/Prototypes/bench-4d5012c1/native-wireviz-v3/bench-harness.bom.tsv","cb23ceea14fc9288a56a512ac9fa64e9f1f42101425989c139461bf4c28f96f4"),
 ("harness_documentation","EVEngineering/Prototypes/bench-4d5012c1/output/bench-harness.yml","3b93fb11332ba936ba9b6894682c11498778f0bd72e08755624e875f500e42cf"),
 ("harness_documentation","EVEngineering/Prototypes/bench-4d5012c1/output/bench-pinout.csv","0061d0685f43a9ca86f7a60dff42cab7d58b3f731e211897595e836e7ecffea3"),
 ("mechanical_cad","EVEngineering/Prototypes/bench-4d5012c1/output/bench-plate.FCMacro","1d746b11811068f5b796bce18a21fb8f7d7e3c99d9ce6d727f99933f0f11b7ab"),
 ("harness_documentation","EVEngineering/Prototypes/bench-4d5012c1/native-wireviz-v3/native-manifest.json","30df90013be4d53b15146fc0b27b28878b54cac2aff45d438c864c12777600ca"),
 ("mechanical_cad","EVEngineering/Prototypes/bench-4d5012c1/output/manifest.json","9977163abb171192e764f150a66de00a87847bc03cfc3cac22e4d775df214acc")
]
def digest(path):
 h=hashlib.sha256()
 with path.open("rb") as f:
  for b in iter(lambda:f.read(1024*1024),b""):h.update(b)
 return h.hexdigest()
def validate(root,manifest):
 if root.name.lower()!="funindustrial" or root.is_symlink():raise ValueError("ROOT_SCOPE_HOLD")
 if manifest.get("schema")!="fun.ev.integrations.v1":raise ValueError("MANIFEST_SCHEMA_HOLD")
 contracts={c["id"] for c in manifest["contracts"]}
 if not {"mechanical_cad","harness_documentation"}.issubset(contracts):raise ValueError("CONTRACT_HOLD")
 records=[]
 for capability,relative,expected in ARTIFACTS:
  p=root.joinpath(*relative.split("/"))
  if p.is_symlink() or not p.is_file() or not p.resolve().is_relative_to(root):raise ValueError("MISSING_OR_LINKED_ARTIFACT_HOLD:"+relative)
  if p.stat().st_size>20*1024*1024:raise ValueError("ARTIFACT_SIZE_HOLD:"+relative)
  actual=digest(p)
  if actual!=expected:raise ValueError("ARTIFACT_HASH_MISMATCH_HOLD:"+relative)
  records.append({"contract":capability,"relativePath":relative,"sha256":actual,"bytes":p.stat().st_size,"provenance":"OWNER_OBSERVED_SHA256_MATCH","qualification":"BENCH_ARTIFACT_ONLY"})
 return records
def main():
 a=argparse.ArgumentParser();a.add_argument("--root",required=True,type=Path);a.add_argument("--out",type=Path);args=a.parse_args()
 try:
  root=args.root.resolve(strict=True)
  mpath=Path(__file__).with_name("integration-manifest-v1.json")
  raw=mpath.read_bytes();m=json.loads(raw)
  records=validate(root,m)
  report={"schema":"fun.ev.artifact_registry.v2","manifestSha256":hashlib.sha256(raw).hexdigest(),
  "registeredArtifacts":records,"registeredCount":len(records),"registeredContracts":["mechanical_cad","harness_documentation"],
  "electricalSchematicVerified":False,"vehicleSpecificDesignVerified":False,"nativeRuntimeRechecked":False,
  "engineeringReleased":False,"manufacturingAuthorized":False,"externalActionsExecuted":False}
  if args.out:
   out=args.out.absolute()
   if out.is_symlink() or out.parent.resolve()!=root:raise ValueError("OUTPUT_SCOPE_HOLD")
   payload=json.dumps(report,indent=2)+"\n"
   if out.exists():
    if out.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
    state="EXISTS"
   else:
    with out.open("x",encoding="utf-8") as f:f.write(payload)
    state="CREATED"
  else:state="OBSERVED"
  print(json.dumps({"state":"FUN_EV_ARTIFACT_REGISTRY_"+state,"registeredCount":len(records),
   "registeredContracts":report["registeredContracts"],"engineeringReleased":False,
   "registry":str(args.out) if args.out else None},indent=2))
 except Exception as e:print("FUN_EV_ARTIFACT_REGISTRY_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
