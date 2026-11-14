#!/usr/bin/env python3
"""V12D: deterministic, review-only engineering parameter candidates from V12C."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

LABELS = {
 "wheelbase": (r"\bwheel\s*base\b|\bwheelbase\b", "CAD"),
 "cab_to_axle": (r"\bcab\s*(?:to|[-/])\s*axle\b", "CAD"),
 "overall_length": (r"\boverall\s+length\b", "CAD"),
 "frame_width": (r"\bframe\s+(?:rail\s+)?width\b", "CAD"),
 "gvwr": (r"\bGVWR\b|gross vehicle weight rating", "Simulations"),
 "gawr": (r"\bGAWR\b|gross axle weight rating", "Simulations"),
 "curb_weight": (r"\bcurb\s+weight\b", "Simulations"),
 "payload": (r"\bpayload\b", "Simulations"),
 "voltage": (r"\b(?:system|nominal|battery)\s+voltage\b", "Wiring"),
}
NUMBER = re.compile(r"(?<![A-Za-z0-9])[-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?![A-Za-z0-9])|(?<![A-Za-z0-9])[-+]?\d+(?:\.\d+)?(?![A-Za-z0-9])")
UNITS = re.compile(r"\b(?:mm|cm|inches|inch|in|lbs|lb|kg|ft|volts|volt|V|kW|kWh)\b",re.I)
MODEL = re.compile(r"\b(?:F[- ]?350|F[- ]?450|F[- ]?550|E[- ]?450)\b",re.I)
def load(root, vehicle, year, cid):
 base=root/"Ford"/vehicle/str(year)
 registry=json.loads((base/"Configurations"/"registry.json").read_text(encoding="utf-8"))
 cfg=next((x for x in registry["configurations"] if x["id"]==cid),None)
 if cfg is None:raise ValueError("CONFIGURATION_NOT_FOUND")
 sources={s["id"]:s for s in json.loads((base/"Sources"/"manifest.json").read_text(encoding="utf-8"))["sources"]}
 folder=base/"Evidence"/"ExtractedPagesV12A"/cid
 tables=json.loads((folder/"engineering-tables-v12c.json").read_text(encoding="utf-8"))
 if tables.get("schema")!="fun.engineering.tables.v12c" or tables.get("vehicle")!=vehicle or tables.get("year")!=year or tables.get("configurationId")!=cid or not tables.get("complete") or tables.get("pageFailures"):
  raise ValueError("TABLE_PROVENANCE_OR_COMPLETENESS_HOLD")
 for sid in cfg["sourceIds"]:
  source=sources.get(sid)
  if not source or source.get("storedName")!=sid+".pdf":raise ValueError("SOURCE_MANIFEST_HOLD")
  pdf=base/"Sources"/(sid+".pdf")
  h=hashlib.sha256()
  with pdf.open("rb") as f:
   for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
  if h.hexdigest()!=sid:raise ValueError("SOURCE_HASH_MISMATCH")
 if tables.get("tablesFound")!=len(tables.get("tables",[])):raise ValueError("TABLE_COUNT_HOLD")
 if any(t.get("sourceSha256") not in cfg["sourceIds"] for t in tables["tables"]):raise ValueError("UNKNOWN_TABLE_SOURCE")
 return folder,tables
def extract(tables, max_candidates):
 candidates=[]
 for table in tables["tables"]:
  rows=table.get("rows",[])
  if not isinstance(rows,list):raise ValueError("INVALID_TABLE_ROWS")
  for row_idx,row in enumerate(rows):
   if not isinstance(row,list):raise ValueError("INVALID_TABLE_ROW")
   for col_idx,cell in enumerate(row):
    if not isinstance(cell,str):continue
    for label,(pattern,destination) in LABELS.items():
     if not re.search(pattern,cell,re.I):continue
     # Include same row for context, but never interpret a number as an approved measurement.
     for value_col,raw in enumerate(row):
      if value_col==col_idx or not isinstance(raw,str):continue
      numbers=NUMBER.findall(raw)
      if not numbers:continue
      if len(candidates)>=max_candidates:raise ValueError("CANDIDATE_BUDGET_HOLD")
      context=" | ".join(str(x)[:300] for x in row)
      key=f"{table['id']}:{row_idx}:{col_idx}:{value_col}:{label}"
      candidates.append({
       "id":hashlib.sha256(key.encode()).hexdigest(),
       "parameter":label,"rawValueCell":raw[:500],"numericTokens":numbers[:20],
       "unitMentions":sorted(set(UNITS.findall(context)),key=str.lower),
       "sourceSha256":table["sourceSha256"],"document":table["document"],
       "page":table["page"],"tableId":table["id"],"tableIndex":table["tableIndex"],
       "labelRow":row_idx,"labelColumn":col_idx,"valueRow":row_idx,"valueColumn":value_col,
       "rowContext":context[:1200],"modelMentionsInTable":table.get("modelMentionsInTable",[]),
       "modelApplicability":"UNDETERMINED","cabApplicability":"UNDETERMINED",
       "normalizedValue":None,"normalizedUnit":None,"proposedDestination":destination,
       "reviewStatus":"NEEDS_HUMAN_REVIEW","approvedForEngineering":False
      })
 return candidates
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--root",required=True,type=Path);p.add_argument("--vehicle",default="F-450")
 p.add_argument("--year",default=2021,type=int);p.add_argument("--id",required=True)
 p.add_argument("--max-candidates",default=50000,type=int)
 a=p.parse_args()
 try:
  if a.vehicle not in ("F-450","F-550","E-450") or not 2000<=a.year<=2100 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,95}",a.id):raise ValueError("INVALID_CONFIGURATION")
  if not 1<=a.max_candidates<=100000:raise ValueError("INVALID_BUDGET")
  folder,tables=load(a.root,a.vehicle,a.year,a.id)
  candidates=extract(tables,a.max_candidates)
  result={"schema":"fun.engineering.parameters.v12d","vehicle":a.vehicle,"year":a.year,
          "configurationId":a.id,"sourceTables":len(tables["tables"]),"candidateCount":len(candidates),
          "engineeringApproved":False,"autoPromoted":False,"candidates":candidates}
  dest=folder/"engineering-parameters-v12d.json"
  payload=json.dumps(result,indent=2,ensure_ascii=False)+"\n"
  if dest.exists():
   if dest.read_text(encoding="utf-8")!=payload:raise ValueError("EXISTING_PARAMETER_INDEX_CONFLICT")
   state="EXISTS"
  else:
   with dest.open("x",encoding="utf-8") as f:f.write(payload)
   state="CREATED"
  print(json.dumps({"state":"FUN_V12D_PARAMETERS_"+state,"sourceTables":len(tables["tables"]),"candidates":len(candidates),"output":str(dest),"engineeringApproved":False},indent=2))
  return 0
 except Exception as e:
  print("FUN_V12D_HOLD="+str(e),file=sys.stderr);return 1
if __name__=="__main__":sys.exit(main())
