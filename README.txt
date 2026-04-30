Evergreen MapLibre v20 — Context-Based Artifact System

Major changes:
- Rebuilt cabins.geojson from the newly uploaded EVG_Cabin_poly.zip.
- Rebuilt surface collection polygons with rows offset 15 m from the cabin line.
- Added artifact_contexts_2021.json, linking non-ceramic artifacts to contexts through Lot #.
- Context logic:
  - Lot Catalog column A = Lot #
  - Artifact Catalog column B = Lot #
  - Lot Catalog G = TU
  - Lot Catalog H = Level
  - Lot Catalog I = STP
  - lot_context_parse_qc.csv corrected_code is used for surface corrections
- Surface polygons now link to artifact records and available photos.
- Test Units now display linked non-ceramic artifacts by lot context in addition to existing ceramic display.

Build summary:
- Non-ceramic artifact records: 756
- Missing lot links: 0
- Unique contexts: 79
- Surface polygons: 44
- Surface row offset: 15 m
