#!/usr/bin/env python3
"""Read-only, source-hashed F-450 baseline; never infer engineering specifications."""
import argparse,hashlib,json,sys
from pathlib import Path
def digest(data):return hashlib.sha256(data).hexdigest()
FIELDS={"vehicle_database":["vehicle_id","model_year","chassis_configuration","oem_document_sha256","gvwr","front_gawr","rear_gawr"],
"mechanical_cad":["geometry_source_sha256","mounting_constraints"],
"electrical_schematics":["schematic_sha256","netlist_sha256","voltage_domain"],
"harness_documentation":["harness_sha256","connector_pinout_sha256"],
"powertrain_simulation":["duty_cycle_sha256","model_sha256","component_data_sha256","result_sha256"],
"parts_procurement_inventory":["bom_sha256","supplier_quotes_sha256","compatibility_review_sha256"],
"safety_verification":["hazard_analysis_sha256","test_plan_sha256","independent_review_sha256"],
"manufacturing_operations":["work_order_sha256","qc_plan_sha256","traceability_sha256"]}
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",required=True,type=Path);p.add_argument("--registry",required=True,type=Path);p.add_argument("--max-bytes",type=int,default=20_000_000);a=p.parse_args()
 try:
  folder=a.folder.resolve(strict=True);root=Path(a.registry).resolve(strict=True).parent
  if folder.name!="F450-2021-REFERENCE" or folder.parent.name!="ExtractedPagesV12A" or root.name.lower()!="funindustrial":raise ValueError("SCOPE_HOLD")
  files={}
  for name in ["ev-conversion-evidence-gate-v1.json","layout-text-integrity-v12r.json","layout-review-priority-v12p.json"]:
   f=folder/name
   if f.is_symlink() or f.stat().st_size>a.max_bytes:raise ValueError("SOURCE_FILE_HOLD:"+name)
   raw=f.read_bytes();files[name]={"sha256":digest(raw),"bytes":len(raw),"parsed":json.loads(raw)}
  gate=files["ev-conversion-evidence-gate-v1.json"]["parsed"]
  integrity=files["layout-text-integrity-v12r.json"]["parsed"]
  if gate.get("schema")!="fun.ev_conversion.evidence_gate.v1" or gate.get("designReleased") is not False or gate.get("engineeringReadiness")!="HOLD_MISSING_VERIFIED_INPUTS":raise ValueError("GATE_AUTHORITY_HOLD")
  if gate.get("sourceIntegritySha256")!=files["layout-text-integrity-v12r.json"]["sha256"]:raise ValueError("GATE_PROVENANCE_HOLD")
  if integrity.get("schema")!="fun.layout.text_integrity.v12r" or integrity.get("engineeringApproved") is not False or integrity.get("reviewQueueSha256")!=files["layout-review-priority-v12p.json"]["sha256"]:raise ValueError("INTEGRITY_PROVENANCE_HOLD")
  registry=json.loads(a.registry.read_bytes())
  if registry.get("schema")!="fun.ev.artifact_registry.v2" or registry.get("registeredCount")!=9 or registry.get("engineeringReleased") is not False:raise ValueError("REGISTRY_HOLD")
  mpath=Path(__file__).with_name("integration-manifest-v1.json");mraw=mpath.read_bytes();manifest=json.loads(mraw)
  if registry.get("manifestSha256")!=digest(mraw):raise ValueError("CONTRACT_MANIFEST_HOLD")
  # Validate all artifact hashes using the existing V2 verifier, rather than trusting a registry claim.
  from importlib.util import spec_from_file_location,module_from_spec
  spec=spec_from_file_location("ev_registry",str(Path(__file__).with_name("register-existing-v2.py")));mod=module_from_spec(spec);spec.loader.exec_module(mod)
  if mod.validate(root,manifest)!=registry.get("registeredArtifacts"):raise ValueError("ARTIFACT_PROVENANCE_HOLD")
  contracts=[]
  for c in manifest["contracts"]:
   name=c["id"]
   if name not in FIELDS:raise ValueError("UNKNOWN_CONTRACT_HOLD")
   contracts.append({"id":name,"requiredFields":[{"field":f,"state":"MISSING_VEHICLE_VERIFIED_EVIDENCE","value":None} for f in c["required"]],
    "benchArtifactsAvailable":sum(x["contract"]==name for x in registry["registeredArtifacts"]),
    "vehicleQualified":False,"adapterConnected":False})
  result={"schema":"fun.ev.f450_vehicle_baseline.v4","scope":"2021 Ford F-450 document collection; exact chassis/VIN configuration unverified",
   "sourceEvidence":[{"file":k,"sha256":v["sha256"]} for k,v in files.items()],
   "registrySha256":digest(a.registry.read_bytes()),"manifestSha256":digest(mraw),
   "recordCount":gate.get("sourceRecordCount"),"engineeringDomains":gate.get("engineeringRequirements"),
   "contracts":contracts,"vehicleSpecificSpecificationsAccepted":0,
   "designReleased":False,"procurementAuthorized":False,"manufacturingAuthorized":False,
   "externalActionsExecuted":False,"state":"SOURCE_LINKED_BASELINE_ENGINEERING_HOLD"}
  print(json.dumps(result,indent=2))
 except Exception as e:print("FUN_F450_BASELINE_V4_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
