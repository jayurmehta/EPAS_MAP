Evergreen MapLibre v14 PHOTOID Package

This is the corrected package.

Verified:
- Uses PHOTOID1 column: PHOTOID1
- Uses PHOTOID2 column: PHOTOID2
- Does NOT use Photo? as the photo source
- Stores images as clean photo_ids arrays in ceramics_2021_tu_1_13.json
- Keeps Cloudflare R2 image loading, gallery, lightbox, no-photo messages, cabin layer, and cabin-to-TU links

Debug summary:
- Filtered ceramic rows: 64
- TUs with ceramic records: ['1', '3', '4', '7', '9', '10', '12', '13']
- Total linked photo IDs from PHOTOID1/PHOTOID2: 44
