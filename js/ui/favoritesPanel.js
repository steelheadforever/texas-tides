// Favorites panel — reorderable rows with at-a-glance conditions + mini tide
// curve. Tapping a row pans the map and opens the station panel.

import { TEXAS_STATIONS } from '../data/stations.js';
import { getFavoriteIds, moveFavorite, removeFavorite } from '../favorites.js';
import { fetchTideNow, fetch24HourCurve, fetchWaterTemp, fetchStationWind } from '../api/noaa.js';
import { renderSparkline } from './charts.js';
import { openPanel } from '../panels.js';
import { getSettings } from '../settings.js';
import { fmtFeet, fmtDegrees, fmtWind, knotsToMph, trendIcon, escapeHtml } from '../format.js';

let onPick = null;

export function initFavoritesPanel({ onSelect } = {}) {
  onPick = onSelect;
}

function stationById(id) {
  return TEXAS_STATIONS.find((s) => s.id === id);
}

export function openFavorites() {
  const body = document.getElementById('favorites-body');
  const ids = getFavoriteIds();

  if (!ids.length) {
    body.innerHTML = `<div class="panel-empty"><i class="ph ph-star"></i>No favorites yet.<br>Open a station and tap <i class="ph ph-plus-circle"></i> to add it.</div>`;
    openPanel('favorites-panel');
    return;
  }

  const stations = ids.map(stationById).filter(Boolean);
  body.innerHTML = stations.map((s) => `
    <div class="card fav-row" data-id="${s.id}" draggable="true">
      <div class="fav-top">
        <i class="ph ph-dots-six-vertical fav-handle"></i>
        <span class="fav-name">${escapeHtml(s.name)}</span>
        <i class="ph-bold ph-caret-right chev"></i>
      </div>
      <div class="fav-stats" id="fav-stats-${s.id}"><span style="color:var(--text-tertiary)">Loading…</span></div>
      <div class="chart-wrap fav-spark"><canvas id="fav-spark-${s.id}"></canvas></div>
    </div>`).join('');
  openPanel('favorites-panel');

  wireRows();
  stations.forEach(loadSummary);
}

async function loadSummary(station) {
  const unit = getSettings().windUnit;
  try {
    const [tideNow, curve, waterTemp, wind] = await Promise.all([
      fetchTideNow(station.id), fetch24HourCurve(station.id),
      fetchWaterTemp(station.id), fetchStationWind(station.id),
    ]);
    const statsEl = document.getElementById(`fav-stats-${station.id}`);
    if (statsEl) {
      const parts = [];
      if (tideNow) {
        const ti = trendIcon(tideNow.trend);
        parts.push(`<span class="stat-tide"><i class="${ti.icon} ${ti.cls}"></i>${tideNow.observed != null ? fmtFeet(tideNow.observed) : '—'} ${ti.label}</span>`);
      }
      if (waterTemp != null) parts.push(`<span style="color:var(--water-temp)"><i class="ph-fill ph-thermometer"></i> ${fmtDegrees(waterTemp)}</span>`);
      if (wind) parts.push(`<span style="color:var(--wind)"><i class="ph ph-wind"></i> ${fmtWind(knotsToMph(wind.speed), unit)} ${escapeHtml(wind.direction || '')}</span>`);
      statsEl.innerHTML = parts.join('') || '<span style="color:var(--text-tertiary)">No data</span>';
    }
    const canvas = document.getElementById(`fav-spark-${station.id}`);
    if (canvas && curve) {
      const pts = curve.predicted
        ? curve.predicted.times.map((t, i) => ({ time: t, ft: curve.predicted.heights[i] }))
        : (curve.observed ? curve.observed.times.map((t, i) => ({ time: t, ft: curve.observed.heights[i] })) : []);
      if (pts.length) renderSparkline(canvas, pts);
    }
  } catch (err) {
    const statsEl = document.getElementById(`fav-stats-${station.id}`);
    if (statsEl) statsEl.innerHTML = '<span style="color:var(--text-tertiary)">No data</span>';
  }
}

function wireRows() {
  const body = document.getElementById('favorites-body');
  let dragId = null;

  body.querySelectorAll('.fav-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.fav-handle')) return;
      const station = stationById(row.dataset.id);
      if (station && onPick) onPick(station);
    });
    row.addEventListener('dragstart', () => { dragId = row.dataset.id; row.classList.add('dragging'); });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); dragId = null; });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = body.querySelector('.dragging');
      if (!dragging || dragging === row) return;
      const rect = row.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      body.insertBefore(dragging, after ? row.nextSibling : row);
    });
    row.addEventListener('drop', () => {
      const ids = getFavoriteIds();
      const newOrder = [...body.querySelectorAll('.fav-row')].map((r) => r.dataset.id);
      const from = ids.indexOf(dragId);
      const to = newOrder.indexOf(dragId);
      if (from >= 0 && to >= 0 && from !== to) moveFavorite(from, to);
    });
  });
}
