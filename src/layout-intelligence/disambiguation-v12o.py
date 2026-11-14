#!/usr/bin/env python3
"""V12O: explain candidate-line conflicts using actual table-region geometry."""
import argparse,collections,hashlib,json,math,sys
from pathlib import Path
def sha(data):return hashlib.sha256(data).hexdigest()
def valid(b):
 return isinstance(b,list) and len(b)==4 and all(type(x) in (int,float) and math.isfinite(x) for x in b) and b[2]>b[0] and b[3]>b[1]
def iou(a,b):
 if not valid(a) or not valid(b):return None
 w=max(0,min(a[2],b[2])-max(a[0],b[0]));h=max(0,min(a[3],b[3])-max(a[1],b[1]))
 inter=w*h;union=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-inter
 return inter/union if union>0 else None
def identity(x):return (x["sourceSha256"],x["page"],str(x.get("primaryTableId")),str(x.get("secondaryTableIndex")))
def classify(entries,lookup,threshold):
 ids={identity(e) for e in entries}
 if len(ids)<=1:return "SAME_COMPARISON_RECORD_NOT_CONFLICT",None
 boxes=[]
 for e in entries:
  k=identity(e);g=lookup.get(k)
  if g is None:return "UNRESOLVED_MISSING_GEOMETRY_RECORD",None
  side=e["region"]
  if side not in ("primaryContext","secondaryContext"):return "UNRESOLVED_UNKNOWN_REGION",None
  b=g.get("primaryBBox" if side=="primaryContext" else "secondaryBBox")
  if not valid(b):return "UNRESOLVED_MISSING_REGION_BBOX",None
  boxes.append(b)
 values=[iou(boxes[i],boxes[j]) for i in range(len(boxes)) for j in range(i+1,len(boxes)) if identity(entries[i])!=identity(entries[j])]
 if not values or any(v is None for v in values):return "UNRESOLVED_INSUFFICIENT_COMPARISONS",None
 low=min(values)
 if low>=threshold:return "POSSIBLE_DUPLICATE_REGION_ARTIFACT",round(low,6)
 if max(values)==0:return "COMPETING_DISJOINT_REGIONS",round(low,6)
 return "UNRESOLVED_MIXED_REGION_OVERLAP",round(low,6)
def assess(spatial,geometry,threshold):
 lookup={}
 for g in geometry["items"]:
  k=identity(g)
  if k in lookup:raise ValueError("DUPLICATE_GEOMETRY_KEY_HOLD")
  lookup[k]=g
 groups=collections.defaultdict(list)
 for entry in spatial["lineAssociations"]:
  if not isinstance(entry.get("lineKey"),str):raise ValueError("LINE_KEY_HOLD")
  if identity(entry) not in lookup:raise ValueError("MISSING_GEOMETRY_KEY_HOLD")
  groups[(entry["sourceSha256"],entry["page"],entry["lineKey"])].append(entry)
 report=[];totals=collections.Counter();association_totals=collections.Counter()
 for (sid,page,linekey),entries in sorted(groups.items()):
  state,minimum=classify(entries,lookup,threshold)
  totals[state]+=1;association_totals[state]+=len(entries)
  report.append({"sourceSha256":sid,"page":page,"lineKey":linekey,"state":state,
   "candidateAssociations":len(entries),"distinctComparisonRecords":len({identity(e) for e in entries}),
   "minimumCrossRecordBBoxIoU":minimum,"associationVerified":False,"engineeringApproved":False})
 return report,dict(sorted(totals.items())),dict(sorted(association_totals.items()))
def run(a):
 folder=a.folder.resolve();sp=folder/"layout-spatial-v12n.json";gp=folder/"layout-geometry-v12l.json"
 sr=sp.read_bytes();gr=gp.read_bytes();s=json.loads(sr);g=json.loads(gr)
 if s.get("schema")!="fun.layout.spatial.v12n" or g.get("schema")!="fun.layout.geometry.v12l":raise ValueError("SCHEMA_HOLD")
 if s.get("relationsVerified") is not False or g.get("relationsVerified") is not False:raise ValueError("AUTHORITY_HOLD")
 if s.get("inputSha256")!=sha((folder/"layout-text-position-v12m.json").read_bytes()):raise ValueError("SPATIAL_HASH_HOLD")
 if g.get("reconciliationSha256")!=sha((folder/"layout-reconciliation-v12i.json").read_bytes()):raise ValueError("GEOMETRY_HASH_HOLD")
 if len(s.get("lineAssociations",[]))>a.max_associations:raise ValueError("ASSOCIATION_BUDGET_HOLD")
 report,counts,associations=assess(s,g,a.duplicate_threshold)
 result={"schema":"fun.layout.disambiguation.v12o","spatialSha256":sha(sr),"geometrySha256":sha(gr),
  "threshold":a.duplicate_threshold,"uniqueCandidateLines":len(report),
  "states":counts,"associationStates":associations,"assessments":report,
  "duplicateRegionsConfirmed":False,"relationsVerified":False,"autoCorrected":False,
  "meaningVerified":False,"engineeringApproved":False}
 dest=folder/"layout-disambiguation-v12o.json";payload=json.dumps(result,indent=2,ensure_ascii=False)+"\n"
 if dest.exists():
  if dest.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
  state="EXISTS"
 else:
  with dest.open("x",encoding="utf-8") as f:f.write(payload)
  state="CREATED"
 print(json.dumps({"state":"FUN_V12O_DISAMBIGUATION_"+state,"uniqueCandidateLines":len(report),
 "states":counts,"associationStates":associations,"duplicateRegionsConfirmed":False,
 "relationsVerified":False,"engineeringApproved":False,"output":str(dest)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",type=Path,required=True)
 p.add_argument("--duplicate-threshold",type=float,default=0.85);p.add_argument("--max-associations",type=int,default=100000)
 a=p.parse_args()
 try:
  if not math.isfinite(a.duplicate_threshold) or not 0.5<=a.duplicate_threshold<=1 or a.max_associations<1:raise ValueError("ARGUMENT_HOLD")
  run(a)
 except Exception as e:print("FUN_V12O_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
