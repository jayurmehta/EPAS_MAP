Evergreen MapLibre Package v13 Rebuilt

This package uses a clean photo_ids array for each ceramic record and simplified viewer code.

Important note:
The uploaded workbook did not include PHOTOID1 / PHOTOID2 headers. I normalized the existing Photo? column into photo_ids so the viewer still uses the simplified schema.

Debug summary:
- Source package used: evergreen_maplibre_v11.zip
- Sheet used: Ceramics
- Photo source used: Photo?
- Filtered ceramic rows: 64
- TUs with ceramic records: ['1', '3', '4', '7', '9', '10', '12', '13']
- Total linked photo IDs: 58

Upload/replace all files in your EPAS_MAP GitHub repository, then commit changes.
