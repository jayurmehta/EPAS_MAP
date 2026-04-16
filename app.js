const DATA_URL = 'tu_summary.geojson';
const CERAMICS_URL = 'ceramics_2021_tu_1_13.json';
const CABINS_URL = 'cabins.geojson';
const CABIN_LINKS_URL = 'cabin_links.json';
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
    if (geom.type === 'Polygon') {
      geom.coordinates[0].forEach(coord => bounds.extend(coord));
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(poly => poly[0].forEach(coord => bounds.extend(coord)));
    }
  });
  return bounds;
}

function buildCeramicsHTML(tu) {
  const ceramic = ceramicsData[String(tu)];
  if (!ceramic) {
    return '<div class="ceramics-block"><h3>2021 Analyzed Ceramics</h3><div class="empty-state">No analyzed ceramic records linked yet for this test unit.</div></div>';
  }
  const levelHtml = ceramic.levels.map(levelObj => {
    const recs = levelObj.records.map(r => {
      const parts = [];
      if (r.count) parts.push(`<strong>Count:</strong> ${r.count}`);
      if (r.type) parts.push(`<strong>Type:</strong> ${r.type}`);
      if (r.chronology) parts.push(`<strong>Chronology:</strong> ${r.chronology}`);
      if (r.vessel_portion) parts.push(`<strong>Vessel Portion:</strong> ${r.vessel_portion}`);
      if (r.vessel_form) parts.push(`<strong>Vessel Form:</strong> ${r.vessel_form}`);
      if (r.photo_id) parts.push(`<strong>Photo ID:</strong> ${r.photo_id}`);
      return `<li class="ceramic-record">${parts.join('<br>')}</li>`;
    }).join('');
    return `
      <div class="ceramic-level">
        <div class="ceramic-level-title">Level ${levelObj.level}</div>
        <div class="small">Records: ${levelObj.level_record_count} | Count total: ${levelObj.level_total_count}</div>
        <ul class="ceramic-list">${recs}</ul>
      </div>
    `;
  }).join('');

  return `
    <div class="ceramics-block">
      <h3>2021 Analyzed Ceramics</h3>
      <div class="small">Records: ${ceramic.record_count} | Count total: ${ceramic.total_count}</div>
      ${levelHtml}
    </div>
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
  const ptCount = props.pt_count ?? '';
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
      <li><strong>Source Point Count:</strong> ${ptCount}</li>
    </ul>
    <h3>Nearby Test Units</h3>
    ${nearbyHtml}
    <h3>Aggregated Artifact Summary from Nearby Test Units</h3>
    ${catsHtml}
  `;
}

function showTUSelection(props) {
  selectionContent.innerHTML = buildTUSelectionHTML(props);
  selectedTU = Number(props.tu ?? -9999);
  selectedCabin = null;
  map.setFilter('tu-selected', ['==', ['get', 'tu'], selectedTU]);
  map.setFilter('cabin-selected', ['==', ['get', 'cabin_num'], -9999]);
  if (window.innerWidth <= 800) openSidebar();
}

function showCabinSelection(props) {
  selectionContent.innerHTML = buildCabinSelectionHTML(props);
  selectedCabin = Number(props.cabin_num ?? -9999);
  selectedTU = null;
  map.setFilter('tu-selected', ['==', ['get', 'tu'], -9999]);
  map.setFilter('cabin-selected', ['==', ['get', 'cabin_num'], selectedCabin]);
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

Promise.all([
  fetch(DATA_URL).then(r => r.json()),
  fetch(CERAMICS_URL).then(r => r.json()).catch(() => ({})),
  fetch(CABINS_URL).then(r => r.json()),
  fetch(CABIN_LINKS_URL).then(r => r.json())
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

    map.on('mousemove', 'tu-fill', e => {
      map.getCanvas().style.cursor = 'pointer';
      const tu = Number(e.features[0].properties.tu ?? -9999);
      map.setFilter('tu-hover', ['==', ['get', 'tu'], tu]);
    });
    map.on('mouseleave', 'tu-fill', () => {
      map.getCanvas().style.cursor = '';
      map.setFilter('tu-hover', ['==', ['get', 'tu'], -9999]);
    });
    map.on('click', 'tu-fill', e => showTUSelection(e.features[0].properties));

    map.on('mousemove', 'cabins-fill', e => {
      map.getCanvas().style.cursor = 'pointer';
      const cabinNum = Number(e.features[0].properties.cabin_num ?? -9999);
      map.setFilter('cabin-hover', ['==', ['get', 'cabin_num'], cabinNum]);
    });
    map.on('mouseleave', 'cabins-fill', () => {
      map.getCanvas().style.cursor = '';
      map.setFilter('cabin-hover', ['==', ['get', 'cabin_num'], -9999]);
    });
    map.on('click', 'cabins-fill', e => showCabinSelection(e.features[0].properties));

    updateSummary();
    if (window.innerWidth <= 800) closeSidebar();
  });
});

artifactSelect.addEventListener('change', e => { currentField = e.target.value; applyFilter(); });
minRange.addEventListener('input', e => { currentMin = Number(e.target.value); minVal.textContent = currentMin; applyFilter(); });
resetBtn.addEventListener('click', () => {
  currentField = ''; currentMin = 0; artifactSelect.value = ''; minRange.value = 0; minVal.textContent = '0'; applyFilter();
});
toggleSidebar.addEventListener('click', toggleSidebarState);
floatingOpenBtn.addEventListener('click', openSidebar);
window.addEventListener('resize', () => {
  if (window.innerWidth > 800) openSidebar();
  else if (!sidebar.classList.contains('closed') && !selectedTU && !selectedCabin) closeSidebar();
});
