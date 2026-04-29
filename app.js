const DATA_URL = 'tu_summary.geojson';
const CERAMICS_URL = 'ceramics_2021_tu_1_13.json';
const CABINS_URL = 'cabins.geojson';
const CABIN_LINKS_URL = 'cabin_links.json';
const IMAGE_BASE = 'https://pub-ab138914e68b46c9b202d08c2017af1b.r2.dev/';
const FIELD_LABELS = window.FIELD_LABELS || {};
const FILTER_FIELDS = window.FILTER_FIELDS || [];

const artifactSelect = document.getElementById('artifact');
const minRange = document.getElementById('minrange');
const minVal = document.getElementById('minval');
const summaryText = document.getElementById('summaryText');
const resetBtn = document.getElementById('resetBtn');
const selectionContent = document.getElementById('selectionContent');
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggleSidebar');
const floatingOpenBtn = document.getElementById('floatingOpenBtn');

let currentField = '';
let currentMin = 0;
let sourceData = null;
let selectedTU = null;
let ceramicsData = {};
let cabinsData = null;
let cabinLinks = {};
let selectedCabin = null;
let currentGallery = [];
let currentGalleryIndex = 0;

const noneOpt = document.createElement('option');
noneOpt.value = '';
noneOpt.textContent = 'None (show all units)';
artifactSelect.appendChild(noneOpt);

FILTER_FIELDS.forEach(field => {
  const opt = document.createElement('option');
  opt.value = field;
  opt.textContent = FIELD_LABELS[field] || field;
  artifactSelect.appendChild(opt);
});

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors'
      }
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
  }
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

function colorExpression(field) {
  return [
    'interpolate', ['linear'], ['coalesce', ['get', field], 0],
    0, '#f7fbff',
    1, '#deebf7',
    5, '#9ecae1',
    20, '#6baed6',
    50, '#3182bd',
    100, '#08519c',
    500, '#08306b'
  ];
}

function getBoundsFromGeoJSON(data) {
  const bounds = new maplibregl.LngLatBounds();
  data.features.forEach(f => {
    const geom = f.geometry;
    if (geom.type === 'Polygon') geom.coordinates[0].forEach(coord => bounds.extend(coord));
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(poly => poly[0].forEach(coord => bounds.extend(coord)));
  });
  return bounds;
}

function safeAttr(value) {
  return String(value ?? '').replace(/"/g, '&quot;');
}

function imageUrls(photoId) {
  if (!photoId) return null;
  const baseName = String(photoId).trim().replace(/-/g, ' ');
  const encoded = encodeURIComponent(baseName);
  return {
    display: `${IMAGE_BASE}${encoded}.JPG`,
    fallback: `${IMAGE_BASE}${encoded}.jpg`,
    label: String(photoId).trim()
  };
}

function tuLevelImageUrls(tu, level) {
  const cleanTU = String(tu).trim();
  const cleanLevel = String(level).trim();
  const baseName = `${cleanTU} ${cleanLevel}`;
  const encoded = encodeURIComponent(baseName);
  return {
    display: `${IMAGE_BASE}${encoded}.JPG`,
    fallback: `${IMAGE_BASE}${encoded}.jpg`,
    label: `TU ${cleanTU}, Level ${cleanLevel}`
  };
}

function namedImageUrls(filenameNoExtension) {
  const encoded = encodeURIComponent(filenameNoExtension);
  return {
    display: `${IMAGE_BASE}${encoded}.JPG`,
    fallback: `${IMAGE_BASE}${encoded}.jpg`,
    label: filenameNoExtension
  };
}

function photoBlock(photoIds, galleryIndexByPhoto = {}) {
  const ids = Array.isArray(photoIds) ? photoIds.filter(Boolean) : [];
  if (!ids.length) {
    return `<div class="no-photo">No artifact photo available</div>`;
  }

  return ids.map(pid => {
    const urls = imageUrls(pid);
    const idx = galleryIndexByPhoto[pid];
    const idxAttr = idx !== undefined ? `data-gallery-index="${idx}"` : '';
    return `
      <div class="artifact-photo">
        <button class="photo-button" ${idxAttr} data-photo-label="${safeAttr(urls.label)}" data-photo-src="${safeAttr(urls.display)}" data-photo-fallback="${safeAttr(urls.fallback)}" type="button">
          <img src="${urls.display}" alt="Artifact ${safeAttr(urls.label)}" loading="lazy"
            onerror="this.onerror=null; this.src='${urls.fallback}';">
        </button>
        <div class="photo-label">Artifact Photo ID: ${urls.label}</div>
      </div>
    `;
  }).join('');
}

function tuLevelPhotoBlock(tu, level) {
  const urls = tuLevelImageUrls(tu, level);
  return `
    <div class="tu-level-photo">
      <div class="tu-level-photo-title">Excavation context photo</div>
      <button class="photo-button context-photo-button" data-photo-label="${safeAttr(urls.label)}" data-photo-src="${safeAttr(urls.display)}" data-photo-fallback="${safeAttr(urls.fallback)}" type="button">
        <img src="${urls.display}" alt="${safeAttr(urls.label)}" loading="lazy"
          onerror="this.onerror=null; this.src='${urls.fallback}'; this.onerror=function(){ this.closest('.tu-level-photo').classList.add('missing-context-photo'); };">
      </button>
      <div class="photo-label">${urls.label}</div>
      <div class="missing-context-note">No context photo found for ${urls.label}.</div>
    </div>
  `;
}

function collectCeramicPhotos(tu) {
  const ceramic = ceramicsData[String(tu)];
  if (!ceramic) return [];

  const photos = [];
  ceramic.levels.forEach(levelObj => {
    levelObj.records.forEach(r => {
      const ids = Array.isArray(r.photo_ids) ? r.photo_ids.filter(Boolean) : [];
      ids.forEach(pid => {
        const urls = imageUrls(pid);
        photos.push({
          photo_id: pid,
          display: urls.display,
          fallback: urls.fallback,
          level: levelObj.level,
          count: r.count,
          type: r.type,
          chronology: r.chronology,
          vessel_portion: r.vessel_portion,
          vessel_form: r.vessel_form
        });
      });
    });
  });

  const seen = new Set();
  return photos.filter(p => {
    if (seen.has(p.photo_id)) return false;
    seen.add(p.photo_id);
    return true;
  });
}

function buildGalleryHTML(tu) {
  const photos = collectCeramicPhotos(tu);
  currentGallery = photos;

  if (!photos.length) {
    return `
      <div class="gallery-block">
        <h3>Artifact Photo Gallery</h3>
        <div class="no-photo">No linked artifact photos are available for this test unit yet.</div>
      </div>
    `;
  }

  const thumbs = photos.map((p, i) => `
    <button class="gallery-thumb" data-gallery-index="${i}" type="button" title="${safeAttr(p.photo_id)}">
      <img src="${p.display}" alt="Artifact ${safeAttr(p.photo_id)}" loading="lazy"
        onerror="this.onerror=null; this.src='${p.fallback}';">
      <span>${p.photo_id}</span>
    </button>
  `).join('');

  return `
    <div class="gallery-block">
      <h3>Artifact Photo Gallery</h3>
      <div class="small">${photos.length} linked artifact photo${photos.length === 1 ? '' : 's'} for this test unit.</div>
      <div class="gallery-grid">${thumbs}</div>
    </div>
  `;
}

function buildCeramicsHTML(tu) {
  const ceramic = ceramicsData[String(tu)];
  if (!ceramic) {
    return `
      <div class="ceramics-block">
        <h3>2021 Analyzed Ceramics</h3>
        <div class="empty-state">No analyzed ceramic records linked yet for this test unit.</div>
      </div>
      ${buildGalleryHTML(tu)}
    `;
  }

  const photos = collectCeramicPhotos(tu);
  const galleryIndexByPhoto = {};
  photos.forEach((p, i) => { galleryIndexByPhoto[p.photo_id] = i; });

  const levelHtml = ceramic.levels.map(levelObj => {
    const recs = levelObj.records.map(r => {
      const parts = [];
      parts.push(`<div class="ceramic-context-line"><strong>Context:</strong> TU ${tu}, Level ${levelObj.level}</div>`);
      if (r.count) parts.push(`<strong>Count:</strong> ${r.count}`);
      if (r.type) parts.push(`<strong>Type:</strong> ${r.type}`);
      if (r.chronology) parts.push(`<strong>Chronology:</strong> ${r.chronology}`);
      if (r.vessel_portion) parts.push(`<strong>Vessel Portion:</strong> ${r.vessel_portion}`);
      if (r.vessel_form) parts.push(`<strong>Vessel Form:</strong> ${r.vessel_form}`);
      parts.push(photoBlock(r.photo_ids, galleryIndexByPhoto));
      return `<li class="ceramic-record">${parts.join('<br>')}</li>`;
    }).join('');

    return `
      <div class="ceramic-level">
        <div class="ceramic-level-title">Level ${levelObj.level}</div>
        <div class="small">Context: Test Unit ${tu}, Level ${levelObj.level}</div>
        ${tuLevelPhotoBlock(tu, levelObj.level)}
        <div class="small">Ceramic records: ${levelObj.level_record_count} | Ceramic count total: ${levelObj.level_total_count}</div>
        <ul class="ceramic-list">${recs}</ul>
      </div>
    `;
  }).join('');

  return `
    <div class="ceramics-block">
      <h3>2021 Analyzed Ceramics by Level</h3>
      <div class="small">Records: ${ceramic.record_count} | Count total: ${ceramic.total_count}</div>
      ${levelHtml}
    </div>
    ${buildGalleryHTML(tu)}
  `;
}

function buildTUSelectionHTML(props) {
  const entries = [];
  FILTER_FIELDS.forEach(field => {
    if (field === 'all_total') return;
    const value = Number(props[field] || 0);
    if (value > 0) entries.push({ label: FIELD_LABELS[field] || field, value });
  });
  entries.sort((a, b) => b.value - a.value);

  const tu = props.tu ?? props.TestUnit ?? 'Unknown';
  const total = Number(props.all_total || 0);
  const assemblageHtml = entries.length
    ? `<ul class="selection-list">${entries.map(e => `<li><strong>${e.label}:</strong> ${e.value}</li>`).join('')}</ul>`
    : `<div class="empty-state">No nonzero artifact categories recorded for this unit.</div>`;

  return `
    <div class="selection-title">Test Unit ${tu}</div>
    <div class="selection-total">Total artifacts: ${total}</div>
    <h3>Artifact Category Summary</h3>
    ${assemblageHtml}
    ${buildCeramicsHTML(tu)}
  `;
}

function buildCabinSelectionHTML(props) {
  const cabinNum = Number(props.cabin_num ?? -1);
  const link = cabinLinks[String(cabinNum)] || null;
  const cabinId = props.cabin_id || (link ? link.cabin_id : 'Unknown');
  const isLong = props.is_long || (link ? link.is_long : 'no');
  const nearby = link ? link.nearby_tus : [];
  const topCats = link ? link.top_categories : [];

  const nearbyHtml = nearby.length
    ? `<ul class="selection-list">${nearby.map(t => `<li><strong>TU ${t.tu}</strong> (${t.distance_m} m away) — Total artifacts: ${t.all_total}</li>`).join('')}</ul>`
    : `<div class="empty-state">No nearby test units linked.</div>`;

  const catsHtml = topCats.length
    ? `<ul class="selection-list">${topCats.map(c => `<li><strong>${c.label}:</strong> ${c.count}</li>`).join('')}</ul>`
    : `<div class="empty-state">No aggregated artifact categories available.</div>`;

  return `
    <div class="selection-title">Cabin ${cabinNum}</div>
    <div class="selection-total">Cabin ID: ${cabinId}</div>
    <h3>Cabin Information</h3>
    <ul class="selection-list">
      <li><strong>Long Cabin:</strong> ${isLong}</li>
    </ul>
    <h3>Nearby Test Units</h3>
    ${nearbyHtml}
    <h3>Aggregated Artifact Summary from Nearby Test Units</h3>
    ${catsHtml}
  `;
}

function bindPhotoButtons() {
  const buttons = selectionContent.querySelectorAll('.photo-button, .gallery-thumb');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.getAttribute('data-gallery-index');
      if (idx !== null && idx !== undefined && idx !== '') openLightbox(Number(idx));
      else openLightboxDirect(btn.getAttribute('data-photo-src'), btn.getAttribute('data-photo-fallback'), btn.getAttribute('data-photo-label'));
    });
  });

  const churchPanel = document.getElementById('churchContextPanel');
  if (churchPanel) {
    const churchBtn = churchPanel.querySelector('.photo-button');
    if (churchBtn) {
      churchBtn.addEventListener('click', () => {
        openLightboxDirect(churchBtn.getAttribute('data-photo-src'), churchBtn.getAttribute('data-photo-fallback'), churchBtn.getAttribute('data-photo-label'));
      });
    }
  }
}

function ensureChurchPanel() {
  let panel = document.getElementById('churchContextPanel');
  if (panel) return panel;

  panel = document.createElement('aside');
  panel.id = 'churchContextPanel';
  panel.className = 'church-context-panel hidden';
  document.getElementById('app').appendChild(panel);
  return panel;
}

function updateChurchPanel(tu) {
  const panel = ensureChurchPanel();
  const tuNum = Number(tu);
  if (tuNum >= 2 && tuNum <= 10) {
    const urls = namedImageUrls('Church Excavation');
    panel.innerHTML = `
      <h3>Church Excavation Area</h3>
      <div class="small">Shown for Test Units 2–10.</div>
      <button class="photo-button church-photo-button" data-photo-label="${safeAttr(urls.label)}" data-photo-src="${safeAttr(urls.display)}" data-photo-fallback="${safeAttr(urls.fallback)}" type="button">
        <img src="${urls.display}" alt="Church Excavation" loading="lazy"
          onerror="this.onerror=null; this.src='${urls.fallback}';">
      </button>
      <div class="photo-label">Church Excavation.JPG</div>
    `;
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
    panel.innerHTML = '';
  }
}

function showTUSelection(props) {
  selectionContent.innerHTML = buildTUSelectionHTML(props);
  selectedTU = Number(props.tu ?? -9999);
  selectedCabin = null;
  updateChurchPanel(selectedTU);
  bindPhotoButtons();

  if (map.getLayer('tu-selected')) map.setFilter('tu-selected', ['==', ['get', 'tu'], selectedTU]);
  if (map.getLayer('cabin-selected')) map.setFilter('cabin-selected', ['==', ['get', 'cabin_num'], -9999]);
  if (window.innerWidth <= 800) openSidebar();
}

function showCabinSelection(props) {
  selectionContent.innerHTML = buildCabinSelectionHTML(props);
  currentGallery = [];
  selectedCabin = Number(props.cabin_num ?? -9999);
  selectedTU = null;
  updateChurchPanel(null);
  if (map.getLayer('tu-selected')) map.setFilter('tu-selected', ['==', ['get', 'tu'], -9999]);
  if (map.getLayer('cabin-selected')) map.setFilter('cabin-selected', ['==', ['get', 'cabin_num'], selectedCabin]);
  if (window.innerWidth <= 800) openSidebar();
}

function updateSummary() {
  if (!sourceData) return;
  const feats = sourceData.features;
  const cabinCount = cabinsData ? cabinsData.features.length : 0;
  if (!currentField) {
    summaryText.innerHTML = `Showing all ${feats.length} test units and ${cabinCount} cabins.`;
    return;
  }
  const visible = feats.filter(f => Number(f.properties[currentField] || 0) >= currentMin);
  const total = visible.reduce((sum, f) => sum + Number(f.properties[currentField] || 0), 0);
  summaryText.innerHTML = `
    <div><strong>Category:</strong> ${FIELD_LABELS[currentField] || currentField}</div>
    <div><strong>Matching test units:</strong> ${visible.length}</div>
    <div><strong>Total count:</strong> ${total}</div>
    <div><strong>Cabins shown:</strong> ${cabinCount}</div>
  `;
}

function applyFilter() {
  if (!map.getLayer('tu-fill')) return;
  if (!currentField) {
    map.setFilter('tu-fill', null);
    map.setFilter('tu-outline', null);
    map.setPaintProperty('tu-fill', 'fill-color', '#cfcfcf');
    map.setPaintProperty('tu-fill', 'fill-opacity', 0.55);
  } else {
    const filt = ['>=', ['coalesce', ['get', currentField], 0], currentMin];
    map.setFilter('tu-fill', filt);
    map.setFilter('tu-outline', filt);
    map.setPaintProperty('tu-fill', 'fill-color', colorExpression(currentField));
    map.setPaintProperty('tu-fill', 'fill-opacity', 0.8);
  }
  updateSummary();
}

function closeSidebar() {
  sidebar.classList.add('closed');
  toggleSidebar.textContent = '⟩';
  floatingOpenBtn.classList.remove('hidden');
}

function openSidebar() {
  sidebar.classList.remove('closed');
  toggleSidebar.textContent = '⟨';
  floatingOpenBtn.classList.add('hidden');
}

function toggleSidebarState() {
  if (sidebar.classList.contains('closed')) openSidebar();
  else closeSidebar();
}

function ensureLightbox() {
  let lb = document.getElementById('lightbox');
  if (lb) return lb;
  lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.className = 'lightbox hidden';
  lb.innerHTML = `
    <div class="lightbox-backdrop"></div>
    <div class="lightbox-content">
      <button class="lightbox-close" type="button" aria-label="Close image viewer">×</button>
      <button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous image">‹</button>
      <img id="lightboxImage" src="" alt="">
      <button class="lightbox-nav lightbox-next" type="button" aria-label="Next image">›</button>
      <div id="lightboxCaption" class="lightbox-caption"></div>
    </div>
  `;
  document.body.appendChild(lb);
  lb.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lb.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
  lb.querySelector('.lightbox-prev').addEventListener('click', () => moveLightbox(-1));
  lb.querySelector('.lightbox-next').addEventListener('click', () => moveLightbox(1));
  document.addEventListener('keydown', e => {
    if (lb.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') moveLightbox(-1);
    if (e.key === 'ArrowRight') moveLightbox(1);
  });
  return lb;
}

function openLightbox(index) {
  if (!currentGallery.length) return;
  currentGalleryIndex = Math.max(0, Math.min(index, currentGallery.length - 1));
  renderLightbox();
}

function openLightboxDirect(src, fallback, label) {
  currentGallery = [{ photo_id: label, display: src, fallback: fallback, type: '', chronology: '', vessel_portion: '', vessel_form: '', level: '' }];
  currentGalleryIndex = 0;
  renderLightbox();
}

function renderLightbox() {
  const lb = ensureLightbox();
  const item = currentGallery[currentGalleryIndex];
  const img = document.getElementById('lightboxImage');
  const caption = document.getElementById('lightboxCaption');
  img.src = item.display;
  img.onerror = function() { this.onerror = null; this.src = item.fallback; };
  img.alt = `Image ${item.photo_id}`;
  const details = [
    item.photo_id ? `<strong>${item.photo_id}</strong>` : '',
    item.level ? `Level ${item.level}` : '',
    item.type ? item.type : '',
    item.chronology ? item.chronology : '',
    item.vessel_portion ? `Portion: ${item.vessel_portion}` : '',
    item.vessel_form ? `Form: ${item.vessel_form}` : ''
  ].filter(Boolean).join(' · ');
  caption.innerHTML = `${details}<br><span>${currentGalleryIndex + 1} of ${currentGallery.length}</span>`;
  lb.classList.remove('hidden');
}

function moveLightbox(delta) {
  if (!currentGallery.length) return;
  currentGalleryIndex = (currentGalleryIndex + delta + currentGallery.length) % currentGallery.length;
  renderLightbox();
}

function closeLightbox() {
  const lb = ensureLightbox();
  lb.classList.add('hidden');
}

Promise.all([
  fetch(DATA_URL).then(r => r.json()),
  fetch(CERAMICS_URL).then(r => r.json()).catch(() => ({})),
  fetch(CABINS_URL).then(r => r.json()),
  fetch(CABIN_LINKS_URL).then(r => r.json()).catch(() => ({}))
]).then(([data, ceramicJson, cabinJson, cabinLinkJson]) => {
  sourceData = data;
  ceramicsData = ceramicJson || {};
  cabinsData = cabinJson;
  cabinLinks = cabinLinkJson || {};

  map.on('load', () => {
    map.addSource('tu-data', { type: 'geojson', data });
    map.addSource('cabins-data', { type: 'geojson', data: cabinJson });
    map.addLayer({ id: 'tu-fill', type: 'fill', source: 'tu-data', paint: { 'fill-color': '#cfcfcf', 'fill-opacity': 0.45 } });
    map.addLayer({ id: 'tu-outline', type: 'line', source: 'tu-data', paint: { 'line-color': '#333', 'line-width': 1.1 } });
    map.addLayer({ id: 'cabins-fill', type: 'fill', source: 'cabins-data', paint: { 'fill-color': '#8c5a2b', 'fill-opacity': 0.5 } });
    map.addLayer({ id: 'cabins-outline', type: 'line', source: 'cabins-data', paint: { 'line-color': '#6d431e', 'line-width': 1.4 } });
    map.addLayer({ id: 'tu-hover', type: 'line', source: 'tu-data', paint: { 'line-color': '#ff7f00', 'line-width': 3 }, filter: ['==', ['get', 'tu'], -9999] });
    map.addLayer({ id: 'tu-selected', type: 'line', source: 'tu-data', paint: { 'line-color': '#b30000', 'line-width': 3.5 }, filter: ['==', ['get', 'tu'], -9999] });
    map.addLayer({ id: 'cabin-hover', type: 'line', source: 'cabins-data', paint: { 'line-color': '#f0d264', 'line-width': 3 }, filter: ['==', ['get', 'cabin_num'], -9999] });
    map.addLayer({ id: 'cabin-selected', type: 'line', source: 'cabins-data', paint: { 'line-color': '#2a6fdb', 'line-width': 3.5 }, filter: ['==', ['get', 'cabin_num'], -9999] });

    const tuBounds = getBoundsFromGeoJSON(data);
    const cabinBounds = getBoundsFromGeoJSON(cabinJson);
    tuBounds.extend(cabinBounds.getSouthWest());
    tuBounds.extend(cabinBounds.getNorthEast());
    map.fitBounds(tuBounds, { padding: 30 });

    map.on('mousemove', 'tu-fill', e => { map.getCanvas().style.cursor = 'pointer'; map.setFilter('tu-hover', ['==', ['get', 'tu'], Number(e.features[0].properties.tu ?? -9999)]); });
    map.on('mouseleave', 'tu-fill', () => { map.getCanvas().style.cursor = ''; map.setFilter('tu-hover', ['==', ['get', 'tu'], -9999]); });
    map.on('click', 'tu-fill', e => showTUSelection(e.features[0].properties));

    map.on('mousemove', 'cabins-fill', e => { map.getCanvas().style.cursor = 'pointer'; map.setFilter('cabin-hover', ['==', ['get', 'cabin_num'], Number(e.features[0].properties.cabin_num ?? -9999)]); });
    map.on('mouseleave', 'cabins-fill', () => { map.getCanvas().style.cursor = ''; map.setFilter('cabin-hover', ['==', ['get', 'cabin_num'], -9999]); });
    map.on('click', 'cabins-fill', e => showCabinSelection(e.features[0].properties));
    updateSummary();
    if (window.innerWidth <= 800) closeSidebar();
  });
});

artifactSelect.addEventListener('change', e => { currentField = e.target.value; applyFilter(); });
minRange.addEventListener('input', e => { currentMin = Number(e.target.value); minVal.textContent = currentMin; applyFilter(); });
resetBtn.addEventListener('click', () => { currentField = ''; currentMin = 0; artifactSelect.value = ''; minRange.value = 0; minVal.textContent = '0'; applyFilter(); });
toggleSidebar.addEventListener('click', toggleSidebarState);
floatingOpenBtn.addEventListener('click', openSidebar);
window.addEventListener('resize', () => { if (window.innerWidth > 800) openSidebar(); else if (!sidebar.classList.contains('closed') && !selectedTU && !selectedCabin) closeSidebar(); });
