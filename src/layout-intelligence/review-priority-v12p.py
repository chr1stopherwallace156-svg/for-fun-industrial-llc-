#!/usr/bin/env python3
"""V12P: deterministic, bounded review priorities; never confidence or approval."""
import argparse,collections,hashlib,json,math,sys
from pathlib import Path
def sha(b):return hashlib.sha256(b).hexdigest()
def groupkey(x):return (x["sourceSha256"],x["page"],x["lineKey"])
def priority(group,associations):
 state=group["state"]
 if state=="UNRESOLVED_MIXED_REGION_OVERLAP":base=100;why=["MIXED_REGION_OVERLAP"]
 elif state=="COMPETING_DISJOINT_REGIONS":base=85;why=["DISJOINT_COMPETING_REGIONS"]
 elif state=="UNRESOLVED_MISSING_REGION_BBOX":base=80;why=["MISSING_REGION_GEOMETRY"]
 elif state=="UNRESOLVED_MISSING_GEOMETRY_RECORD":base=80;why=["MISSING_GEOMETRY_RECORD"]
 elif state=="UNRESOLVED_UNKNOWN_REGION":base=75;why=["UNKNOWN_REGION"]
 elif state=="UNRESOLVED_INSUFFICIENT_COMPARISONS":base=75;why=["INSUFFICIENT_COMPARISONS"]
 elif state=="POSSIBLE_DUPLICATE_REGION_ARTIFACT":base=60;why=["POSSIBLE_DUPLICATE_NOT_CONFIRMED"]
 elif state=="SAME_COMPARISON_RECORD_NOT_CONFLICT":base=10;why=["SAME_COMPARISON_RECORD"]
 else:raise ValueError("UNKNOWN_DISAMBIGUATION_STATE_HOLD")
 hints=sorted({h for a in associations for h in a.get("line",{}).get("hints",[]) if h in ("NUMBERED_CAPTION_PATTERN","FOOTNOTE_PATTERN","UNIT_TOKEN_PATTERN")})
 for hint in hints:
  base+={"NUMBERED_CAPTION_PATTERN":12,"FOOTNOTE_PATTERN":8,"UNIT_TOKEN_PATTERN":6}[hint]
  why.append(hint)
 distinct=group["distinctComparisonRecords"]
 if distinct>2:base+=min(12,2*(distinct-2));why.append("MULTIPLE_COMPETING_RECORDS")
 distances=[a.get("line",{}).get("verticalGap") for a in associations]
 distances=[d for d in distances if type(d) in (float,int) and math.isfinite(d) and d>=0]
 if distances and min(distances)<=12:base+=5;why.append("NEAR_TABLE_BOUNDARY")
 if not distances:why.append("NO_VALID_DISTANCE")
 # This is queue ordering, not a probability or statement of truth.
 return min(150,base),why,hints
def run(a):
 f=a.folder.resolve();op=f/"layout-disambiguation-v12o.json";sp=f/"layout-spatial-v12n.json"
 oraw=op.read_bytes();sraw=sp.read_bytes();o=json.loads(oraw);s=json.loads(sraw)
 if o.get("schema")!="fun.layout.disambiguation.v12o" or s.get("schema")!="fun.layout.spatial.v12n":raise ValueError("SCHEMA_HOLD")
 if o.get("spatialSha256")!=sha(sraw) or s.get("inputSha256")!=sha((f/"layout-text-position-v12m.json").read_bytes()):raise ValueError("PROVENANCE_HOLD")
 if o.get("relationsVerified") is not False or s.get("relationsVerified") is not False:raise ValueError("AUTHORITY_HOLD")
 if len(o.get("assessments",[]))>a.max_groups or len(s.get("lineAssociations",[]))>a.max_associations:raise ValueError("BUDGET_HOLD")
 index=collections.defaultdict(list)
 for entry in s["lineAssociations"]:index[groupkey(entry)].append(entry)
 queue=[];seen=set()
 for group in o["assessments"]:
  k=groupkey(group)
  if k in seen:raise ValueError("DUPLICATE_GROUP_HOLD")
  seen.add(k);matches=index.get(k,[])
  if len(matches)!=group["candidateAssociations"]:raise ValueError("ASSOCIATION_COUNT_HOLD")
  score,reasons,hints=priority(group,matches)
  example=sorted(matches,key=lambda x:(x.get("region",""),str(x.get("primaryTableId")),str(x.get("secondaryTableIndex"))))[0] if matches else None
  queue.append({"sourceSha256":k[0],"page":k[1],"lineKey":k[2],
   "state":group["state"],"reviewPriorityScore":score,"priorityReasons":reasons,
   "patternHints":hints,"candidateAssociations":len(matches),
   "distinctComparisonRecords":group["distinctComparisonRecords"],
   "exampleLineText":(example or {}).get("line",{}).get("text","")[:500],
   "exampleLineBBox":(example or {}).get("line",{}).get("bbox"),
   "sourceReference":{"sourceSha256":k[0],"page":k[1]},
   "meaningVerified":False,"relationshipVerified":False,"engineeringApproved":False})
 if len(seen)!=len(index):raise ValueError("UNACCOUNTED_ASSOCIATIONS_HOLD")
 queue.sort(key=lambda x:(-x["reviewPriorityScore"],x["sourceSha256"],x["page"],x["lineKey"]))
 counts=dict(sorted(collections.Counter(q["state"] for q in queue).items()))
 result={"schema":"fun.layout.review_priority.v12p","disambiguationSha256":sha(oraw),
  "spatialSha256":sha(sraw),"queueLength":len(queue),"stateCounts":counts,
  "priorityIsConfidence":False,"relationsVerified":False,"autoCorrected":False,
  "engineeringApproved":False,"reviewQueue":queue}
 dest=f/"layout-review-priority-v12p.json";payload=json.dumps(result,ensure_ascii=False,indent=2)+"\n"
 if dest.exists():
  if dest.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
  state="EXISTS"
 else:
  with dest.open("x",encoding="utf-8") as out:out.write(payload)
  state="CREATED"
 print(json.dumps({"state":"FUN_V12P_REVIEW_QUEUE_"+state,"queueLength":len(queue),
  "stateCounts":counts,"topPriorities":[{"page":q["page"],"score":q["reviewPriorityScore"],
   "state":q["state"],"reasons":q["priorityReasons"]} for q in queue[:5]],
  "priorityIsConfidence":False,"engineeringApproved":False,"output":str(dest)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",required=True,type=Path)
 p.add_argument("--max-groups",type=int,default=10000);p.add_argument("--max-associations",type=int,default=100000)
 a=p.parse_args()
 try:
  if min(a.max_groups,a.max_associations)<1:raise ValueError("INVALID_BUDGET")
  run(a)
 except Exception as e:print("FUN_V12P_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
