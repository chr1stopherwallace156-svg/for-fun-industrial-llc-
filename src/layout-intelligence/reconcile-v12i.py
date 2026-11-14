#!/usr/bin/env python3
"""V12I: offline evidence reconciliation from V12H cache; never changes source tables."""
import argparse, collections, hashlib, json, re, sys
from pathlib import Path

def sha(b):return hashlib.sha256(b).hexdigest()
def normalize(x):return re.sub(r"\s+"," ",str(x or "")).strip().casefold()
def shape(rows):return [[normalize(c) for c in row] for row in rows]
def compare_rows(a,b):
 a=shape(a);b=shape(b)
 identical=a==b
 left=collections.Counter(x for row in a for x in row if x)
 right=collections.Counter(x for row in b for x in row if x)
 same_text=left==right
 common=sum((left&right).values());union=sum((left|right).values())
 return {"identicalGrid":identical,"sameCellTextMultiset":same_text,
  "primaryShape":[len(r) for r in a],"secondaryShape":[len(r) for r in b],
  "cellSimilarity":round(common/union,4) if union else 1.0,
  "primaryOnly":list((left-right).elements())[:12],
  "secondaryOnly":list((right-left).elements())[:12]}
def decision(c):
 if c["identicalGrid"]:return "GRID_TEXT_IDENTICAL"
 if c["sameCellTextMultiset"]:return "SAME_TEXT_DIFFERENT_STRUCTURE"
 if c["cellSimilarity"]>=0.85:return "HIGH_TEXT_OVERLAP_REVIEW"
 return "MATERIAL_TEXT_DIFFERENCE"
def run(args):
 folder=args.folder.resolve()
 primary_path=folder/"engineering-tables-v12c.json"
 report_path=folder/"layout-crossengine-v12h.json"
 audit_path=folder/"layout-audit-v12g.json"
 primary=json.loads(primary_path.read_bytes());report=json.loads(report_path.read_bytes())
 if report.get("schema")!="fun.layout.crossengine.v12h":raise ValueError("V12H_SCHEMA_HOLD")
 if sha(primary_path.read_bytes())!=report.get("primarySha256"):raise ValueError("PRIMARY_HASH_HOLD")
 if sha(audit_path.read_bytes())!=report.get("auditSha256"):raise ValueError("AUDIT_HASH_HOLD")
 if report.get("engine")!="pdfplumber" or not re.fullmatch(r"[A-Za-z0-9._-]{1,50}",report.get("engineVersion","")):raise ValueError("ENGINE_HOLD")
 byid={t["id"]:t for t in primary["tables"]}
 if len(byid)!=len(primary["tables"]):raise ValueError("DUPLICATE_PRIMARY_ID")
 bypage=collections.defaultdict(list)
 for t in primary["tables"]:bypage[(t["sourceSha256"],t["page"])].append(t)
 if len(report["pages"])>args.max_pages:raise ValueError("PAGE_BUDGET_HOLD")
 results=[];counts=collections.Counter();cache_dir=folder/"V12H-PageCache"
 for page in report["pages"]:
  sid=page["sourceSha256"];number=page["page"]
  if not re.fullmatch("[0-9a-f]{64}",sid) or type(number)!=int or number<1:raise ValueError("PAGE_ID_HOLD")
  key=sha(("v12h-pdfplumber-"+report["engineVersion"]+":"+sid+":"+str(number)).encode())
  cache_path=cache_dir/(key+".json")
  cache=json.loads(cache_path.read_bytes())
  if cache.get("key")!=key or not isinstance(cache.get("tables"),list):raise ValueError("CACHE_KEY_HOLD")
  secondary=cache["tables"];original=bypage[(sid,number)]
  if page["primaryTables"]!=len(original) or page["secondaryTables"]!=len(secondary):raise ValueError("PAGE_COUNT_HOLD")
  for c in page["comparison"]:
   state=c["state"];item={"sourceSha256":sid,"page":number,"v12hState":state,
     "primaryTableId":c.get("primaryTableId"),"secondaryTableIndex":c.get("secondaryTableIndex"),
     "reviewStatus":"NEEDS_HUMAN_REVIEW","autoApplied":False,"meaningVerified":False}
   if state in ("CELL_TEXT_AGREEMENT","CELL_TEXT_DISAGREEMENT"):
    t=byid.get(c.get("primaryTableId"));j=c.get("secondaryTableIndex")
    if t is None or t not in original or type(j)!=int or j<0 or j>=len(secondary):raise ValueError("MATCH_PROVENANCE_HOLD")
    if "bboxIoU" not in c:raise ValueError("GEOMETRY_EVIDENCE_HOLD")
    alignment=compare_rows(t["rows"],secondary[j]["rows"])
    item.update({"classification":decision(alignment),"alignment":alignment,"bboxIoU":c["bboxIoU"],
      "proposedAction":"REVIEW_GRID_AND_CONTEXT" if not alignment["identicalGrid"] else "NO_CHANGE_PROPOSED",
      "primaryEvidence":{"bbox":t.get("bbox"),"rows":t["rows"]},
      "secondaryEvidence":{"bbox":secondary[j].get("bbox"),"rows":secondary[j]["rows"]}})
   elif state=="NO_GEOMETRIC_MATCH":
    t=byid.get(c.get("primaryTableId"))
    if t is None or t not in original:raise ValueError("PRIMARY_PROVENANCE_HOLD")
    item.update({"classification":"PRIMARY_UNMATCHED","proposedAction":"REVIEW_TABLE_SEGMENTATION",
      "primaryEvidence":{"bbox":t.get("bbox"),"rows":t["rows"]}})
   elif state=="SECONDARY_ONLY_TABLE":
    j=c.get("secondaryTableIndex")
    if type(j)!=int or not 0<=j<len(secondary):raise ValueError("SECONDARY_PROVENANCE_HOLD")
    item.update({"classification":"SECONDARY_UNMATCHED","proposedAction":"REVIEW_TABLE_SEGMENTATION",
      "secondaryEvidence":{"bbox":secondary[j].get("bbox"),"rows":secondary[j]["rows"]}})
   else:raise ValueError("UNKNOWN_COMPARISON_STATE")
   counts[item["classification"]]+=1;results.append(item)
 if len(results)>args.max_records:raise ValueError("RECORD_BUDGET_HOLD")
 output={"schema":"fun.layout.reconciliation.v12i","primarySha256":sha(primary_path.read_bytes()),
   "crossengineSha256":sha(report_path.read_bytes()),"auditSha256":sha(audit_path.read_bytes()),
   "pages":len(report["pages"]),"records":len(results),"classifications":dict(counts),
   "sourceModified":False,"autoCorrected":False,"meaningVerified":False,
   "engineeringApproved":False,"items":results}
 destination=folder/"layout-reconciliation-v12i.json"
 payload=json.dumps(output,ensure_ascii=False,indent=2)+"\n"
 if destination.exists():
  if destination.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
  status="EXISTS"
 else:
  with destination.open("x",encoding="utf-8") as f:f.write(payload)
  status="CREATED"
 print(json.dumps({"state":"FUN_V12I_RECONCILIATION_"+status,"pages":output["pages"],
   "records":len(results),"classifications":dict(counts),"autoCorrected":False,
   "meaningVerified":False,"output":str(destination)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",type=Path,required=True)
 p.add_argument("--max-pages",type=int,default=400);p.add_argument("--max-records",type=int,default=5000)
 a=p.parse_args()
 try:
  if not 1<=a.max_pages<=1000 or not 1<=a.max_records<=100000:raise ValueError("INVALID_BUDGET")
  run(a)
 except Exception as e:print("FUN_V12I_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
