Evergreen MapLibre v22 — Surface Photo Link Fix

Fix:
- Re-parsed the 2021 Photo Log so Columns D and E can resolve to surface Cabin/Row contexts.
- Columns D/E are treated as surface contexts when they explicitly indicate Cabin/Row/Surface or when the resulting SFC#R# matches a known surface polygon.
- Photo IDs remain Cloudflare-compatible filenames, e.g. EPAS2021 399.jpg, with no dash.

Summary:
- Expanded photo IDs: 1112
- Contexts with photos: 63
- Spatial surface contexts with photos: 44
- Spatial surface photo count: 484
- General unmapped surface photo count: 476
- TU contexts with photos: 8
- STP contexts with photos: 10

New audit files:
- photo_log_context_links_v22.csv
- surface_photo_link_audit_v22.csv
- v22_photo_log_summary.json
