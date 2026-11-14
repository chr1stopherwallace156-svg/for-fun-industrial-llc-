# V12B: engineering evidence candidate index

Run after V12A to classify page/line excerpts by keyword into CAD, Wiring, Components, Simulations, and Evidence *review destinations*. This is deterministic candidate discovery, not dimension extraction or technical validation. Candidate `value` and `units` are deliberately null. A keyword match is not proof that a statement applies to the selected F-450 configuration.

The index is written under `Evidence/ExtractedPagesV12A/<configuration>/engineering-index-v12b.json`. Source PDFs are SHA-256 rechecked and extracted JSON must have matching vehicle/year/configuration/source identifiers and complete page counts. Existing index is not overwritten; a changed result holds.

Run: `python src/vehicle-library/index-v12b.py --root <VehicleLibrary> --vehicle F-450 --year 2021 --id F450-2021-REFERENCE`.

Future V12C: document section/table parsing, dimensional unit normalization, explicit model applicability, engineer review, and approved input exports. No automatic CAD generation or manufacturing approval here.
