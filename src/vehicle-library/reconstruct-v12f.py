#!/usr/bin/env python3
"""V12F: conservative header/row unit reconstruction; optional pdfplumber comparison."""
import argparse, hashlib, json, re, sys
from pathlib import Path
from decimal import Decimal
from collections import Counter
MODELS=re.compile(r"(?<![A-Za-z0-9])([FE])[- ]?(350|450|550)(?![A-Za-z0-9])",re.I)
UNITS=re.compile(r"(?<![A-Za-z])(?:mm|cm|inches|inch|in\.|in|ft|lbs?\.?|kg|volts?|V)(?![A-Za-z])",re.I)
VALUE=re.compile(r"^\s*([+-]?\d+(?:,\d{3})*(?:\.\d+)?)\s*$")
LABELS={"wheelbase":r"\bwheel\s*base\b|\bwheelbase\b","cab_to_axle":r"\bcab\s*(?:to|[-/])\s*axle\b","overall_length":r"\boverall\s+length\b","frame_width":r"\bframe\s+(?:rail\s+)?width\b","gvwr":r"\bGVWR\b|gross vehicle weight rating","gawr":r"\bGAWR\b|gross axle weight rating","curb_weight":r"\bcurb\s+weight\b","payload":r"\bpayload\b","voltage":r"\b(?:system|nominal|battery)\s+voltage\b"}
FACTOR={"mm":("mm",Decimal("1")),"cm":("mm",Decimal("10")),"in":("mm",Decimal("25.4")),"inch":("mm",Decimal("25.4")),"inches":("mm",Decimal("25.4")),"ft":("mm",Decimal("304.8")),"lb":("kg",Decimal("0.45359237")),"lbs":("kg",Decimal("0.45359237")),"kg":("kg",Decimal("1")),"v":("V",Decimal("1")),"volt":("V",Decimal("1")),"volts":("V",Decimal("1"))}
def digest(path):
 h=hashlib.sha256()
 with path.open("rb") as f:
  for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
 return h.hexdigest()
def unit(text):
 found={x.lower().rstrip(".") for x in UNITS.findall(text)}
 return next(iter(found)) if len(found)==1 else None
def model(text):
 found={f"{a.upper()}-{b}" for a,b in MODELS.findall(text)}
 return next(iter(found)) if len(found)==1 else None
def reconstruct(tables,limit):
 records=[];reasons=Counter()
 for t in tables:
  rows=t["rows"]
  for ri,row in enumerate(rows):
   for li,labelcell in enumerate(row):
    if not isinstance(labelcell,str):continue
    for parameter,pattern in LABELS.items():
     if not re.search(pattern,labelcell,re.I):continue
     for ci,raw in enumerate(row):
      if ci==li or not isinstance(raw,str) or not VALUE.fullmatch(raw):continue
      if len(records)>=limit:raise ValueError("RECONSTRUCTION_BUDGET_HOLD")
      # Strict: only use a single explicit unit in label or same-column header.
      header=[(hi,rows[hi][ci]) for hi in range(ri) if ci<len(rows[hi]) and isinstance(rows[hi][ci],str)]
      # Nearest header wins only when exactly one header includes a unit.
      unit_sources=[(hi,v) for hi,v in header if unit(v)]
      label_unit=unit(labelcell)
      header_units={unit(v) for _,v in unit_sources}
      selected_unit=label_unit if label_unit and (not header_units or header_units=={label_unit}) else (next(iter(header_units)) if not label_unit and len(header_units)==1 else None)
      header_models={model(v) for _,v in header if model(v)}
      chosen_model=next(iter(header_models)) if len(header_models)==1 else None
      reason="REVIEW_ONLY"
      normalized=None;canonical=None
      if not selected_unit:reason="UNIT_AMBIGUOUS_OR_MISSING"
      elif not chosen_model:reason="MODEL_AMBIGUOUS_OR_MISSING"
      else:
       canonical,factor=FACTOR[selected_unit]
       expected="mm" if parameter in ("wheelbase","cab_to_axle","overall_length","frame_width") else "kg" if parameter in ("gvwr","gawr","curb_weight","payload") else "V"
       if canonical!=expected:reason="INCOMPATIBLE_DIMENSION";canonical=None
       else:
        normalized=str(Decimal(raw.replace(",",""))*factor)
        reason="HEADER_MATCH_REVIEW_REQUIRED"
      reasons[reason]+=1
      key=f"{t['id']}:{ri}:{li}:{ci}:{parameter}"
      records.append({"id":hashlib.sha256(key.encode()).hexdigest(),"parameter":parameter,
       "rawValueCell":raw,"unitCandidate":selected_unit,"normalizedCandidate":normalized,
       "normalizedUnit":canonical,"modelCandidate":chosen_model,
       "modelApplicability":"UNVERIFIED","cabApplicability":"UNDETERMINED",
       "reason":reason,"sourceSha256":t["sourceSha256"],"document":t["document"],
       "page":t["page"],"tableId":t["id"],"labelRow":ri,"labelColumn":li,
       "valueRow":ri,"valueColumn":ci,"headerEvidence":[{"row":hi,"text":v[:200]} for hi,v in header if unit(v) or model(v)],
       "labelEvidence":labelcell[:300],"reviewStatus":"NEEDS_HUMAN_REVIEW",
       "approvedForEngineering":False,"cadExportEligible":False})
 return records,dict(reasons)
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--root",required=True,type=Path);p.add_argument("--vehicle",default="F-450")
 p.add_argument("--year",type=int,default=2021);p.add_argument("--id",required=True)
 p.add_argument("--max-records",type=int,default=50000)
 p.add_argument("--compare-pdfplumber",action="store_true")
 a=p.parse_args()
 try:
  if a.vehicle not in ("F-450","F-550","E-450") or not 2000<=a.year<=2100 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,95}",a.id):raise ValueError("INVALID_CONFIGURATION")
  if not 1<=a.max_records<=100000:raise ValueError("INVALID_BUDGET")
  base=a.root/"Ford"/a.vehicle/str(a.year)
  cfgs=json.loads((base/"Configurations"/"registry.json").read_text(encoding="utf-8"))["configurations"]
  cfg=next((c for c in cfgs if c["id"]==a.id),None)
  if cfg is None:raise ValueError("CONFIGURATION_NOT_FOUND")
  manifest={s["id"]:s for s in json.loads((base/"Sources"/"manifest.json").read_text(encoding="utf-8"))["sources"]}
  for sid in cfg["sourceIds"]:
   if sid not in manifest or manifest[sid].get("storedName")!=sid+".pdf" or digest(base/"Sources"/(sid+".pdf"))!=sid:raise ValueError("SOURCE_INTEGRITY_HOLD")
  folder=base/"Evidence"/"ExtractedPagesV12A"/a.id
  data=json.loads((folder/"engineering-tables-v12c.json").read_text(encoding="utf-8"))
  if (data.get("schema")!="fun.engineering.tables.v12c" or data.get("vehicle")!=a.vehicle or data.get("year")!=a.year or data.get("configurationId")!=a.id or not data.get("complete") or data.get("pageFailures") or data.get("tablesFound")!=len(data.get("tables",[]))):raise ValueError("TABLE_PROVENANCE_HOLD")
  if any(t.get("sourceSha256") not in cfg["sourceIds"] for t in data["tables"]):raise ValueError("UNKNOWN_SOURCE")
  records,reasons=reconstruct(data["tables"],a.max_records)
  comparison={"engine":"pdfplumber","state":"NOT_REQUESTED"}
  if a.compare_pdfplumber:
   try:import pdfplumber
   except ImportError:comparison={"engine":"pdfplumber","state":"NOT_INSTALLED"}
   else:
    # Independently compare table counts, not numeric accuracy.
    by_source=Counter(t["sourceSha256"] for t in data["tables"])
    counts={}
    for sid in cfg["sourceIds"]:
     count=0
     with pdfplumber.open(str(base/"Sources"/(sid+".pdf"))) as pdf:
      for page in pdf.pages:
       count+=len(page.find_tables())
     counts[sid]={"v12cTables":by_source[sid],"pdfplumberTables":count}
    comparison={"engine":"pdfplumber","state":"COUNT_COMPARISON_ONLY","perSource":counts}
  output={"schema":"fun.engineering.reconstruction.v12f","vehicle":a.vehicle,"year":a.year,"configurationId":a.id,
   "sourceTables":len(data["tables"]),"recordCount":len(records),"reasonCounts":reasons,
   "comparison":comparison,"engineeringApproved":False,"cadExportEligible":False,"records":records}
  dest=folder/"engineering-reconstruction-v12f.json"
  payload=json.dumps(output,indent=2,ensure_ascii=False)+"\n"
  if dest.exists():
   if dest.read_text(encoding="utf-8")!=payload:raise ValueError("EXISTING_RECONSTRUCTION_CONFLICT")
   state="EXISTS"
  else:
   with dest.open("x",encoding="utf-8") as f:f.write(payload)
   state="CREATED"
  print(json.dumps({"state":"FUN_V12F_RECONSTRUCTION_"+state,"sourceTables":len(data["tables"]),"records":len(records),
   "reasonCounts":reasons,"comparison":comparison["state"],"engineeringApproved":False,"output":str(dest)},indent=2))
  return 0
 except Exception as e:
  print("FUN_V12F_HOLD="+str(e),file=sys.stderr);return 1
if __name__=="__main__":sys.exit(main())
