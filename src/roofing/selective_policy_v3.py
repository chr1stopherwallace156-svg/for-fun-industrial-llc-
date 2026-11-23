"""Deterministic, conservative roof-target extraction policy.

This scores *research priority*, never roof condition or commercial probability.
Absent permits are not evidence that a roof was never replaced. Preserve unknown
properties in an enrichment hold; discard only demonstrably out-of-scope records.
"""
from __future__ import annotations
import datetime as dt
import re

VERSION = "fun-roofing-selective-v3"
MIN_BUILDING_AGE = 20

# Use only unambiguous public land-use descriptors for exclusions. Ambiguous
# classification codes and "mixed use" are review holds, never silent rejects.
EXPLICIT_NONRESIDENTIAL = re.compile(
    r"(?:^|\b)(?:industrial|commercial|retail|warehouse|office building|"
    r"manufacturing|government facility|public school|church|vacant land|"
    r"parking lot|agricultural land)(?:\b|$)", re.I
)
AMBIGUOUS_TYPE = re.compile(
    r"\b(?:mixed.use|apartment|multifamily|multi.family|duplex|condominium)\b", re.I
)

def property_decision(*, year_built=None, land_use="", residential=0,
                      address="", zip_code="", apn="", today=None):
    """Return KEEP, HOLD or DROP + reason; no personal/owner fields needed."""
    today = today or dt.date.today()
    use = str(land_use or "").strip()
    yr = year_built if isinstance(year_built, int) and not isinstance(year_built, bool) else None
    if EXPLICIT_NONRESIDENTIAL.search(use) and not re.search(r"\bresidential\b", use, re.I):
        return ("DROP", "KNOWN_NONRESIDENTIAL")
    if yr is not None and yr > today.year - MIN_BUILDING_AGE:
        # A younger building with no observed roof permit is still a candidate
        # for later review; newer does not mean it never needs roofing work.
        return ("HOLD", "NEWER_PROPERTY_LOWER_PRIORITY")
    if not str(apn or "").strip() and not (address and zip_code):
        return ("DROP", "MISSING_PARCEL_AND_LOCATION")
    if not address or not zip_code:
        return ("HOLD", "ADDRESS_OR_ZIP_UNAVAILABLE")
    if yr is None:
        return ("HOLD", "YEAR_BUILT_UNVERIFIED")
    if residential != 1 or AMBIGUOUS_TYPE.search(use):
        return ("HOLD", "PROPERTY_TYPE_UNVERIFIED")
    return ("KEEP", "OLDER_RESIDENTIAL_VERIFICATION")

def score_candidate(*, year_built=None, last_roof_permit=None, residential=0,
                    apn="", address="", zip_code="", today=None):
    """Bounded 0–100 heuristic, with transparent factors (not a probability)."""
    today = today or dt.date.today()
    age = today.year - year_built if isinstance(year_built, int) else None
    age_factor = max(0.0, min(1.0, (age - 15) / 30.0)) if age is not None else 0.0
    permit_year = None
    if isinstance(last_roof_permit, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", last_roof_permit):
        try:
            permit_year = dt.date.fromisoformat(last_roof_permit).year
        except ValueError:
            permit_year = None
    old_permit = 1.0 if permit_year is not None and today.year - permit_year >= 20 else 0.0
    no_observed_permit = 1.0 if permit_year is None else 0.0
    house_factor = 1.0 if residential == 1 else 0.25
    evidence_factor = sum((bool(apn), bool(address), bool(zip_code),
                           age is not None, residential == 1)) / 5.0
    score = round(40*age_factor + 20*old_permit + 10*no_observed_permit +
                  15*house_factor + 15*evidence_factor)
    return max(0, min(100, score))

def research_tier(*, address="", zip_code="", year_built=None, residential=0,
                  last_roof_permit=None, today=None):
    if not address or not zip_code:
        return "HOLD_NEEDS_ADDRESS"
    if year_built is None:
        return "HOLD_NEEDS_BUILDING_YEAR"
    if residential != 1:
        return "HOLD_VERIFY_RESIDENTIAL_CLASSIFICATION"
    if last_roof_permit:
        try:
            if (today or dt.date.today()).year - dt.date.fromisoformat(last_roof_permit).year < 10:
                return "LOW_PRIORITY_RECENT_ROOF_RECORD_NOT_PROOF_OF_REPLACEMENT"
        except (TypeError, ValueError):
            pass
    return "READY_FOR_PERMIT_AND_INSPECTION_VERIFICATION"
