#!/usr/bin/env python3
"""Offline, bounded, provenance-preserving PDF page text extraction."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def run(root, vehicle, year, config_id, max_pages, max_chars):
    if vehicle not in ("F-450", "F-550", "E-450") or not 2000 <= year <= 2100:
        raise ValueError("INVALID_VEHICLE_YEAR")
    if not config_id or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-" for ch in config_id) or len(config_id) > 96:
        raise ValueError("INVALID_CONFIGURATION_ID")
    base = root / "Ford" / vehicle / str(year)
    registry = json.loads((base / "Configurations" / "registry.json").read_text(encoding="utf-8"))
    config = next((c for c in registry["configurations"] if c["id"] == config_id), None)
    if config is None:
        raise ValueError("CONFIGURATION_NOT_FOUND")
    manifest = json.loads((base / "Sources" / "manifest.json").read_text(encoding="utf-8"))
    sources = {s["id"]: s for s in manifest["sources"]}
    import fitz
    destination = base / "Evidence" / "ExtractedPagesV12A" / config_id
    destination.mkdir(parents=True, exist_ok=True)
    results = []
    for source_id in config["sourceIds"]:
        source = sources.get(source_id)
        if not source or source.get("sha256") != source_id or not source.get("storedName", "").endswith(".pdf"):
            raise ValueError("INVALID_PDF_MANIFEST")
        filename = source["storedName"]
        if filename != source_id + ".pdf":
            raise ValueError("INVALID_SOURCE_FILENAME")
        pdf = base / "Sources" / filename
        if digest(pdf) != source_id:
            raise ValueError("SOURCE_HASH_MISMATCH")
        output = destination / (source_id + ".pages.json")
        if output.exists():
            data = json.loads(output.read_text(encoding="utf-8"))
            if data.get("sourceSha256") != source_id or data.get("schema") != "fun.pdf.pages.v12a":
                raise ValueError("EXISTING_EXTRACTION_CONFLICT")
            results.append({"source": source["originalName"], "state": "EXISTS", "pages": data["processedPages"], "output": str(output)})
            continue
        pages = []
        with fitz.open(str(pdf)) as doc:
            count = len(doc)
            for index in range(min(count, max_pages)):
                page = doc.load_page(index)
                text = page.get_text("text", sort=True)
                pages.append({"page": index + 1, "text": text[:max_chars], "truncated": len(text) > max_chars, "characters": len(text), "reviewStatus": "UNVERIFIED"})
        result = {"schema": "fun.pdf.pages.v12a", "vehicle": vehicle, "year": year, "configurationId": config_id, "sourceSha256": source_id, "originalName": source["originalName"], "sourceUrl": source.get("sourceUrl"), "totalPages": count, "processedPages": len(pages), "partial": len(pages) < count, "engineeringApproved": False, "pages": pages}
        # Exclusive creation prevents accidental replacement of existing extraction.
        with output.open("x", encoding="utf-8") as handle:
            json.dump(result, handle, ensure_ascii=False, indent=2)
        results.append({"source": source["originalName"], "state": "EXTRACTED", "pages": len(pages), "totalPages": count, "partial": len(pages) < count, "output": str(output)})
    return results

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--vehicle", default="F-450")
    parser.add_argument("--year", default=2021, type=int)
    parser.add_argument("--id", required=True)
    parser.add_argument("--max-pages", default=1000, type=int)
    parser.add_argument("--max-chars", default=100000, type=int)
    args = parser.parse_args()
    if not 1 <= args.max_pages <= 5000 or not 100 <= args.max_chars <= 1000000:
        parser.error("INVALID_RESOURCE_BUDGET")
    try:
        results = run(args.root, args.vehicle, args.year, args.id, args.max_pages, args.max_chars)
        print(json.dumps({"state": "FUN_V12A_EXTRACTION_COMPLETE", "documents": len(results), "results": results, "engineeringApproved": False}, indent=2))
    except Exception as exc:
        print("FUN_V12A_HOLD=" + str(exc), file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
