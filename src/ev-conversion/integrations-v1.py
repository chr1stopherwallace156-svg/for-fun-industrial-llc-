import argparse,json,hashlib,sys
from pathlib import Path
def sha(b):return hashlib.sha256(b).hexdigest()
def check(m):
 if m.get("schema")!="fun.ev.integrations.v1":raise ValueError("SCHEMA_HOLD")
 if {g["id"] for g in m["groups"]}!={"cad_wiring","ev_capabilities"}:raise ValueError("GROUP_HOLD")
 ids=[c["id"] for c in m["contracts"]]
 if len(ids)!=8 or len(set(ids))!=8:raise ValueError("CONTRACT_HOLD")
 seen=set()
 def visit(x,stack):
  if x in stack:raise ValueError("DEPENDENCY_CYCLE_HOLD")
  if x in seen:return
  c=next(y for y in m["contracts"] if y["id"]==x)
  if not c["required"]:raise ValueError("REQUIRED_FIELDS_HOLD")
  for d in c["dependsOn"]:
   if d not in ids:raise ValueError("UNKNOWN_DEPENDENCY_HOLD")
   visit(d,stack|{x})
  seen.add(x)
 for x in ids:visit(x,set())
 if m["authority"]!={"externalExecution":"OPERATOR_APPROVAL_REQUIRED","engineeringRelease":False,"procurementAuthorized":False,"manufacturingAuthorized":False,"readOnly":True}:raise ValueError("AUTHORITY_HOLD")
 return ids
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",required=True,type=Path);a=p.parse_args()
 try:
  folder=a.folder.resolve();base=Path(__file__).resolve().parent
  raw=(base/"integration-manifest-v1.json").read_bytes();m=json.loads(raw);ids=check(m)
  eraw=(folder/"ev-conversion-evidence-gate-v1.json").read_bytes();e=json.loads(eraw)
  if e.get("schema")!="fun.ev_conversion.evidence_gate.v1" or e.get("designReleased") is not False:raise ValueError("ENGINEERING_EVIDENCE_HOLD")
  if e.get("sourceIntegritySha256")!=sha((folder/"layout-text-integrity-v12r.json").read_bytes()):raise ValueError("EVIDENCE_PROVENANCE_HOLD")
  report={"schema":"fun.ev.integration_readiness.v1","manifestSha256":sha(raw),"evidenceGateSha256":sha(eraw),"groups":2,"capabilities":len(ids),"connectedAdapters":0,"contracts":[{"capability":c["id"],"requiredEvidenceFields":c["required"],"dependsOn":c["dependsOn"],"state":"BLOCKED_UNTIL_VERIFIED_INPUTS_AND_ADAPTER","engineeringApproved":False} for c in m["contracts"]],"engineeringReleased":False,"manufacturingAuthorized":False}
  out=folder/"ev-integration-readiness-v1.json";payload=json.dumps(report,indent=2)+"\n"
  if out.exists():
   if out.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
   state="EXISTS"
  else:
   with out.open("x",encoding="utf-8") as f:f.write(payload)
   state="CREATED"
  print(json.dumps({"state":"FUN_EV_INTEGRATIONS_"+state,"groups":2,"capabilities":len(ids),"connectedAdapters":0,"engineeringReleased":False,"output":str(out)},indent=2))
 except Exception as ex:print("FUN_EV_INTEGRATIONS_HOLD="+str(ex),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
