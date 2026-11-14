#!/usr/bin/env python3
"""Fun Industrial -> Elektron: read-only EV conversion evidence readiness dossier."""
import argparse,collections,hashlib,json,sys
from pathlib import Path
def digest(b):return hashlib.sha256(b).hexdigest()
DOMAINS={
 "vehicle_identity":["model_year","vin_or_configuration","gvwr","axle_ratings"],
 "duty_cycle":["route_distance","payload","grade","ambient_temperature"],
 "battery":["usable_energy","pack_mass","pack_envelope","voltage","thermal_limits"],
 "drive_system":["motor_torque","continuous_power","gear_ratio","mounting"],
 "safety":["hv_isolation","fusing","disconnect","braking","crash_protection"],
 "regulatory":["vehicle_classification","applicable_requirements","inspection_plan"],
 "manufacturing":["bom_quotes","work_instructions","quality_checkpoints","validation_plan"]
}
def run(a):
 folder=a.folder.resolve();p=folder/"layout-text-integrity-v12r.json";raw=p.read_bytes();d=json.loads(raw)
 if d.get("schema")!="fun.layout.text_integrity.v12r" or d.get("engineeringApproved") is not False or d.get("relationsVerified") is not False:raise ValueError("INTEGRITY_SCHEMA_HOLD")
 if d.get("reviewQueueSha256")!=digest((folder/"layout-review-priority-v12p.json").read_bytes()):raise ValueError("INTEGRITY_PROVENANCE_HOLD")
 items=d.get("items")
 if not isinstance(items,list) or len(items)!=d.get("records") or len(items)>a.max_records:raise ValueError("RECORD_BUDGET_HOLD")
 states=collections.Counter();seen=set();examples=[]
 for x in items:
  k=(x["sourceSha256"],x["page"],x["lineKey"])
  if k in seen:raise ValueError("DUPLICATE_EVIDENCE_HOLD")
  seen.add(k);s=x["textIntegrityState"]
  if s not in ("READABLE_REVIEW_CANDIDATE","TEXT_RECOVERY_REQUIRED","LOW_INFORMATION_REVIEW"):raise ValueError("UNKNOWN_TEXT_STATE_HOLD")
  states[s]+=1
  if s=="READABLE_REVIEW_CANDIDATE" and len(examples)<a.preview:
   examples.append({"sourceSha256":k[0],"page":k[1],"lineKey":k[2],"excerpt":x["sourceText"][:160],
    "textIntegrityOnly":True,"engineeringVerified":False})
 # No extracted line is assigned to a requirement or promoted to engineering evidence.
 requirements=[{"domain":domain,"requiredFields":[{"field":field,"state":"MISSING_VERIFIED_EVIDENCE"} for field in fields],
  "domainReady":False} for domain,fields in DOMAINS.items()]
 result={"schema":"fun.ev_conversion.evidence_gate.v1","purpose":"PRELIMINARY_F450_CONVERSION_ENGINEERING_DOSSIER",
  "platformScope":"2021 Ford F-450 source collection; exact vehicle configuration unverified",
  "sourceIntegritySha256":digest(raw),"sourceRecordCount":len(items),
  "sourceStates":dict(sorted(states.items())),"reviewableTextExamples":examples,
  "engineeringRequirements":requirements,
  "engineeringReadiness":"HOLD_MISSING_VERIFIED_INPUTS",
  "designReleased":False,"componentCompatibilityVerified":False,"safetyValidated":False,
  "regulatoryEligibilityVerified":False,"manufacturingAuthorized":False,
  "sourceTextDoesNotEstablishEngineeringAuthority":True}
 out=folder/"ev-conversion-evidence-gate-v1.json";payload=json.dumps(result,indent=2,ensure_ascii=False)+"\n"
 if out.exists():
  if out.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
  state="EXISTS"
 else:
  with out.open("x",encoding="utf-8") as f:f.write(payload)
  state="CREATED"
 print(json.dumps({"state":"FUN_EV_CONVERSION_EVIDENCE_GATE_"+state,
  "sourceRecordCount":len(items),"sourceStates":result["sourceStates"],
  "engineeringDomains":len(requirements),"engineeringReadiness":result["engineeringReadiness"],
  "designReleased":False,"output":str(out)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",required=True,type=Path)
 p.add_argument("--max-records",type=int,default=10000);p.add_argument("--preview",type=int,default=5);a=p.parse_args()
 try:
  if a.max_records<1 or not 0<=a.preview<=20:raise ValueError("BUDGET_HOLD")
  run(a)
 except Exception as e:print("FUN_EV_GATE_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
