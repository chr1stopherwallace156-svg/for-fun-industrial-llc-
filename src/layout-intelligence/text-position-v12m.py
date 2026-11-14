#!/usr/bin/env python3
"""V12M: selective original-PDF word geometry, conservative candidate context."""
import argparse,collections,hashlib,json,math,re,sys,time
from pathlib import Path
def sha(b):return hashlib.sha256(b).hexdigest()
def filehash(p):
 h=hashlib.sha256()
 with p.open("rb") as f:
  for c in iter(lambda:f.read(1048576),b""):h.update(c)
 return h.hexdigest()
def validbox(v):
 if not isinstance(v,list) or len(v)!=4 or any(type(x) not in (float,int) or not math.isfinite(x) for x in v):return None
 a,b,c,d=map(float,v)
 return [a,b,c,d] if c>a and d>b else None
def context(words,bbox,max_words):
 if not bbox:return {"state":"NO_TABLE_BBOX","candidates":[]}
 x0,y0,x1,y1=bbox
 selected=[]
 for w in words:
  try:
   wx0=float(w["x0"]);wx1=float(w["x1"]);top=float(w["top"]);bottom=float(w["bottom"])
   if not all(map(math.isfinite,[wx0,wx1,top,bottom])):continue
   if wx1<wx0 or bottom<top:continue
   horizontal=max(0,min(x1,wx1)-max(x0,wx0))
   if horizontal<=0:continue
   if bottom<=y0 and y0-bottom<=90:position="ABOVE"
   elif top>=y1 and top-y1<=90:position="BELOW"
   elif top<y1 and bottom>y0:position="WITHIN_TABLE_REGION"
   else:continue
   distance=round(y0-bottom if position=="ABOVE" else top-y1 if position=="BELOW" else 0,2)
   selected.append({"text":str(w.get("text",""))[:120],"bbox":[wx0,top,wx1,bottom],
    "position":position,"verticalGap":distance})
  except (ValueError,TypeError,KeyError):continue
 selected.sort(key=lambda z:(z["verticalGap"],z["bbox"][1],z["bbox"][0],z["text"]))
 return {"state":"POSITION_CANDIDATES_ONLY","candidates":selected[:max_words],
 "candidateWordsFound":len(selected),"truncated":len(selected)>max_words}
def run(a):
 import pdfplumber
 base=a.root.resolve();srcdir=(base/"Sources").resolve();folder=(base/"Evidence"/"ExtractedPagesV12A"/a.configuration).resolve()
 if not srcdir.is_relative_to(base) or not folder.is_relative_to(base):raise ValueError("PATH_ESCAPE_HOLD")
 lp=folder/"layout-geometry-v12l.json";jp=folder/"layout-context-v12j.json";rp=folder/"layout-reconciliation-v12i.json"
 geo=json.loads(lp.read_bytes());ctx=json.loads(jp.read_bytes());rec=json.loads(rp.read_bytes())
 if geo.get("schema")!="fun.layout.geometry.v12l" or ctx.get("schema")!="fun.layout.context.v12j" or rec.get("schema")!="fun.layout.reconciliation.v12i":raise ValueError("SCHEMA_HOLD")
 if geo.get("reconciliationSha256")!=sha(rp.read_bytes()) or ctx.get("reconciliationSha256")!=sha(rp.read_bytes()):raise ValueError("SOURCE_CHAIN_HOLD")
 if len(geo["items"])!=geo["records"] or len(rec["items"])!=geo["records"]:raise ValueError("RECORD_COUNT_HOLD")
 if len(ctx["items"])!=ctx["records"]:raise ValueError("CONTEXT_COUNT_HOLD")
 targets=set()
 for item in geo["items"]:
  if item["geometryAssessment"] in ("PARTIAL_REGION_OVERLAP","LOW_REGION_OVERLAP"):
   targets.add((item["sourceSha256"],item["page"]))
 for item in ctx["items"]:
  if item["pageTextAnchorHits"]==0:targets.add((item["sourceSha256"],item["page"]))
 if len(targets)>a.max_pages:raise ValueError("PAGE_BUDGET_HOLD")
 targets=sorted(targets);cache=folder/"V12M-WordCache";cache.mkdir(exist_ok=True)
 verified=set();wordpages={};hits=0;misses=0
 for sid,page in targets:
  if not re.fullmatch("[0-9a-f]{64}",sid) or type(page)!=int or page<1:raise ValueError("SOURCE_ID_HOLD")
  source=(srcdir/(sid+".pdf")).resolve()
  if not source.is_relative_to(srcdir) or not source.is_file():raise ValueError("SOURCE_MISSING")
  if sid not in verified:
   if filehash(source)!=sid:raise ValueError("PDF_HASH_HOLD")
   verified.add(sid)
  key=sha(("v12m-words:"+pdfplumber.__version__+":"+sid+":"+str(page)).encode())
  target=cache/(key+".json")
  if target.exists():
   data=json.loads(target.read_bytes())
   if data.get("key")!=key or data.get("sourceSha256")!=sid or data.get("page")!=page or not isinstance(data.get("words"),list):raise ValueError("CACHE_PROVENANCE_HOLD")
   hits+=1
  else:
   with pdfplumber.open(source) as pdf:
    if page>len(pdf.pages):raise ValueError("PAGE_RANGE_HOLD")
    words=pdf.pages[page-1].extract_words()
   if len(words)>a.max_words_per_page:raise ValueError("WORD_BUDGET_HOLD")
   data={"key":key,"sourceSha256":sid,"page":page,"words":[{"text":str(w.get("text",""))[:120],"x0":w["x0"],"x1":w["x1"],"top":w["top"],"bottom":w["bottom"]} for w in words]}
   with target.open("x",encoding="utf-8") as f:json.dump(data,f,separators=(",",":"),ensure_ascii=False)
   misses+=1
  if len(data["words"])>a.max_words_per_page:raise ValueError("WORD_BUDGET_HOLD")
  wordpages[(sid,page)]=data["words"]
 items=[];states=collections.Counter()
 for item in geo["items"]:
  key=(item["sourceSha256"],item["page"])
  if key not in wordpages:continue
  a1=context(wordpages[key],validbox(item.get("primaryBBox")),a.max_candidate_words)
  a2=context(wordpages[key],validbox(item.get("secondaryBBox")),a.max_candidate_words)
  states[a1["state"]]+=1;states[a2["state"]]+=1
  items.append({"sourceSha256":key[0],"page":key[1],"primaryTableId":item.get("primaryTableId"),
   "secondaryTableIndex":item.get("secondaryTableIndex"),"geometryAssessment":item["geometryAssessment"],
   "primaryContext":a1,"secondaryContext":a2,"captionScopeVerified":False,"unitBindingVerified":False,"relationshipVerified":False})
 out={"schema":"fun.layout.text_position.v12m","geometrySha256":sha(lp.read_bytes()),"contextSha256":sha(jp.read_bytes()),
  "engine":"pdfplumber","engineVersion":pdfplumber.__version__,"selectedPages":len(targets),"cacheHits":hits,"cacheMisses":misses,
  "records":len(items),"states":dict(states),"relationsVerified":False,"autoCorrected":False,"engineeringApproved":False,"items":items}
 dest=folder/"layout-text-position-v12m.json";payload=json.dumps(out,ensure_ascii=False,indent=2)+"\n"
 if dest.exists():
  if dest.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
  status="EXISTS"
 else:
  with dest.open("x",encoding="utf-8") as f:f.write(payload)
  status="CREATED"
 print(json.dumps({"state":"FUN_V12M_TEXT_POSITION_"+status,"selectedPages":len(targets),"records":len(items),
 "cacheHits":hits,"cacheMisses":misses,"states":dict(states),"relationsVerified":False,
 "engineeringApproved":False,"output":str(dest)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--root",required=True,type=Path);p.add_argument("--configuration",default="F450-2021-REFERENCE")
 p.add_argument("--max-pages",type=int,default=150);p.add_argument("--max-words-per-page",type=int,default=20000)
 p.add_argument("--max-candidate-words",type=int,default=100);a=p.parse_args()
 try:
  if not re.fullmatch("[A-Za-z0-9][A-Za-z0-9._-]{0,95}",a.configuration) or min(a.max_pages,a.max_words_per_page,a.max_candidate_words)<1:raise ValueError("INVALID_BUDGET")
  run(a)
 except Exception as e:print("FUN_V12M_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
