#!/usr/bin/env python3
"""V12N: review-only spatial text-line candidates from V12M positioned words."""
import argparse,collections,hashlib,json,math,re,sys
from pathlib import Path
def sha(b):return hashlib.sha256(b).hexdigest()
def line_groups(words,tolerance=4):
 groups=[]
 for w in sorted(words,key=lambda x:(x["bbox"][1],x["bbox"][0],x["text"])):
  b=w["bbox"]
  if len(b)!=4 or any(type(v) not in (int,float) or not math.isfinite(v) for v in b):raise ValueError("INVALID_WORD_GEOMETRY")
  if not groups or abs(b[1]-groups[-1][0]["bbox"][1])>tolerance or w["position"]!=groups[-1][0]["position"]:
   groups.append([w])
  else:groups[-1].append(w)
 result=[]
 for group in groups:
  group.sort(key=lambda w:w["bbox"][0])
  text=" ".join(str(w["text"]) for w in group).strip()
  if not text:continue
  b=[min(w["bbox"][0] for w in group),min(w["bbox"][1] for w in group),
     max(w["bbox"][2] for w in group),max(w["bbox"][3] for w in group)]
  if b[2]<=b[0] or b[3]<=b[1]:continue
  gap=min(w["verticalGap"] for w in group)
  pos=group[0]["position"]
  hints=[]
  if re.search(r"\b(?:table|figure|schedule)\s*[\dIVX]+",text,re.I):hints.append("NUMBERED_CAPTION_PATTERN")
  if re.search(r"\b(?:note|notes|source)\s*:",text,re.I) or text.startswith(("*","†","‡")):hints.append("FOOTNOTE_PATTERN")
  if re.search(r"(?<!\w)(?:mm|cm|kg|lbs?|kW|kWh|psi|MPa|ft|inches|%)\b",text,re.I):hints.append("UNIT_TOKEN_PATTERN")
  result.append({"text":text[:500],"bbox":b,"position":pos,"verticalGap":gap,
   "hints":hints,"relationshipVerified":False})
 return result
def build(doc,max_lines):
 output=[];claims=collections.defaultdict(set);counts=collections.Counter()
 for i,item in enumerate(doc["items"]):
  rid=(item["sourceSha256"],item["page"],item.get("primaryTableId"),item.get("secondaryTableIndex"))
  for side in ("primaryContext","secondaryContext"):
   c=item[side]
   if c["state"]!="POSITION_CANDIDATES_ONLY":counts["NO_TABLE_BBOX"]+=1;continue
   lines=line_groups(c.get("candidates",[]))
   if len(lines)>max_lines:raise ValueError("LINE_BUDGET_HOLD")
   for l in lines:
    # Key includes source page and physical line bounds. Same source line
    # may be proposed for more than one table, which is a conflict candidate.
    key=(item["sourceSha256"],item["page"],tuple(round(v,1) for v in l["bbox"]),l["text"])
    claims[key].add(rid)
    output.append({"sourceSha256":item["sourceSha256"],"page":item["page"],
     "primaryTableId":item.get("primaryTableId"),"secondaryTableIndex":item.get("secondaryTableIndex"),
     "region":side,"line":l,"lineKey":sha(json.dumps(key).encode())[:20],
     "association":"POSSIBLE_NEARBY_TEXT","reviewRequired":True,"conflict":False})
 counts["lineCandidates"]=len(output)
 conflicts={sha(json.dumps(k).encode())[:20] for k,v in claims.items() if len(v)>1}
 for o in output:
  if o["lineKey"] in conflicts:o["conflict"]=True
 counts["ambiguousAssociations"]=sum(o["conflict"] for o in output)
 counts["ambiguousUniqueLines"]=len(conflicts)
 counts["withoutCandidateLines"]=sum(
  not any(o["sourceSha256"]==item["sourceSha256"] and o["page"]==item["page"]
    and o["primaryTableId"]==item.get("primaryTableId")
    and o["secondaryTableIndex"]==item.get("secondaryTableIndex") for o in output)
  for item in doc["items"])
 return output,dict(counts)
def run(a):
 f=a.folder.resolve();source=f/"layout-text-position-v12m.json";raw=source.read_bytes();doc=json.loads(raw)
 if doc.get("schema")!="fun.layout.text_position.v12m" or doc.get("relationsVerified") is not False:raise ValueError("V12M_SCHEMA_HOLD")
 if doc.get("geometrySha256")!=sha((f/"layout-geometry-v12l.json").read_bytes()) or doc.get("contextSha256")!=sha((f/"layout-context-v12j.json").read_bytes()):raise ValueError("INPUT_HASH_HOLD")
 if doc.get("records")!=len(doc.get("items",[])) or doc["records"]>a.max_records:raise ValueError("INPUT_COUNT_HOLD")
 items,counts=build(doc,a.max_lines_per_region)
 if len(items)>a.max_total_lines:raise ValueError("OUTPUT_BUDGET_HOLD")
 result={"schema":"fun.layout.spatial.v12n","inputSha256":sha(raw),"records":len(doc["items"]),
 "assessments":counts,"lineAssociations":items,"relationsVerified":False,"autoCorrected":False,
 "meaningVerified":False,"engineeringApproved":False}
 dest=f/"layout-spatial-v12n.json";payload=json.dumps(result,indent=2,ensure_ascii=False)+"\n"
 if dest.exists():
  if dest.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
  state="EXISTS"
 else:
  with dest.open("x",encoding="utf-8") as out:out.write(payload)
  state="CREATED"
 print(json.dumps({"state":"FUN_V12N_SPATIAL_"+state,"records":result["records"],"assessments":counts,
  "relationsVerified":False,"engineeringApproved":False,"output":str(dest)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",required=True,type=Path)
 p.add_argument("--max-records",type=int,default=5000);p.add_argument("--max-lines-per-region",type=int,default=120)
 p.add_argument("--max-total-lines",type=int,default=100000);a=p.parse_args()
 try:
  if min(a.max_records,a.max_lines_per_region,a.max_total_lines)<1:raise ValueError("INVALID_BUDGET")
  run(a)
 except Exception as e:print("FUN_V12N_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
