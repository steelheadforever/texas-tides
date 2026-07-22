// Station detail panel — the web equivalent of the iOS station sheet.
// Opens without moving the map. Reuses the existing API layer.

import { fetchTideNow, fetchNextTide, fetch24HourCurve, fetchWaterTemp, fetchWaterTempHistory, fetchAirTemp, fetchStationWind } from '../api/noaa.js';
import { fetchForecast12h, fetchPressure, fetchAlerts } from '../api/nws.js';
import { fetchSunMoonData } from '../api/usno.js';
import { renderTideCurve, renderWaterTemp } from './charts.js';
import { openPanel } from '../panels.js';
import { getSettings } from '../settings.js';
import { isFavorite, toggleFavorite } from '../favorites.js';
import {
  fmtTime, fmtDay, dayKey, fmtFeet, fmtDegrees, fmtWind, knotsToMph, setDisplayTz,
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
  // All times app-wide render in the selected station's local zone (falls
  // back to Central when the station has no tz, i.e. the legacy TX list).
  setDisplayTz(station.tz);
  document.getElementById('station-title').textContent = station.name;
  updateFavButton();
  const body = document.getElementById('station-body');
  body.innerHTML = '<div class="loading">Loading station data</div>';
  openPanel('station-panel');

  const reqId = station.id;
  try {
    // Stations without a predictions product (Great Lakes gauges) skip the
    // tide requests entirely — they'd all fail upstream. The curve endpoint
    // still runs for its observed water-level fallback.
    const hasPred = !station.products || station.products.includes('predictions');
    const hiloOnly = station.predType === 'S';
    const [tideNow, nextTide, curve, waterTemp, waterTempHistory, airTemp, wind, windForecast, pressure, sunMoon, alerts] =
      await Promise.all([
        hasPred ? fetchTideNow(station.id, station.tz, { hiloOnly }) : null,
        hasPred ? fetchNextTide(station.id, station.tz) : null,
        fetch24HourCurve(station.id, { hiloOnly, skipPredictions: !hasPred, tz: station.tz }),
        fetchWaterTemp(station.id), fetchWaterTempHistory(station.id, 24, station.tz),
        fetchAirTemp(station.id, station.lat, station.lon), fetchStationWind(station.id),
        fetchForecast12h(station.lat, station.lon), fetchPressure(station.lat, station.lon),
        fetchSunMoonData(station.lat, station.lon, new Date(), station.tz),
        fetchAlerts(station.lat, station.lon),
      ]);

    // Station changed while loading — drop stale render.
    if (currentStation?.id !== reqId) return;

    const events = [nextTide?.first, nextTide?.second].filter(Boolean);
    // Warnings first (worker-sorted). Not part of anyData — no alerts is the
    // normal, happy state, never "offline".
    const alertsHtml = alertStack(alerts || [], station.tz);
    const anyData = tideNow || curve || waterTemp != null || airTemp != null || wind || windForecast || pressure || sunMoon;
    // Even when every data fetch failed, surface any alerts that did arrive —
    // a NOAA outage during a gale is exactly when the banner matters.
    if (!anyData) { body.innerHTML = alertsHtml + offlineCard(); wireRetry(station); return; }

    body.innerHTML = [
      alertsHtml,
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
      if (curveCanvas && curve) renderTideCurve(curveCanvas, curve, events, { tz: station.tz });
      const tempCanvas = document.getElementById('sp-temp');
      if (tempCanvas && waterTempHistory?.length >= 2) renderWaterTemp(tempCanvas, waterTempHistory, { tz: station.tz });
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

// ---- NWS alert banners -----------------------------------------------------

// Banner tier from the event name — the NWS severity field can't rank
// products (every Small Craft Advisory is "Minor"). Mirrors iOS
// MarineAlert.Level.
function alertLevel(event) {
  if (/Warning$/.test(event)) return 'warning';
  if (/Watch$/.test(event)) return 'watch';
  return 'advisory';
}

// "until 9:00 PM" (station-local), adding the day when the end crosses a
// station-local midnight — "until 8:00 PM" at 10:53 PM must not mean tomorrow.
function alertUntil(alert, tz) {
  const end = new Date(alert.ends || alert.expires || NaN);
  if (isNaN(end)) return '';
  const time = fmtTime(end, tz);
  return dayKey(end, tz) === dayKey(new Date(), tz)
    ? `until ${time}`
    : `until ${fmtDay(end, tz)}, ${time}`;
}

// NWS body text arrives hard-wrapped (single newlines mid-paragraph, blank
// lines between paragraphs). Unwrap the lines, keep the paragraphs as <p>s.
function alertParagraphs(text) {
  return text.split('\n\n')
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
}

// One alert renders as its own banner; two or more collapse into a single
// summary banner (tinted by the worst alert) that expands to the full stack —
// eight stacked advisories must never bury the tide data.
function alertStack(alerts, tz) {
  if (!alerts.length) return '';
  if (alerts.length === 1) return alertBanner(alerts[0], tz);
  const worst = alertLevel(alerts[0].event); // worker sorts worst-first
  return `<details class="alert-banner alert-${worst}">
    <summary>
      <i class="ph-fill ph-warning"></i>
      <span class="alert-title">${alerts.length} Active Alerts<small>${escapeHtml(alerts[0].event)} + ${alerts.length - 1} more</small></span>
      <i class="ph-bold ph-caret-down alert-chevron"></i>
    </summary>
    <div class="alert-stack">${alerts.map((a) => alertBanner(a, tz)).join('')}</div>
  </details>`;
}

function alertBanner(alert, tz) {
  const level = alertLevel(alert.event);
  const until = alertUntil(alert, tz);
  const icon = level === 'advisory' ? 'ph-fill ph-warning-circle' : 'ph-fill ph-warning';
  const body = [alert.description, alert.instruction].filter(Boolean).map(alertParagraphs).join('');
  return `<details class="alert-banner alert-${level}">
    <summary>
      <i class="${icon}"></i>
      <span class="alert-title">${escapeHtml(alert.event)}${until ? `<small>${escapeHtml(until)}</small>` : ''}</span>
      <i class="ph-bold ph-caret-down alert-chevron"></i>
    </summary>
    <div class="alert-body">
      ${body}
      <div class="alert-source">Source: National Weather Service — not a substitute for official marine broadcasts.</div>
    </div>
  </details>`;
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
  const msg = curve.synthetic
    ? 'Curve estimated from NOAA high/low predictions — verify before relying on it for safety.'
    : 'Tide values are predictions — verify before relying on them for safety.';
  return `<div class="sp-tide-note"><i class="ph ph-info"></i><span>${msg}</span></div>`;
}

function curveCard(curve) {
  if (!curve) return '';
  const label = curve.noPredictions ? 'Water Level (24h observed)'
    : curve.synthetic ? '24-Hour Tide Curve (estimated)'
    : '24-Hour Tide Curve';
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
  // USNO reports 'N/A' when an event doesn't occur that day (e.g. no
  // moonrise) — render a dash instead of the raw sentinel.
  const t = (s) => (!s || s === 'N/A') ? '—' : s;
  return card('Sun & Moon', 'ph-fill ph-sun-horizon', `
    <div class="sunmoon-row">
      <div class="sunmoon-col">
        <span class="line"><i class="ph-fill ph-sun-horizon icon-sunrise"></i> ${escapeHtml(t(sun.rise))}</span>
        <span class="line"><i class="ph-fill ph-sun-horizon icon-sunset"></i> ${escapeHtml(t(sun.set))}</span>
      </div>
      <div class="sunmoon-col">
        <span class="line"><i class="${moonIcon(sm.moonPhase)}"></i> ${escapeHtml(t(sm.moonPhase))}</span>
        <span class="line" style="color:var(--text-secondary)">↑ ${escapeHtml(t(moon.rise))}&nbsp;&nbsp;↓ ${escapeHtml(t(moon.set))}</span>
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
