"""Conservative street-block cohort analysis for Fun Industrial roofing research.

A street 100-block is only a proximity proxy, NOT measured physical distance.
Does not assert leaks, roof condition, reroof completion or sales probability.
Only exact APN matches and completed official LA City roof permit sources count.
Read-only; no network, persistent DB changes, outreach or personal contact data.
"""
from __future__ import annotations

import datetime as dt
import re
import sqlite3
from bisect import bisect_left, bisect_right
from collections import Counter, defaultdict
from heapq import heappush, heapreplace

VERSION = "fun-roofing-street-block-cohorts-v5"
BLOCK = re.compile(r"^\s*(\d{1,6})\s+(.{3,90}?)\s*$")
UNIT = re.compile(r"(?:^|\s)(?:UNIT|APT|APARTMENT|STE|SUITE|FL|FLOOR|LOT|#)\b|[/#]", re.I)
SOURCE_LIMIT = ("la_permits_pre2010","la_permits_2010_2019","la_permits_2020_present")

def street_block(address):
    """A deliberately strict parcel-level proxy, not a geospatial distance."""
    if not isinstance(address,str) or len(address)>125 or UNIT.search(address):
        return None
    match=BLOCK.fullmatch(address.strip())
    if not match:
        return None
    street=re.sub(r"\s+", " ",match.group(2).upper().replace(".", "").replace(",","")).strip()
    if not street or not re.search(r"[A-Z]",street):
        return None
    # Only compare houses on same named street and same numeric 100-block.
    return (street,int(match.group(1))//100)

def _subtract_years(day, years):
    try:return day.replace(year=day.year-years)
    except ValueError:return day.replace(year=day.year-years,day=28)

def neighbor_context(conn, *, zips, today, recent_years, min_building_age,
                     kind, city, peer_years=5, min_peers=5):
    """Aggregate age-matched peers with recent roof-related permits by block.

    Each candidate's peers exclude its own APN. Only cohorts of at least
    min_peers yield a signal. Emit aggregated ZIP results, not identities.
    """
    if not 0<=peer_years<=15 or not 3<=min_peers<=30:
        raise ValueError("NEIGHBOR_FILTERS_INVALID")
    if not isinstance(today,dt.date):raise ValueError("NEIGHBOR_DATE_INVALID")
    placeholders=",".join("?" for _ in zips)
    params=("Los Angeles",city,today.year-min_building_age,*zips)
    property_sql=f"""SELECT zip,apn,address,year_built
        FROM roofing_selection_candidates_v3
        WHERE disposition='KEEP' AND county=? AND city=?
         AND year_built IS NOT NULL AND year_built<=?
         AND zip IN ({placeholders})
         AND address IS NOT NULL AND address!=''
        ORDER BY zip,apn"""
    blocks=defaultdict(list)
    available=Counter()
    invalid=Counter()
    total=Counter()
    for p in conn.execute(property_sql,params):
        zip_code=p["zip"]
        total[zip_code]+=1
        key=street_block(p["address"])
        if key is None or not p["apn"]:
            invalid[zip_code]+=1
            continue
        blocks[(zip_code,*key)].append((int(p["year_built"]),str(p["apn"])))
        available[zip_code]+=1

    # Only recent permit events are needed for this independent third method.
    low=_subtract_years(today,recent_years).isoformat()
    q=f"""SELECT DISTINCT s.zip, e.apn
        FROM roofing_selection_candidates_v3 s
        JOIN permits e ON e.county=s.county AND e.apn=s.apn
        WHERE s.disposition='KEEP' AND s.county=? AND s.city=?
         AND s.year_built<=? AND s.zip IN ({placeholders})
         AND e.source_id IN (?,?,?)
         AND e.issue_date>=? AND e.issue_date<=?"""
    args=(*params,*SOURCE_LIMIT,low,today.isoformat())
    if kind=="replacement_like":
        q+=" AND e.roof_class='REPLACEMENT_LIKE'"
    recent_by_zip=defaultdict(set)
    for row in conn.execute(q,args):
        recent_by_zip[row["zip"]].add(str(row["apn"]))

    # Keep only a bounded handful of *research examples*, not a separate
    # contactable target database. Public APN is an identifier, not a roof age.
    examples_heap=[]
    out=defaultdict(lambda:{"eligible_properties_no_recent_exact_apn_permit":0,
        "candidates_with_enough_age_similar_street_block_peers":0,
        "candidates_with_at_least_two_recent_peer_permits":0,
        "blocks_with_qualifying_age_cohort":set(),
        "peer_permits_across_candidate_windows":0,
        "peers_across_candidate_windows":0})
    for (z,street,num),group in blocks.items():
        group.sort()
        years_list=[year for year,_ in group]
        recent_flags=[1 if apn in recent_by_zip[z] else 0 for _,apn in group]
        prefix=[0]
        for flag in recent_flags:prefix.append(prefix[-1]+flag)
        for i,(year,apn) in enumerate(group):
            if apn in recent_by_zip[z]:
                continue
            target=out[z]
            target["eligible_properties_no_recent_exact_apn_permit"]+=1
            lo=bisect_left(years_list,year-peer_years)
            hi=bisect_right(years_list,year+peer_years)
            peers=hi-lo-1
            if peers<min_peers:continue
            recent_peer_count=prefix[hi]-prefix[lo] # candidate itself is not recent
            target["candidates_with_enough_age_similar_street_block_peers"]+=1
            target["peers_across_candidate_windows"]+=peers
            target["peer_permits_across_candidate_windows"]+=recent_peer_count
            target["blocks_with_qualifying_age_cohort"].add((street,num))
            if recent_peer_count>=2:
                target["candidates_with_at_least_two_recent_peer_permits"]+=1
                # Prefer multiple independently recorded neighbor parcels and
                # relatively dense peer cohorts, deterministically by APN.
                example=(recent_peer_count,round(recent_peer_count/peers,5),z,str(apn),year,peers)
                if len(examples_heap)<25:heappush(examples_heap,example)
                elif example>examples_heap[0]:heapreplace(examples_heap,example)
    results={}
    for z in zips:
        x=out[z]
        n=x["candidates_with_enough_age_similar_street_block_peers"]
        peers=x["peers_across_candidate_windows"]
        recent=len(recent_by_zip[z])
        selected=total[z]
        peer_share=(100*x["peer_permits_across_candidate_windows"]/peers) if peers else None
        zip_share=(100*recent/selected) if selected else None
        # Context comparison is descriptive, *not* a calibrated likelihood.
        # Small or empty ZIP baselines never produce inflated/infinite lift.
        reference_lift=(round(peer_share/zip_share,2)
                        if peer_share is not None and zip_share is not None
                        and zip_share>0 and n>=min_peers else None)
        results[z]={
            "method":"same_100_number_street_block_and_build_year_cohort_proxy",
            "construction_age_tolerance_plus_minus_years":peer_years,
            "minimum_other_houses_in_cohort":min_peers,
            "street_block_address_parseable_properties":available[z],
            "insufficient_address_precision_or_unit_ambiguity":invalid[z],
            "eligible_properties_without_recent_exact_apn_permit":x["eligible_properties_no_recent_exact_apn_permit"],
            "candidates_with_enough_age_similar_street_block_peers":n,
            "candidates_with_two_or_more_recent_peer_roof_permits":
                x["candidates_with_at_least_two_recent_peer_permits"],
            "blocks_with_qualifying_age_cohort":
                len(x["blocks_with_qualifying_age_cohort"]),
            "age_matched_peer_permit_window_share_pct":
                round(peer_share,2) if peer_share is not None else None,
            "zip_referenced_recent_apn_permit_share_pct":
                round(zip_share,2) if zip_share is not None else None,
            "peer_activity_relative_to_zip_reference_ratio":reference_lift,
            "repeat_window_observations_are_not_independent":True,
            "individual_property_damage_or_new_roof_need_verified":False,
            "physical_distance_measured":False,
        }
    limited_examples=[{
         "zip":z, "apn":apn, "construction_year":year,
         "similar_age_same_street_block_neighbors":peers,
         "other_parcels_with_recent_roof_permits":recent_count,
         "neighbor_recorded_permit_share_pct":round(100*rate,1),
         "roof_condition_and_replacement_need":"UNVERIFIED",
         "physical_distance_measured":False,
        } for recent_count,rate,z,apn,year,peers
          in sorted(examples_heap,reverse=True)]
    return {"version":VERSION,
       "public_research_examples":limited_examples,
       "formula_c_neighborhood_context":{
           "window":"street_number_100_block_not_actual_geographic_distance",
           "not_able_to_infer_leaks_or_worn_shingles":True,
           "observed_permit_work_not_proof_of_roof_replacement":True,
           "age_cohorts_compare_construction_year_not_actual_roof_age":True,
           "zips":results,
       }}
