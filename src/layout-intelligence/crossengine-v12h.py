#!/usr/bin/env python3
"""V12H generic, read-only, selective pdfplumber/PyMuPDF table comparison."""
import argparse, hashlib, json, os, re, sys, time
from collections import Counter, defaultdict
from pathlib import Path

def sha(b): return hashlib.sha256(b).hexdigest()
def norm(s): return re.sub(r"\s+"," ",str(s or "")).strip().casefold()
def flatten(rows): return [norm(c) for row in rows for c in row if norm(c)]
def overlap(a,b):
 if not a or not b or len(a)!=4 or len(b)!=4:return 0.0
 x=max(0,min(float(a[2]),float(b[2]))-max(float(a[0]),float(b[0])))
 y=max(0,min(float(a[3]),float(b[3]))-max(float(a[1]),float(b[1])))
 area=x*y
 aa=max(0,(float(a[2])-float(a[0]))*(float(a[3])-float(a[1])))
 bb=max(0,(float(b[2])-float(b[0]))*(float(b[3])-float(b[1])))
 return area/(aa+bb-area) if aa+bb-area>0 else 0.0
def compare(primary,secondary):
 # Match one-to-one by bbox intersection; never infer semantic equivalence.
 unused=set(range(len(secondary)));results=[]
 for t in primary:
  candidates=sorted(((overlap(t.get("bbox"),s.get("bbox")),j) for j,s in enumerate(secondary) if j in unused),reverse=True)
  best,j=candidates[0] if candidates else (0,None)
  if j is None or best<0.20:
   results.append({"primaryTableId":t.get("id"),"state":"NO_GEOMETRIC_MATCH","bboxIoU":round(best,4)})
   continue
  unused.remove(j);s=secondary[j]
  a=flatten(t.get("rows",[]));b=flatten(s.get("rows",[]))
  ca=Counter(a);cb=Counter(b)
  shared=sum((ca&cb).values());total=sum((ca|cb).values())
  score=shared/total if total else 1.0
  results.append({"primaryTableId":t.get("id"),"secondaryTableIndex":j,"state":"CELL_TEXT_AGREEMENT" if score==1 else "CELL_TEXT_DISAGREEMENT","bboxIoU":round(best,4),"cellTokenMultisetSimilarity":round(score,4),"primaryCells":len(a),"secondaryCells":len(b),
   "missingFromSecondary":list((ca-cb).elements())[:12],"additionalInSecondary":list((cb-ca).elements())[:12]})
 for j in sorted(unused):results.append({"secondaryTableIndex":j,"state":"SECONDARY_ONLY_TABLE"})
 return results
def load_json(path):return json.loads(path.read_text(encoding="utf-8"))
def run(args):
 try:import pdfplumber
 except ImportError:raise ValueError("PDFPLUMBER_NOT_INSTALLED_INSTALL_IN_ISOLATED_VENV")
 base=args.root.resolve();sources=(base/"Sources").resolve();folder=(base/"Evidence"/"ExtractedPagesV12A"/args.configuration).resolve()
 for p in (sources,folder):
  if not p.is_relative_to(base):raise ValueError("PATH_ESCAPE_HOLD")
 original=(folder/"engineering-tables-v12c.json");audit_path=(folder/"layout-audit-v12g.json")
 tables=load_json(original);audit=load_json(audit_path)
 if tables.get("schema")!="fun.engineering.tables.v12c" or audit.get("schema")!="fun.layout.audit.v12g":raise ValueError("SCHEMA_HOLD")
 if audit.get("inputSha256")!=sha(original.read_bytes()):raise ValueError("AUDIT_INPUT_HASH_MISMATCH")
 if tables.get("tablesFound")!=len(tables.get("tables",[])):raise ValueError("TABLE_COUNT_HOLD")
 byid={t["id"]:t for t in tables["tables"]}
 if len(byid)!=len(tables["tables"]):raise ValueError("DUPLICATE_TABLE_ID")
 grouped=defaultdict(list)
 for record in audit["records"]:
  if record["tableId"] not in byid:raise ValueError("UNKNOWN_TABLE_IN_AUDIT")
  if record.get("reviewPriority")!="TARGETED_SECOND_PASS":continue
  t=byid[record["tableId"]];sid=t["sourceSha256"];page=t["page"]
  if not re.fullmatch("[0-9a-f]{64}",sid) or not isinstance(page,int) or page<1:raise ValueError("SOURCE_PAGE_HOLD")
  grouped[(sid,page)].append(t)
 if len(grouped)>args.max_pages:raise ValueError("PAGE_BUDGET_HOLD")
 cache=(folder/"V12H-PageCache");cache.mkdir(parents=True,exist_ok=True)
 results=[];hits=0;misses=0;started=time.monotonic();source_hashes={}
 for (sid,page),selected in sorted(grouped.items()):
  src=(sources/(sid+".pdf")).resolve()
  if not src.is_relative_to(sources) or not src.is_file():raise ValueError("SOURCE_NOT_FOUND")
  if sid not in source_hashes:
   h=hashlib.sha256()
   with src.open("rb") as f:
    for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
   if h.hexdigest()!=sid:raise ValueError("SOURCE_HASH_MISMATCH")
   source_hashes[sid]=True
  key=sha(("v12h-pdfplumber-"+pdfplumber.__version__+":"+sid+":"+str(page)).encode())
  target=cache/(key+".json")
  if target.exists():
   cached=load_json(target)
   if cached.get("key")!=key:raise ValueError("CACHE_INTEGRITY_HOLD")
   secondary=cached["tables"];hits+=1
  else:
   with pdfplumber.open(str(src)) as pdf:
    if page>len(pdf.pages):raise ValueError("PAGE_OUT_OF_RANGE")
    found=pdf.pages[page-1].find_tables()
    secondary=[{"bbox":list(t.bbox),"rows":[[str(c) if c is not None else "" for c in row] for row in t.extract()]} for t in found]
   payload=json.dumps({"key":key,"tables":secondary},ensure_ascii=False,separators=(",",":"))
   with target.open("x",encoding="utf-8") as f:f.write(payload)
   misses+=1
  # Include every original table on the selected page for fair one-to-one matching.
  primary=[t for t in tables["tables"] if t["sourceSha256"]==sid and t["page"]==page]
  results.append({"sourceSha256":sid,"page":page,"flaggedTableIds":[t["id"] for t in selected],
   "primaryTables":len(primary),"secondaryTables":len(secondary),"comparison":compare(primary,secondary)})
 states=Counter(c["state"] for r in results for c in r["comparison"])
 output={"schema":"fun.layout.crossengine.v12h","primarySha256":sha(original.read_bytes()),"auditSha256":sha(audit_path.read_bytes()),
  "engine":"pdfplumber","engineVersion":pdfplumber.__version__,"selectedPages":len(results),"cacheHits":hits,"cacheMisses":misses,
  "elapsedSeconds":round(time.monotonic()-started,3),"states":dict(states),"semanticVerification":False,
  "engineeringApproved":False,"autoCorrected":False,"pages":results}
 dest=folder/"layout-crossengine-v12h.json"
 if dest.exists():raise ValueError("OUTPUT_EXISTS_NO_OVERWRITE")
 with dest.open("x",encoding="utf-8") as f:json.dump(output,f,indent=2)
 print(json.dumps({"state":"FUN_V12H_COMPLETE","selectedPages":len(results),"cacheHits":hits,"cacheMisses":misses,"states":dict(states),"elapsedSeconds":output["elapsedSeconds"],"semanticVerification":False,"output":str(dest)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--root",required=True,type=Path);p.add_argument("--configuration",default="F450-2021-REFERENCE")
 p.add_argument("--max-pages",type=int,default=400);a=p.parse_args()
 try:
  if not 1<=a.max_pages<=1000 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,95}",a.configuration):raise ValueError("INVALID_ARGUMENT")
  run(a)
 except Exception as e:print("FUN_V12H_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
