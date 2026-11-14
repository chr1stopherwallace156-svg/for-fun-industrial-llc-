#!/usr/bin/env python3
"""Index extracted Ford PDF text into unverified engineering evidence candidates."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

CATEGORIES = {
    "chassis_geometry": (r"wheelbase|frame rail|cab.to.axle|overall length|track width|ground clearance|mounting", "CAD"),
    "vehicle_ratings": (r"GVWR|GAWR|curb weight|payload|gross combination|axle rating", "Simulations"),
    "electrical": (r"connector|pinout|circuit|fuse|ground|wiring|voltage", "Wiring"),
    "components": (r"part number|component|alternator|battery|transmission", "Components"),
    "compliance": (r"FMVSS|incomplete vehicle|certification|compliance|restriction", "Evidence")
}
def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda:f.read(1024*1024),b""):h.update(b)
    return h.hexdigest()
def build(root,vehicle,year,config_id):
    if vehicle not in ("F-450","F-550","E-450") or not 2000<=year<=2100 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,95}",config_id):
        raise ValueError("INVALID_CONFIGURATION")
    base=root/"Ford"/vehicle/str(year)
    registry=json.loads((base/"Configurations"/"registry.json").read_text(encoding="utf-8"))
    config=next((c for c in registry["configurations"] if c["id"]==config_id),None)
    if not config:raise ValueError("CONFIGURATION_NOT_FOUND")
    manifest=json.loads((base/"Sources"/"manifest.json").read_text(encoding="utf-8"))
    sources={s["id"]:s for s in manifest["sources"]}
    folder=base/"Evidence"/"ExtractedPagesV12A"/config_id
    candidates=[];document_counts=[]
    for sid in config["sourceIds"]:
        source=sources.get(sid)
        if not source or source.get("storedName")!=sid+".pdf":raise ValueError("INVALID_SOURCE_MANIFEST")
        pdf=base/"Sources"/(sid+".pdf")
        if sha(pdf)!=sid:raise ValueError("SOURCE_HASH_MISMATCH")
        extraction=json.loads((folder/(sid+".pages.json")).read_text(encoding="utf-8"))
        if extraction.get("schema")!="fun.pdf.pages.v12a" or extraction.get("sourceSha256")!=sid or extraction.get("configurationId")!=config_id or extraction.get("year")!=year or extraction.get("vehicle")!=vehicle:raise ValueError("EXTRACTION_PROVENANCE_MISMATCH")
        if extraction.get("partial") or extraction.get("processedPages")!=extraction.get("totalPages") or len(extraction.get("pages",[]))!=extraction.get("totalPages"):raise ValueError("INCOMPLETE_EXTRACTION_HOLD")
        count=0
        for p in extraction["pages"]:
            if not isinstance(p.get("page"),int) or p["page"]<1:raise ValueError("INVALID_PAGE")
            for line_no,line in enumerate(p.get("text","").splitlines(),1):
                line=line.strip()
                if not line or len(line)>600:continue
                for category,(pattern,destination) in CATEGORIES.items():
                    if re.search(pattern,line,re.IGNORECASE):
                        key=f"{sid}:{p['page']}:{line_no}:{category}:{line}"
                        candidates.append({"id":hashlib.sha256(key.encode()).hexdigest(),"sourceSha256":sid,"document":source["originalName"],"page":p["page"],"line":line_no,"category":category,"proposedDestination":destination,"excerpt":line,"value":None,"units":None,"status":"NEEDS_HUMAN_REVIEW","approvedForEngineering":False})
                        count+=1
        document_counts.append({"document":source["originalName"],"pages":extraction["totalPages"],"candidates":count})
    return {"schema":"fun.evidence.index.v12b","vehicle":vehicle,"year":year,"configurationId":config_id,"candidateCount":len(candidates),"documents":document_counts,"candidates":candidates,"engineeringApproved":False,"autoPromoted":False}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",required=True,type=Path)
    p.add_argument("--vehicle",default="F-450")
    p.add_argument("--year",type=int,default=2021)
    p.add_argument("--id",required=True)
    args=p.parse_args()
    try:
        data=build(args.root,args.vehicle,args.year,args.id)
        out=args.root/"Ford"/args.vehicle/str(args.year)/"Evidence"/"ExtractedPagesV12A"/args.id/"engineering-index-v12b.json"
        encoded=json.dumps(data,ensure_ascii=False,indent=2)+"\n"
        if out.exists():
            if out.read_text(encoding="utf-8")!=encoded:raise ValueError("INDEX_ALREADY_EXISTS_DIFFERENT_CONTENT")
            state="EXISTS"
        else:
            with out.open("x",encoding="utf-8") as f:f.write(encoded)
            state="CREATED"
        print(json.dumps({"state":"FUN_V12B_INDEX_"+state,"documents":len(data["documents"]),"pages":sum(d["pages"] for d in data["documents"]),"candidates":data["candidateCount"],"output":str(out),"engineeringApproved":False},indent=2))
    except Exception as e:
        print("FUN_V12B_HOLD="+str(e),file=sys.stderr);return 1
    return 0
if __name__=="__main__":sys.exit(main())
