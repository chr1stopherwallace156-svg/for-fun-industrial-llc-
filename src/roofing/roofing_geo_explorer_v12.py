"""V12 read-only geographic ZIP reference and street-block drill-down.

ZIP reference coordinates are GeoNames postal-code locations (not roof, street,
parcel or permit coordinates). No network, GIS lookup, geocoding, owner data,
SQLite writes or automatic outreach. The local V9 quartet must reconcile first.
GeoNames US postal codes, CC BY 4.0, refreshed 2026-08-15.
https://download.geonames.org/export/zip/US.zip
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

from roofing_opportunities_v10 import (
    read_offers, _file_rows, PATHWAYS, ZIP
)

VERSION="fun-roofing-zip-street-explorer-v12"
# Postal ZIP reference points only; positions must NEVER be interpreted as
# parcel, block, street-center, roof or property geocoding.
ZIP_REFERENCES={
    "90011":(34.0079,-118.2582),
    "90037":(34.0030,-118.2863),
    "90049":(34.0660,-118.4740),
    "90731":(33.7339,-118.2914),
}
SAFE_BLOCK=re.compile(r"^[A-Za-z0-9 .,&'()/#-]{1,180}$")
MAX_LIMIT=50
MAX_OFFSET=20000

def explore(root, *, zip_code=None, pathway=None, block=None,
            mode="blocks", offset=0, limit=25):
    if mode not in ("blocks","properties"):
        raise ValueError("ZIP_EXPLORER_VIEW_INVALID")
    if zip_code is not None and (not isinstance(zip_code,str) or not ZIP.fullmatch(zip_code)):
        raise ValueError("ZIP_EXPLORER_ZIP_INVALID")
    if pathway is not None and pathway not in PATHWAYS:
        raise ValueError("ZIP_EXPLORER_PATHWAY_INVALID")
    if block is not None and (not isinstance(block,str) or not SAFE_BLOCK.fullmatch(block)):
        raise ValueError("ZIP_EXPLORER_BLOCK_INVALID")
    if not isinstance(offset,int) or isinstance(offset,bool) or not 0<=offset<=MAX_OFFSET:
        raise ValueError("ZIP_EXPLORER_OFFSET_INVALID")
    if not isinstance(limit,int) or isinstance(limit,bool) or not 1<=limit<=MAX_LIMIT:
        raise ValueError("ZIP_EXPLORER_LIMIT_INVALID")
    if mode=="properties" and (not zip_code or not block):
        raise ValueError("ZIP_EXPLORER_PROPERTY_SCOPE_REQUIRED")
    summary=read_offers(root)
    if summary["state"]!="READY_FROM_RECONCILED_LOCAL_V9_REPORTS":
        return {"version":VERSION,"state":summary["state"],
                "read_only":True,"no_outreach":True}
    root=Path(root)
    folder=root/"research_exports"
    stamp=summary["report_snapshot"]
    block_rows=_file_rows(folder/f"roofing_ranked_street_blocks_{stamp}.csv",
                           folder,"ranked_street_blocks")
    property_rows=_file_rows(folder/f"roofing_qualified_property_research_{stamp}.csv",
                              folder,"qualified_property_research")
    from roofing_opportunities_v10 import _pathway, _integer
    known={z["zip"] for z in summary["zips"]}
    if zip_code is not None and zip_code not in known:
        raise ValueError("ZIP_EXPLORER_ZIP_NOT_IN_REPORT")
    blocks={}
    for r in block_rows:
        key=(r["zip"],r["street_number_block"])
        blocks[key]={
            "zip":r["zip"],"street_number_block":r["street_number_block"],
            "rank":_integer(r["rank"]),
            "recent_permit_parcels":_integer(r["recent_permit_parcels_in_street_block"]),
            "all_count":0,"HISTORICAL":0,"NO_MATCH":0,"OTHER":0,
        }
    cohorts={}
    for p in property_rows:
        key=(p["zip"],p["street_number_block"])
        label=_pathway(p)
        blocks[key][label]+=1
        blocks[key]["all_count"]+=1
        if mode=="properties" and key==(zip_code,block) and (
            pathway is None or label==pathway):
            cohorts.setdefault(key,[]).append({
                "zip":p["zip"],"street_number_block":p["street_number_block"],
                "address":p["address"],
                "construction_year":_integer(p["construction_year"]),
                "existing_formula_a_priority":_integer(p["formula_a_existing_priority"]),
                "last_recorded_exact_parcel_roof_permit":
                    p["last_recorded_exact_apn_roof_permit"] or None,
                "recent_age_matched_peer_permit_parcels":
                    _integer(p["other_properties_with_recent_exact_apn_permit"]),
                "pathway":label,
                "roof_condition_verified":False,
            })
    present=(
      [{"zip":z["zip"],"lat":ZIP_REFERENCES[z["zip"]][0],
        "lon":ZIP_REFERENCES[z["zip"]][1],"qualified_properties":z["qualified_properties"],
        "qualified_blocks":z["qualified_blocks"],
        "historical":z["historical"],"no_match":z["no_match"]}
       for z in summary["zips"] if z["zip"] in ZIP_REFERENCES]
    )
    base={
        "version":VERSION,"state":"ZIP_STREET_RESEARCH_READY",
        "report_snapshot":stamp,"mode":mode,
        "zip":zip_code,"pathway":pathway,"block":block,
        "zip_reference_points":present,
        "unmapped_zips":[z["zip"] for z in summary["zips"]
                         if z["zip"] not in ZIP_REFERENCES],
        "coordinate_meaning":"ZIP_POSTAL_REFERENCE_ONLY_NOT_STREET_OR_PARCEL",
        "coordinate_source":"GeoNames US postal codes, CC BY 4.0, 2026-08-15",
        "has_geocoded_streets_or_properties":False,
        "read_only":True,"no_outreach":True,
        "last_recorded_permit_not_roof_age":True,
        "no_matching_permit_not_no_roof_work":True,
    }
    if mode=="blocks":
        entries=[v for (z,name),v in blocks.items()
                 if (zip_code is None or z==zip_code)
                 and (block is None or name==block)
                 and (pathway is None or v[pathway]>0)]
        entries.sort(key=lambda v:(- (v[pathway] if pathway else v["all_count"]),
                                  -v["recent_permit_parcels"],v["zip"],v["street_number_block"]))
        sliced=entries[offset:offset+limit]
        base.update({"total":len(entries),"offset":offset,
                     "has_more":offset+limit<len(entries),
                     "rows":[{
                         "zip":v["zip"],"street_number_block":v["street_number_block"],
                         "rank_in_original_v9":v["rank"],
                         "qualified_in_view":v[pathway] if pathway else v["all_count"],
                         "total_qualified":v["all_count"],
                         "historical":v["HISTORICAL"],
                         "no_match":v["NO_MATCH"],
                         "other":v["OTHER"],
                         "recent_permit_parcels":v["recent_permit_parcels"],
                     } for v in sliced]})
    else:
        if (zip_code,block) not in blocks:
            raise ValueError("ZIP_EXPLORER_BLOCK_NOT_IN_REPORT")
        rows=cohorts.get((zip_code,block),[])
        rows.sort(key=lambda r:(-r["recent_age_matched_peer_permit_parcels"],
                                -r["existing_formula_a_priority"],r["address"]))
        base.update({"total":len(rows),"offset":offset,
                     "has_more":offset+limit<len(rows),
                     "rows":rows[offset:offset+limit]})
    return base

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",required=True)
    p.add_argument("--zip",default=None)
    p.add_argument("--pathway",choices=PATHWAYS,default=None)
    p.add_argument("--block",default=None)
    p.add_argument("--mode",choices=("blocks","properties"),default="blocks")
    p.add_argument("--offset",type=int,default=0)
    p.add_argument("--limit",type=int,default=25)
    a=p.parse_args()
    print(json.dumps(explore(a.root,zip_code=a.zip,pathway=a.pathway,
        block=a.block,mode=a.mode,offset=a.offset,limit=a.limit),
        sort_keys=True,separators=(",",":")))

if __name__=="__main__":
    try:main()
    except (ValueError,OSError) as exc:
        name=str(exc) if isinstance(exc,ValueError) else type(exc).__name__
        print("ZIP_EXPLORER_HOLD="+name[:140],file=sys.stderr)
        sys.exit(1)
