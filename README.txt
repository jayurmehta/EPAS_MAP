Evergreen MapLibre v18 — TU Photos Independent of Ceramics

Fix:
- Test unit photos now display from tu_context_photos.json regardless of whether that TU has ceramic-analysis records.
- This means clicking a TU with no ceramics should still show its uploaded TU context photos.

Key behavior:
- TU context photos appear near the top of the side panel before artifact summaries.
- Ceramic records, when present, are still grouped by level.
- Church Excavation popup still appears for TUs 2–10 and has a close button.
- app.js, style.css, and tu_context_photos.json are cache-busted.

Important files to upload:
- index.html
- app.js
- style.css
- tu_context_photos.json
- all existing GeoJSON/JSON/CSV files
