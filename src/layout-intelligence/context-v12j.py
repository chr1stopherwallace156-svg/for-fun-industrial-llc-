#!/usr/bin/env python3
"""V12J: bounded, generic evidence-backed context proposals; no source mutation."""
import argparse, hashlib, json, re, sys
from collections import Counter
from pathlib import Path

TARGET={"MATERIAL_TEXT_DIFFERENCE","SAME_TEXT_DIFFERENT_STRUCTURE","HIGH_TEXT_OVERLAP_REVIEW"}
UNITS=re.compile(r"(?<!\w)(?:mm|cm|m|inches|inch|in\.|ft|lbs?\.?|kg|g|kW|kWh|V|A|Hz|psi|MPa|°C|°F|%)(?!\w)",re.I)
CAPTION=re.compile(r"\b(?:table|figure|schedule|specification|dimensions|ratings|capacity|weight|measurements)\b",re.I)
FOOTNOTE=re.compile(r"^\s*(?:\*|†|‡|\(\d+\)|\[\d+\]|note\s*:)",re.I)
def sha(b):return hashlib.sha256(b).hexdigest()
def clean(x):return re.sub(r"\s+"," ",str(x or "")).strip()
def analyze(item,page_text,max_lines):
 lines=page_text.splitlines()
 original=item.get("primaryEvidence",{}).get("rows",[])
 alternate=item.get("secondaryEvidence",{}).get("rows",[])
 # Search bounded literal anchors from both extracted tables in source page text.
 anchors=[]
 for grid in (original,alternate):
  for row in grid[:8]:
   for cell in row[:8]:
    value=clean(cell)
    if 5<=len(value)<=90 and value not in anchors and len(anchors)<16:anchors.append(value)
 hits=[]
 for i,line in enumerate(lines):
  normalized=clean(line).casefold()
  if any(a.casefold() in normalized for a in anchors):
   hits.append(i)
   if len(hits)>=12:break
 positions=set()
 for i in hits:
  for j in range(max(0,i-3),min(len(lines),i+4)):positions.add(j)
 evidence=[{"line":i+1,"text":clean(lines[i])[:240]} for i in sorted(positions)[:max_lines]]
 units=sorted({m.group(0).lower().rstrip(".") for e in evidence for m in UNITS.finditer(e["text"])})
 captions=[e for e in evidence if CAPTION.search(e["text"])][:8]
 footnotes=[e for e in evidence if FOOTNOTE.search(e["text"])][:8]
 classification=item["classification"]
 if classification=="SAME_TEXT_DIFFERENT_STRUCTURE":action="REVIEW_ROW_COLUMN_ASSOCIATIONS"
 elif classification=="MATERIAL_TEXT_DIFFERENCE":action="REVIEW_MISSING_OR_ALTERED_CELLS"
 else:action="REVIEW_HIGH_OVERLAP_DIFFERENCES"
 return {"classification":classification,"action":action,"pageTextAnchorHits":len(hits),
  "sourceContext":evidence,"unitMentions":units,"captionCandidates":captions,"footnoteCandidates":footnotes,
  "proposal":"Compare both preserved table grids against cited source-page lines; no replacement is selected.",
  "proposedReplacement":None,"contextVerified":False,"meaningVerified":False,"reviewStatus":"NEEDS_HUMAN_REVIEW"}
def run(a):
 folder=a.folder.resolve()
 rp=folder/"layout-reconciliation-v12i.json"
 xp=folder/"layout-crossengine-v12h.json"
 raw=rp.read_bytes();data=json.loads(raw)
 if data.get("schema")!="fun.layout.reconciliation.v12i" or data.get("autoCorrected") is not False:raise ValueError("RECONCILIATION_SCHEMA_HOLD")
 if data.get("crossengineSha256")!=sha(xp.read_bytes()):raise ValueError("CROSSENGINE_HASH_HOLD")
 if len(data.get("items",[]))>a.max_records:raise ValueError("RECORD_BUDGET_HOLD")
 pages={};records=[];counts=Counter();missing=0
 for item in data["items"]:
  if item.get("classification") not in TARGET:continue
  sid=item.get("sourceSha256");page=item.get("page")
  if not isinstance(sid,str) or not re.fullmatch(r"[0-9a-f]{64}",sid) or type(page)!=int or page<1:raise ValueError("SOURCE_PAGE_HOLD")
  if (sid,page) not in pages:
   p=folder/(sid+".pages.json")
   if not p.is_file():raise ValueError("PAGE_EVIDENCE_MISSING_"+sid)
   document=json.loads(p.read_bytes())
   if document.get("schema")!="fun.pdf.pages.v12a" or document.get("sourceSha256")!=sid or document.get("partial") or page>len(document.get("pages",[])):raise ValueError("PAGE_EVIDENCE_PROVENANCE_HOLD")
   candidate=document["pages"][page-1]
   if candidate.get("page")!=page:raise ValueError("PAGE_NUMBER_MISMATCH")
   pages[(sid,page)]=str(candidate.get("text",""))
  result=analyze(item,pages[(sid,page)],a.max_context_lines)
  if not result["pageTextAnchorHits"]:missing+=1
  counts[result["action"]]+=1
  records.append({"sourceSha256":sid,"page":page,"primaryTableId":item.get("primaryTableId"),
   "secondaryTableIndex":item.get("secondaryTableIndex"),**result})
 out={"schema":"fun.layout.context.v12j","reconciliationSha256":sha(raw),"records":len(records),
  "sourcePagesUsed":len(pages),"withoutTextAnchor":missing,"actions":dict(counts),
  "autoCorrected":False,"engineeringApproved":False,"meaningVerified":False,"items":records}
 dest=folder/"layout-context-v12j.json"
 payload=json.dumps(out,indent=2,ensure_ascii=False)+"\n"
 if dest.exists():
  if dest.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
  status="EXISTS"
 else:
  with dest.open("x",encoding="utf-8") as f:f.write(payload)
  status="CREATED"
 print(json.dumps({"state":"FUN_V12J_CONTEXT_"+status,"records":len(records),"sourcePagesUsed":len(pages),
  "withoutTextAnchor":missing,"actions":dict(counts),"autoCorrected":False,"meaningVerified":False,"output":str(dest)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",required=True,type=Path)
 p.add_argument("--max-records",type=int,default=5000);p.add_argument("--max-context-lines",type=int,default=32)
 a=p.parse_args()
 try:
  if not 1<=a.max_records<=100000 or not 1<=a.max_context_lines<=128:raise ValueError("INVALID_BUDGET")
  run(a)
 except Exception as e:print("FUN_V12J_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
