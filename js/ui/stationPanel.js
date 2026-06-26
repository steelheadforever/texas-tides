// Station detail panel — the web equivalent of the iOS station sheet.
// Opens without moving the map. Reuses the existing API layer.

import { fetchTideNow, fetchNextTide, fetch24HourCurve, fetchWaterTemp, fetchWaterTempHistory, fetchAirTemp, fetchStationWind } from '../api/noaa.js';
import { fetchForecast12h, fetchPressure } from '../api/nws.js';
import { fetchSunMoonData } from '../api/usno.js';
import { renderTideCurve, renderWaterTemp } from './charts.js';
import { openPanel } from '../panels.js';
import { getSettings } from '../settings.js';
import { isFavorite, toggleFavorite } from '../favorites.js';
import {
  fmtTime, fmtFeet, fmtDegrees, fmtWind, knotsToMph,
  conditionIcon, trendIcon, pressureTrendIcon, moonIcon, escapeHtml,
} from '../format.js';

let currentStation = null;
let handlers = {};

export function initStationPanel({ onForecast, onSolunar } = {}) {
  handlers = { onForecast, onSolunar };

  document.getElementById('station-fav').addEventListener('click', () => {
    if (!currentStation) return;
    toggleFavorite(currentStation.id);
    updateFavButton();
  });
  document.getElementById('station-forecast').addEventListener('click', () => {
    if (currentStation && handlers.onForecast) handlers.onForecast(currentStation);
  });
  document.getElementById('station-solunar').addEventListener('click', () => {
    if (currentStation && handlers.onSolunar) handlers.onSolunar(currentStation);
  });
}

export function getCurrentStation() {
  return currentStation;
}

function updateFavButton() {
  const btn = document.getElementById('station-fav');
  const fav = currentStation && isFavorite(currentStation.id);
  btn.classList.toggle('fav-active', !!fav);
  btn.querySelector('i').className = fav ? 'ph-fill ph-star' : 'ph ph-plus-circle';
  btn.title = fav ? 'Remove from favorites' : 'Add to favorites';
}

export async function openStation(station) {
  currentStation = station;
  document.getElementById('station-title').textContent = station.name;
  updateFavButton();
  const body = document.getElementById('station-body');
  body.innerHTML = '<div class="loading">Loading station data</div>';
  openPanel('station-panel');

  const reqId = station.id;
  try {
    const [tideNow, nextTide, curve, waterTemp, waterTempHistory, airTemp, wind, windForecast, pressure, sunMoon] =
      await Promise.all([
        fetchTideNow(station.id), fetchNextTide(station.id), fetch24HourCurve(station.id),
        fetchWaterTemp(station.id), fetchWaterTempHistory(station.id, 24),
        fetchAirTemp(station.id, station.lat, station.lon), fetchStationWind(station.id),
        fetchForecast12h(station.lat, station.lon), fetchPressure(station.lat, station.lon),
        fetchSunMoonData(station.lat, station.lon),
      ]);

    // Station changed while loading — drop stale render.
    if (currentStation?.id !== reqId) return;

    const events = [nextTide?.first, nextTide?.second].filter(Boolean);
    const anyData = tideNow || curve || waterTemp != null || airTemp != null || wind || windForecast || pressure || sunMoon;
    if (!anyData) { body.innerHTML = offlineCard(); wireRetry(station); return; }

    body.innerHTML = [
      tideStatusCard(tideNow),
      nextTidesCard(events),
      curveCard(curve),
      tideNote(curve),
      conditionsGrid({ waterTemp, airTemp, wind, windForecast, pressure }),
      sunMoonCard(sunMoon),
      waterTempCard(waterTempHistory),
      `<div style="text-align:center;font-size:0.7rem;color:var(--text-tertiary);">NOAA Station ${escapeHtml(station.id)}</div>`,
    ].filter(Boolean).join('');

    requestAnimationFrame(() => {
      const curveCanvas = document.getElementById('sp-curve');
      if (curveCanvas && curve) renderTideCurve(curveCanvas, curve, events);
      const tempCanvas = document.getElementById('sp-temp');
      if (tempCanvas && waterTempHistory?.length >= 2) renderWaterTemp(tempCanvas, waterTempHistory);
    });
  } catch (err) {
    console.error('Station load failed:', err);
    if (currentStation?.id === reqId) { body.innerHTML = offlineCard(); wireRetry(station); }
  }
}

function wireRetry(station) {
  const btn = document.getElementById('sp-retry');
  if (btn) btn.addEventListener('click', () => openStation(station));
}

// ---- Cards ----------------------------------------------------------------

function card(label, iconClass, inner) {
  return `<div class="card">
    <div class="card-label"><i class="${iconClass}"></i>${label}</div>
    ${inner}
  </div>`;
}

function tideStatusCard(t) {
  if (!t) return '';
  const ti = trendIcon(t.trend);
  const stats = [];
  if (t.observed != null) stats.push(`<div class="stat"><span class="stat-label">Observed</span><span class="stat-value">${fmtFeet(t.observed)}</span></div>`);
  if (t.predicted != null) stats.push(`<div class="stat center"><span class="stat-label">Predicted</span><span class="stat-value">${fmtFeet(t.predicted)}</span></div>`);
  if (t.delta != null) {
    const alert = Math.abs(t.delta) > 0.5 ? ' alert' : '';
    const sign = t.delta >= 0 ? '+' : '';
    stats.push(`<div class="stat trailing"><span class="stat-label">Difference</span><span class="stat-value${alert}">${sign}${t.delta.toFixed(2)} ft</span></div>`);
  }
  if (!stats.length) return '';
  return card('Tide Status', 'ph-fill ph-waves', `
    <div class="stat-row">${stats.join('')}</div>
    <div class="trend-row">
      <i class="${ti.icon} ${ti.cls}"></i><span>${ti.label}</span>
      ${t.phaseText ? `<span class="sep">·</span><span class="phase">${escapeHtml(t.phaseText)}</span>` : ''}
    </div>`);
}

function nextTidesCard(events) {
  if (!events.length) return '';
  const rows = events.map((e) => {
    const high = e.kind === 'High';
    return `<div class="tide-event">
      <i class="ph-bold ${high ? 'ph-arrow-line-up' : 'ph-arrow-line-down'} te-kind ${high ? 'high' : 'low'}"></i>
      <span class="te-kind ${high ? 'high' : 'low'}">${e.kind}</span>
      <span>${fmtTime(e.time)}</span>
      <span class="te-height">${fmtFeet(e.ft)}</span>
    </div>`;
  }).join('');
  return card('Next Tides', 'ph ph-clock', rows);
}

// Small persistent reminder that the curve is predicted, not a guarantee.
// People plan on-the-water activities from this, so we keep it in view next to
// the readout (in addition to the first-run notice and the Terms).
function tideNote(curve) {
  if (!curve || curve.noPredictions) return '';
  return `<div class="sp-tide-note"><i class="ph ph-info"></i><span>Tide values are predictions — verify before relying on them for safety.</span></div>`;
}

function curveCard(curve) {
  if (!curve) return '';
  const label = curve.noPredictions ? 'Water Level (24h observed)' : '24-Hour Tide Curve';
  const legend = curve.observed && curve.predicted
    ? `<div class="chart-legend"><span><span class="dot" style="background:var(--tide)"></span>Predicted</span><span><span class="dot" style="background:var(--observed)"></span>Observed</span></div>`
    : '';
  return card(label, 'ph ph-chart-line', `<div class="chart-wrap"><canvas id="sp-curve"></canvas></div>${legend}`);
}

function condCard(head, iconClass, iconColorClass, value, detail, detailIcon) {
  return `<div class="cond-card">
    <div class="cond-head"><i class="${iconClass} ${iconColorClass}"></i>${head}</div>
    <div class="cond-value">${value}</div>
    ${detail ? `<div class="cond-detail">${detailIcon ? `<i class="${detailIcon}"></i> ` : ''}${detail}</div>` : '<div class="cond-detail">&nbsp;</div>'}
  </div>`;
}

function conditionsGrid({ waterTemp, airTemp, wind, windForecast, pressure }) {
  const unit = getSettings().windUnit;
  const cards = [];
  if (waterTemp != null) cards.push(condCard('Water Temp', 'ph-fill ph-thermometer', 'cond-icon-water', fmtDegrees(waterTemp)));
  if (airTemp != null) cards.push(condCard('Air Temp', 'ph-fill ph-thermometer-simple', 'cond-icon-air', fmtDegrees(airTemp)));
  if (wind) {
    const speed = knotsToMph(wind.speed);
    const gust = knotsToMph(wind.gust);
    cards.push(condCard('Wind Now', 'ph ph-wind', 'cond-icon-wind', `${fmtWind(speed, unit)} ${escapeHtml(wind.direction || '')}`,
      gust ? `Gusts ${fmtWind(gust, unit)}` : null));
  }
  if (windForecast && windForecast.avgSpeed != null) {
    cards.push(condCard('Wind Next 12h', 'ph ph-wind', 'cond-icon-wind', `${fmtWind(windForecast.avgSpeed, unit)} ${escapeHtml(windForecast.direction || '')}`,
      windForecast.maxSpeed != null ? `Up to ${fmtWind(windForecast.maxSpeed, unit)}` : null));
  }
  if (pressure) {
    cards.push(condCard('Pressure', 'ph-fill ph-gauge', 'cond-icon-pressure', `${pressure.value.toFixed(2)} inHg`,
      pressure.trend.charAt(0).toUpperCase() + pressure.trend.slice(1), pressureTrendIcon(pressure.trend)));
  }
  if (windForecast && windForecast.condition) {
    const ci = conditionIcon(windForecast.condition);
    cards.push(condCard('Sky', ci.icon, 'cond-icon-sun', escapeHtml(windForecast.condition)));
  }
  if (!cards.length) return '';
  return `<div class="cond-grid">${cards.join('')}</div>`;
}

function sunMoonCard(sm) {
  if (!sm) return '';
  const sun = sm.sun || {};
  const moon = sm.moon || {};
  return card('Sun & Moon', 'ph-fill ph-sun-horizon', `
    <div class="sunmoon-row">
      <div class="sunmoon-col">
        <span class="line"><i class="ph-fill ph-sun-horizon icon-sunrise"></i> ${escapeHtml(sun.rise || '—')}</span>
        <span class="line"><i class="ph-fill ph-sun-horizon icon-sunset"></i> ${escapeHtml(sun.set || '—')}</span>
      </div>
      <div class="sunmoon-col">
        <span class="line"><i class="${moonIcon(sm.moonPhase)}"></i> ${escapeHtml(sm.moonPhase || '—')}</span>
        <span class="line" style="color:var(--text-secondary)">↑ ${escapeHtml(moon.rise || '—')}&nbsp;&nbsp;↓ ${escapeHtml(moon.set || '—')}</span>
      </div>
    </div>`);
}

function waterTempCard(history) {
  if (!history || history.length < 2) return '';
  return card('Water Temp Trend (24h)', 'ph-fill ph-thermometer', `<div class="chart-wrap" style="height:120px"><canvas id="sp-temp"></canvas></div>`);
}

function offlineCard() {
  return `<div class="card">
    <div class="card-label"><i class="ph ph-wifi-slash"></i>No Data</div>
    <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:0.75rem;">Couldn't reach the tide service. Check your connection and try again.</p>
    <button class="btn btn-primary btn-block" id="sp-retry"><i class="ph-bold ph-arrow-clockwise"></i> Retry</button>
  </div>`;
}
