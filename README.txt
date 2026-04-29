Evergreen MapLibre v16 — TU Photo Visibility Fix

This version fixes two likely reasons the TU-level photos and Church Excavation panel were not visible:

1. Cache busting:
   - index.html now loads style.css?v=16 and app.js?v=16.
   - This helps GitHub Pages/browser cache actually load the new JavaScript and CSS.

2. More robust TU-level photo filenames:
   For TU 13, Level 2, the viewer now tries:
   - 13 2.JPG
   - 13 2.jpg
   - 13-2.JPG
   - TU13 2.JPG
   - TU13 Level 2.JPG

3. Church Excavation panel:
   - The panel is now fixed to the browser window instead of nested inside the map grid.
   - It should appear on the right when clicking TUs 2–10.
   - Expected filename remains Church Excavation.JPG.

Existing behavior preserved:
- artifact photos from PHOTOID1/PHOTOID2
- artifact gallery
- lightbox
- cabin layer
- cabin-to-TU links
