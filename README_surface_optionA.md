# Evergreen Surface Collections Option A Preview

This preview uses Column I (`corrected_code`) from `surface_collection_parse_qc_JM.csv`.

## Rules used
- Aggregation: by Cabin/Gap + Row.
- Bag numbers are ignored for spatial analysis.
- `C1.5` means the gap/midpoint between Cabins 1 and 2.
- Rows are modeled as approximately 1 meter apart.
- Collection areas were not all regularly sized, so polygons are generalized approximations.

## Summary
- Total QC rows: 668
- Filled corrected_code entries: 35
- Spatialized expanded records: 349
- Unique aggregated surface areas: 38
- Preview polygons created: 38

## Files
- `preview_map_optionA.html` — open locally to inspect geometry.
- `surface_collections_optionA_preview.geojson` — preview geometry.
- `surface_optionA_area_summary.csv` — aggregated area summary.
- `surface_optionA_expanded_parse.csv` — row-level parse audit.
- `surface_optionA_summary.json` — processing summary.
