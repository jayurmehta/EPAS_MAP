const DATA_URL = 'tu_summary.geojson';

const FIELD_LABELS = window.FIELD_LABELS || {};
const FILTER_FIELDS = window.FILTER_FIELDS || [];

const artifactSelect = document.getElementById('artifact');
const minRange = document.getElementById('minrange');
const minVal = document.getElementById('minval');
const summaryText = document.getElementById('summaryText');
const resetBtn = document.getElementById('resetBtn');

let currentField = '';
let currentMin = 0;
let sourceData = null;

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
    layers: [
      { id: 'osm', type: 'raster', source: 'osm' }
    ]
  },
  center: [-90.63, 29.90],
  zoom: 18
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

function buildPopupHTML(props) {
  const entries = [];
  FILTER_FIELDS.forEach(field => {
    if (field === 'all_total') return;
    const value = Number(props[field] || 0);
    if (value > 0) {
      entries.push({
        field,
        label: FIELD_LABELS[field] || field,
        value
      });
    }
  });
  entries.sort((a, b) => b.value - a.value);

  const items = entries.length
    ? `<ul class="popup-list">` + entries.map(e => `<li><strong>${e.label}:</strong> ${e.value}</li>`).join('') + `</ul>`
    : `<div class="small">No artifact counts recorded for this unit.</div>`;

  const tu = props.tu ?? props.TestUnit ?? 'Unknown';
  const allTotal = Number(props.all_total || 0);

  return `
    <div class="popup-title">Test Unit ${tu}</div>
    <div class="small"><strong>Total artifacts:</strong> ${allTotal}</div>
    ${items}
  `;
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
    map.setFilter('tu-fill', ['>=', ['coalesce', ['get', currentField], 0], currentMin]);
    map.setFilter('tu-outline', ['>=', ['coalesce', ['get', currentField], 0], currentMin]);
    map.setPaintProperty('tu-fill', 'fill-color', colorExpression(currentField));
    map.setPaintProperty('tu-fill', 'fill-opacity', 0.8);
  }
  updateSummary();
}

fetch(DATA_URL)
  .then(r => r.json())
  .then(data => {
    sourceData = data;
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

      const bounds = getBoundsFromGeoJSON(data);
      map.fitBounds(bounds, { padding: 30 });

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
        const props = e.features[0].properties;
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(buildPopupHTML(props))
          .addTo(map);
      });

      updateSummary();
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
