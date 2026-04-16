const DATA_URL = 'tu_summary.geojson';
const CERAMICS_URL = 'ceramics_2021_tu_1_13.json';
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

function buildSelectionHTML(props) {
  const entries = [];
  FILTER_FIELDS.forEach(field => {
    if (field === 'all_total') return;
    const value = Number(props[field] || 0);
    if (value > 0) {
      entries.push({ label: FIELD_LABELS[field] || field, value });
    }
  });
  entries.sort((a, b) => b.value - a.value);

  const tu = props.tu ?? props.TestUnit ?? 'Unknown';
  const total = Number(props.all_total || 0);

  const assemblageHtml = entries.length
    ? `
      <ul class="selection-list">
        ${entries.map(e => `<li><strong>${e.label}:</strong> ${e.value}</li>`).join('')}
      </ul>
    `
    : `<div class="empty-state">No nonzero artifact categories recorded for this unit.</div>`;

  return `
    <div class="selection-title">Test Unit ${tu}</div>
    <div class="selection-total">Total artifacts: ${total}</div>
    <h3>Artifact Category Summary</h3>
    ${assemblageHtml}
    ${buildCeramicsHTML(tu)}
  `;
}

function showSelection(props) {
  selectionContent.innerHTML = buildSelectionHTML(props);
  selectedTU = Number(props.tu ?? -9999);
  if (map.getLayer('tu-selected')) {
    map.setFilter('tu-selected', ['==', ['get', 'tu'], selectedTU]);
  }
  if (window.innerWidth <= 800) {
    openSidebar();
  }
}

function updateSummary() {
  if (!sourceData) return;
  const feats = sourceData.features;
  if (!currentField) {
    summaryText.textContent = `Showing all ${feats.length} test units.`;
    return;
  }
  const visible = feats.filter(f => Number(f.properties[currentField] || 0) >= currentMin);
  const total = visible.reduce((sum, f) => sum + Number(f.properties[currentField] || 0), 0);
  summaryText.innerHTML = `
    <div><strong>Category:</strong> ${FIELD_LABELS[currentField] || currentField}</div>
    <div><strong>Matching units:</strong> ${visible.length}</div>
    <div><strong>Total count:</strong> ${total}</div>
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
  toggleSidebar.setAttribute('aria-label', 'Show sidebar');
  floatingOpenBtn.classList.remove('hidden');
}

function openSidebar() {
  sidebar.classList.remove('closed');
  toggleSidebar.textContent = '⟨';
  toggleSidebar.setAttribute('aria-label', 'Hide sidebar');
  floatingOpenBtn.classList.add('hidden');
}

function toggleSidebarState() {
  if (sidebar.classList.contains('closed')) openSidebar();
  else closeSidebar();
}

Promise.all([
  fetch(DATA_URL).then(r => r.json()),
  fetch(CERAMICS_URL).then(r => r.json()).catch(() => ({}))
]).then(([data, ceramicJson]) => {
  sourceData = data;
  ceramicsData = ceramicJson || {};

  map.on('load', () => {
    map.addSource('tu-data', { type: 'geojson', data });

    map.addLayer({
      id: 'tu-fill',
      type: 'fill',
      source: 'tu-data',
      paint: {
        'fill-color': '#cfcfcf',
        'fill-opacity': 0.55
      }
    });

    map.addLayer({
      id: 'tu-outline',
      type: 'line',
      source: 'tu-data',
      paint: {
        'line-color': '#333',
        'line-width': 1.1
      }
    });

    map.addLayer({
      id: 'tu-hover',
      type: 'line',
      source: 'tu-data',
      paint: {
        'line-color': '#ff7f00',
        'line-width': 3
      },
      filter: ['==', ['get', 'tu'], -9999]
    });

    map.addLayer({
      id: 'tu-selected',
      type: 'line',
      source: 'tu-data',
      paint: {
        'line-color': '#b30000',
        'line-width': 3.5
      },
      filter: ['==', ['get', 'tu'], -9999]
    });

    map.fitBounds(getBoundsFromGeoJSON(data), { padding: 30 });

    map.on('mousemove', 'tu-fill', e => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features[0];
      const tu = Number(f.properties.tu ?? -9999);
      map.setFilter('tu-hover', ['==', ['get', 'tu'], tu]);
    });

    map.on('mouseleave', 'tu-fill', () => {
      map.getCanvas().style.cursor = '';
      map.setFilter('tu-hover', ['==', ['get', 'tu'], -9999]);
    });

    map.on('click', 'tu-fill', e => {
      showSelection(e.features[0].properties);
    });

    updateSummary();
    if (window.innerWidth <= 800) {
      closeSidebar();
    }
  });
});

artifactSelect.addEventListener('change', e => {
  currentField = e.target.value;
  applyFilter();
});

minRange.addEventListener('input', e => {
  currentMin = Number(e.target.value);
  minVal.textContent = currentMin;
  applyFilter();
});

resetBtn.addEventListener('click', () => {
  currentField = '';
  currentMin = 0;
  artifactSelect.value = '';
  minRange.value = 0;
  minVal.textContent = '0';
  applyFilter();
});

toggleSidebar.addEventListener('click', toggleSidebarState);
floatingOpenBtn.addEventListener('click', openSidebar);

window.addEventListener('resize', () => {
  if (window.innerWidth > 800) {
    openSidebar();
  } else if (!sidebar.classList.contains('closed') && !selectedTU) {
    closeSidebar();
  }
});
