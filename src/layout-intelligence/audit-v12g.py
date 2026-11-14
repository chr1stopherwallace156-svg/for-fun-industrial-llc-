#!/usr/bin/env python3
"""Generic table structural verifier, independent of vehicle/domain. Read-only inputs."""
import argparse, hashlib, json, re, sys
from pathlib import Path
from collections import Counter
def hash_bytes(b):return hashlib.sha256(b).hexdigest()
def audit(tables, max_tables=50000):
 if not isinstance(tables,list) or len(tables)>max_tables:raise ValueError("TABLE_BUDGET_HOLD")
 results=[];stats=Counter()
 for i,t in enumerate(tables):
  rows=t.get("rows",[])
  if not isinstance(rows,list):raise ValueError("INVALID_ROWS")
  widths=[len(r) for r in rows if isinstance(r,list)]
  if len(widths)!=len(rows):raise ValueError("INVALID_ROW")
  issues=[]
  if not rows:issues.append("EMPTY_TABLE")
  if widths and len(set(widths))>1:issues.append("RAGGED_ROWS")
  if rows and any(not isinstance(c,(str,type(None))) for row in rows for c in row):issues.append("NON_TEXT_CELL")
  if rows and len(rows)>1:
   top=" ".join(str(c or "") for c in rows[0])
   if not re.search(r"[A-Za-z]",top):issues.append("HEADER_UNCLEAR")
  for ri,row in enumerate(rows):
   for ci,cell in enumerate(row):
    if isinstance(cell,str) and re.search(r"\d",cell) and not re.search(r"[A-Za-z]",cell):
     if not any(re.search(r"\b(mm|cm|in|inch|inches|ft|lb|lbs|kg|volt|volts|V|kW|kWh)\b",str(x or ""),re.I) for x in row):
      issues.append("NUMERIC_CELL_WITHOUT_ROW_UNIT")
      break
   if "NUMERIC_CELL_WITHOUT_ROW_UNIT" in issues:break
  issues=sorted(set(issues))
  for issue in issues:stats[issue]+=1
  results.append({"tableId":t.get("id",str(i)),"sourceSha256":t.get("sourceSha256"),
   "page":t.get("page"),"bbox":t.get("bbox"),"rows":len(rows),
   "columnsMax":max(widths,default=0),"issues":issues,
   "reviewPriority":"TARGETED_SECOND_PASS" if issues else "STRUCTURE_CHECK_PASSED",
   "verifiedMeaning":False})
 return results,dict(stats)
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--input",required=True,type=Path);p.add_argument("--output",required=True,type=Path)
 p.add_argument("--max-tables",type=int,default=50000)
 a=p.parse_args()
 try:
  if not 1<=a.max_tables<=100000:raise ValueError("INVALID_BUDGET")
  raw=a.input.read_bytes();data=json.loads(raw)
  if not isinstance(data,dict) or not isinstance(data.get("tables"),list):raise ValueError("INPUT_TABLE_SCHEMA_HOLD")
  records,counts=audit(data["tables"],a.max_tables)
  output={"schema":"fun.layout.audit.v12g","inputSha256":hash_bytes(raw),
   "tables":len(records),"issueCounts":counts,
   "targetedSecondPass":sum(bool(r["issues"]) for r in records),
   "meaningVerified":False,"records":records}
  payload=json.dumps(output,indent=2,ensure_ascii=False)+"\n"
  if a.output.exists():
   if a.output.read_text(encoding="utf-8")!=payload:raise ValueError("EXISTING_AUDIT_CONFLICT")
   state="EXISTS"
  else:
   a.output.parent.mkdir(parents=True,exist_ok=True)
   with a.output.open("x",encoding="utf-8") as f:f.write(payload)
   state="CREATED"
  print(json.dumps({"state":"FUN_V12G_LAYOUT_AUDIT_"+state,"tables":len(records),
    "targetedSecondPass":output["targetedSecondPass"],"issueCounts":counts,
    "meaningVerified":False,"output":str(a.output)},indent=2))
  return 0
 except Exception as e:
  print("FUN_V12G_HOLD="+str(e),file=sys.stderr);return 1
if __name__=="__main__":sys.exit(main())
