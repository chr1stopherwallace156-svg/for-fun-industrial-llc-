#!/usr/bin/env python3
"""V12L: conservative table-region geometry assessment; never validates text scope."""
import argparse,hashlib,json,math,sys
from pathlib import Path
from collections import Counter
def sha(b):return hashlib.sha256(b).hexdigest()
def box(v):
 if not isinstance(v,(list,tuple)) or len(v)!=4:return None
 if any(type(x) not in (int,float) or not math.isfinite(x) for x in v):return None
 x0,y0,x1,y1=v
 if x1<=x0 or y1<=y0:return None
 return [float(x) for x in v]
def iou(a,b):
 if a is None or b is None:return None
 x=max(0,min(a[2],b[2])-max(a[0],b[0]))
 y=max(0,min(a[3],b[3])-max(a[1],b[1]))
 inter=x*y
 area=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-inter
 return round(inter/area,6) if area else 0
def assess(item):
 a=box(item.get("primaryEvidence",{}).get("bbox"))
 b=box(item.get("secondaryEvidence",{}).get("bbox"))
 overlap=iou(a,b)
 if a is None and b is None:state="BOTH_BBOX_UNAVAILABLE"
 elif a is None or b is None:state="ONE_BBOX_UNAVAILABLE"
 elif overlap>=0.85:state="HIGH_REGION_OVERLAP"
 elif overlap>=0.5:state="PARTIAL_REGION_OVERLAP"
 elif overlap>0:state="LOW_REGION_OVERLAP"
 else:state="DISJOINT_REGIONS"
 return {"sourceSha256":item["sourceSha256"],"page":item["page"],"primaryTableId":item.get("primaryTableId"),
 "secondaryTableIndex":item.get("secondaryTableIndex"),"classification":item["classification"],
 "primaryBBox":a,"secondaryBBox":b,"bboxIoU":overlap,"geometryAssessment":state,
 "captionScopeVerified":False,"unitBindingVerified":False,"relationshipVerified":False,
 "reviewStatus":"NEEDS_HUMAN_REVIEW"}
def run(a):
 f=a.folder.resolve()
 rp=f/"layout-reconciliation-v12i.json";gp=f/"layout-evidence-graph-v12k.json";cp=f/"layout-context-v12j.json"
 raw=rp.read_bytes();rec=json.loads(raw);graph=json.loads(gp.read_bytes())
 if rec.get("schema")!="fun.layout.reconciliation.v12i" or rec.get("autoCorrected") is not False:raise ValueError("RECONCILIATION_SCHEMA_HOLD")
 if graph.get("schema")!="fun.layout.evidence_graph.v12k" or graph.get("relationsVerified") is not False:raise ValueError("GRAPH_SCHEMA_HOLD")
 if graph.get("contextSha256")!=sha(cp.read_bytes()):raise ValueError("GRAPH_CONTEXT_HASH_HOLD")
 if len(rec.get("items",[]))>a.max_records:raise ValueError("RECORD_BUDGET_HOLD")
 # Validate source evidence chain; graph must correspond to the same reconciliation file.
 context=json.loads(cp.read_bytes())
 if context.get("reconciliationSha256")!=sha(raw):raise ValueError("RECONCILIATION_HASH_HOLD")
 if graph.get("nodeCount")!=len(graph.get("nodes",[])) or graph.get("edgeCount")!=len(graph.get("edges",[])):raise ValueError("GRAPH_COUNT_HOLD")
 items=[assess(i) for i in rec["items"]]
 counts=Counter(i["geometryAssessment"] for i in items)
 output={"schema":"fun.layout.geometry.v12l","reconciliationSha256":sha(raw),"graphSha256":sha(gp.read_bytes()),
 "records":len(items),"assessments":dict(counts),"captionScopeVerified":False,"unitBindingVerified":False,
 "relationsVerified":False,"autoCorrected":False,"meaningVerified":False,"engineeringApproved":False,"items":items}
 dest=f/"layout-geometry-v12l.json";payload=json.dumps(output,indent=2,ensure_ascii=False)+"\n"
 if dest.exists():
  if dest.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
  state="EXISTS"
 else:
  with dest.open("x",encoding="utf-8") as w:w.write(payload)
  state="CREATED"
 print(json.dumps({"state":"FUN_V12L_GEOMETRY_"+state,"records":len(items),"assessments":dict(counts),
 "relationsVerified":False,"engineeringApproved":False,"output":str(dest)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",required=True,type=Path);p.add_argument("--max-records",type=int,default=5000)
 a=p.parse_args()
 try:
  if not 1<=a.max_records<=100000:raise ValueError("INVALID_BUDGET")
  run(a)
 except Exception as e:print("FUN_V12L_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
