// Station search + "near me" — the discovery layer for the national catalog.
// A floating search field over the map: type-ahead by station name or state,
// or hit the crosshair to list the nearest stations by GPS.

import { getStations } from '../data/stationStore.js';
import { escapeHtml } from '../format.js';

const MAX_RESULTS = 8;

let onPick = null;

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Rank: name prefix > word prefix > substring; state matches boost.
function scoreStation(s, q) {
  const name = s.name.toLowerCase();
  const state = (s.state || '').toLowerCase();
  if (name.startsWith(q)) return 3;
  if (name.split(/[\s,()]+/).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q)) return 1;
  if (state === q) return 1.5;
  return 0;
}

function tierBadge(s) {
  if ((s.products || []).includes('water_level')) return '<span class="result-badge live">live gauge</span>';
  if (s.predType === 'S') return '<span class="result-badge">hi/lo only</span>';
  return '';
}

function renderResults(list, note) {
  const box = document.getElementById('search-results');
  if (!list.length) {
    box.innerHTML = note ? `<div class="search-note">${escapeHtml(note)}</div>` : '';
    box.classList.toggle('open', !!note);
    return;
  }
  box.innerHTML = list.map((r) => `
    <button class="search-result" data-id="${r.station.id}">
      <i class="ph-fill ph-waves"></i>
      <span class="result-name">${escapeHtml(r.station.name)}</span>
      <span class="result-meta">${escapeHtml(r.station.state || '')}${r.miles != null ? ` · ${r.miles.toFixed(0)} mi` : ''}</span>
      ${tierBadge(r.station)}
    </button>`).join('');
  box.classList.add('open');
}

function closeResults() {
  const box = document.getElementById('search-results');
  box.classList.remove('open');
  box.innerHTML = '';
}

async function runQuery(q) {
  q = q.trim().toLowerCase();
  if (q.length < 2) { closeResults(); return; }
  const stations = await getStations();
  const results = stations
    .map((s) => ({ station: s, score: scoreStation(s, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.station.name.localeCompare(b.station.name))
    .slice(0, MAX_RESULTS);
  renderResults(results, results.length ? null : 'No stations match');
}

async function runNearMe() {
  renderResults([], 'Locating…');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    const stations = await getStations();
    const results = stations
      .map((s) => ({ station: s, miles: haversineMiles(latitude, longitude, s.lat, s.lon) }))
      .sort((a, b) => a.miles - b.miles)
      .slice(0, MAX_RESULTS);
    renderResults(results);
  }, () => {
    renderResults([], 'Location unavailable — check browser permissions');
  }, { timeout: 8000, maximumAge: 300000 });
}

export function initSearch({ onSelect } = {}) {
  onPick = onSelect;
  const input = document.getElementById('station-search-input');
  const box = document.getElementById('search-results');

  let debounce = null;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => runQuery(input.value), 120);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.blur(); closeResults(); }
    if (e.key === 'Enter') {
      const first = box.querySelector('.search-result');
      if (first) first.click();
    }
  });

  document.getElementById('near-me-btn').addEventListener('click', () => {
    if (!navigator.geolocation) { renderResults([], 'Geolocation not supported'); return; }
    runNearMe();
  });

  box.addEventListener('click', async (e) => {
    const btn = e.target.closest('.search-result');
    if (!btn) return;
    const stations = await getStations();
    const station = stations.find((s) => s.id === btn.dataset.id);
    if (station && onPick) {
      closeResults();
      input.value = '';
      input.blur();
      onPick(station);
    }
  });

  // Click-away closes the dropdown.
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.station-search')) closeResults();
  });
}
