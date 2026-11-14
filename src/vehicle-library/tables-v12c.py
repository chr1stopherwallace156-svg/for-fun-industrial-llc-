#!/usr/bin/env python3
"""Read-only, provenance-linked Ford PDF table extraction. No engineering approval."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

VEHICLES = ("F-450", "F-550", "E-450")
MODEL_RE = re.compile(r"(?<!\w)(F[- ]?350|F[- ]?450|F[- ]?550|E[- ]?450)(?!\w)", re.I)
UNIT_RE = re.compile(r"(?<![a-z])(?:mm|cm|inches|inch|in\.|lbs?\.?|kg|ft|volts?|amps?|kW|kWh|Nm|lb-ft)(?![a-z])", re.I)
NUMBER_RE = re.compile(r"(?<![\w])[-+]?\d[\d,]*(?:\.\d+)?(?![\w])")
TOPICS = {
    "CAD": re.compile(r"wheelbase|frame|cab.to.axle|length|width|height|clearance|mount", re.I),
    "Simulations": re.compile(r"GVWR|GAWR|weight|payload|rating|capacity|mass", re.I),
    "Wiring": re.compile(r"connector|pin|fuse|wire|circuit|voltage|ground", re.I),
    "Components": re.compile(r"part|component|alternator|battery|transmission", re.I),
    "Evidence": re.compile(r"FMVSS|certification|compliance|restriction", re.I),
}
def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""): h.update(chunk)
    return h.hexdigest()
def normalize(c):
    return re.sub(r"\s+", " ", str(c or "")).strip()[:500]
def main():
    a = argparse.ArgumentParser()
    a.add_argument("--root", type=Path, required=True)
    a.add_argument("--vehicle", default="F-450")
    a.add_argument("--year", type=int, default=2021)
    a.add_argument("--id", required=True)
    a.add_argument("--max-pages", type=int, default=2000)
    a.add_argument("--max-tables", type=int, default=20000)
    args = a.parse_args()
    try:
        if args.vehicle not in VEHICLES or not 2000 <= args.year <= 2100 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,95}", args.id):
            raise ValueError("INVALID_CONFIGURATION")
        if not 1 <= args.max_pages <= 5000 or not 1 <= args.max_tables <= 50000:
            raise ValueError("INVALID_BUDGET")
        import fitz
        base = args.root / "Ford" / args.vehicle / str(args.year)
        registry = json.loads((base / "Configurations" / "registry.json").read_text(encoding="utf-8"))
        config = next((c for c in registry["configurations"] if c["id"] == args.id), None)
        if config is None: raise ValueError("CONFIGURATION_NOT_FOUND")
        sources = {s["id"]: s for s in json.loads((base / "Sources" / "manifest.json").read_text(encoding="utf-8"))["sources"]}
        extracted = base / "Evidence" / "ExtractedPagesV12A" / args.id
        # First validate all inputs before writing output.
        items = []
        total_pages = 0
        for sid in config["sourceIds"]:
            src = sources.get(sid)
            if not src or src.get("storedName") != sid + ".pdf": raise ValueError("INVALID_SOURCE_MANIFEST")
            pdf = base / "Sources" / (sid + ".pdf")
            if sha256(pdf) != sid: raise ValueError("SOURCE_HASH_MISMATCH")
            prior = json.loads((extracted / (sid + ".pages.json")).read_text(encoding="utf-8"))
            if (prior.get("schema") != "fun.pdf.pages.v12a" or prior.get("sourceSha256") != sid
                or prior.get("configurationId") != args.id or prior.get("vehicle") != args.vehicle
                or prior.get("year") != args.year or prior.get("partial")
                or prior.get("processedPages") != prior.get("totalPages")):
                raise ValueError("EXTRACTION_PROVENANCE_HOLD")
            total_pages += prior["totalPages"]
            items.append((sid, src, pdf, prior["totalPages"]))
        if total_pages > args.max_pages: raise ValueError("PAGE_BUDGET_HOLD")
        tables = []
        page_failures = []
        for sid, src, pdf, page_count in items:
            with fitz.open(str(pdf)) as doc:
                if len(doc) != page_count: raise ValueError("PDF_PAGE_COUNT_CHANGED")
                for page_no, page in enumerate(doc, 1):
                    try:
                        found = page.find_tables()
                        for table_index, table in enumerate(found.tables):
                            if len(tables) >= args.max_tables: raise ValueError("TABLE_BUDGET_HOLD")
                            rows = [[normalize(cell) for cell in row] for row in table.extract()]
                            if not rows: continue
                            flat = " ".join(cell for row in rows for cell in row)
                            model_hints = sorted({m.upper().replace(" ", "-").replace("F450","F-450").replace("F350","F-350").replace("F550","F-550").replace("E450","E-450") for m in MODEL_RE.findall(flat)})
                            destination = [name for name, pattern in TOPICS.items() if pattern.search(flat)]
                            bbox = [round(float(v), 2) for v in table.bbox]
                            key = f"{sid}:{page_no}:{table_index}:{bbox}"
                            tables.append({
                                "id": hashlib.sha256(key.encode()).hexdigest(),
                                "sourceSha256": sid, "document": src["originalName"],
                                "page": page_no, "tableIndex": table_index, "bbox": bbox,
                                "rows": rows, "modelMentionsInTable": model_hints,
                                "modelApplicability": "UNDETERMINED",
                                "unitMentions": sorted(set(UNIT_RE.findall(flat)), key=str.lower),
                                "numericTokensPresent": bool(NUMBER_RE.search(flat)),
                                "proposedDestinations": destination,
                                "status": "NEEDS_HUMAN_REVIEW", "approvedForEngineering": False
                            })
                    except ValueError: raise
                    except Exception as exc:
                        page_failures.append({"sourceSha256": sid, "page": page_no, "reason": type(exc).__name__})
        output = {
            "schema": "fun.engineering.tables.v12c", "vehicle": args.vehicle,
            "year": args.year, "configurationId": args.id,
            "documents": len(items), "pagesExamined": total_pages,
            "tablesFound": len(tables), "pageFailures": page_failures,
            "complete": not page_failures, "engineeringApproved": False,
            "autoPromoted": False, "tables": tables
        }
        destination = extracted / "engineering-tables-v12c.json"
        encoded = json.dumps(output, ensure_ascii=False, indent=2) + "\n"
        if destination.exists():
            if destination.read_text(encoding="utf-8") != encoded: raise ValueError("EXISTING_TABLE_INDEX_CONFLICT")
            state = "EXISTS"
        else:
            with destination.open("x", encoding="utf-8") as f: f.write(encoded)
            state = "CREATED"
        print(json.dumps({"state":"FUN_V12C_TABLES_"+state, "documents":len(items),
                          "pages":total_pages,"tables":len(tables),
                          "pageFailures":len(page_failures),"complete":not page_failures,
                          "output":str(destination),"engineeringApproved":False}, indent=2))
        return 0 if not page_failures else 2
    except Exception as exc:
        print("FUN_V12C_HOLD="+str(exc), file=sys.stderr)
        return 1
if __name__ == "__main__": sys.exit(main())
