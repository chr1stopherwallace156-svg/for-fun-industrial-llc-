#!/usr/bin/env python3
"""V12E conservative normalization and conflict review; no CAD authority."""
import argparse
from collections import defaultdict
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re
import sys

UNIT = re.compile(r"^\s*([+-]?\d+(?:,\d{3})*(?:\.\d+)?)\s*(mm|cm|in|inch|inches|ft|lb|lbs|kg|V|volt|volts)\s*$",re.I)
FACTORS = {"mm":("mm",Decimal("1")),"cm":("mm",Decimal("10")),
"in":("mm",Decimal("25.4")),"inch":("mm",Decimal("25.4")),"inches":("mm",Decimal("25.4")),
"ft":("mm",Decimal("304.8")),"lb":("kg",Decimal("0.45359237")),"lbs":("kg",Decimal("0.45359237")),
"kg":("kg",Decimal("1")),"v":("V",Decimal("1")),"volt":("V",Decimal("1")),"volts":("V",Decimal("1"))}
DIMENSIONS = {"wheelbase","cab_to_axle","overall_length","frame_width"}
WEIGHTS = {"gvwr","gawr","curb_weight","payload"}
def digest(path):
 h=hashlib.sha256()
 with path.open("rb") as f:
  for block in iter(lambda:f.read(1024*1024),b""):h.update(block)
 return h.hexdigest()
def process(root,vehicle,year,cid):
 if vehicle not in ("F-450","F-550","E-450") or not 2000<=year<=2100 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,95}",cid):
  raise ValueError("INVALID_CONFIGURATION")
 base=root/"Ford"/vehicle/str(year)
 registry=json.loads((base/"Configurations"/"registry.json").read_text(encoding="utf-8"))
 cfg=next((c for c in registry["configurations"] if c["id"]==cid),None)
 if not cfg:raise ValueError("CONFIGURATION_NOT_FOUND")
 folder=base/"Evidence"/"ExtractedPagesV12A"/cid
 data=json.loads((folder/"engineering-parameters-v12d.json").read_text(encoding="utf-8"))
 if (data.get("schema")!="fun.engineering.parameters.v12d" or data.get("vehicle")!=vehicle or
     data.get("year")!=year or data.get("configurationId")!=cid or
     data.get("candidateCount")!=len(data.get("candidates",[])) or data.get("engineeringApproved") is not False):
  raise ValueError("PARAMETER_PROVENANCE_HOLD")
 manifest={s["id"]:s for s in json.loads((base/"Sources"/"manifest.json").read_text(encoding="utf-8"))["sources"]}
 for sid in cfg["sourceIds"]:
  s=manifest.get(sid)
  if not s or s.get("storedName")!=sid+".pdf" or digest(base/"Sources"/(sid+".pdf"))!=sid:
   raise ValueError("SOURCE_INTEGRITY_HOLD")
 results=[];groups=defaultdict(list)
 for c in data["candidates"]:
  if c.get("sourceSha256") not in cfg["sourceIds"]:raise ValueError("UNKNOWN_CANDIDATE_SOURCE")
  if not isinstance(c.get("page"),int) or c["page"]<1:raise ValueError("INVALID_CANDIDATE_PAGE")
  parameter=c["parameter"];raw=c.get("rawValueCell","")
  match=UNIT.fullmatch(raw) if isinstance(raw,str) else None
  normalized=None;unit=None;reason="NO_EXACT_VALUE_AND_UNIT"
  if match:
   try:
    number=Decimal(match.group(1).replace(",",""))
    unit,factor=FACTORS[match.group(2).lower()]
    if (parameter in DIMENSIONS and unit=="mm" or parameter in WEIGHTS and unit=="kg" or parameter=="voltage" and unit=="V") and number>=0:
     normalized=str(number*factor);reason="EXACT_CELL_UNIT_CONVERSION_ONLY"
    else:unit=None;reason="INCOMPATIBLE_PARAMETER_UNIT"
   except InvalidOperation:reason="INVALID_NUMBER"
  # Explicit table mentions do not prove which column/configuration the value applies to.
  record={"candidateId":c["id"],"parameter":parameter,"rawValueCell":raw,
    "normalizedCandidate":normalized,"normalizedUnit":unit if normalized is not None else None,
    "conversionBasis":reason,"modelApplicability":"UNDETERMINED",
    "cabApplicability":"UNDETERMINED","wheelbaseApplicability":"UNDETERMINED",
    "sourceSha256":c["sourceSha256"],"page":c["page"],"tableId":c["tableId"],
    "valueRow":c["valueRow"],"valueColumn":c["valueColumn"],
    "reviewStatus":"NEEDS_HUMAN_REVIEW","approvedForEngineering":False,
    "cadExportEligible":False}
  results.append(record)
  if normalized is not None:groups[(parameter,unit)].append(record)
 conflicts=[]
 for (parameter,unit),records in groups.items():
  distinct=sorted(set(r["normalizedCandidate"] for r in records),key=Decimal)
  if len(distinct)>1:
   conflicts.append({"parameter":parameter,"unit":unit,"distinctValues":distinct,
    "candidateIds":[r["candidateId"] for r in records],
    "status":"POTENTIAL_CONFLICT_REQUIRES_CONFIGURATION_REVIEW"})
 return folder,{"schema":"fun.engineering.review.v12e","vehicle":vehicle,"year":year,
  "configurationId":cid,"sourceCandidates":len(results),
  "exactUnitConversions":sum(r["normalizedCandidate"] is not None for r in results),
  "potentialConflictGroups":len(conflicts),"conflicts":conflicts,
  "records":results,"engineeringApproved":False,"cadExportEligible":False}
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--root",required=True,type=Path);p.add_argument("--vehicle",default="F-450")
 p.add_argument("--year",default=2021,type=int);p.add_argument("--id",required=True)
 a=p.parse_args()
 try:
  folder,result=process(a.root,a.vehicle,a.year,a.id)
  out=folder/"engineering-review-v12e.json"
  payload=json.dumps(result,indent=2,ensure_ascii=False)+"\n"
  if out.exists():
   if out.read_text(encoding="utf-8")!=payload:raise ValueError("EXISTING_REVIEW_CONFLICT")
   state="EXISTS"
  else:
   with out.open("x",encoding="utf-8") as f:f.write(payload)
   state="CREATED"
  print(json.dumps({"state":"FUN_V12E_REVIEW_"+state,"candidates":result["sourceCandidates"],
   "exactUnitConversions":result["exactUnitConversions"],
   "potentialConflictGroups":result["potentialConflictGroups"],"cadExportEligible":False,
   "output":str(out)},indent=2))
  return 0
 except Exception as e:
  print("FUN_V12E_HOLD="+str(e),file=sys.stderr);return 1
if __name__=="__main__":sys.exit(main())
